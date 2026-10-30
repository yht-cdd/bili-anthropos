#!/usr/bin/env node
/**
 * bili-dm.mjs —— 发 B 站私信（只允许发给主人）
 * ============================================================
 * 为什么写死只能发给主人：
 *   私信是 B 站风控最凶的接口（判营销/骚扰）。
 *   能力越窄越安全 —— 这个工具从设计上就发不出去给第二个人。
 *
 * 用法：
 *   node bili-dm.mjs "消息内容"
 *   node bili-dm.mjs "消息内容" --dry
 *
 * 主人 UID 来源：环境变量 OWNER_UID > $LIFE_HOME/secrets/owner_uid.txt
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || path.join(HOME, "secrets/bili_cookie.txt");
const OWNER_FILE = path.join(HOME, "secrets/owner_uid.txt");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const argv = process.argv.slice(2);
const dry = argv.includes("--dry");
const text = argv.find((a) => !a.startsWith("--")) || "";

if (!text) {
  console.error('用法: node bili-dm.mjs "消息内容" [--dry]');
  process.exit(2);
}

function ownerUid() {
  const env = String(process.env.OWNER_UID || "").trim();
  if (env) return env;
  try {
    return fs.readFileSync(OWNER_FILE, "utf8").trim().split(/\s+/)[0];
  } catch {
    return "";
  }
}

const OWNER = ownerUid();
if (!/^\d{6,}$/.test(OWNER)) {
  console.error(`❌ 读不到主人 UID（${OWNER_FILE}）。这个工具只发给主人，没有主人 UID 就不发。`);
  process.exit(1);
}

const cookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const jar = {};
for (const kv of cookie.split(";")) {
  const i = kv.indexOf("=");
  if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
}
const SELF = jar.DedeUserID || "";
const CSRF = jar.bili_jct || "";
const DEV = String(jar.buvid3 || "").slice(0, 36).toUpperCase();

if (!SELF || !CSRF) {
  console.error("❌ Cookie 缺 DedeUserID 或 bili_jct");
  process.exit(1);
}

const clean = String(text).trim();
if (clean.length > 900) {
  console.error(`❌ 消息太长（${clean.length} 字），B 站私信上限约 900`);
  process.exit(1);
}

if (dry) {
  console.log(JSON.stringify({ dry: true, to: `owner(${OWNER.length}位)`, len: clean.length, preview: clean.slice(0, 120) }, null, 2));
  process.exit(0);
}

const form = new URLSearchParams({
  "msg[sender_uid]": SELF,
  "msg[receiver_id]": OWNER, // 写死：只能发给主人
  "msg[receiver_type]": "1",
  "msg[msg_type]": "1",
  "msg[dev_id]": DEV,
  "msg[timestamp]": String(Math.floor(Date.now() / 1000)),
  "msg[content]": JSON.stringify({ content: clean }),
  csrf: CSRF,
});

const r = await fetch("https://api.vc.bilibili.com/web_im/v1/web_im/send_msg", {
  method: "POST",
  headers: {
    "User-Agent": UA,
    Referer: "https://message.bilibili.com/",
    Origin: "https://message.bilibili.com",
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookie,
  },
  body: form.toString(),
  signal: AbortSignal.timeout(20_000),
});
const j = await r.json().catch(() => ({ code: -998 }));
if (j.code === 0) {
  console.log(JSON.stringify({ ok: true, msg_key: j.data?.msg_key, len: clean.length }));
  try {
    fs.appendFileSync(
      path.join(HOME, "exec/bridge.log"),
      `${new Date().toISOString()} | 主动私信 | ${clean.replace(/\n/g, " ").slice(0, 50)} | 成功 | 0s | ${clean.length}字\n`
    );
  } catch {}
} else {
  console.error(`❌ 发送失败 code=${j.code} ${j.message || ""}`);
  process.exit(1);
}
