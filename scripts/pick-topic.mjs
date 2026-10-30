#!/usr/bin/env node
/**
 * pick-topic.mjs —— 从工程文档里挖选题素材
 * ============================================================
 * 选题不该靠拍脑袋。她每天 0 点收到主人发来的工程文档，
 * 那些文档里写满了「我们踩了什么坑、试了什么、数字是多少」——
 * 那正是观众愿意看的东西，只是被埋在技术表述里。
 *
 * 这个脚本不生成选题，只做**素材包**：
 *   把最近几份工程文档里的「结论 / 坑 / 数字 / 反常识点」抽出来，
 *   拼成一段她能直接读的东西。选题仍然由她判断。
 *
 * 用法：
 *   node pick-topic.mjs                 # 最近 5 份，文本
 *   node pick-topic.mjs --n 3 --json    # 机器可读
 *   node pick-topic.mjs --days 7        # 只看 7 天内更新的
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const PROJ = path.join(HOME, "knowledge/projects");

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  }
}
const N = Number(opt.n || 5);
const DAYS = Number(opt.days || 0);

const INTEREST = /(坑|教训|结论|所以|但是|其实|反常识|实测|数据|数字|失败|翻车|发现|意外|对比)/;
const SKIP = /^(目录|参考|附录|更新日志|变更记录)/;

function files() {
  if (!fs.existsSync(PROJ)) return [];
  const cutoff = DAYS ? Date.now() - DAYS * 86400_000 : 0;
  return fs
    .readdirSync(PROJ)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const p = path.join(PROJ, f);
      const st = fs.statSync(p);
      return { name: f, path: p, mtime: st.mtimeMs, size: st.size };
    })
    .filter((x) => x.mtime >= cutoff)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, N);
}

/** 从一份文档里抽「能讲的点」 */
function extract(file) {
  let text = "";
  try { text = fs.readFileSync(file.path, "utf8"); } catch { return null; }

  const lines = text.split("\n");
  let title = "";
  const sections = [];
  let cur = null;

  for (const ln of lines) {
    const h1 = ln.match(/^#\s+(.+)/);
    const h2 = ln.match(/^#{2,3}\s+(.+)/);
    if (h1 && !title) { title = h1[1].trim(); continue; }
    if (h2) {
      if (cur) sections.push(cur);
      cur = { head: h2[1].trim(), body: [] };
      continue;
    }
    if (cur) cur.body.push(ln);
  }
  if (cur) sections.push(cur);

  const picked = [];
  for (const s of sections) {
    if (SKIP.test(s.head)) continue;
    if (!INTEREST.test(s.head) && !INTEREST.test(s.body.join(""))) continue;
    const body = s.body
      .join("\n")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\|.*\|/g, "")          // 表格行去掉，太占地方
      .replace(/\n{2,}/g, "\n")
      .trim();
    if (body.length < 40) continue;
    picked.push({ head: s.head, body: body.slice(0, 600) });
    if (picked.length >= 3) break;
  }

  // 全文里的数字句：观众爱听具体数字
  const numbers = lines
    .filter((l) => /\d/.test(l) && /(秒|分钟|次|张|条|个|%|MB|GB|元)/.test(l) && l.length < 160)
    .map((l) => l.replace(/^[-*\s>#]+/, "").trim())
    .filter((l) => l.length > 12)
    .slice(0, 3);

  if (!title) title = path.basename(file.name, ".md");
  return {
    doc: file.name,
    title,
    updated: new Date(file.mtime).toLocaleDateString("sv-SE"),
    sections: picked,
    numbers,
  };
}

const docs = files().map(extract).filter(Boolean);

if (opt.json) {
  console.log(JSON.stringify({ ok: true, count: docs.length, docs }, null, 2));
  process.exit(0);
}

if (!docs.length) {
  console.log("（knowledge/projects 里没有工程文档。选题没有原料 —— 等她 0 点收信之后再看。）");
  process.exit(0);
}

console.log(`选题素材包 · 来自 ${docs.length} 份工程文档\n`);
for (const d of docs) {
  console.log(`━━ ${d.title}（${d.updated}）${d.doc}`);
  for (const s of d.sections) {
    console.log(`  ▸ ${s.head}`);
    console.log(`    ${s.body.replace(/\n/g, "\n    ").slice(0, 420)}`);
  }
  if (d.numbers.length) {
    console.log("  ▸ 具体数字（观众信这个）");
    for (const n of d.numbers) console.log(`    · ${n}`);
  }
  console.log("");
}
console.log("怎么用：这些是**素材**，不是选题。选题要你自己判断——");
console.log("哪一条能让一个完全不懂技术的人停下来看完 3 分钟？");
