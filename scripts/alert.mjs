#!/usr/bin/env node
/**
 * alert.mjs —— 出事了，让她能主动找到人
 * ============================================================
 * 之前的告警只写 /opt/life/ALERT.md —— 没人会去看那个文件。
 * 这个脚本把「她出事了」变成一封真的邮件，发到主人自己的邮箱。
 *
 * 通道：
 *   主路：AgentSend（anthropos@agentsend.io → 主人邮箱），已实测可投外部地址
 *   备路：邮件发不出去时，把日志传夸克网盘，把分享链接再试发一次
 *   兜底：两条都不通，写 ALERT.md 并落日志（至少留下证据）
 *
 * 为什么要去重：
 *   同一个故障每 12 秒弹一封，主人会直接把她的邮件全部静音 —— 那比不发更糟。
 *   同类告警 30 分钟内只发一次（--urgent 可突破）。
 *
 * 用法：
 *   node alert.mjs "Cookie 失效" "刷新一下，我停了" 
 *   node alert.mjs "大脑离线 10 分钟" "opencode 没起来" --urgent
 *   node alert.mjs "..." "..." --file /opt/life/bili/logs/bridge.log
 *   node alert.mjs "..." "..." --dry
 *
 * 退出码：0 已发 / 1 没发出去 / 2 参数错
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const API = "https://api.agentsend.io";
const KEY_FILE = path.join(HOME, "secrets/agentsend_token.txt");
const EMAIL_FILE = path.join(HOME, "secrets/owner_email.txt");
const INBOX = process.env.ANTHROPOS_INBOX || "9857a963-aeee-4056-b101-adbfc5dc3a0d";
const STATE_FILE = path.join(HOME, "bili/data/alert_state.json");
const LOG_FILE = path.join(HOME, "exec/alert.log");

const argv = process.argv.slice(2);
const opt = {};
let title = "";
let body = "";
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  } else positional.push(argv[i]);
}
title = positional[0] || "";
body = positional[1] || "";

const DEDUP_MS = 30 * 60_000;

function keyFile() {
  try { return fs.readFileSync(KEY_FILE, "utf8").trim(); } catch { return ""; }
}
function ownerEmail() {
  const env = String(process.env.OWNER_EMAIL || "").trim();
  if (env) return env;
  try { return fs.readFileSync(EMAIL_FILE, "utf8").trim(); } catch { return ""; }
}
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}
function saveState(s) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n");
  } catch {}
}
function note(line) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} | ${line}\n`);
  } catch {}
}

async function sendMail(subject, text) {
  const key = keyFile();
  if (!key) return { ok: false, why: "没有 agentsend_token.txt" };
  const to = ownerEmail();
  if (!to) return { ok: false, why: "没有 owner_email.txt / OWNER_EMAIL" };

  const r = await fetch(`${API}/inboxes/${INBOX}/messages`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ to: [to], subject, bodyText: text }),
    signal: AbortSignal.timeout(60_000),
  });
  const t = await r.text();
  let j = {};
  try { j = JSON.parse(t); } catch {}
  if (r.status >= 300 || !j.id) return { ok: false, why: `HTTP ${r.status} ${t.slice(0, 160)}` };
  return { ok: true, id: j.id, to };
}

/** 邮件不通时的备路：日志传夸克，把分享链接塞进邮件正文再试一次 */
function quarkFallback(file) {
  if (!file || !fs.existsSync(file)) return "";
  try {
    const out = execSync(`OPENCLAW_CLI=1 quark upload "${file}" --share --url-type 1 --expired-type 1`, {
      encoding: "utf8",
      timeout: 120_000,
    }).trim();
    const m = out.match(/https:\/\/pan\.quark\.cn\/s\/\S+/);
    return m ? m[0] : "";
  } catch (e) {
    note(`夸克兜底失败：${String(e.message).slice(0, 120)}`);
    return "";
  }
}

(async () => {
  if (!title) {
    console.error('用法: node alert.mjs "标题" "正文" [--urgent] [--file 日志] [--dry]');
    process.exit(2);
  }

  const state = loadState();
  const rec = state[title];
  if (!opt.urgent && rec && Date.now() - Number(rec.at || 0) < DEDUP_MS) {
    console.log(`（同类告警 30 分钟内已发过，跳过：${title}）`);
    process.exit(0);
  }

  const stamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const text = [
    body || "（没写正文）",
    "",
    "---",
    `时间：${stamp}`,
    `主机：她所在的那台机器`,
    opt.file ? `附件说明：日志在服务器 ${opt.file}（邮件不带附件，需要贴上来再发一次）` : "",
    "",
    "这封是她自己发的：桥接或大脑出了她处理不了的事，才会走这条路。",
  ].filter(Boolean).join("\n");

  if (opt.dry) {
    console.log(JSON.stringify({ dry: true, to: ownerEmail() || "(未配置)", subject: `[Anthropos 告警] ${title}`, text }, null, 2));
    process.exit(0);
  }

  let r = await sendMail(`[Anthropos 告警] ${title}`, text);

  if (!r.ok) {
    note(`主路失败：${r.why}`);
    const link = quarkFallback(opt.file);
    if (link) {
      r = await sendMail(`[Anthropos 告警] ${title}（附网盘）`, `${text}\n\n日志/文件：${link}`);
    }
  }

  if (r.ok) {
    state[title] = { at: Date.now(), count: Number(rec?.count || 0) + 1 };
    saveState(state);
    note(`已发「${title}」→ ${r.to}`);
    console.log(JSON.stringify({ ok: true, id: r.id, to: r.to, subject: `[Anthropos 告警] ${title}` }));
    process.exit(0);
  }

  // 两条都不通：至少留证据
  note(`全部失败：${title} | ${r.why}`);
  try {
    fs.appendFileSync(
      path.join(HOME, "ALERT.md"),
      `\n## ${stamp} · ${title}\n\n${text}\n\n> 邮件也没发出去：${r.why}\n`
    );
  } catch {}
  console.error(`❌ 告警没发出去：${r.why}`);
  process.exit(1);
})();
