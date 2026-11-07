#!/usr/bin/env node
/**
 * sync-videoproj.mjs —— 把服务器上的视频项目源码补进仓库
 * ============================================================
 * 为什么要它：
 *   2026-11-07 盘点发现，仓库里的 video/projects/* 是**残缺副本**：
 *
 *     ai-agent-promo-v3   服务器 29 个文件 / 仓库 8 个
 *     week0-1105          服务器 22 / 仓库 7
 *     gravitee-agentops   服务器 14 / 仓库 完全没有
 *
 *   原因是 render-video.mjs 只在**渲染那一刻**上传它扫到的文件。
 *   她后来改过但没再触发渲染的，就永远留在服务器上。
 *   —— 一台 2G 内存、已经 OOM 过一次的云服务器，是唯一完整副本。
 *
 *   2026-11-07 同时把 render.yml 改成从 videoproj/<slug>/src 取源码：
 *   仓库里旧的 video/projects/ 从此冻结（不删，只是不再更新），
 *   免得两份源码各自长歪。
 *
 * 这个脚本只同步源码和文档，**不同步渲染产物**：
 *   收：src/** 的 .ts/.tsx/.js/.jsx/.css/.json/.md/.glsl/.svg
 *       项目根的 brief*.md / progress.md / state.json / SPEC.md
 *       public/** 里小于 1MB 的图片
 *   不收：out/、node_modules/、*.mp4、*.wav、*.png(>1MB)、帧目录
 *
 * 用法：
 *   node sync-videoproj.mjs --dry          # 只看会传什么
 *   node sync-videoproj.mjs                # 全部项目，一次 commit
 *   node sync-videoproj.mjs --only week0-1105
 */

import fs from "node:fs";
import path from "node:path";
import { commitFiles } from "./github-commit.mjs";

const HOME = process.env.LIFE_HOME || "/opt/life";
const ROOT = path.join(HOME, "videoproj");
const REPO_PREFIX = "videoproj";   // 仓库里放的位置（和服务器路径一致，好对照）

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[a.slice(2)] = true;
    else { opt[a.slice(2)] = v; i += 1; }
  }
}

const SRC_EXT = /\.(tsx?|jsx?|css|json|md|glsl|svg|html)$/i;
const IMG_EXT = /\.(png|jpg|jpeg|webp|gif)$/i;
const MAX_IMG = 1024 * 1024;         // public 里的图片超过 1MB 不传
// out / build / frames / cache 都是渲染中间产物，不备份：
// 2026-11-07 dry-run 时 build/ 被收进来，375 个文件 42MB，一大半是 bundle.js
const SKIP_DIR = /(^|\/)(out|build|dist|node_modules|frames|tmp|cache|\.git|shots-out)(\/|$)/i;
const SKIP_FILE = /\.(mp4|mov|webm|wav|mp3|m4a|zip|gz|onnx|bin|pt|ckpt|bundle\.js|map)$/i;

function walk(dir, base, acc) {
  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const it of items) {
    const abs = path.join(dir, it.name);
    const rel = path.relative(base, abs).replace(/\\/g, "/");
    if (it.isDirectory()) {
      if (SKIP_DIR.test(rel)) continue;
      walk(abs, base, acc);
      continue;
    }
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    if (SKIP_FILE.test(rel)) continue;
    if (st.size > 5 * 1024 * 1024) continue;              // 单文件超 5MB 不传
    if (SRC_EXT.test(rel)) {
      acc.push({ abs, rel, size: st.size });
    } else if (IMG_EXT.test(rel) && /(^|\/)public(\/|$)/.test(rel) && st.size <= MAX_IMG) {
      acc.push({ abs, rel, size: st.size });
    }
  }
  return acc;
}

(async () => {
  if (!fs.existsSync(ROOT)) {
    console.error(`❌ 没有 ${ROOT}`);
    process.exit(2);
  }

  let slugs = fs.readdirSync(ROOT).filter((d) => {
    try { return fs.statSync(path.join(ROOT, d)).isDirectory(); } catch { return false; }
  });
  if (opt.only) slugs = slugs.filter((s) => s === opt.only);

  console.log(`扫描 ${slugs.length} 个项目…\n`);

  const all = [];
  const report = [];
  for (const slug of slugs) {
    const base = path.join(ROOT, slug);
    const found = walk(base, base, []);
    const bytes = found.reduce((n, f) => n + f.size, 0);
    report.push({ slug, files: found.length, kb: Math.round(bytes / 1024) });
    for (const f of found) {
      all.push({
        path: `${REPO_PREFIX}/${slug}/${f.rel}`,
        content: fs.readFileSync(f.abs),
      });
    }
  }

  console.log("  项目                        文件   大小");
  console.log("  " + "-".repeat(52));
  for (const r of report) {
    console.log(`  ${String(r.slug).padEnd(26)} ${String(r.files).padStart(4)}   ${r.kb} KB`);
  }
  console.log(`\n  合计 ${all.length} 个文件，约 ${Math.round(all.reduce((n, f) => n + f.content.length, 0) / 1024)} KB`);

  if (!all.length) { console.log("\n没有要同步的。"); process.exit(0); }

  const res = await commitFiles({
    files: all,
    message: `sync(videoproj): ${report.length} 个项目 ${all.length} 个源码文件补全远程备份`,
    branch: String(opt.ref || "main"),
    dry: !!opt.dry,
    log: (s) => console.error(`  ${s}`),
  });

  console.log(`\n${opt.dry ? "(dry-run)" : "✅ 已提交"}`);
  for (const r of res.results || []) {
    console.log(`  ${r.commit ? r.commit.slice(0, 7) : "dry"}  ${r.files} 个文件  ${r.message}`);
  }
})().catch((e) => { console.error("❌", e.message); process.exit(1); });
