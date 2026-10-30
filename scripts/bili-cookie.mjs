#!/usr/bin/env node
/**
 * bili-cookie.mjs — B站 Cookie 生命周期管理器
 *
 * 为什么需要它：
 *   SESSDATA 名义 30 天，但每次带它请求会滑动续期 → 只要每天保活就永续
 *   bili_ticket 只有 3 天，但可以用 HMAC 签名自动刷新
 *   buvid3/4 约 1 年，缺失时可重新申请
 *
 * 用法：
 *   node bili-cookie.mjs check      只检查，不修改
 *   node bili-cookie.mjs all        检查 + 刷新 ticket + 保活 + 写回
 *
 * 退出码：0 健康 / 1 需要人工介入（SESSDATA 失效）/ 2 网络错误
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const COOKIE_FILE = process.env.BILI_COOKIE_FILE || "/opt/life/secrets/bili_cookie.txt";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const TICKET_KEY = "XgwSnGZ1p"; // B站 web ticket 签名固定密钥（多年未变）
const TICKET_TTL_WARN = 6 * 3600; // 剩余 < 6 小时就刷新

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);

function parseCookie(str) {
  const o = {};
  for (const part of str.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    o[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return o;
}
function toCookie(o) {
  return Object.entries(o).map(([k, v]) => `${k}=${v}`).join("; ");
}
function load() {
  if (!fs.existsSync(COOKIE_FILE)) throw new Error(`Cookie 文件不存在: ${COOKIE_FILE}`);
  return parseCookie(fs.readFileSync(COOKIE_FILE, "utf8").trim());
}
function save(o) {
  fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true });
  fs.writeFileSync(COOKIE_FILE, toCookie(o), { encoding: "utf8", mode: 0o600 });
  log("已写回", COOKIE_FILE);
}

async function api(url, jar, opts = {}) {
  const r = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      "User-Agent": UA,
      Referer: "https://www.bilibili.com/",
      Origin: "https://www.bilibili.com",
      Cookie: toCookie(jar),
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(opts.timeout || 15000),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: r.status, json, text, setCookie: r.headers.getSetCookie?.() || [] };
}

/** 1. 登录态检查 */
async function check(jar) {
  const { json } = await api("https://api.bilibili.com/x/web-interface/nav", jar);
  if (!json) return { ok: false, reason: "nav 返回非 JSON" };
  if (json.code !== 0 || !json.data?.isLogin) {
    return { ok: false, reason: `code=${json.code} ${json.message || ""}`, code: json.code };
  }
  return {
    ok: true,
    uname: json.data.uname,
    mid: json.data.mid,
    level: json.data.level_info?.current_level,
    coins: json.data.money,
    vipStatus: json.data.vipStatus,
  };
}

/** 2. bili_ticket 状态（从 JWT payload 读 exp，无需发请求） */
function ticketStatus(jar) {
  const t = jar.bili_ticket;
  if (!t) return { exists: false, exp: 0, remaining: 0 };
  try {
    const payload = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString("utf8"));
    const exp = payload.exp || 0;
    return { exists: true, exp, remaining: exp - Math.floor(Date.now() / 1000) };
  } catch {
    return { exists: true, exp: 0, remaining: 0, corrupt: true };
  }
}

/** 3. 刷新 bili_ticket */
async function refreshTicket(jar) {
  const ts = Math.floor(Date.now() / 1000);
  const hexsign = crypto.createHmac("sha256", TICKET_KEY).update(`ts${ts}`).digest("hex");
  const csrf = jar.bili_jct || "";
  const url = `https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?key_id=ec02&hexsign=${hexsign}&context%5Bts%5D=${ts}&csrf=${csrf}`;
  const { json } = await api(url, jar, { method: "POST" });
  if (json?.code === 0 && json.data?.ticket) {
    jar.bili_ticket = json.data.ticket;
    jar.bili_ticket_expires = String(json.data.created_at + json.data.ttl);
    return { ok: true, ttl: json.data.ttl, expires: json.data.created_at + json.data.ttl };
  }
  return { ok: false, code: json?.code, msg: json?.message };
}

/** 4. buvid 补全 */
async function ensureBuvid(jar) {
  if (jar.buvid3) return { ok: true, existed: true };
  const { json } = await api("https://api.bilibili.com/x/frontend/finger/spi", jar);
  if (json?.code === 0 && json.data?.b_3) {
    jar.buvid3 = json.data.b_3;
    jar.buvid4 = json.data.b_4 || jar.buvid4;
    if (!jar.b_nut) jar.b_nut = String(Math.floor(Date.now() / 1000));
    return { ok: true, existed: false };
  }
  return { ok: false };
}

/** 5. 保活（触发 SESSDATA 滑动续期） */
async function keepAlive(jar) {
  const hits = [
    "https://api.bilibili.com/x/web-interface/nav",
    "https://api.bilibili.com/x/relation/stat?vmid=" + (jar.DedeUserID || "1"),
  ];
  let renewed = false;
  for (const u of hits) {
    const { setCookie } = await api(u, jar);
    for (const sc of setCookie) {
      const m = sc.match(/^([^=]+)=([^;]*)/);
      if (m && /^(SESSDATA|bili_jct|buvid3|buvid4|b_nut|_uuid|bili_ticket)/.test(m[1])) {
        if (jar[m[1]] !== m[2]) renewed = true;
        jar[m[1]] = m[2];
      }
    }
  }
  return { ok: true, renewed };
}

// ── main ─────────────────────────────────────────────
const cmd = process.argv[2] || "check";

try {
  const jar = load();
  log(`加载 Cookie：${Object.keys(jar).length} 个字段`);

  const st = await check(jar);
  if (!st.ok) {
    console.error(`\n❌ 登录态失效：${st.reason}`);
    console.error(`   code=-101 → SESSDATA 过期或被踢，需要人工扫码`);
    console.error(`   code=-352 → 风控，补 buvid 后重试`);
    process.exit(1);
  }
  log(`✅ 登录有效：${st.uname} (uid ${st.mid}) Lv${st.level} 硬币 ${st.coins}`);

  const tk = ticketStatus(jar);
  log(`bili_ticket: ${tk.exists ? `剩余 ${(tk.remaining / 3600).toFixed(1)} 小时` : "不存在"}`);

  if (cmd === "check") {
    process.exit(0);
  }

  // all
  const bv = await ensureBuvid(jar);
  log(`buvid: ${bv.ok ? (bv.existed ? "已存在" : "已补全") : "补全失败"}`);

  if (!tk.exists || tk.remaining < TICKET_TTL_WARN) {
    const rt = await refreshTicket(jar);
    if (rt.ok) log(`✅ ticket 已刷新，新有效期 ${(rt.ttl / 86400).toFixed(1)} 天`);
    else log(`⚠️ ticket 刷新失败 code=${rt.code} ${rt.msg || ""}`);
  } else {
    log("ticket 仍充足，跳过刷新");
  }

  const ka = await keepAlive(jar);
  log(`保活完成${ka.renewed ? "，Cookie 已更新" : "，无变化"}`);

  save(jar);
  process.exit(0);
} catch (e) {
  console.error("❌ 异常:", e.message);
  process.exit(2);
}
