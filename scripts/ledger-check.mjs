#!/usr/bin/env node
/**
 * ledger-check.mjs —— 对账：B 站会话里的外发私信 vs sends 表
 * ============================================================
 * 账本的唯一真相是 B 站会话接口，sends 只是副本。
 * 这个脚本按「时间戳 + 原文」逐条比对，缺了就报，--fix 才补。
 *
 * 用法：
 *   node ledger-check.mjs                 # 查今天
 *   node ledger-check.mjs --day 2026-10-30
 *   node ledger-check.mjs --fix           # 把缺的补进 sends（kind=dm_reply）
 *
 * 退出码：0 = 对得上；1 = 有差异
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || path.join(HOME, "secrets/bili_cookie.txt");
const DB_FILE = path.join(HOME, "bili/data/bili.db");
const OWNER_FILE = path.join(HOME, "secrets/owner_uid.txt");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else {
      opt[argv[i].slice(2)] = v;
      i += 1;
    }
  }
}
if (opt.help) {
  console.log("用法: node ledger-check.mjs [--day YYYY-MM-DD] [--fix]");
  process.exit(0);
}

const day = String(opt.day || new Date().toLocaleDateString("sv-SE"));
const at = (sec) => new Date(Number(sec) * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
const start = Math.floor(new Date(`${day}T00:00:00+08:00`).getTime() / 1000);
const end = start + 86_400;

const cookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const selfUid = (cookie.match(/DedeUserID=(\d+)/) || [])[1];
const ownerUid = fs.readFileSync(OWNER_FILE, "utf8").trim().split(/\s+/)[0];
if (!selfUid || !ownerUid) {
  console.error("❌ 读不到 self UID 或主人 UID");
  process.exit(2);
}

const u = new URL("https://api.vc.bilibili.com/svr_sync/v1/svr_sync/fetch_session_msgs");
u.searchParams.set("session_type", "1");
u.searchParams.set("talker_id", ownerUid);
u.searchParams.set("size", "50");
const r = await fetch(u, {
  headers: { "User-Agent": UA, Referer: "https://message.bilibili.com/", Cookie: cookie },
  signal: AbortSignal.timeout(20_000),
});
const j = await r.json().catch(() => ({ code: -998 }));
if (j.code !== 0) {
  console.error(`❌ 会话接口失败 code=${j.code} ${j.message || ""}`);
  process.exit(2);
}

const api = (j.data?.messages || [])
  .filter((m) => String(m.sender_uid) === selfUid)
  .map((m) => {
    let text = m.content;
    try {
      text = JSON.parse(text).content ?? text;
    } catch {}
    return {
      ms: Number(m.timestamp),   // 秒 —— sends.sent_at 全表约定用秒（2026-10-31 统一）
      text: String(text),
      key: String(m.msg_key || ""),
    };
  })
  .filter((m) => m.ms >= start && m.ms < end);

const db = new DatabaseSync(DB_FILE, { readOnly: !opt.fix });
const rows = db.prepare("SELECT id, text, rpid, sent_at FROM sends WHERE sent_at >= ? AND sent_at < ?").all(start, end);

const keyOf = (ms, text) => `${ms}|${text}`;
const apiKeys = new Map();
for (const m of api) {
  const k = keyOf(m.ms, m.text);
  apiKeys.set(k, (apiKeys.get(k) || 0) + 1);
}
const dbKeys = new Map();
for (const row of rows) {
  const k = keyOf(row.sent_at, row.text);
  dbKeys.set(k, (dbKeys.get(k) || 0) + 1);
}

const missing = api.filter((m) => (apiKeys.get(keyOf(m.ms, m.text)) || 0) > (dbKeys.get(keyOf(m.ms, m.text)) || 0));
const extra = rows.filter((row) => (dbKeys.get(keyOf(row.sent_at, row.text)) || 0) > (apiKeys.get(keyOf(row.sent_at, row.text)) || 0));

let fixed = 0;
if (opt.fix && missing.length) {
  const w = new DatabaseSync(DB_FILE);
  const ins = w.prepare(`
    INSERT INTO sends(event_id, kind, target, user_id, text, rpid, sent_at, ok)
    VALUES(?,?,?,?,?,?,?,?)
  `);
  for (const m of missing) {
    ins.run("", "dm_reply", "owner", String(ownerUid), m.text, m.key, m.ms, 1);
    fixed += 1;
  }
  w.close();
}
db.close();

console.log(
  JSON.stringify(
    {
      day,
      apiOutgoing: api.length,
      sendsRows: rows.length,
      missing: missing.length,
      extra: extra.length,
      fixed,
      ok: missing.length === 0 && extra.length === 0,
    },
    null,
    2
  )
);
if (missing.length) for (const m of missing) console.log(`  缺: ${at(m.ms)} | ${m.text.slice(0, 60).replace(/\n/g, " ")}`);
if (extra.length) for (const x of extra) console.log(`  多: ${at(x.sent_at)} | id=${x.id} | ${x.text.slice(0, 60).replace(/\n/g, " ")}`);

process.exit(missing.length === 0 && extra.length === 0 ? 0 : 1);
