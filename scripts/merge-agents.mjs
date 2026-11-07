#!/usr/bin/env node
/**
 * merge-agents.mjs —— 服务器 AGENTS.md 与仓库脱敏版的双向合并（Step A：只生成，不落盘）
 *
 * 方向：以服务器版为母体（它带着 11-04 / 11-05 的最新主人令，一字不能丢），
 *       补进仓库独有的 9 个章节（九.6 全套人味铁律、12.3.1 探活、10.2.1 补充…），
 *       再用「从 secrets 动态取值」的映射生成脱敏版给公开仓库。
 *
 * 用法：node merge-agents.mjs            只生成 + 扫描 + 比对
 *       node merge-agents.mjs --write    写服务器 AGENTS.md（先备份），打印脱敏版路径
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const HOME = "/opt/life";
const SRC = path.join(HOME, "AGENTS.md");            // 服务器版（母体）
const REPO_BASE = "/tmp/repo_agents.md";              // 仓库版（Step 前一步已落地）
const OUT_SERVER = "/tmp/merged_server.md";
const OUT_REPO = "/tmp/masked_repo.md";

const server = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const repo = fs.readFileSync(REPO_BASE, "utf8").replace(/\r\n/g, "\n");
const S = server.split("\n");
const R = repo.split("\n");

// ── 1. 从仓库版里抽取要并入的章节 ──────────────────────
function slice(lines, startRe, endRe, label) {
  const a = lines.findIndex((l) => startRe.test(l));
  if (a < 0) throw new Error(`找不到起始标题: ${label}`);
  let b = lines.length;
  for (let i = a + 1; i < lines.length; i += 1) {
    if (endRe.test(lines[i])) { b = i; break; }
  }
  return { text: lines.slice(a, b).join("\n").trim(), from: a + 1, to: b };
}

const sec96 = slice(R, /^### 九\.6 /, /^## 十、/, "九.6 全套");
const sec1231 = slice(R, /^### 12\.3\.1 /, /^### 12\.4 /, "12.3.1 + 发现免费层");

// 画幅铁律里仓库版多出的一行
const frameLine = R.find((l) => /首帧图也用 16:9/.test(l)) || "";

console.log("=== 抽取结果 ===");
console.log(`  九.6 全套      仓库行 ${sec96.from}-${sec96.to}  ${sec96.text.split("\n").length} 行  ${sec96.text.length} 字`);
console.log(`  12.3.1 段      仓库行 ${sec1231.from}-${sec1231.to}  ${sec1231.text.split("\n").length} 行  ${sec1231.text.length} 字`);
console.log(`  画幅补充行     ${JSON.stringify(frameLine.slice(0, 46))}`);

// ── 2. 决定插入点 ──────────────────────────────────────
function insertAt(lines, block, { beforeRe, afterRe, tag }) {
  let idx = -1;
  if (beforeRe) idx = lines.findIndex((l) => beforeRe.test(l));
  if (idx < 0 && afterRe) {
    const a = lines.findIndex((l) => afterRe.test(l));
    if (a >= 0) {
      // 从 afterRe 那行往下找到该段结束（下一个 ## 或 ### 标题）
      let e = a + 1;
      for (; e < lines.length; e += 1) if (/^#{2,3} /.test(lines[e])) break;
      idx = e;
    }
  }
  if (idx < 0) throw new Error(`找不到插入点: ${tag}`);
  return [...lines.slice(0, idx), "", ...block.split("\n"), "", ...lines.slice(idx)];
}

let out = S;

// 九.6 全套：服务器版若已有就跳过
const has96 = out.some((l) => /^### 九\.6 /.test(l));
if (!has96) {
  try {
    out = insertAt(out, sec96.text, { beforeRe: /^### 看完一个视频，可以主动说一句/, tag: "九.6（在「看完一个视频」之前）" });
  } catch {
    out = insertAt(out, sec96.text, { beforeRe: /^## 十、/, tag: "九.6（兜底：在「十、」之前）" });
  }
  const i = out.findIndex((l) => /^### 九\.6 /.test(l));
  console.log(`\n  ✓ 九.6 全套已插入到第 ${i + 1} 行前`);
} else console.log("\n  · 服务器版已有九.6，跳过");

// 兜底：若「看完一个视频」小节不存在，上面会抛错——改用 ## 十 之前
const has1231 = out.some((l) => /^### 12\.3\.1 /.test(l));
if (!has1231) {
  out = insertAt(out, sec1231.text, { beforeRe: /^### 12\.4 /, tag: "12.3.1（在 12.4 之前）" });
  const i = out.findIndex((l) => /^### 12\.3\.1 /.test(l));
  console.log(`  ✓ 12.3.1 段已插入到第 ${i + 1} 行前`);
} else console.log("  · 服务器版已有 12.3.1，跳过");

// 画幅铁律补一行
if (frameLine && !out.some((l) => l.includes("首帧图也用 16:9"))) {
  const i = out.findIndex((l) => /^### 12\.-1 /.test(l));
  if (i >= 0) {
    let e = i + 1;
    for (; e < out.length; e += 1) if (/^#{2,3} /.test(out[e])) break;
    out = [...out.slice(0, e), frameLine, ...out.slice(e)];
    console.log(`  ✓ 画幅补充行插入到第 ${e + 1} 行`);
  } else console.log("  ⚠️ 没找到 12.-1 画幅铁律标题，补充行没插");
}

const mergedServer = out.join("\n").replace(/\n{3,}/g, "\n\n");
fs.writeFileSync(OUT_SERVER, mergedServer.endsWith("\n") ? mergedServer : mergedServer + "\n");

// ── 3. 生成脱敏版（值全部从 secrets / 正文动态取，绝不硬编码）──
const rd = (f) => { try { return fs.readFileSync(path.join(HOME, "secrets", f), "utf8").trim(); } catch { return ""; } };
const rules = [];

// 注意：这里绝不能用「把数字换成 \d」的模糊匹配。
// 上一版就是那么写的，结果主人 UID 和 Anthropos 自己的 UID 都是 16 位数字，
// 一条规则把两个都吃掉，脱敏版里她自己被写成了 <OWNER_UID>。
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ownerUid = rd("owner_uid.txt");
if (ownerUid) rules.push([new RegExp(esc(ownerUid), "g"), "<OWNER_UID>"]);

let selfUid = "";
const m1 = mergedServer.match(/B 站账号\s*`([^`]+)`（UID\s*`?(\d{6,})`?）/);
if (m1) { selfUid = m1[2]; rules.push([new RegExp(esc(m1[2]), "g"), "<SELF_UID>"]); rules.push([new RegExp(esc(m1[1]), "g"), "<SELF_NAME>"]); }

// 主人昵称：从正文「B 站昵称 X）」里抓
const m2 = mergedServer.match(/B 站昵称\s*([^\s）)】」]+)/);
if (m2) rules.push([new RegExp(m2[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "<OWNER_NAME>"]);

const ownerEmail = rd("owner_email.txt");
if (ownerEmail) rules.push([new RegExp(ownerEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "<OWNER_EMAIL>"]);

// 魔搭 key 前缀（ms-xxxxxx…）
rules.push([/\bms-[0-9a-f]{6,12}[^\s、，)）]*/g, "<魔搭 key 前缀>"]);

// 任何 secrets 文件里的值，只要长度 ≥10，全部按精确值替换
for (const f of fs.readdirSync(path.join(HOME, "secrets"))) {
  if (!/\.txt$/.test(f)) continue;
  const v = rd(f);
  if (v.length >= 10 && !/\s/.test(v)) {
    const ph = { owner_uid: "<OWNER_UID>", self_uid: "<SELF_UID>", owner_email: "<OWNER_EMAIL>" }[f.replace(".txt", "")] || `<${f.replace(".txt", "")}>`;
    rules.push([new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), ph]);
  }
}

let masked = mergedServer;
const applied = [];
for (const [re, ph] of rules) {
  const n = (masked.match(re) || []).length;
  if (n) { masked = masked.replace(re, ph); applied.push(`${ph} ×${n}`); }
}
fs.writeFileSync(OUT_REPO, masked.endsWith("\n") ? masked : masked + "\n");

console.log("\n=== 脱敏替换 ===");
console.log("  " + applied.join("\n  "));

// ── 4. 脱敏版敏感扫描：必须 0 命中 ──────────────────────
const NON_PUBLIC = /^(0\.|10\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[01])\.|127\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|198\.1[89]\.|198\.51\.100\.|203\.0\.113\.|255\.)/;
const UA = /(Mozilla\/|Chrome\/|Safari\/|Version\/|Edg\/)/;
const ipRe = /(?<![\d.,\/])((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))(?![\d.,])/g;
const leaks = [];
let mm;
while ((mm = ipRe.exec(masked))) {
  const ip = mm[1];
  if (NON_PUBLIC.test(ip)) continue;
  if (UA.test(masked.slice(Math.max(0, mm.index - 60), mm.index))) continue;
  leaks.push(`公网 IP ${ip}`);
}
// 精确值残留：直接再用 secrets 值扫一遍
for (const f of fs.readdirSync(path.join(HOME, "secrets"))) {
  if (!/\.txt$/.test(f)) continue;
  const v = rd(f);
  if (v.length >= 10 && masked.includes(v)) leaks.push(`secrets/${f} 的值仍在正文里`);
  else if (v.length >= 10) {
    for (const part of v.split(/[;\s]/).map((x) => x.split("=")[1]).filter(Boolean)) {
      if (part.length >= 20 && masked.includes(part)) leaks.push(`secrets/${f} 内字段值残留`);
    }
  }
}
if (ownerUid && masked.includes(ownerUid)) leaks.push("主人 UID 残留");
if (selfUid && masked.includes(selfUid)) leaks.push("自身 UID 残留");
if (/\bms-[0-9a-f]{6}/.test(masked)) leaks.push("魔搭 key 前缀残留");
if (m2 && masked.includes(m2[1])) leaks.push("主人昵称残留");
if (m1 && masked.includes(m1[1])) leaks.push("自身 B 站账号名残留");

// ── 替换计数校验：原文有几处真值，脱敏版就得有几个占位符 ──
console.log("\n=== 替换计数校验 ===");
const cnt = (t, s) => (s ? (t.match(new RegExp(esc(s), "g")) || []).length : 0);
const ph = (t, s) => (t.match(new RegExp(s, "g")) || []).length;
const expect = [
  ["主人 UID", cnt(mergedServer, ownerUid), ph(masked, "<OWNER_UID>")],
  ["自身 UID", cnt(mergedServer, selfUid), ph(masked, "<SELF_UID>")],
  ["自身账号名", cnt(mergedServer, m1 && m1[1]), ph(masked, "<SELF_NAME>")],
  ["主人昵称", cnt(mergedServer, m2 && m2[1]), ph(masked, "<OWNER_NAME>")],
];
let mism = 0;
for (const [k, a, b] of expect) {
  const ok = a === b;
  if (!ok) mism += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${String(k).padEnd(12)} 原文 ${a} 处 → 占位符 ${b} 处`);
}
if (mism) console.log("  ⛔ 数量对不上，说明替换越界或漏替换");

console.log("\n=== 脱敏版敏感扫描 ===");
console.log(leaks.length ? "  ⛔ " + leaks.join("\n  ⛔ ") : "  ✓ 0 命中");

// ── 5. 结构比对：两份的章节标题必须完全一致 ────────────────
const heads = (t) => t.split("\n").filter((l) => /^#{2,4} /.test(l)).map((l) => l.trim());
const HS2 = heads(mergedServer), HR2 = heads(masked);
const onlyS = HS2.filter((x) => !HR2.includes(x));
const onlyR = HR2.filter((x) => !HS2.includes(x));
console.log("\n=== 结构比对（合并后两份应完全一致）===");
console.log(`  合并版(真实值) ${mergedServer.split("\n").length} 行 / ${HS2.length} 章节`);
console.log(`  脱敏版(进仓库) ${masked.split("\n").length} 行 / ${HR2.length} 章节`);
console.log(`  标题集合差异: ${onlyS.length + onlyR.length}`, (onlyS.length || onlyR.length) ? `\n    只在真实版: ${onlyS.join(" | ")}\n    只在脱敏版: ${onlyR.join(" | ")}` : "  ✓ 完全一致");

// ── 6. 相对原服务器版新增了什么 ──────────────────────────
console.log("\n=== 相对服务器原版新增 ===");
console.log(`  行数 ${S.length} → ${mergedServer.split("\n").length}（+${mergedServer.split("\n").length - S.length}）`);
for (const k of ["九.6", "九.6.2.1", "九.6.3", "12.3.1", "发现免费层变了", "model-scout", "首帧图也用"]) {
  const before = (server.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  const after = (mergedServer.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  console.log(`    ${k.padEnd(18)} ${before} → ${after}`);
}
console.log("\n=== 相对仓库原版补了什么（脱敏版 vs 仓库原脱敏版）===");
console.log(`  行数 ${R.length} → ${masked.split("\n").length}（+${masked.split("\n").length - R.length}）`);
for (const k of ["魔搭1", "modelscope_token2", "OneClick", "档位名有两份", "fish-ecosystem", "免费，随便用", "现成字幕"]) {
  const before = (repo.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  const after = (masked.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  console.log(`    ${k.padEnd(18)} ${before} → ${after}`);
}

console.log(`\n产物: ${OUT_SERVER}  ${OUT_REPO}`);
if (leaks.length || mism) { console.log("\n⛔ 敏感残留或占位符计数不符，不许落盘"); process.exit(4); }

// ── 7. 落盘（只在通过全部校验后）──────────────────────────
if (process.argv.includes("--write")) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const bak = `${SRC}.bak-before-merge-${day}`;
  if (!fs.existsSync(bak)) fs.copyFileSync(SRC, bak);
  fs.writeFileSync(SRC, fs.readFileSync(OUT_SERVER));
  fs.copyFileSync("/tmp/merge-agents.mjs", path.join(HOME, "scripts", "merge-agents.mjs"));
  console.log(`\n✅ 已写服务器 AGENTS.md（${mergedServer.split("\n").length} 行）`);
  console.log(`   备份: ${bak}`);
  console.log(`   工具自留: scripts/merge-agents.mjs`);
  console.log(`   脱敏版待推: ${OUT_REPO}`);
}
