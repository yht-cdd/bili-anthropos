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
const VIDEO_MAX_SEC = 180;     // 单段上限 3 分钟；超过就切段
const VIDEO_MAX_BYTES = 40 * 1024 * 1024;
const SEG_HEIGHT = 720;        // 统一 720P（看清屏幕文字的下限）
const SEG_FPS = 16;            // 16fps：动作够用，体积可控
const PER_SEG_BYTES = 30 * 1024 * 1024;
const SEG_CONCURRENCY = 6;     // 所有段一次性并行送出
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
async function callOnce(model, parts, maxTokens = 100000) {
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
  const h = Math.min(SEG_HEIGHT, p.height || SEG_HEIGHT);
  // 统一 720P / 16fps：这是能看清屏幕文字的底线，再低就认不出字幕
  ff([
    "-i", file,
    "-vf", `scale=-2:${h},fps=${SEG_FPS}`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
    "-c:a", "aac", "-b:a", "64k",
    "-movflags", "+faststart",
    out,
  ], 300_000);
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

/**
 * 切成 ≤segSec 秒的段，统一 720P / 16fps。
 * 段之间用 -ss 定位（放在 -i 前），重编码保证每段都能独立解码。
 */
function splitVideo(file, p, segSec) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  // 最后一段如果太短（<3 秒），模型会直接拒收，并到上一段去
  let n = Math.ceil(p.duration / segSec);
  if (n > 1 && p.duration - (n - 1) * segSec < 3) n -= 1;
  const outs = [];
  const h = Math.min(SEG_HEIGHT, p.height || SEG_HEIGHT);
  for (let i = 0; i < n; i += 1) {
    const start = i * segSec;
    const dur = Math.min(segSec, p.duration - start);
    const out = path.join(TMP_DIR, `seg-${i}-${Date.now()}.mp4`);
    ff(
      [
        "-ss", String(start), "-t", String(dur), "-i", file,
        "-vf", `scale=-2:${h},fps=${SEG_FPS}`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
        "-c:a", "aac", "-b:a", "64k",
        "-movflags", "+faststart",
        out,
      ],
      300_000
    );
    outs.push({ file: out, start, dur, size: fs.statSync(out).size });
  }
  return outs;
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

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

    const forceFrames = cmd === "frames" || opt.quick === true;
    const segLimit = Number(opt.seg) || VIDEO_MAX_SEC;
    const fits = p.duration <= segLimit;
    const segCount = Math.ceil(p.duration / segLimit);

    if (forceFrames) {
      log(`   → 指定抽帧，抽 ${n} 帧拼一张图`);
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
    } else if (fits) {
      log(`   → 直传（${p.duration.toFixed(0)}s ≤ ${VIDEO_MAX_SEC}s）`);
      const v = prepareVideo(file, p);
      const size = fs.statSync(v).size;
      const b64 = fs.readFileSync(v).toString("base64");
      log(`   压到 ${SEG_HEIGHT}P/${SEG_FPS}fps：${Math.round(size / 1024)}KB，base64 ${Math.round(b64.length / 1024)}KB`);
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
    } else if (segCount > 12) {
      // 超过一小时：分块要二十多次调用，不划算，退回抽帧
      log(`   → 超过 1 小时（${segCount} 块），退回抽帧`);
      const { out, cols, rows } = makeGrid(file, p, Math.max(n, 12));
      const b64 = fs.readFileSync(out).toString("base64");
      const ans = await ask([
        {
          type: "text",
          text:
            askText ||
            `这是一段 ${Math.round(p.duration / 60)} 分钟视频的抽样画面，按时间顺序排列。` +
              `请概括主要内容。看不清就说看不清。`,
        },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
      ]);
      console.log(ans);
    } else {
      // 分块：每块 ≤5 分钟，逐块看，最后拼起来
      log(`   → 分 ${segCount} 块（每块 ≤${segLimit}s），并行看完`);
      const segs = splitVideo(file, p, segLimit);
      log(`   切好 ${segs.length} 块：${segs.map((s) => `${Math.round(s.size / 1024)}KB`).join(" / ")}`);

      // 并行跑：串行时 3 块要 3 分钟，并行只要最慢那一块的时长
      const parts = new Array(segs.length);
      let cursor = 0;
      const t0 = Date.now();
      const worker = async () => {
        while (true) {
          const i = cursor;
          cursor += 1;
          if (i >= segs.length) return;
          const s = segs[i];
          const tag = `[${i + 1}/${segs.length} ${mmss(s.start)}]`;
          log(`   ${tag} 开始（${Math.round(s.size / 1024)}KB）`);
          const b64 = fs.readFileSync(s.file).toString("base64");
          try {
            const ans = await ask(
              [
                {
                  type: "text",
                  text:
                    (askText ? `${askText}\n\n` : "") +
                    `这是同一段视频的第 ${i + 1}/${segs.length} 块（${mmss(s.start)}–${mmss(s.start + s.dur)}）。` +
                    `只说这一块里发生了什么：讲了什么、出现什么画面和文字。不要总结全片。`,
                },
                { type: "video_url", video_url: { url: `data:video/mp4;base64,${b64}` } },
              ],
              { maxTokens: 600 }
            );
            parts[i] = `【${mmss(s.start)}–${mmss(s.start + s.dur)}】\n${ans}`;
            log(`   ${tag} 完成`);
          } catch (e) {
            parts[i] = `【${mmss(s.start)}–${mmss(s.start + s.dur)}】\n（这一段没看成：${String(e.message).slice(0, 80)}）`;
            log(`   ${tag} 失败：${String(e.message).slice(0, 60)}`);
          } finally {
            try { fs.unlinkSync(s.file); } catch {}
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(SEG_CONCURRENCY, segs.length) }, () => worker())
      );
      log(`   并行完成，用时 ${Math.round((Date.now() - t0) / 1000)}s`);
      console.log(parts.join("\n\n"));
    }
  } else {
    console.error(`❌ 未知命令：${cmd}\n\n${USAGE}`);
    process.exit(2);
  }
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
