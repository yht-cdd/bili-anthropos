#!/usr/bin/env node
/**
 * publish-project.mjs —— 工程文档归档（本地端）
 * ============================================================
 * 每完成一个工程，把文档发给云端的她。
 *
 * 为什么强制过滤：
 *   邮件出了容器就不可控。被"删掉敏感部分继续发"的文档，
 *   往往语义已经断了 —— 读者看到的是残缺的因果。
 *   所以命中就拒发，让人先把文档改干净。
 *
 * 用法：
 *   node publish-project.mjs <文档路径> [--name "工程名"] [--dry]
 *   node publish-project.mjs <文档路径> --force    # 明知有敏感词仍要发
 *
 * 凭据：环境变量 AGENTSEND_KEY，或 secrets/agentsend_token.txt
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = process.env.USERPROFILE || os.homedir();
const KEY_FILE = process.env.AGENTSEND_KEY_FILE || path.join(HOME, ".config", "opencode", "secrets", "agentsend_token.txt");
const FROM_INBOX = "5c7c5925-52da-4838-afb3-4afd6ed31260"; // local-agent@agentsend.io
const TO = ["anthropos@agentsend.io"];
const API = "https://api.agentsend.io";

const argv = process.argv.slice(2);
const opt = {};
let file = "";
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else {
      opt[argv[i].slice(2)] = v;
      i += 1;
    }
  } else if (!file) file = argv[i];
}

if (!file || !fs.existsSync(file)) {
  console.error("用法: node publish-project.mjs <文档路径> [--name 工程名] [--dry] [--force]");
  process.exit(2);
}

function apiKey() {
  const env = String(process.env.AGENTSEND_KEY || "").trim();
  if (env) return env;
  try {
    return fs.readFileSync(KEY_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

// ── 敏感扫描 ──────────────────────────────────────────
// 只认"具体形态"，不认词。文档里写「服务器 IP」没问题，
// 写 "203.0.113.1" 才有问题。
const HARD = [
  { name: "IPv4 地址", re: /\b(?!(?:127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.255)\b)(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { name: "AgentSend key", re: /\bask_[A-Za-z0-9]{20,}/g },
  { name: "魔搭 token", re: /\bms-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/g },
  { name: "HuggingFace token", re: /\bhf_[A-Za-z0-9]{30,}/g },
  { name: "OpenAI 风格 key", re: /\bsk-[A-Za-z0-9]{20,}/g },
  { name: "夸克授权码", re: /\bAAC-[0-9a-f]{20,}/gi },
  { name: "Cookie SESSDATA", re: /SESSDATA=[A-Za-z0-9%]{20,}/g },
  { name: "Cookie bili_jct", re: /bili_jct=[0-9a-f]{28,}/g },
  { name: "私钥", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

// 软信号：16~19 位纯数字，可能是 B 站 UID
const SOFT = [{ name: "长数字（疑似 UID）", re: /\b\d{15,19}\b/g }];

function scan(text) {
  const hits = [];
  for (const { name, re } of HARD) {
    const m = text.match(re);
    if (m) hits.push({ level: "hard", name, samples: [...new Set(m)].slice(0, 3) });
  }
  for (const { name, re } of SOFT) {
    const m = text.match(re);
    if (m) hits.push({ level: "soft", name, samples: [...new Set(m)].slice(0, 3) });
  }
  return hits;
}

// ── 摘要提取 ──────────────────────────────────────────
// 给她一个"一眼定位"的开头：第一段正文，最多 120 字
function summarize(text) {
  const body = text
    .replace(/^---[\s\S]*?---\s*/, "")   // 去掉 front matter
    .replace(/^#+\s.*$/gm, "")           // 去掉标题行
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 去掉图片
    .replace(/```[\s\S]*?```/g, "")      // 去掉代码块
    .replace(/^>\s?/gm, "")              // 去掉引用符
    .replace(/\*\*|__/g, "")             // 去掉粗体标记
    .trim();
  const first = body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)[0] || "";
  return first.replace(/\s+/g, " ").trim().slice(0, 120);
}

const text = fs.readFileSync(file, "utf8");
const name = String(opt.name || path.basename(file, path.extname(file)));
const date = new Date().toLocaleDateString("sv-SE");
const subject = `[PROJECT] ${name} | ${date}`;

const hits = scan(text);
const hard = hits.filter((h) => h.level === "hard");
const soft = hits.filter((h) => h.level === "soft");

console.error(`📄 ${file}  ${(text.length / 1024).toFixed(1)} KB`);
console.error(`   主题：${subject}`);
console.error(`   摘要：${summarize(text)}`);

if (hits.length) {
  console.error("\n⚠️  敏感扫描：");
  for (const h of hits) {
    console.error(`   [${h.level === "hard" ? "阻断" : "警告"}] ${h.name}：${h.samples.join(" / ")}`);
  }
}

if (hard.length && !opt.force) {
  console.error("\n❌ 有硬敏感项，已拒发。");
  console.error("   改干净再来，或者确认无风险后加 --force（不推荐）。");
  process.exit(1);
}

if (opt.dry) {
  console.log(JSON.stringify({ dry: true, subject, to: TO, size: text.length, hits, summary: summarize(text) }, null, 2));
  process.exit(0);
}

const key = apiKey();
if (!key) {
  console.error(`❌ 没有 AgentSend API key。放到 ${KEY_FILE}，或设环境变量 AGENTSEND_KEY。`);
  process.exit(1);
}

const bodyText = [
  `# ${name}`,
  ``,
  `- 日期：${date}`,
  `- 来源：本地 AGENT（local-agent@agentsend.io）`,
  `- 摘要：${summarize(text)}`,
  ``,
  `---`,
  ``,
  text,
].join("\n");

const r = await fetch(`${API}/inboxes/${FROM_INBOX}/messages`, {
  method: "POST",
  headers: { "x-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({ to: TO, subject, bodyText }),
  signal: AbortSignal.timeout(60_000),
});
const j = await r.json().catch(() => ({}));
if (r.status >= 300 || !j.id) {
  console.error(`❌ 发送失败 HTTP ${r.status}：${JSON.stringify(j).slice(0, 200)}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    { ok: true, id: j.id, subject, to: TO, status: j.status, size: bodyText.length, summary: summarize(text) },
    null,
    2
  )
);
