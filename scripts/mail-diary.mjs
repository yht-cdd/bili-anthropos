#!/usr/bin/env node
/**
 * mail-diary.mjs —— 每天把日记完整寄到主人邮箱
 * ============================================================
 * 为什么要有这个：
 *   日记写在服务器上，主人不会天天 ssh 上来看。写完就发走，
 *   等于每天给他一份「她今天到底干了什么」的原始记录。
 *
 * 两条硬规矩：
 *   1. **完整**，不是摘要 —— 摘要会丢掉「她怎么想的」那部分
 *   2. **一天只发一次** —— 桥接重启、日切重跑都不能重复发
 *
 * 用法：
 *   node mail-diary.mjs                 # 发昨天的（0 点日切后用这个）
 *   node mail-diary.mjs --date 2026-10-30
 *   node mail-diary.mjs --date 2026-10-30 --force   # 忽略去重
 *   node mail-diary.mjs --dry
 *
 * 退出码：0 已发/无需发 / 1 失败
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const API = "https://api.agentsend.io";
const KEY_FILE = path.join(HOME, "secrets/agentsend_token.txt");
const EMAIL_FILE = path.join(HOME, "secrets/owner_email.txt");
const INBOX = process.env.ANTHROPOS_INBOX || "9857a963-aeee-4056-b101-adbfc5dc3a0d";
const STATE_FILE = path.join(HOME, "bili/data/diary_mail.json");
const DIARY_DIR = path.join(HOME, "diary");

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  }
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv-SE");
}
const date = String(opt.date || yesterday());

function key() {
  try { return fs.readFileSync(KEY_FILE, "utf8").trim(); } catch { return ""; }
}
function ownerEmail() {
  const env = String(process.env.OWNER_EMAIL || "").trim();
  if (env) return env;
  try { return fs.readFileSync(EMAIL_FILE, "utf8").trim(); } catch { return ""; }
}
function state() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}

const file = path.join(DIARY_DIR, `${date}.md`);
if (!fs.existsSync(file)) {
  console.log(`（${date} 没有日记，跳过）`);
  process.exit(0);
}

const st = state();
if (!opt.force && st.lastSentDate === date) {
  console.log(`（${date} 的日记已经发过了，跳过）`);
  process.exit(0);
}

const body = fs.readFileSync(file, "utf8").trim();
if (!body) {
  console.log(`（${date} 日记是空的，跳过）`);
  process.exit(0);
}

const subject = `[日记] ${date} · Anthropos`;
const text = [
  body,
  "",
  "---",
  `这是 ${date} 的完整日记，共 ${body.length} 字。`,
  "没有摘要 —— 摘要会丢掉「我为什么这么想」那部分。",
].join("\n");

if (opt.dry) {
  console.log(JSON.stringify({ dry: true, to: ownerEmail() || "(未配置)", subject, chars: body.length }, null, 2));
  process.exit(0);
}

const k = key();
const to = ownerEmail();
if (!k) { console.error("❌ 没有 agentsend_token.txt"); process.exit(1); }
if (!to) { console.error("❌ 没有 owner_email.txt"); process.exit(1); }
if (body.length > 200_000) {
  console.error(`⚠️ 日记 ${body.length} 字，超过 20 万，先截断再发`);
}

const r = await fetch(`${API}/inboxes/${INBOX}/messages`, {
  method: "POST",
  headers: { "x-api-key": k, "Content-Type": "application/json" },
  body: JSON.stringify({ to: [to], subject, bodyText: text.slice(0, 200_000) }),
  signal: AbortSignal.timeout(90_000),
});
const t = await r.text();
let j = {};
try { j = JSON.parse(t); } catch {}

if (r.status >= 300 || !j.id) {
  console.error(`❌ 发送失败 HTTP ${r.status}：${t.slice(0, 200)}`);
  process.exit(1);
}

fs.writeFileSync(STATE_FILE, JSON.stringify({ lastSentDate: date, at: new Date().toISOString(), id: j.id }, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, date, to, chars: body.length, id: j.id }, null, 2));
