#!/usr/bin/env node
/**
 * bili-upload.mjs —— 把本地视频传到 B 站（默认不投稿）
 * ============================================================
 * 分三档，默认最保守：
 *   --dry       只做 preupload，拿到凭证就停（不上传一个字节）
 *   （默认）     真上传文件，但**不提交投稿** —— 文件进你的素材区，不公开
 *   --publish   上传 + 提交投稿（会真的发出去）
 *
 * 为什么默认不发布：投稿是不可逆的对外动作。
 * 先能传、能看结果，再决定要不要按发布键。
 *
 * 用法：
 *   node bili-upload.mjs <文件> --dry
 *   node bili-upload.mjs <文件>
 *   node bili-upload.mjs <文件> --publish --title "标题" --tid 21 --tag "标签1,标签2"
 *
 * 注意：
 *   · 参数 r 必须是 upos（不是 mp4），否则 404
 *   · 上传凭证 5 天有效
 *   · 单文件 ≤100MB 走单分片；更大要真的切块传
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || path.join(HOME, "secrets/bili_cookie.txt");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

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
  console.error(
    "用法: node bili-upload.mjs <文件> [--dry] [--publish --title T --tid 21 --tag a,b]\n" +
      "  --dry      只 preupload，不上传\n" +
      "  (默认)     上传但不提交\n" +
      "  --publish  上传并提交投稿"
  );
  process.exit(2);
}

const cookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const csrf = (/bili_jct=([^;]+)/.exec(cookie) || [])[1] || "";
if (!csrf) {
  console.error("❌ Cookie 里没有 bili_jct，无法提交");
  process.exit(1);
}

const H = {
  "user-agent": UA,
  referer: "https://member.bilibili.com/platform/upload/video/frame",
  origin: "https://member.bilibili.com",
  cookie,
};

const size = fs.statSync(file).size;
const name = path.basename(file);
console.error(`📦 ${name}  ${(size / 1024 / 1024).toFixed(1)} MB`);

// ── 1. preupload ──────────────────────────────────────
const preUrl =
  "https://member.bilibili.com/preupload?" +
  new URLSearchParams({
    name,
    size: String(size),
    r: "upos",
    profile: "ugcfx/bup",
    ssl: "0",
    version: "2.14.0.0",
    build: "2140000",
  });

const preRes = await fetch(preUrl, { headers: H, signal: AbortSignal.timeout(30_000) });
const preTxt = await preRes.text();
let pre;
try {
  pre = JSON.parse(preTxt);
} catch {
  console.error(`❌ preupload 非 JSON（HTTP ${preRes.status}）：${preTxt.slice(0, 150)}`);
  process.exit(1);
}
if (pre.OK !== 1) {
  console.error(`❌ preupload 被拒 code=${pre.code} ${pre.message || ""}`);
  process.exit(1);
}
console.error(`   凭证 OK  biz_id=${pre.biz_id}  chunk=${pre.chunk_size}  node=${pre.endpoint}`);

if (opt.dry) {
  console.log(JSON.stringify({ mode: "dry", ok: true, biz_id: pre.biz_id, upos_uri: pre.upos_uri, endpoint: pre.endpoint }));
  console.error("✅ preupload 通过（没上传任何数据）");
  process.exit(0);
}

// ── 2. 开启上传会话 ───────────────────────────────────
const upUrl = `https:${pre.endpoint}/${String(pre.upos_uri).replace("upos://", "")}`;
const auth = { "X-Upos-Auth": pre.auth };

const openQ = new URLSearchParams({
  uploads: "",
  output: "json",
  profile: "ugcfx/bup",
  filesize: String(size),
  partsize: String(pre.chunk_size),
  biz_id: String(pre.biz_id),
});
const openRes = await fetch(`${upUrl}?${openQ}`, {
  method: "POST",
  headers: { ...auth, "user-agent": UA, referer: "https://member.bilibili.com/" },
  signal: AbortSignal.timeout(30_000),
});
const openTxt = await openRes.text();
let open;
try {
  open = JSON.parse(openTxt);
} catch {
  console.error(`❌ 开启会话非 JSON：${openTxt.slice(0, 200)}`);
  process.exit(1);
}
if (open.OK !== 1) {
  console.error(`❌ 开启会话失败：${JSON.stringify(open).slice(0, 200)}`);
  process.exit(1);
}
const uploadId = open.upload_id;
console.error(`   会话 OK  upload_id=${String(uploadId).slice(0, 24)}…`);

// ── 3. 上传（单分片足够时一次 PUT）─────────────────────
const chunkSize = Number(pre.chunk_size) || 10 * 1024 * 1024;
const chunks = Math.max(1, Math.ceil(size / chunkSize));
const buf = fs.readFileSync(file);

for (let i = 0; i < chunks; i += 1) {
  const start = i * chunkSize;
  const end = Math.min(size, start + chunkSize);
  const part = buf.subarray(start, end);
  const putQ = new URLSearchParams({
    partNumber: String(i + 1),
    uploadId: String(uploadId),
    chunk: String(i),
    chunks: String(chunks),
    size: String(end - start),
    start: String(start),
    end: String(end),
    total: String(size),
  });
  const t0 = Date.now();
  const r = await fetch(`${upUrl}?${putQ}`, {
    method: "PUT",
    headers: { ...auth, "user-agent": UA, referer: "https://member.bilibili.com/", "Content-Type": "application/octet-stream" },
    body: part,
    signal: AbortSignal.timeout(300_000),
  });
  const t = await r.text();
  const ok = r.ok && /SUCCESS|MULTIPART_PUT_SUCCESS/i.test(t + r.status);
  console.error(`   分片 ${i + 1}/${chunks}  ${((end - start) / 1024 / 1024).toFixed(1)}MB  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${ok ? "✓" : "✗ " + t.slice(0, 100)}`);
  if (!ok) {
    console.error("❌ 分片上传失败");
    process.exit(1);
  }
}

// ── 4. 结束上传 ───────────────────────────────────────
const endQ = new URLSearchParams({
  output: "json",
  name,
  profile: "ugcfx/bup",
  uploadId: String(uploadId),
  biz_id: String(pre.biz_id),
  filesize: String(size),
  partsize: String(pre.chunk_size),
});
const endRes = await fetch(`${upUrl}?${endQ}`, {
  method: "POST",
  headers: { ...auth, "user-agent": UA, referer: "https://member.bilibili.com/" },
  signal: AbortSignal.timeout(60_000),
});
const endTxt = await endRes.text();
console.error(`   结束上传：${endTxt.slice(0, 160)}`);

const result = {
  mode: opt.publish ? "publish" : "upload-only",
  uploaded: true,
  name,
  size,
  biz_id: pre.biz_id,
  upos_uri: pre.upos_uri,
  filename: String(pre.upos_uri).replace("upos://", "").replace(/\.[^.]+$/, ""),
  cid: pre.biz_id,
};

if (!opt.publish) {
  console.log(JSON.stringify(result, null, 2));
  console.error("✅ 上传完成，**没有提交投稿** —— 文件在你的素材区，不会公开");
  process.exit(0);
}

// ── 5. 提交投稿（只有 --publish 才走）──────────────────
const title = String(opt.title || name.replace(/\.[^.]+$/, ""));
const tid = Number(opt.tid || 21);
const tag = String(opt.tag || "AI");
const desc = String(opt.desc || "");

const addUrl = `https://member.bilibili.com/x/vu/web/add/v3?t=${Date.now()}&csrf=${csrf}`;
const addBody = {
  title,
  copyright: 1,
  tid,
  tag,
  desc,
  source: "",
  cover: "",
  videos: [{ filename: result.filename, title: name, desc: "" }],
  dynamic: "",
  interactive: 0,
  act_reserve_create: 0,
  no_disturbance: 0,
  dolby: 0,
  up_selection_reply: false,
  up_close_reply: false,
  up_close_danmu: false,
  watermark: { state: 0 },
};
const addRes = await fetch(addUrl, {
  method: "POST",
  headers: { ...H, "content-type": "application/json" },
  body: JSON.stringify(addBody),
  signal: AbortSignal.timeout(60_000),
});
const addTxt = await addRes.text();
console.error(`   提交投稿：${addTxt.slice(0, 300)}`);
result.publish_response = addTxt.slice(0, 500);
console.log(JSON.stringify(result, null, 2));
