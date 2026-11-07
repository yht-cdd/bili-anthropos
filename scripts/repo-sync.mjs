#!/usr/bin/env node
/**
 * repo-sync.mjs —— 服务器代码 vs GitHub 仓库的差异审计，可选一次 commit 补齐
 * ============================================================
 * 为什么要它：
 *   /opt/life 不是 git 仓库，代码靠 scp 和 API 双向搬。2026-11-07 查
 *   videoproj 时发现同样的病：服务器上有、仓库里没有的文件一大把，
 *   而且没人知道哪些已经过时。这个脚本把两边对齐状况一次性摊开。
 *
 * 默认只报告（dry-run）。加 --apply 才提交，且提交前逐文件过敏感扫描。
 *
 * 敏感扫描的教训（2026-11-07 第一版就翻车）：
 *   按「SESSDATA」「bili_jct」这种**字段名**去扫，结果 10 个文件被拦，
 *   连 bili-bridge.mjs（必须提交的那个）都过不去 —— 那里面出现的只是
 *   代码里的字段名和 127.0.0.1，没有一个真实凭据。
 *   所以现在只扫三样：**值的形态**、**公网 IP**、**secrets 里的精确值**。
 *
 * 用法：
 *   node scripts/repo-sync.mjs                     # 看差异
 *   node scripts/repo-sync.mjs --apply             # 差异一次 commit 推上去
 *   node scripts/repo-sync.mjs --include scripts   # 缩小范围
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { commitFiles } from "./github-commit.mjs";

const HOME = process.env.LIFE_HOME || "/opt/life";
const REPO = process.env.GITHUB_REPO || "yht-cdd/bili-anthropos";
const API = "https://api.github.com";

const argv = process.argv.slice(2);
const opt = { include: [] };
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === "--apply") { opt.apply = true; continue; }
  if (a === "--dry") { opt.apply = false; continue; }
  if (a === "--include") { opt.include.push(String(argv[++i] || "")); continue; }
  if (a.startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[a.slice(2)] = true;
    else { opt[a.slice(2)] = v; i += 1; }
  }
}

// ── 同步范围：只有代码 / 配置 / 工程文档 ──
// 根级 *.md（AGENTS.md、SELF.md、BELIEFS.md、STREAM.md、TODAY.md…）2026-11-07 起移出默认范围：
// 服务器上那份写着真实 UID 和主人昵称，仓库里那份是占位符脱敏版，
// 两版已经各自长岔（见 HARD_NEVER 的说明），必须人工合并，不能自动推。
const INCLUDE = opt.include.length
  ? opt.include.map((p) => new RegExp("^" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  : [/^scripts\//, /^config\//, /^docs\//, /^\.github\//];

// 永远不自动推，即使 --include 命中
const HARD_NEVER = [
  [/^AGENTS\.md$/i, "含真实 UID / 主人昵称，且与仓库脱敏版分叉，需人工合并"],
];

const NEVER_DIR = /(^|\/)(secrets|\.git|node_modules|logs|tmp|diary|journal|memory|exec|inbox|outbox|archive|knowledge|videos|videoproj|bili|identity|skills|assets|systemd|tools|scars|themes|cover)(\/|$)/;
const NEVER_FILE = /(\.db|\.log|\.mp4|\.mov|\.wav|\.mp3|\.png|\.jpe?g|\.gif|\.webp|\.zip|\.gz|\.onnx|\.bin|\.pt|\.ckpt|\.bak|\.bak[.-][\w.-]+|\.old|\.orig|~|\.key|\.pem)$/i;
const MAX_SIZE = 400 * 1024;   // 单文件超 400KB 不自动推（大概是数据快照，不是代码）

// ── 一、凭据的「值形态」：字段名单独出现不算泄露 ──
const VALUE_PATTERNS = [
  [/\bgh[oprs]_[A-Za-z0-9]{16,}\b/, "GitHub token"],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/, "sk- 开头的 key"],
  [/SESSDATA\s*[=:]\s*["']?[0-9a-zA-Z_%-]{30,}/, "SESSDATA 的值"],
  [/bili_jct\s*[=:]\s*["']?[0-9a-f]{24,}/i, "bili_jct 的值"],
  [/buvid[34]\s*=\s*["']?[0-9A-F]{8}-[0-9A-F-]{24,}/, "buvid 的值"],
  [/DedeUserID\s*[=:]\s*["']?\d{7,}/, "DedeUserID 的值"],
  [/[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*[=:]\s*["'][^"'\s]{16,}["']/i, "硬编码凭据赋值"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "私钥"],
];

// ── 二、公网 IP（本地、保留、文档段、正则示例都不算）──
const NON_PUBLIC = /^(0\.|10\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[01])\.|127\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.0\.[02]\.|192\.0\.2\.|192\.168\.|198\.(1[89]|51)\.|198\.51\.100\.|203\.0\.113\.|255\.)/;
const IP_RE = /(?<![\d.,])((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))(?![\d.,])/g;

// UA 里的版本号长得太像 IP（Chrome/154.0.0.0），前面 60 字符有浏览器标记就放过
const UA_HINT = /(Mozilla\/|Chrome\/|Safari\/|Version\/|Edg\/|OPR\/|Gecko\/)/;

function publicIps(text) {
  const hits = [];
  IP_RE.lastIndex = 0;
  let m;
  while ((m = IP_RE.exec(text))) {
    const ip = m[1];
    if (NON_PUBLIC.test(ip)) continue;
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    if (UA_HINT.test(before)) continue;
    const around = text.slice(Math.max(0, m.index - 16), m.index + ip.length + 16).replace(/\s+/g, " ");
    if (/\\d|\{\d|\d\}|x\.x\.x/.test(around)) continue;   // 正则/掩码示例
    hits.push(ip);
  }
  return [...new Set(hits)];
}

// ── 三、secrets 里的精确值：命中就拦，且绝不把值打出来 ──
function exactSecrets() {
  const names = ["owner_uid.txt", "owner_email.txt", "bili_cookie.txt", "modelscope_token.txt",
    "github_token.txt", "agentsend_token.txt", "opencode_password.txt", "voice_api_key.txt"];
  const vals = [];
  for (const n of names) {
    let v = "";
    try { v = fs.readFileSync(path.join(HOME, "secrets", n), "utf8").trim(); } catch { continue; }
    if (v.length >= 8) vals.push({ label: n, v });
    // cookie 文件里的每个 k=v 也单独当一条精确值
    for (const kv of v.split(";")) {
      const p = kv.split("=")[1];
      if (p && p.trim().length >= 20) vals.push({ label: n + " 字段", v: p.trim() });
    }
  }
  return vals;
}

function token() {
  const e = String(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
  if (e) return e;
  return fs.readFileSync(path.join(HOME, "secrets/github_token.txt"), "utf8").trim();
}

async function gh(p, init = {}) {
  const r = await fetch(API + p, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(90_000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`GitHub ${r.status} ${p}: ${(t.match(/"message":"([^"]{0,120})/) || [])[1] || t.slice(0, 120)}`);
  return JSON.parse(t);
}

const blobSha = (buf) =>
  crypto.createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");

function scan(text, secrets) {
  const hits = [];
  for (const [re, name] of VALUE_PATTERNS) if (re.test(text)) hits.push(name);
  const ips = publicIps(text);
  if (ips.length) hits.push("公网 IP " + ips.slice(0, 3).join(","));
  for (const s of secrets) if (text.includes(s.v)) hits.push("secrets 精确值:" + s.label);
  return hits;
}

function walk(dir, base, acc) {
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const it of items) {
    const abs = path.join(dir, it.name);
    const rel = path.relative(base, abs).replace(/\\/g, "/");
    if (it.isDirectory()) {
      if (NEVER_DIR.test(rel)) continue;
      walk(abs, base, acc);
      continue;
    }
    if (NEVER_DIR.test(rel) || NEVER_FILE.test(rel)) continue;
    if (!INCLUDE.some((re) => re.test(rel))) continue;
    let st; try { st = fs.statSync(abs); } catch { continue; }
    if (st.size > MAX_SIZE) continue;
    acc.push({ rel, abs, size: st.size });
  }
  return acc;
}

(async () => {
  const all = walk(HOME, HOME, []).sort((a, b) => a.rel.localeCompare(b.rel));
  const guarded = all.filter((f) => HARD_NEVER.some(([re]) => re.test(f.rel)));
  const files = all.filter((f) => !HARD_NEVER.some(([re]) => re.test(f.rel)));
  const secrets = exactSecrets();
  console.log(`服务器候选 ${files.length} 个文件   精确比对值 ${secrets.length} 条`);
  console.log(`范围：${INCLUDE.map((r) => r.source).join(" | ")}\n`);

  const tree = await gh(`/repos/${REPO}/git/trees/main?recursive=1`);
  const repoMap = new Map();
  for (const t of (tree.tree || []).filter((x) => x.type === "blob")) repoMap.set(t.path, t.sha);

  const missing = [], changed = [], blocked = [];
  let same = 0;
  for (const f of files) {
    const buf = fs.readFileSync(f.abs);
    const cur = repoMap.get(f.rel);
    if (cur === blobSha(buf)) { same += 1; continue; }
    const hits = scan(buf.toString("utf8"), secrets);
    if (hits.length) { blocked.push({ rel: f.rel, hits }); continue; }
    (cur ? changed : missing).push({ ...f, buf });
  }

  const line = (arr, tag) => {
    for (const f of arr.slice(0, 45)) console.log(`  ${tag} ${String(f.rel).padEnd(44)} ${String(Math.round(f.size / 1024 * 10) / 10)} KB`);
    if (arr.length > 45) console.log(`  …还有 ${arr.length - 45} 个`);
  };
  console.log(`仓库里没有（新文件）: ${missing.length}`); line(missing, "＋");
  console.log(`\n内容不一致（要更新）: ${changed.length}`); line(changed, "~");
  console.log(`\n完全一致: ${same}`);
  console.log(`\n被敏感扫描拦下: ${blocked.length}`);
  for (const b of blocked) console.log(`  ✗ ${b.rel}\n     ${b.hits.join("  ")}`);

  if (guarded.length) {
    console.log(`\n硬性排除（永不自动推）: ${guarded.length}`);
    for (const f of guarded) {
      const why = (HARD_NEVER.find(([re]) => re.test(f.rel)) || [])[1] || "";
      console.log(`  ⛔ ${f.rel} —— ${why}${repoMap.has(f.rel) ? "（仓库有旧版）" : "（仓库没有）"}`);
    }
  }

  // 根级 *.md 不在同步范围，但差异要看得见，不能当没发生
  const loose = [];
  for (const n of fs.readdirSync(HOME)) {
    if (!/\.md$/i.test(n)) continue;
    if (HARD_NEVER.some(([re]) => re.test(n))) continue;
    let st; try { st = fs.statSync(path.join(HOME, n)); } catch { continue; }
    if (!st.isFile() || st.size > MAX_SIZE) continue;
    const sha = blobSha(fs.readFileSync(path.join(HOME, n)));
    const cur = repoMap.get(n);
    if (cur !== sha) loose.push({ n, inRepo: !!cur });
  }
  if (loose.length) {
    console.log(`\n根级 *.md 未纳入范围（个人内容，要推得人工过一遍）: ${loose.length}`);
    for (const l of loose.slice(0, 12)) console.log(`  · ${String(l.n).padEnd(22)} 仓库${l.inRepo ? "有旧版" : "没有"}`);
  }

  const todo = [...missing, ...changed];
  if (!todo.length) { console.log("\n没有要推的。"); return; }
  const bytes = todo.reduce((n, f) => n + f.buf.length, 0);
  if (!opt.apply) {
    console.log(`\n(dry-run) 加 --apply 会一次 commit 推 ${todo.length} 个文件，约 ${Math.round(bytes / 1024)} KB`);
    return;
  }

  const res = await commitFiles({
    files: todo.map((f) => ({ path: f.rel, content: f.buf })),
    message: `chore(repo-sync): 服务器代码与仓库对齐，${todo.length} 个文件`,
    log: (s) => console.error(`  ${s}`),
  });
  console.log("\n已提交");
  for (const r of res.results || []) {
    console.log(`  ${r.commit ? r.commit.slice(0, 7) : (r.unchanged ? "无变化" : "?")}  ${r.files} 个文件`);
  }
})().catch((e) => { console.error("❌", e.message); process.exit(1); });
