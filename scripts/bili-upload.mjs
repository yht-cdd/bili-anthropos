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
 *   # 文件已经传好了，只补一次投稿提交（凭证 5 天内有效，不用再传一遍）
 *   node bili-upload.mjs --publish --title "标题" --tid 231 --tag a,b \
 *        --resume-filename ugcfxever/xxxx --resume-cid 43273030045
 *
 *   # 补改已发布稿件的简介 / 标签 / 话题（走 member.bilibili.com/x/vu/web/edit）
 *   node bili-upload.mjs --edit-bvid BV1xxxx --desc "简介" --tag a,b --topic 1335021
 *
 * 注意：
 *   · 参数 r 必须是 upos（不是 mp4），否则 404
 *   · 上传凭证 5 天有效
 *   · 单文件 ≤100MB 走单分片；更大要真的切块传
 *   · 封口（end）**必须带 {"parts":[…]} 的 JSON body**。少了它 B 站会把对象
 *     当成没封口，add/v3 报 21015「第(1)个视频可能上传过程出现问题」——
 *     这一步返回 OK=1 也不代表封好了，是假通（2026-11-03 实测）
 *   · videos[].filename 不带扩展名，封口 name 带扩展名；videos[].cid = biz_id
 *   · tag 是**逗号分隔字符串**（不是 JSON 数组），2026-11-03 用 edit 接口实测确认：
 *     传 "AI,人工智能,AI Agent" 读回就是这 5 个 tag。稿件 desc/tag 为空**不是格式问题**，
 *     是 add/v3 提交时压根没带 --desc / --tag（脚本默认 desc 为空串、tag 默认 "AI"）。
 *     验收要看 member 侧 archive.desc/tag，不能只看「稿件出现」。
 *   · 话题（topic）有可靠字段：topic_id + topic_detail{from_topic_id,from_source}，
 *     走 add/v3 和 edit 都有效（BV1Re4T6jECR 实测 topic_id 读回 1335021「2026科技猎手」）。
 *     话题 id 用 `--topic-search "关键词"` 查（app.bilibili.com/x/topic/pub/search，
 *     参数名是 keywords 不是 keyword）。注意 /x/vupre/web/topic/type 长期 20003，
 *     别在它上面耗时间。
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

// --resume-filename：文件已经传好了，跳过上传，只补提交（投稿失败重试用，不用再传一遍）
const resume = String(opt["resume-filename"] || "");
const resumeCid = String(opt["resume-cid"] || "");
// --edit-bvid：改已发布稿件的元信息（desc/tag/topic/cover），不重新上传视频
const editBvid = String(opt["edit-bvid"] || "");
// --topic：话题 id（数字）。--topic-search：按关键词查话题 id，查完就退出
const topicId = Number(opt.topic || 0) || 0;
const topicSearch = String(opt["topic-search"] || "");

if (topicSearch) {
  // 话题搜索：/x/vupre/web/topic/type 长期 20003（实测 2026-11-03），能用的只有 app 端这个
  // 参数名是 keywords（keyword 会被忽略、静默返回默认热门榜 —— 差点因此查错）
  const r = await fetch(
    "https://app.bilibili.com/x/topic/pub/search?" +
      new URLSearchParams({ keywords: topicSearch, page_num: "1", page_size: "20" }),
    { headers: { "user-agent": UA, referer: "https://www.bilibili.com/" }, signal: AbortSignal.timeout(20_000) }
  );
  const j = await r.json().catch(() => null);
  if (!j || j.code !== 0) {
    console.error(`❌ 话题搜索失败 code=${j && j.code} ${(j && j.message) || ""}`);
    process.exit(1);
  }
  const items = (j.data && j.data.topic_items) || [];
  console.log(`=== 话题搜索「${topicSearch}」（${items.length} 条，★=播放过千万）===`);
  for (const it of items) {
    const big = it.view >= 10_000_000 ? " ★" : "";
    console.log(`  ${it.id}  ${it.name}  播放=${it.view} 讨论=${it.discuss}${big}`);
  }
  process.exit(0);
}

if (editBvid) {
  const ok = await editMeta(editBvid);
  process.exit(ok ? 0 : 1);
}

if ((!file || !fs.existsSync(file)) && !resume) {
  console.error(
    "用法: node bili-upload.mjs <文件> [--dry] [--publish --title T --tid 21 --tag a,b --desc D --topic ID]\n" +
      "  --dry      只 preupload，不上传\n" +
      "  (默认)     上传但不提交\n" +
      "  --publish  上传并提交投稿\n" +
      "  --resume-filename X --resume-cid N  跳过上传，用已传好的文件补提交\n" +
      "  --edit-bvid BV1xxx [--desc D] [--tag a,b] [--topic ID] [--title T]  改已发布稿件\n" +
      "  --topic-search \"关键词\"              查话题 id（★=播放过千万）"
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

const size = file ? fs.statSync(file).size : 0;
const name = path.basename(file || "");
if (size) console.error(`📦 ${name}  ${(size / 1024 / 1024).toFixed(1)} MB`);
if (resume) {
  // 文件已经在素材区，跳过上传，直接走第 5 步补提交
  const cid = Number(resumeCid) || 0;
  const result = { mode: "publish", uploaded: false, resumed: true, biz_id: cid, filename: resume, cid };
  const okAdd = await submitAdd(result);
  console.log(JSON.stringify(result, null, 2));
  process.exit(okAdd ? 0 : 1);
}

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

// 封口要回传每个分片的 partNumber + eTag。两个上游实现（bilibili-api-python
// 的 _complete_page、biliup-rs 的 get_ret_video_info）都证实：bup 协议下 eTag
// 值本身服务端不校验（它们直接写死 "etag"），**但 parts 数组必须有**。
const parts = [];

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
  const etag = String(r.headers.get("etag") || "").replace(/^"|"$/g, "") || "etag";
  parts.push({ partNumber: i + 1, eTag: etag });
  console.error(`   分片 ${i + 1}/${chunks}  ${((end - start) / 1024 / 1024).toFixed(1)}MB  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${ok ? "✓" : "✗ " + t.slice(0, 100)}`);
  if (!ok) {
    console.error("❌ 分片上传失败");
    process.exit(1);
  }
}

// ── 4. 封口（结束上传）────────────────────────────────
// ⚠️ 这一步必须带 {"parts":[…]} 的 JSON body + Content-Type: application/json。
// 少了它：服务端可能仍回 OK=1，但对象没真正封口，后面 add/v3 必吃 21015
// 「第(1)个视频可能上传过程出现问题」——这就是我们之前撞的墙（2026-11-03）。
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
  headers: {
    ...auth,
    "user-agent": UA,
    referer: "https://member.bilibili.com/",
    "content-type": "application/json; charset=UTF-8",
  },
  body: JSON.stringify({ parts }),
  signal: AbortSignal.timeout(60_000),
});
const endTxt = await endRes.text();
console.error(`   封口：${endTxt.slice(0, 160)}`);
let endJson = null;
try {
  endJson = JSON.parse(endTxt);
} catch {
  console.error("❌ 封口返回非 JSON，视为失败");
  process.exit(1);
}
if (endJson.OK !== 1) {
  console.error(`❌ 封口未确认（OK=${endJson.OK} code=${endJson.code} ${endJson.message || ""}）`);
  process.exit(1);
}
console.error(`   封口确认 OK  key=${endJson.key || "-"}`);

// filename 必须是「不带 bucket、不带扩展名」的裸文件名：
//   ✔ n261103a21uv2rsqeyv6g029h6lkjvmc        （add/v3 认这个）
//   ✘ ugcfxever/n261103a…                     （带 bucket → 21015，2026-11-03 实测）
//   ✘ n261103a21uv2rsqeyv6g029h6lkjvmc.mp4    （带扩展名）
// 封口返回的 key 形如 "/n261….mp4"（无 bucket），upos_uri 形如 "upos://ugcfxever/n261….mp4"，
// 统一取最后一段再去扩展名。封口用的 name 反而要带扩展名 —— 两者不一样。
const finalKey = String(endJson.key || pre.upos_uri || "")
  .replace(/^upos:\/\//, "")
  .split("/")
  .filter(Boolean)
  .pop() || "";
const result = {
  mode: opt.publish ? "publish" : "upload-only",
  uploaded: true,
  name,
  size,
  biz_id: pre.biz_id,
  upos_uri: pre.upos_uri,
  // filename 不带扩展名（file_stem）；封口用的 name 带扩展名 —— 两者不一样
  filename: finalKey.replace(/\.[^.]+$/, ""),
  cid: pre.biz_id,
};

if (!opt.publish) {
  console.log(JSON.stringify(result, null, 2));
  console.error("✅ 上传完成，**没有提交投稿** —— 文件在你的素材区，不会公开");
  process.exit(0);
}

const okAdd = await submitAdd(result);
console.log(JSON.stringify(result, null, 2));
process.exit(okAdd ? 0 : 1);

// ── 5. 提交投稿（只有 --publish / --resume 才走）─────────
async function submitAdd(res) {
  const title = String(opt.title || name.replace(/\.[^.]+$/, "") || "未命名视频");
  const tid = Number(opt.tid || 21);
  const tag = String(opt.tag || "AI");
  const desc = String(opt.desc || "");

  // 封面：add/v3 不接受空 cover —— 不给就自己截一帧传上去（bilibili-api-python
  // 的上传流程也是先 upload_cover 再 submit，从不发空串）
  let cover = String(opt.cover || "");
  if (!cover && file && fs.existsSync(file)) {
    try {
      cover = await uploadCoverFromVideo(file);
    } catch (e) {
      console.error(`   ⚠️ 自动封面失败：${String(e).slice(0, 120)}`);
    }
  }

  const addUrl = `https://member.bilibili.com/x/vu/web/add/v3?t=${Date.now()}&csrf=${csrf}`;
  // 字段对照 bilibili-api-python 的 VideoMeta.__dict__()（pip 包 17.4.2）：
  // videos[].cid 必带、desc_format_id/recreate/subtitle/web_os 为网页端固定携带项
  const addBody = {
    title,
    copyright: 1,
    tid,
    tag,
    desc_format_id: 9999,
    desc,
    source: "",
    cover,
    videos: [{ filename: res.filename, title, desc: "", cid: Number(res.cid) || Number(res.biz_id) }],
    recreate: -1,
    dynamic: "",
    interactive: 0,
    act_reserve_create: 0,
    no_disturbance: 0,
    no_reprint: 0,
    subtitle: { open: 0, lan: "" },
    dolby: 0,
    lossless_music: 0,
    up_selection_reply: false,
    up_close_reply: false,
    up_close_danmu: false,
    web_os: 1,
    watermark: { state: 0 },
    csrf,
  };
  // 话题：bilibili-api-python VideoMeta 只把 topic_id / topic_detail / mission_id 写进 meta，
  // 且值为 None 时整个字段删掉。这里只在给了 --topic 时才加，避免空值干扰。
  if (topicId) {
    addBody.topic_id = topicId;
    addBody.topic_detail = { from_topic_id: topicId, from_source: "arc.web.recommend" };
    addBody.mission_id = 0;
  }
  const addRes = await fetch(addUrl, {
    method: "POST",
    headers: { ...H, "content-type": "application/json" },
    body: JSON.stringify(addBody),
    signal: AbortSignal.timeout(60_000),
  });
  const addTxt = await addRes.text();
  console.error(`   提交投稿：${addTxt.slice(0, 300)}`);
  res.publish_response = addTxt.slice(0, 500);
  let addJson = null;
  try {
    addJson = JSON.parse(addTxt);
  } catch {}
  if (addJson && addJson.code === 0 && addJson.data && addJson.data.bvid) {
    res.bvid = addJson.data.bvid;
    res.aid = addJson.data.aid;
    console.error(`✅ 投稿成功 ${addJson.data.bvid}（aid=${addJson.data.aid}）—— 进审核队列`);
    return true;
  }
  console.error(`❌ 投稿未成功 code=${addJson && addJson.code} ${addJson && addJson.message || ""}`);
  return false;
}

// 改已发布稿件的元信息（desc / tag / topic / title / cover）。
// 为什么单独一条路：add/v3 是「新建」，改稿走 member.bilibili.com/x/vu/web/edit，
// 且必须带上原有 videos[]（title/desc/filename/cid）——少一个就报
// 21011「新增稿件分P不能为空」（2026-11-03 实测）。改完会重新进审核，状态会变成
// 「修改内容待审核」，这是正常代价，调用方要如实报给用户。
async function editMeta(bvid) {
  const UA_M = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
  // 先取原稿全部字段（edit 接口要「整份覆盖」，不能只发改动的几项）
  const src = await fetch(
    `https://member.bilibili.com/x/vupre/web/archive/view?topic_grey=1&bvid=${encodeURIComponent(bvid)}`,
    { headers: { "user-agent": UA_M, referer: "https://member.bilibili.com/", cookie }, signal: AbortSignal.timeout(30_000) }
  );
  const sj = await src.json().catch(() => null);
  if (!sj || sj.code !== 0 || !sj.data || !sj.data.archive) {
    console.error(`❌ 取原稿失败 code=${sj && sj.code} ${(sj && sj.message) || ""}`);
    return false;
  }
  const a = sj.data.archive;
  const vids = sj.data.videos || [];
  if (!vids.length || !vids[0].filename) {
    console.error("❌ 原稿没有分P信息，无法改（edit 需要 videos[]）");
    return false;
  }
  const title = String(opt.title || a.title);
  const tag = String(opt.tag || a.tag || "");
  const desc = String(opt.desc === undefined ? a.desc || "" : opt.desc);
  const topic = Number(opt.topic || 0) || a.topic_id || 0;

  const body = {
    aid: a.aid,
    title,
    copyright: a.copyright,
    tid: a.tid,
    tag,
    desc,
    desc_format_id: 9999,
    dynamic: a.dynamic || "",
    interactive: 0,
    act_reserve_create: 0,
    no_disturbance: 0,
    no_reprint: a.no_reprint || 0,
    subtitle: { open: 0, lan: "" },
    web_os: 2, // 编辑页固定 2（投稿页是 1）
    new_web_edit: 1,
    handle_staff: false,
    topic_grey: 1,
    cover: a.cover,
    source: a.source || "",
    dolby: 0,
    lossless_music: 0,
    up_selection_reply: false,
    up_close_reply: false,
    up_close_danmu: false,
    watermark: { state: 0 },
    videos: vids.map((v) => ({ title: v.title, desc: v.desc || "", filename: v.filename, cid: v.cid })),
    csrf,
  };
  if (topic) {
    body.topic_id = topic;
    body.topic_detail = { from_topic_id: topic, from_source: "arc.web.recommend" };
    body.mission_id = 0;
  }

  const r = await fetch(
    `https://member.bilibili.com/x/vu/web/edit?t=${Math.floor(Date.now() / 1000)}&csrf=${csrf}`,
    {
      method: "POST",
      headers: { ...H, "content-type": "application/json;charset=UTF-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    }
  );
  const t = await r.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {}
  if (!j || j.code !== 0) {
    console.error(`❌ 改稿失败 code=${j && j.code} ${(j && j.message) || ""} ${t.slice(0, 150)}`);
    return false;
  }
  console.error(`✅ 改稿提交 ${bvid} —— 会重新进审核`);

  // 回读一遍：desc/tag 是不是真的落库（「提交成功」≠「内容进去了」，2026-11-03 教训）
  await new Promise((s) => setTimeout(s, 6000));
  const chk = await fetch(
    `https://member.bilibili.com/x/vupre/web/archive/view?topic_grey=1&bvid=${encodeURIComponent(bvid)}`,
    { headers: { "user-agent": UA_M, referer: "https://member.bilibili.com/", cookie }, signal: AbortSignal.timeout(30_000) }
  );
  const cj = await chk.json().catch(() => null);
  const ca = (cj && cj.data && cj.data.archive) || null;
  if (!ca) {
    console.error("   ⚠️ 回读失败，无法确认 desc/tag 是否落库");
    return true;
  }
  console.error(`   回读：desc=${ca.desc ? ca.desc.length + " 字" : "空"} tag=${JSON.stringify(ca.tag)} topic=${ca.topic_id}(${ca.topic_name || "-"}) 状态=${ca.state_desc}`);
  console.log(JSON.stringify({ bvid, desc: ca.desc, tag: ca.tag, topic_id: ca.topic_id, topic_name: ca.topic_name, state: ca.state_desc }, null, 2));
  if (!ca.desc && desc) console.error("   ❌ desc 没写进去");
  if (!ca.tag && tag) console.error("   ❌ tag 没写进去");
  return true;
}

// 用 ffmpeg 截一帧 → POST cover/up 拿图床 URL。只读本地文件，不碰 secrets 之外的东西
async function uploadCoverFromVideo(src) {
  const { execFileSync } = await import("node:child_process");
  const jpg = `/tmp/opencode/upload-cover-${Date.now()}.jpg`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-ss", "1", "-frames:v", "1", "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720", jpg], {
    timeout: 60_000,
  });
  const b64 = fs.readFileSync(jpg).toString("base64");
  fs.unlinkSync(jpg);
  const body = new URLSearchParams({ cover: `data:image/png;base64,${b64}`, csrf, ts: String(Date.now()) });
  const r = await fetch("https://member.bilibili.com/x/vu/web/cover/up?ts=" + Date.now(), {
    method: "POST",
    headers: { ...H, "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(60_000),
  });
  const j = await r.json().catch(() => null);
  if (!j || j.code !== 0 || !j.data || !j.data.url) {
    throw new Error(`cover/up code=${j && j.code}`);
  }
  console.error(`   自动封面：${j.data.url}`);
  return j.data.url;
}
