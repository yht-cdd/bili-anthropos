#!/usr/bin/env node
/**
 * bili-apply-cred.mjs —— 把扫码拿到的凭证装进服务器
 * ============================================================
 * 扫码在本地做（工具见 tools/scan-login.mjs），凭证要落到服务器上。
 * 这个脚本负责落地，顺便保证三件事：
 *
 *   ① 只覆盖 B 站给的那 5 个字段，buvid3 / b_nut / bili_ticket 原样保留
 *      —— 全换掉会让这台机器看起来像新设备，反而招风控
 *   ② refresh_token / access_token 必须都存下来，缺一个就等于白扫
 *   ③ 装上之后当场验一次 nav 接口，不通过就说"不通过"
 *
 * 用法：
 *   node bili-apply-cred.mjs /tmp/cred.json
 *   node bili-apply-cred.mjs /tmp/cred.json --quiet
 *
 * 输入可以是 TV 端 poll 的完整响应（带 data 层），也可以是 data 本身。
 * 退出码：0 装好且登录有效 / 1 装好但登录无效 / 2 输入不对
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || path.join(HOME, "secrets/bili_cookie.txt");
const STATE_FILE = path.join(HOME, "bili/data/login_state.json");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const argv = process.argv.slice(2);
const quiet = argv.includes("--quiet");
const src = argv.find((a) => !a.startsWith("--"));

if (!src) {
  console.error("用法: node bili-apply-cred.mjs <cred.json> [--quiet]");
  process.exit(2);
}

let raw;
try {
  const j = JSON.parse(fs.readFileSync(src, "utf8"));
  raw = j.data && j.data.cookie_info ? j.data : j;   // 兼容完整响应
} catch (e) {
  console.error(`❌ 读不了 ${src}：${e.message}`);
  process.exit(2);
}

const cookies = raw.cookie_info?.cookies || [];
const ti = raw.token_info || raw;

if (!cookies.length) {
  console.error("❌ 这份 JSON 里没有 cookie_info.cookies，不是扫码结果");
  process.exit(2);
}
if (!ti.access_token || !ti.refresh_token) {
  console.error(
    "❌ 缺 access_token 或 refresh_token。\n" +
    "   少了它们就只能登录、不能续期，等于扫了个一次性的码。\n" +
    `   实际拿到：${Object.keys(ti).join(", ")}\n` +
    "   （Cookie 仍然会装上，现在能用，只是以后要重扫）"
  );
}

// ① 合并 Cookie
const jar = new Map();
try {
  for (const part of fs.readFileSync(COOKIE_FILE, "utf8").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
} catch {}
const kept = new Set(jar.keys());
for (const c of cookies) if (c?.name) jar.set(c.name, c.value);

fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true });
fs.writeFileSync(COOKIE_FILE, [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") + "\n", { mode: 0o600 });
try { fs.chmodSync(COOKIE_FILE, 0o600); } catch {}

// ② 写 token state
let st = {};
try { st = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch {}
if (ti.access_token) st.access_token = ti.access_token;
if (ti.refresh_token) st.refresh_token = ti.refresh_token;
if (raw.mid || ti.mid) st.mid = String(raw.mid || ti.mid);
st.token_at = Date.now();
const ttl = ti.expires_in || raw.expires_in;
if (ttl) st.expires_at = Date.now() + Number(ttl) * 1000;
st.source = "qr";
delete st.auth_code;
delete st.qr_at;

fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2) + "\n", { mode: 0o600 });
try { fs.chmodSync(STATE_FILE, 0o600); } catch {}

// ③ 当场验活
async function check() {
  try {
    const r = await fetch("https://api.bilibili.com/x/web-interface/nav", {
      headers: { "User-Agent": UA, Cookie: fs.readFileSync(COOKIE_FILE, "utf8").trim(), Referer: "https://www.bilibili.com/" },
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    return { ok: j.code === 0 && j.data?.isLogin === true, code: j.code, uname: j.data?.uname || "", mid: String(j.data?.mid || "") };
  } catch (e) {
    return { ok: false, why: e.message };
  }
}
const ck = await check();

const report = {
  ok: ck.ok,
  cookieFields: jar.size,
  overwritten: cookies.map((c) => c.name).filter((n) => kept.has(n)),
  added: cookies.map((c) => c.name).filter((n) => !kept.has(n)),
  renewable: Boolean(st.access_token && st.refresh_token),
  expiresInDays: st.expires_at ? Math.round((st.expires_at - Date.now()) / 86400_000) : null,
  login: ck,
};

if (quiet) {
  console.log(ck.ok ? "ok" : "failed");
} else {
  console.log(JSON.stringify(report, null, 2));
  if (ck.ok && report.renewable) {
    console.log("\n✅ 装好了，而且能自动续期。这次扫完就不用再管了。");
  } else if (ck.ok) {
    console.log("\n⚠️ Cookie 能用，但没有续期凭据 —— 过一阵还得重扫。");
  } else {
    console.log("\n❌ Cookie 装上了但登录不通，检查一下服务器出口 IP 有没有被风控。");
  }
}

process.exit(ck.ok ? 0 : 1);
