#!/usr/bin/env node
/**
 * gen-media.mjs —— Agnes 出图 / 出片
 * ============================================================
 * 为什么单独一个脚本：
 *   生成是**花钱**的动作。它不该藏在会话里随手调用，
 *   要有额度闸门、要有记账、要能一眼看出最近生成了什么。
 *
 * 实测（2026-10-30，api.agnes-ai.cn）：
 *   图片：POST /v1/images/generations  → 直接返回 url，可用
 *   视频：POST /v1/videos  mode="text"（文生视频）/ mode="keyframe"（首尾帧）
 *         注意 .cn 的接口和 .com 文档不一样：num_frames / duration 都是「禁止字段」，
 *         必须传 mode，否则 400。常见返回 503 video_queue_full（队列满）。
 *
 * 用法：
 *   node gen-media.mjs image --prompt "…" [--size 1024x1024] [--out /path/x.png]
 *   node gen-media.mjs video --prompt "…" [--mode text] [--first-frame a.png] [--out /path/x.mp4]
 *   node gen-media.mjs models            # 看这个 key 能用哪些模型
 *   node gen-media.mjs usage             # 今天的生成记录
 *
 * 凭据：环境变量 AGNES_API_KEY，或 $LIFE_HOME/secrets/agnes_key.txt
 * 退出码：0 成功 / 1 失败 / 3 超额度 / 4 队列满
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const BASE = process.env.AGNES_BASE || "https://api.agnes-ai.cn";
const KEY_FILE = path.join(HOME, "secrets/agnes_key.txt");
const USAGE_FILE = path.join(HOME, "bili/data/gen_usage.jsonl");
const DAILY_MAX = Number(process.env.AGNES_DAILY_MAX || 10);   // 一天最多生成几次，防手滑
const IMAGE_MODEL = process.env.AGNES_IMAGE_MODEL || "agnes-image-2.5-flash";
const VIDEO_MODEL = process.env.AGNES_VIDEO_MODEL || "agnes-video-2.5-flash";

const argv = process.argv.slice(2);
const cmd = argv[0] || "";
const opt = {};
for (let i = 1; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  }
}

function apiKey() {
  const env = String(process.env.AGNES_API_KEY || "").trim();
  if (env) return env;
  try { return fs.readFileSync(KEY_FILE, "utf8").trim(); } catch { return ""; }
}
const KEY = apiKey();
if (!KEY) {
  console.error(`❌ 没有 Agnes key。放到 ${KEY_FILE} 或设 AGNES_API_KEY。`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, { method = "GET", body, timeout = 120_000 } = {}) {
  const r = await fetch(BASE + pathname, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, raw: t };
}

function todayCount() {
  try {
    const day = new Date().toLocaleDateString("sv-SE");
    return fs.readFileSync(USAGE_FILE, "utf8").trim().split("\n")
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((x) => x && String(x.at || "").startsWith(day)).length;
  } catch { return 0; }
}
function record(rec) {
  try {
    fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
    fs.appendFileSync(USAGE_FILE, JSON.stringify({ at: new Date().toISOString(), ...rec }) + "\n");
  } catch {}
}
function gate() {
  if (opt.force) return true;
  const n = todayCount();
  if (n >= DAILY_MAX) {
    console.error(`🚫 今天已经生成 ${n} 次，到上限 ${DAILY_MAX}。真要继续加 --force。`);
    return false;
  }
  return true;
}

async function download(url, out) {
  const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!r.ok) throw new Error(`下载失败 HTTP ${r.status}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  return fs.statSync(out).size;
}

async function genImage() {
  const prompt = String(opt.prompt || "").trim();
  if (!prompt) { console.error('用法: gen-media.mjs image --prompt "描述" [--size 1024x1024]'); return 2; }
  if (!gate()) return 3;

  const size = String(opt.size || "1024x1024");
  const t0 = Date.now();
  const r = await api("/v1/images/generations", {
    method: "POST",
    body: { model: String(opt.model || IMAGE_MODEL), prompt, size, extra_body: { response_format: "url" } },
  });
  if (r.status !== 200) {
    console.error(`❌ 出图失败 HTTP ${r.status}: ${r.raw.slice(0, 200)}`);
    return 1;
  }
  const item = (r.j?.data || [])[0] || {};
  const url = item.url;
  if (!url) { console.error("❌ 返回里没有 url：" + r.raw.slice(0, 200)); return 1; }

  const out = path.resolve(String(opt.out || path.join(HOME, "tmp", `img-${Date.now()}.png`)));
  const bytes = await download(url, out);
  record({ kind: "image", model: String(opt.model || IMAGE_MODEL), prompt: prompt.slice(0, 120), size, bytes, ms: Date.now() - t0, out });
  console.log(JSON.stringify({ ok: true, kind: "image", file: out, bytes, size, ms: Date.now() - t0, url }, null, 2));
  return 0;
}

/** 任务状态：.cn 的查询路径没在文档里写，两种都试一遍 */
async function videoStatus(id) {
  const cands = [`/v1/videos/${id}`, `/agnesapi?video_id=${id}`, `/v1/videos/query?id=${id}`];
  for (const p of cands) {
    const r = await api(p, { timeout: 30_000 });
    if (r.status === 200 && r.j) return { path: p, j: r.j };
  }
  return null;
}

function pickStatus(j) {
  const d = j?.data || j;
  return String(d?.status || d?.state || d?.task_status || "").toLowerCase();
}
function pickUrl(j) {
  const d = j?.data || j;
  return d?.video_url || d?.url || d?.output || (Array.isArray(d) ? d[0]?.url : "") || "";
}

async function genVideo() {
  const prompt = String(opt.prompt || "").trim();
  if (!prompt) { console.error('用法: gen-media.mjs video --prompt "描述" [--mode text|keyframe] [--first-frame x.png]'); return 2; }
  if (!gate()) return 3;

  const mode = String(opt.mode || (opt["first-frame"] ? "keyframe" : "text"));
  const body = { model: String(opt.model || VIDEO_MODEL), prompt, mode };

  if (mode === "keyframe") {
    if (!opt["first-frame"]) { console.error("❌ keyframe 模式需要 --first-frame <图片>"); return 2; }
    const p = path.resolve(String(opt["first-frame"]));
    body.first_frame = `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
    if (opt["last-frame"]) {
      const q = path.resolve(String(opt["last-frame"]));
      body.last_frame = `data:image/png;base64,${fs.readFileSync(q).toString("base64")}`;
    }
  }

  const t0 = Date.now();
  const r = await api("/v1/videos", { method: "POST", body, timeout: 90_000 });
  if (r.status === 503) {
    console.error(`⏳ 视频队列满了（不是我们的错）。过一会儿再试。${r.raw.slice(0, 120)}`);
    return 4;
  }
  if (r.status !== 200) {
    console.error(`❌ 建任务失败 HTTP ${r.status}: ${r.raw.slice(0, 240)}`);
    return 1;
  }
  const d = r.j?.data || r.j || {};
  const id = d.video_id || d.task_id || d.id;
  if (!id) { console.error("❌ 返回里没有任务 id：" + r.raw.slice(0, 240)); return 1; }
  console.error(`  任务 ${id} 已创建，等结果…`);

  const deadline = Date.now() + Number(opt.timeout || 900) * 1000;
  while (Date.now() < deadline) {
    await sleep(8000);
    const st = await videoStatus(id);
    if (!st) continue;
    const s = pickStatus(st.j);
    process.stderr.write(`  状态 ${s || "?"}\r`);
    if (/(succeed|success|complete|done|finished)/.test(s)) {
      const url = pickUrl(st.j);
      if (!url) { console.error("\n❌ 完成了但没找到视频地址：" + JSON.stringify(st.j).slice(0, 240)); return 1; }
      const out = path.resolve(String(opt.out || path.join(HOME, "tmp", `video-${Date.now()}.mp4`)));
      const bytes = await download(url, out);
      record({ kind: "video", model: String(opt.model || VIDEO_MODEL), prompt: prompt.slice(0, 120), mode, bytes, ms: Date.now() - t0, out, id });
      console.log("");
      console.log(JSON.stringify({ ok: true, kind: "video", file: out, bytes, ms: Date.now() - t0, id, url }, null, 2));
      return 0;
    }
    if (/(fail|error|cancel)/.test(s)) {
      console.error("\n❌ 任务失败：" + JSON.stringify(st.j).slice(0, 300));
      return 1;
    }
  }
  console.error(`\n⏳ 等超时了，任务 id ${id} 还在跑。可以稍后用 id 查。`);
  return 1;
}

(async () => {
  if (cmd === "image") process.exit(await genImage());
  if (cmd === "video") process.exit(await genVideo());

  if (cmd === "models") {
    const r = await api("/v1/models", { timeout: 30_000 });
    if (r.status !== 200) { console.error(`❌ HTTP ${r.status} ${r.raw.slice(0, 160)}`); process.exit(1); }
    for (const m of r.j?.data || []) console.log(m.id);
    process.exit(0);
  }

  if (cmd === "usage") {
    const day = new Date().toLocaleDateString("sv-SE");
    let rows = [];
    try {
      rows = fs.readFileSync(USAGE_FILE, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => String(x.at).startsWith(day));
    } catch {}
    console.log(JSON.stringify({ date: day, count: rows.length, limit: DAILY_MAX, items: rows.map((x) => ({ kind: x.kind, at: x.at, bytes: x.bytes, prompt: x.prompt })) }, null, 2));
    process.exit(0);
  }

  console.error("用法：node gen-media.mjs <image|video|models|usage> ...");
  process.exit(2);
})();
