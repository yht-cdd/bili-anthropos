#!/usr/bin/env node
/**
 * bili-login.mjs —— 扫码登录 + 自动续期
 * ============================================================
 * 为什么要有这个：
 *
 *   手动从浏览器复制 Cookie 是最脆的一种办法。2026-10-30 实测：
 *   一份 SESSDATA 的过期戳写着 2027-04-28（还剩 179 天），
 *   结果在服务器上只活了 6 小时 46 分就变成 -101。
 *   不是过期，是被服务端作废 —— 浏览器那边一刷新、或者风控一动，
 *   复制出来的那份就作废了，而且**没有任何办法把它救回来**。
 *
 *   所以别复制 Cookie，扫码登录。扫一次，之后自己续。
 *
 * 走 TV 端（不是网页端），因为只有它会给 refresh_token：
 *   · refresh_token 有效期 180 天，每次刷新都会滚动续期
 *   · 会话和浏览器完全独立，你在电脑上登录不会把它踢掉
 *
 * 用法：
 *   node bili-login.mjs qr        生成二维码，等扫码（终端里也会打出来）
 *   node bili-login.mjs poll      继续等上一次生成的二维码（不重新生成）
 *   node bili-login.mjs refresh   用 refresh_token 换新的一套凭证
 *   node bili-login.mjs status    看现在是什么状态
 *
 * 退出码：0 成功 / 1 失败 / 2 参数错 / 3 等扫码超时
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || path.join(HOME, "secrets/bili_cookie.txt");
const STATE_FILE = path.join(HOME, "bili/data/login_state.json");
const LOG_FILE = path.join(HOME, "bili/logs/cookie.log");
const API = "https://passport.bilibili.com";

// TV 端（云视听小电视）内置的 appkey/appsec。这两个值在客户端里，公开且多年未变。
const APPKEY = "4409e2ce8ffd12b8";
const APPSEC = "59b43e04ad6965f34319062b478f83dd";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const REFRESH_AFTER_DAYS = 7;    // 每隔多久主动换一次（远小于 180 天，留足余量）

const log = (...a) => {
  const line = `[${new Date().toISOString()}] ${a.join(" ")}`;
  console.error(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {}
};

const out = (o) => console.log(JSON.stringify(o, null, 2));

// ── 签名 ──────────────────────────────────────────────
// B 站 app 接口的签名：参数按 key 排序拼 query，末尾接 appsec，取 md5。
function signed(params) {
  const all = { ...params, ts: String(Math.floor(Date.now() / 1000)) };
  const qs = Object.keys(all)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(all[k])}`)
    .join("&");
  return new URLSearchParams({ ...all, sign: crypto.createHash("md5").update(qs + APPSEC).digest("hex") });
}

async function post(pathname, params) {
  const r = await fetch(`${API}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: signed(params).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { code: -999, message: t.slice(0, 200) };
  }
}

// ── 状态文件 ──────────────────────────────────────────
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n", { mode: 0o600 });
}

// ── Cookie 读写 ───────────────────────────────────────
function readCookie() {
  try {
    return fs.readFileSync(COOKIE_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

/**
 * 把新凭证合并进现有 Cookie。
 * 只覆盖 B 站给的那几个；buvid3/b_nut/bili_ticket 这些留着不动 ——
 * 它们和账号无关，换了反而像新设备，容易招风控。
 */
function writeCookie(cookies) {
  const jar = new Map();
  for (const part of readCookie().split(";")) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  for (const c of cookies) {
    if (c && c.name) jar.set(c.name, c.value);
  }
  const line = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") + "\n";
  fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true });
  fs.writeFileSync(COOKIE_FILE, line, { mode: 0o600 });
  try {
    fs.chmodSync(COOKIE_FILE, 0o600);
  } catch {}
  return [...jar.keys()];
}

/** 记下这次凭证是从哪来的、什么时候，方便 status 判断该不该续 */
function rememberTokens(d, src) {
  const st = loadState();
  st.access_token = d.access_token;
  st.refresh_token = d.refresh_token;
  st.mid = String(d.mid || st.mid || "");
  st.token_at = Date.now();
  st.expires_at = d.expires_in ? Date.now() + Number(d.expires_in) * 1000 : st.expires_at;
  st.source = src;
  delete st.auth_code;      // 扫完了，这个码就作废了
  saveState(st);
  return st;
}

/** 用当前凭证问一下服务端：我们还是不是登录状态 */
async function checkLogin() {
  const c = readCookie();
  if (!c) return { ok: false, why: "没有 Cookie 文件" };
  try {
    const r = await fetch("https://api.bilibili.com/x/web-interface/nav", {
      headers: { "User-Agent": UA, Cookie: c, Referer: "https://www.bilibili.com/" },
      signal: AbortSignal.timeout(15_000),
    });
    const j = await r.json();
    return { ok: j.code === 0 && j.data?.isLogin === true, code: j.code, uname: j.data?.uname || "", mid: String(j.data?.mid || "") };
  } catch (e) {
    return { ok: false, why: e.message };
  }
}

// ── qr：生成二维码 ────────────────────────────────────
async function cmdQr() {
  const j = await post("/x/passport-tv-login/qrcode/auth_code", { appkey: APPKEY, local_id: "0" });
  if (j.code !== 0 || !j.data?.url) {
    out({ ok: false, step: "auth_code", code: j.code, message: j.message });
    process.exit(1);
  }
  const st = loadState();
  st.auth_code = j.data.auth_code;
  st.qr_at = Date.now();
  saveState(st);
  log(`生成二维码 auth_code=${j.data.auth_code.slice(0, 8)}…`);
  out({
    ok: true,
    url: j.data.url,
    auth_code: j.data.auth_code,
    expires_in: j.data.expires_in || 180,
    hint: "用 B 站手机 App 扫码。扫完跑 poll 收凭证。",
  });
}

// ── poll：等扫码 ──────────────────────────────────────
// 86038 二维码失效 / 86039 未确认 / 86101 未扫码 / 0 成功
async function cmdPoll({ waitSec = 180 } = {}) {
  const st = loadState();
  if (!st.auth_code) {
    out({ ok: false, why: "没有待扫码的二维码，先跑 qr" });
    process.exit(2);
  }
  const deadline = Date.now() + waitSec * 1000;
  let last = "";
  while (Date.now() < deadline) {
    const j = await post("/x/passport-tv-login/qrcode/poll", {
      appkey: APPKEY,
      auth_code: st.auth_code,
      local_id: "0",
    });
    if (j.code === 0 && j.data) {
      const keys = writeCookie(j.data.cookie_info?.cookies || []);
      rememberTokens(j.data, "qr");
      const ck = await checkLogin();
      log(`扫码成功 mid=${j.data.mid} cookie 字段 ${keys.length} 个`);
      out({
        ok: true,
        mid: String(j.data.mid),
        hasRefreshToken: !!j.data.refresh_token,
        expiresInDays: j.data.expires_in ? Math.round(j.data.expires_in / 86400) : null,
        cookieKeys: keys,
        loginCheck: ck,
      });
      process.exit(ck.ok ? 0 : 1);
    }
    if (j.code !== 86039 && j.code !== 86101) {
      out({ ok: false, step: "poll", code: j.code, message: j.message });
      process.exit(1);
    }
    const tag = `${j.code}:${j.message}`;
    if (tag !== last) {
      log(`等扫码… ${tag}`);
      last = tag;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  out({ ok: false, why: `等了 ${waitSec} 秒还没确认，二维码过期了，重跑 qr`, code: "timeout" });
  process.exit(3);
}

// ── refresh：自动续期 ─────────────────────────────────
async function cmdRefresh() {
  const st = loadState();
  if (!st.refresh_token || !st.access_token) {
    out({ ok: false, why: "没有 refresh_token，说明这份凭证是手动复制的 Cookie，续不了。跑 qr 扫一次码。" });
    process.exit(2);
  }
  const j = await post("/api/v2/oauth2/refresh_token", {
    appkey: APPKEY,
    access_key: st.access_token,
    refresh_token: st.refresh_token,
  });
  if (j.code !== 0 || !j.data) {
    out({ ok: false, step: "refresh", code: j.code, message: j.message });
    // -101 / -400 都表示 refresh_token 本身也过期了，只能重扫
    process.exit(1);
  }
  const keys = writeCookie(j.data.cookie_info?.cookies || []);
  rememberTokens(j.data, "refresh");
  const ck = await checkLogin();
  log(`续期成功${ck.ok ? "" : "（但 Cookie 仍然不通）"}`);
  out({
    ok: true,
    refreshed: true,
    cookieKeys: keys,
    expiresInDays: j.data.expires_in ? Math.round(j.data.expires_in / 86400) : null,
    loginCheck: ck,
  });
  process.exit(ck.ok ? 0 : 1);
}

// ── status ────────────────────────────────────────────
async function cmdStatus() {
  const st = loadState();
  const ck = await checkLogin();
  const ageDays = st.token_at ? Math.round((Date.now() - st.token_at) / 86400_000 * 10) / 10 : null;
  out({
    cookie: { ok: ck.ok, code: ck.code, uname: ck.uname, mid: ck.mid, why: ck.why },
    hasRefreshToken: !!st.refresh_token,
    source: st.source || "(未知，可能是手动复制)",
    tokenAgeDays: ageDays,
    refreshDue: st.token_at ? ageDays >= REFRESH_AFTER_DAYS : null,
    accessTokenExpiresInDays: st.expires_at ? Math.round((st.expires_at - Date.now()) / 86400_000) : null,
  });
  process.exit(ck.ok ? 0 : 1);
}

// ── 入口 ──────────────────────────────────────────────
const cmd = process.argv[2] || "status";
const waitIdx = process.argv.indexOf("--wait");
const waitSec = waitIdx > 0 ? Number(process.argv[waitIdx + 1]) || 180 : 180;

if (cmd === "qr") await cmdQr();
else if (cmd === "poll") await cmdPoll({ waitSec });
else if (cmd === "refresh") await cmdRefresh();
else if (cmd === "status") await cmdStatus();
else {
  console.error("用法: node bili-login.mjs [qr|poll|refresh|status] [--wait 秒]");
  process.exit(2);
}
