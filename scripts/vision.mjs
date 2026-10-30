#!/usr/bin/env node
/**
 * vision.mjs —— 外置视觉：把图片 / 视频交给魔搭的模型看，换回一段纯文字
 * ============================================================
 * 为什么不走 opencode：
 *   1. 不占她的上下文。一条十分钟视频的描述可能几千字，但她只需要结论
 *   2. 额度、降级、压缩、记账都在一处，出问题只查这一个文件
 *   3. 换模型只改一个常量
 *
 * 用法：
 *   node vision.mjs check                              自检（token / 连通 / 额度）
 *   node vision.mjs image <文件> [--ask "问题"]
 *   node vision.mjs video <文件> [--ask "问题"]        短片直传，长片自动抽帧
 *   node vision.mjs frames <视频> [--n 9] [--ask "问题"]  强制抽帧九宫格
 *
 * 前提：
 *   /opt/life/secrets/modelscope_token.txt  （600 权限）
 *   到 https://modelscope.cn/my/myaccesstoken 申请，不要提交进仓库
 *
 * 实测过的坑（2026-10-30）：
 *   · 640×320 的图会被读错，1280×640 才对 —— 分辨率决定对错，不是模型不行
 *   · 视频必须带 data:video/mp4;base64, 前缀，裸 base64 会被拒
 *   · 120 秒 / 396KB 可以直传；再长就抽帧，别硬塞
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// ── 配置 ──────────────────────────────────────────────
const HOME = process.env.LIFE_HOME || "/opt/life";
const TOKEN_FILE = path.join(HOME, "secrets/modelscope_token.txt");
const QUOTA_FILE = path.join(HOME, "bili/data/vision_quota.json");
const TMP_DIR = path.join(HOME, "tmp/vision");

const BASE = "https://api-inference.modelscope.cn/v1";

// 固定用 Qwen3.8-Flash：视频 12 秒级、图片 1.2 秒级，速度和准确度最平衡
const MODEL = "Qwen/Qwen3.8-Flash-Next";
const FALLBACK = ["Qwen/Qwen3.5-122B-A10B", "Shanghai_AI_Laboratory/Intern-S2-Preview"];

const LONG_EDGE = 1568;        // 长边上限（再大只是浪费 token）
const MIN_EDGE = 1024;         // 低于这个会读不准，提醒调用方
const VIDEO_MAX_SEC = 120;     // 直传上限（实测 120s 可过）
const VIDEO_MAX_BYTES = 6 * 1024 * 1024;
const FRAMES_DEFAULT = 9;
const TILE = 720;

// ── 工具 ──────────────────────────────────────────────
const log = (...a) => console.error(...a);

function token() {
  let t = "";
  try {
    t = fs.readFileSync(TOKEN_FILE, "utf8").trim();
  } catch {}
  if (!t) {
    console.error(
      `❌ 缺少魔搭 token：${TOKEN_FILE}\n` +
        `   到 https://modelscope.cn/my/myaccesstoken 生成，然后：\n` +
        `     echo '<你的token>' > ${TOKEN_FILE} && chmod 600 ${TOKEN_FILE}\n` +
        `   这个文件不能进 git。`
    );
    process.exit(2);
  }
  return t;
}

function ff(args, timeout = 180_000) {
  return execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    encoding: "utf8",
    timeout,
    maxBuffer: 32 * 1024 * 1024,
  });
}

function probe(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration,size:stream=codec_type,width,height", "-of", "json", file],
    { encoding: "utf8", timeout: 30_000 }
  );
  const j = JSON.parse(out);
  const v = (j.streams || []).find((s) => s.codec_type === "video") || {};
  return {
    duration: Number(j.format?.duration || 0),
    size: Number(j.format?.size || 0),
    width: Number(v.width || 0),
    height: Number(v.height || 0),
    hasAudio: (j.streams || []).some((s) => s.codec_type === "audio"),
  };
}

// ── 额度记账 ──────────────────────────────────────────
const today = () => new Date().toLocaleDateString("sv-SE");
function quota() {
  let q = { date: today(), count: 0, byModel: {} };
  try {
    const j = JSON.parse(fs.readFileSync(QUOTA_FILE, "utf8"));
    if (j && j.date === today()) q = j;
  } catch {}
  return q;
}
function quotaAdd(model) {
  const q = quota();
  q.count += 1;
  q.byModel[model] = (q.byModel[model] || 0) + 1;
  try {
    fs.mkdirSync(path.dirname(QUOTA_FILE), { recursive: true });
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(q, null, 2) + "\n");
  } catch {}
  return q;
}

// ── 请求 ──────────────────────────────────────────────
async function callOnce(model, parts, maxTokens = 900) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: parts }],
    }),
    signal: AbortSignal.timeout(240_000),
  });
  const txt = await r.text();
  let j;
  try {
    j = JSON.parse(txt);
  } catch {
    return { ok: false, ms: Date.now() - t0, err: `非 JSON（HTTP ${r.status}）：${txt.slice(0, 120)}` };
  }
  if (j.error) {
    return { ok: false, ms: Date.now() - t0, err: JSON.stringify(j.error).slice(0, 200) };
  }
  const ans = String(j.choices?.[0]?.message?.content ?? "").trim();
  if (!ans) return { ok: false, ms: Date.now() - t0, err: "空回答" };
  return { ok: true, ms: Date.now() - t0, ans };
}

/** 主模型失败就换备用；全挂才报错 */
async function ask(parts, { maxTokens } = {}) {
  const chain = [MODEL, ...FALLBACK];
  let lastErr = "";
  for (const m of chain) {
    try {
      const r = await callOnce(m, parts, maxTokens);
      if (r.ok) {
        quotaAdd(m);
        log(`   ✓ ${m}  ${(r.ms / 1000).toFixed(1)}s`);
        return r.ans;
      }
      lastErr = `${m}: ${r.err}`;
      log(`   ✗ ${m}  ${r.err}`);
    } catch (e) {
      lastErr = `${m}: ${e.message}`;
      log(`   ✗ ${m}  ${e.message}`);
    }
  }
  throw new Error("所有视觉模型都失败了。最后一个错误：" + lastErr);
}

// ── 图片 ──────────────────────────────────────────────
function prepareImage(file) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const p = probe(file);
  const longer = Math.max(p.width, p.height);

  if (longer < MIN_EDGE) {
    log(`   ⚠️ 图片只有 ${p.width}×${p.height}，长边低于 ${MIN_EDGE}，可能读不准`);
  }

  const out = path.join(TMP_DIR, `img-${Date.now()}.jpg`);
  const scale = longer > LONG_EDGE
    ? `scale='min(${LONG_EDGE},iw)':'min(${LONG_EDGE},ih)':force_original_aspect_ratio=decrease`
    : "scale=iw:ih";
  ff(["-i", file, "-vf", scale, "-q:v", "3", "-frames:v", "1", out]);
  return out;
}

// ── 视频 ──────────────────────────────────────────────
function prepareVideo(file, p) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const out = path.join(TMP_DIR, `vid-${Date.now()}.mp4`);
  // 直传时降到 480p，体积够小、画面还看得清
  ff([
    "-i", file,
    "-vf", "scale=-2:480",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
    "-c:a", "aac", "-b:a", "64k",
    "-movflags", "+faststart",
    out,
  ]);
  return out;
}

function makeGrid(file, p, n) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const out = path.join(TMP_DIR, `grid-${Date.now()}.jpg`);
  const dur = Math.max(1, p.duration);
  const fps = Math.max(0.01, n / dur);
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  ff([
    "-i", file,
    "-vf", `fps=${fps.toFixed(4)},scale=${TILE}:-2,tile=${cols}x${rows}`,
    "-frames:v", "1",
    "-q:v", "3",
    out,
  ], 240_000);
  return { out, cols, rows };
}

// ── 入口 ──────────────────────────────────────────────
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = {};
let file = "";
for (let i = 1; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else {
      opt[argv[i].slice(2)] = v;
      i += 1;
    }
  } else if (!file) file = argv[i];
}

const USAGE = `用法：
  node vision.mjs check
  node vision.mjs image <文件> [--ask "问题"]
  node vision.mjs video <文件> [--ask "问题"]
  node vision.mjs frames <视频> [--n 9] [--ask "问题"]`;

if (!cmd || cmd === "help") {
  console.log(USAGE);
  process.exit(0);
}

if (cmd === "check") {
  const t = token();
  const q = quota();
  console.log(`token     : ${t.slice(0, 6)}…${t.slice(-4)}（${t.length} 字符）`);
  console.log(`模型       : ${MODEL}`);
  console.log(`备用       : ${FALLBACK.join(" / ")}`);
  console.log(`今日调用   : ${q.count} 次`);
  try {
    const r = await fetch(`${BASE}/models`, {
      headers: { Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(20_000),
    });
    const j = await r.json();
    console.log(`连通性     : HTTP ${r.status}，可用模型 ${j.data?.length ?? 0} 个`);
  } catch (e) {
    console.log(`连通性     : ❌ ${e.message}`);
  }
  process.exit(0);
}

if (!file || !fs.existsSync(file)) {
  console.error(`❌ 文件不存在：${file || "(没给)"}\n\n${USAGE}`);
  process.exit(2);
}

const askText = typeof opt.ask === "string" ? opt.ask : "";

try {
  if (cmd === "image") {
    log(`🖼  图片：${file}`);
    const img = prepareImage(file);
    const b64 = fs.readFileSync(img).toString("base64");
    log(`   送图 ${Math.round(b64.length / 1024)}KB(base64)`);
    const ans = await ask([
      { type: "text", text: askText || "描述这张图里有什么。如果有文字，原文抄下来。" },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
    ]);
    console.log(ans);
  } else if (cmd === "video" || cmd === "frames") {
    const p = probe(file);
    log(`🎬 视频：${file}`);
    log(`   ${p.width}×${p.height}  ${p.duration.toFixed(1)}s  ${Math.round(p.size / 1024)}KB  音轨=${p.hasAudio ? "有" : "无"}`);
    const n = Number(opt.n || FRAMES_DEFAULT);

    const tooLong = p.duration > VIDEO_MAX_SEC;
    const tooBig = p.size > VIDEO_MAX_BYTES;
    const forceFrames = cmd === "frames";

    if (forceFrames || tooLong || tooBig) {
      const why = forceFrames ? "指定抽帧" : tooLong ? `超过 ${VIDEO_MAX_SEC}s` : "文件过大";
      log(`   → ${why}，改抽 ${n} 帧拼一张图`);
      const { out, cols, rows } = makeGrid(file, p, n);
      const b64 = fs.readFileSync(out).toString("base64");
      log(`   送图 ${Math.round(b64.length / 1024)}KB(base64)，${cols}×${rows} 网格`);
      const ans = await ask([
        {
          type: "text",
          text:
            askText ||
            `这是一段 ${Math.round(p.duration)} 秒视频的 ${n} 帧画面，按时间顺序从左到右、从上到下排列。` +
              `请描述视频讲了什么：先概括，再按顺序说关键画面。看不清就说看不清，不要猜。`,
        },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
      ]);
      console.log(ans);
    } else {
      log(`   → 直传（${p.duration.toFixed(0)}s ≤ ${VIDEO_MAX_SEC}s）`);
      const v = prepareVideo(file, p);
      const size = fs.statSync(v).size;
      const b64 = fs.readFileSync(v).toString("base64");
      log(`   压到 480p：${Math.round(size / 1024)}KB，base64 ${Math.round(b64.length / 1024)}KB`);
      const ans = await ask([
        {
          type: "text",
          text:
            askText ||
            "这个视频讲了什么？先一句话概括，再说关键画面和出现的信息。不确定就说不确定。",
        },
        { type: "video_url", video_url: { url: `data:video/mp4;base64,${b64}` } },
      ]);
      console.log(ans);
      try { fs.unlinkSync(v); } catch {}
    }
  } else {
    console.error(`❌ 未知命令：${cmd}\n\n${USAGE}`);
    process.exit(2);
  }
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
