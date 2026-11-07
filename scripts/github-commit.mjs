#!/usr/bin/env node
/**
 * github-commit.mjs —— 一次提交多个文件，只产生一个 commit
 * ============================================================
 * 为什么要有它：
 *   2026-10-31 我写的 render-video.mjs 用 Contents API 逐文件 PUT，
 *   **每个文件产生一个 commit**。week0-1105 一个项目就灌了 100+ 个
 *   `video(week0-1105): update shots/S9.tsx` 这种提交，历史彻底没法看。
 *
 *   正确做法是走 Git Data API：tree → commit → 移 ref，
 *   四个请求换一次提交，不管多少个文件。
 *
 * ⚠️ 2026-11-07 踩的第二个坑，这个更贵：
 *   第一版我在 tree 的 entry 里写了
 *       { path, content: <base64>, encoding: "base64" }
 *   看着天经地义 —— Contents API 就是这么传的。
 *   但 **Create a Tree 的 entry 根本没有 encoding 这个字段**，GitHub 把它
 *   当多余参数丢掉，然后按 UTF-8 字面把那一长串 base64 存成了文件正文。
 *   结果：render.yml 仓库里 7504 字节（原文 5.5KB），theme.ts 3724 字节
 *   （原文 2793 字节，正好 ×4/3），270 个文件全是「一行的 base64 乱码」。
 *   commit 统计 `+22 -5584` 就是信号：22 个文件每个只"加了一行"。
 *
 *   规矩：
 *     文本文件 → tree entry 用 content 传**原文**（不加 encoding）
 *     二进制   → 先 POST /git/blobs（那里 encoding 才合法）拿 sha，tree 里只引用 sha
 *   验证方法：拿回来的 size 必须等于原文件字节数，blob sha 必须等于本地 git hash-object。
 *
 * 用法（给别的脚本 import）：
 *   import { commitFiles } from "./github-commit.mjs";
 *   await commitFiles({ files: [{ path, content }], message, branch });
 *
 * 命令行直接跑（调试用）：
 *   node github-commit.mjs --dry path/in/repo.ts
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const REPO = process.env.GITHUB_REPO || "yht-cdd/bili-anthropos";
const API = "https://api.github.com";

// 明确是二进制的扩展名，一律走 blobs API
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|tiff|mp3|mp4|mov|webm|wav|m4a|aac|flac|zip|gz|tgz|bz2|xz|7z|pdf|onnx|bin|pt|ckpt|safetensors|woff2?|ttf|otf|eot|exe|dll|node|wasm)$/i;

function isTextBuffer(buf) {
  if (buf.includes(0)) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(buf); return true; } catch { return false; }
}

function token() {
  const env = String(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
  if (env) return env;
  try {
    return fs.readFileSync(path.join(HOME, "secrets/github_token.txt"), "utf8").trim();
  } catch {
    throw new Error("没有 GitHub token（env GH_TOKEN 或 secrets/github_token.txt）");
  }
}

async function gh(pathname, init = {}) {
  const t = token();
  const r = await fetch(API + pathname, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(120_000),
  });
  const txt = await r.text();
  if (!r.ok) {
    let msg = txt.slice(0, 200);
    try { msg = JSON.parse(txt).message || msg; } catch {}
    throw new Error(`GitHub ${r.status} ${pathname}: ${msg}`);
  }
  return JSON.parse(txt);
}

/** 文本内联原文；二进制先建 blob 再引用 sha */
async function makeEntry(f, log) {
  const buf = Buffer.isBuffer(f.content) ? f.content : Buffer.from(String(f.content));
  const binary = BINARY_EXT.test(f.path) || !isTextBuffer(buf);
  if (!binary) {
    // 关键：这里绝不加 encoding，content 就是原文
    return { path: f.path, mode: "100644", type: "blob", content: buf.toString("utf8") };
  }
  const b = await gh(`/repos/${REPO}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: buf.toString("base64"), encoding: "base64" }),
  });
  return { path: f.path, mode: "100644", type: "blob", sha: b.sha };
}

/** 二进制 blob 并发上限，别把二级限流打爆 */
async function entriesFor(batch, log) {
  const out = new Array(batch.length);
  let i = 0;
  let done = 0;
  async function worker() {
    while (i < batch.length) {
      const k = i++;
      out[k] = await makeEntry(batch[k], log);
      done += 1;
      if (done % 40 === 0) log(`    已处理 ${done}/${batch.length} 个`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return out;
}

/**
 * 一次提交多个文件。
 * @param {object} o
 * @param {Array<{path:string, content:Buffer|string}>} o.files  仓库内的完整路径
 * @param {string} o.message                                     commit message
 * @param {string} [o.branch]                                    默认 main
 * @param {boolean} [o.dry]                                      只报告不提交
 * @param {(s:string)=>void} [o.log]
 */
export async function commitFiles(o) {
  const branch = o.branch || "main";
  const log = o.log || ((s) => console.error(s));
  const files = (o.files || []).filter((f) => f && f.path && f.content !== undefined);

  if (!files.length) return { ok: true, skipped: "没有文件要提交", commit: null };

  // 分批规则：**按字节数**，不按文件数。
  // 2026-11-07 实测：255 个文件一次提交（base64 后约 10MB）建 tree 成功但
  // commit 报「Tree SHA does not exist」—— 请求体超限，tree 没落库。
  // 文本现在按原文内联（比 base64 小 25%），每批控制在 2.5MB 原文以内。
  const MAX_BATCH_BYTES = 2.5 * 1024 * 1024;
  const MAX_BATCH_FILES = 120;
  const batches = [];
  let cur = [];
  let curBytes = 0;
  for (const f of files) {
    const size = Buffer.isBuffer(f.content) ? f.content.length : Buffer.byteLength(String(f.content));
    if (cur.length && (curBytes + size > MAX_BATCH_BYTES || cur.length >= MAX_BATCH_FILES)) {
      batches.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(f);
    curBytes += size;
  }
  if (cur.length) batches.push(cur);

  const results = [];
  for (let b = 0; b < batches.length; b += 1) {
    const batch = batches[b];
    const suffix = batches.length > 1 ? ` (${b + 1}/${batches.length})` : "";
    const msg = o.message + suffix;

    log(`  拿 ${branch} 的当前提交…`);
    const ref = await gh(`/repos/${REPO}/git/ref/heads/${branch}`);
    const baseCommit = ref.object.sha;
    const commitObj = await gh(`/repos/${REPO}/git/commits/${baseCommit}`);
    const baseTree = commitObj.tree.sha;

    if (o.dry) {
      log(`  (dry-run) 会提交 ${batch.length} 个文件：`);
      for (const e of batch.slice(0, 12)) log(`     ${e.path}`);
      if (batch.length > 12) log(`     …还有 ${batch.length - 12} 个`);
      results.push({ dry: true, files: batch.length, message: msg });
      continue;
    }

    log(`  建 entries（${batch.length} 个文件，二进制走 blobs）…`);
    const entries = await entriesFor(batch, log);

    log(`  建 tree…`);
    const tree = await gh(`/repos/${REPO}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTree, tree: entries }),
    });

    // 内容和现有文件完全一致时，新 tree 的 SHA 就等于 base tree。
    // 这时再建 commit 就是一个空提交 —— 2026-11-07 重跑同步就多出来两个
    // （0186d48、98e1e9e，stats 全是 +0 -0）。
    if (tree.sha === baseTree) {
      log(`  内容无变化，跳过 commit（${batch.length} 个文件都已一致）`);
      results.push({ commit: null, unchanged: true, files: batch.length, message: msg });
      continue;
    }

    log("  建 commit…");
    const newCommit = await gh(`/repos/${REPO}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: msg, tree: tree.sha, parents: [baseCommit] }),
    });

    log(`  移 ref → ${newCommit.sha.slice(0, 7)}`);
    // GitHub 的 Git Data API 是写后读最终一致的：刚建出来的 commit 可能在另一个
    // 后端副本上还没可见，PATCH ref 就会报 422「Object does not exist」。
    // 2026-11-07 连撞两次（sync 第 4 批、AGENTS 合并），只能靠重跑，所以在这里重试。
    let lastErr = null;
    for (let a = 1; a <= 4; a += 1) {
      try {
        await gh(`/repos/${REPO}/git/refs/heads/${branch}`, {
          method: "PATCH",
          body: JSON.stringify({ sha: newCommit.sha, force: false }),
        });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (!/does not exist|422|404/.test(String(e.message))) break;
        log(`    ref 还没可见（第 ${a} 次），等 2s 重试…`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (lastErr) throw lastErr;

    results.push({ commit: newCommit.sha, tree: tree.sha, files: batch.length, message: msg });
  }

  return { ok: true, repo: REPO, branch, results };
}

// ── 提交后自检：仓库 size 必须等于原文 size ──────────
export async function verifyCommitted(list, log = ((s) => console.error(s))) {
  let bad = 0;
  for (const f of list.slice(0, 20)) {
    const buf = Buffer.isBuffer(f.content) ? f.content : Buffer.from(String(f.content));
    const j = await gh(`/repos/${REPO}/contents/${encodeURIComponent(f.path).replace(/%2F/g, "/")}`)
      .catch(() => null);
    if (!j || !j.size) { log(`  ? 读不到 ${f.path}`); continue; }
    if (j.size !== buf.length) {
      log(`  ✗ ${f.path}  仓库 ${j.size} B ≠ 原文 ${buf.length} B`);
      bad += 1;
    }
  }
  return bad;
}

// ── 命令行入口（调试用）──────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const paths = argv.filter((a) => !a.startsWith("--"));
  const dry = argv.includes("--dry");
  if (!paths.length) {
    console.log("用法: node github-commit.mjs [--dry] <仓库内路径=本地路径>");
    console.log("  例: node github-commit.mjs --dry 'videoproj/demo-link/src/Demo.tsx=/opt/life/videoproj/demo-link/src/Demo.tsx'");
    process.exit(0);
  }
  const files = paths.map((p) => {
    const [rp, lp] = p.split("=");
    return { path: lp ? rp : rp, content: fs.readFileSync(lp || rp) };
  });
  commitFiles({ files, message: `chore: ${files.length} 个文件`, dry, log: console.error })
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error("❌", e.message); process.exit(1); });
}
