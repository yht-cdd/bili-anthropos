#!/usr/bin/env node
/**
 * gen-media.mjs —— 图片 / 视频生成适配层
 * ============================================================
 * 这个脚本**不绑定任何供应商**。
 * 谁想用哪家（OpenAI 风格 / 自建 / 云厂商），只要在 config/media-api.json 里填
 * 地址、路径、模型名，就能接上；换供应商不用改代码。
 *
 * 为什么要有这一层：
 *   生成是**花钱**的动作，不该散落在会话里随手调用。它需要
 *   额度闸门、记账、以及一个「换供应商只改配置」的接缝。
 *
 * 用法：
 *   node gen-media.mjs image --prompt "…" [--size 1024x1024] [--out /path/x.png]
 *   node gen-media.mjs video --prompt "…" [--mode text] [--first-frame a.png] [--out /path/x.mp4]
 *   node gen-media.mjs models        # 列出这家服务可用的模型（GET {imagePath 的父级}/models 或 baseUrl/v1/models）
 *   node gen-media.mjs usage         # 今天的生成记录
 *
 * 配置：$LIFE_HOME/config/media-api.json（结构见 config/media-api.example.json）
 * 凭据：配置文件里的 keyFile，或环境变量 MEDIA_API_KEY
 * 退出码：0 成功 / 1 失败 / 2 参数或配置错 / 3 超额度 / 4 服务端排队满
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const CFG_FILE = process.env.MEDIA_CONFIG || path.join(HOME, "config/media-api.json");
const USAGE_FILE = path.join(HOME, "bili/data/gen_usage.jsonl");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CFG_FILE, "utf8"));
  } catch {
    return null;
  }
}
const CFG = loadConfig();

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

if (!CFG && cmd !== "") {
  console.error(`❌ 没有配置文件 ${CFG_FILE}\n   照 config/media-api.example.json 抄一份，填上你自己的服务地址和模型名。`);
  process.exit(2);
}

const BASE = String(process.env.MEDIA_BASE || CFG?.baseUrl || "").replace(/\/+$/, "");
const KEY_FILE = path.join(HOME, CFG?.keyFile || "secrets/media_api_key.txt");
const DAILY_MAX = Number(process.env.MEDIA_DAILY_MAX || CFG?.dailyMax || 10);
const IMAGE = CFG?.image || {};
const VIDEO = CFG?.video || {};

function apiKey() {
  const env = String(process.env.MEDIA_API_KEY || "").trim();
  if (env) return env;
  try { return fs.readFileSync(KEY_FILE, "utf8").trim(); } catch { return ""; }
}
const KEY = apiKey();

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

/** 各家返回结构不一样，按常见几种形状兜一遍就够用 */
function pickUrl(j) {
  const d = j?.data ?? j;
  if (Array.isArray(d)) return d[0]?.url || d[0]?.video_url || "";
  return d?.url || d?.video_url || d?.output || j?.url || "";
}
function pickId(j) {
  const d = j?.data ?? j ?? {};
  return d.video_id || d.task_id || d.id || j?.id || "";
}
function pickStatus(j) {
  const d = j?.data ?? j ?? {};
  return String(d.status || d.state || d.task_status || "").toLowerCase();
}

async function genImage() {
  const prompt = String(opt.prompt || "").trim();
  if (!prompt) { console.error('用法: gen-media.mjs image --prompt "描述" [--size 1024x1024]'); return 2; }
  if (!gate()) return 3;

  const size = String(opt.size || IMAGE.size || "1024x1024");
  const t0 = Date.now();
  const body = {
    model: String(opt.model || IMAGE.model || ""),
    prompt,
    size,
    ...(IMAGE.extraBody || {}),
  };
  const r = await api(IMAGE.path || "/v1/images/generations", { method: "POST", body });
  if (r.status !== 200) {
    console.error(`❌ 出图失败 HTTP ${r.status}: ${r.raw.slice(0, 220)}`);
    return 1;
  }
  const url = pickUrl(r.j);
  if (!url) { console.error("❌ 返回里没有图片地址：" + r.raw.slice(0, 220)); return 1; }

  const out = path.resolve(String(opt.out || path.join(HOME, "tmp", `img-${Date.now()}.png`)));
  const bytes = await download(url, out);
  record({ kind: "image", model: body.model, prompt: prompt.slice(0, 120), size, bytes, ms: Date.now() - t0, out });
  console.log(JSON.stringify({ ok: true, kind: "image", file: out, bytes, size, ms: Date.now() - t0 }, null, 2));
  return 0;
}

/**
 * 视频请求体集中在这里 —— 换供应商时**只需要改这一个函数**。
 * 常见差异：有的要 mode（text / keyframe），有的要 duration，有的要 num_frames。
 */
function buildVideoBody(prompt, mode, frames) {
  const body = { model: String(opt.model || VIDEO.model || ""), prompt };
  const modeField = VIDEO.modeField || "mode";
  const modes = VIDEO.modes || {};
  body[modeField] = mode === "keyframe" ? (modes.keyframe || "keyframe") : (modes.text || "text");
  if (mode === "keyframe") {
    body.first_frame = `data:image/png;base64,${fs.readFileSync(frames.first).toString("base64")}`;
    if (frames.last) body.last_frame = `data:image/png;base64,${fs.readFileSync(frames.last).toString("base64")}`;
  }
  return body;
}

async function genVideo() {
  const prompt = String(opt.prompt || "").trim();
  if (!prompt) { console.error('用法: gen-media.mjs video --prompt "描述" [--mode text|keyframe] [--first-frame x.png]'); return 2; }
  if (!gate()) return 3;

  const mode = String(opt.mode || (opt["first-frame"] ? "keyframe" : "text"));
  const frames = {
    first: opt["first-frame"] ? path.resolve(String(opt["first-frame"])) : "",
    last: opt["last-frame"] ? path.resolve(String(opt["last-frame"])) : "",
  };
  if (mode === "keyframe" && !frames.first) { console.error("❌ keyframe 模式需要 --first-frame <图片>"); return 2; }

  const t0 = Date.now();
  const r = await api(VIDEO.path || "/v1/videos", {
    method: "POST",
    body: buildVideoBody(prompt, mode, frames),
    timeout: 90_000,
  });
  if (r.status === 429 || r.status === 503) {
    console.error(`⏳ 对面排队满了（HTTP ${r.status}），不是我们的错。过一会儿再试。`);
    return 4;
  }
  if (r.status !== 200) {
    console.error(`❌ 建任务失败 HTTP ${r.status}: ${r.raw.slice(0, 240)}`);
    return 1;
  }
  const id = pickId(r.j);
  if (!id) { console.error("❌ 返回里没有任务 id：" + r.raw.slice(0, 240)); return 1; }
  console.error(`  任务 ${id} 已创建，等结果…`);

  // 查询路径各家不同，配置文件里给一组，按顺序试
  const statusPaths = VIDEO.statusPaths || ["/v1/videos/{id}", "/v1/videos/query?id={id}"];
  const deadline = Date.now() + Number(opt.timeout || 900) * 1000;

  while (Date.now() < deadline) {
    await sleep(8000);
    let st = null;
    for (const p of statusPaths) {
      const rr = await api(String(p).replace("{id}", id), { timeout: 30_000 });
      if (rr.status === 200 && rr.j) { st = rr; break; }
    }
    if (!st) continue;
    const s = pickStatus(st.j);
    process.stderr.write(`  状态 ${s || "?"}\r`);
    if (/(succeed|success|complete|done|finished)/.test(s)) {
      const url = pickUrl(st.j);
      if (!url) { console.error("\n❌ 完成了但没找到片源：" + JSON.stringify(st.j).slice(0, 240)); return 1; }
      const out = path.resolve(String(opt.out || path.join(HOME, "tmp", `video-${Date.now()}.mp4`)));
      const bytes = await download(url, out);
      record({ kind: "video", model: String(opt.model || VIDEO.model || ""), prompt: prompt.slice(0, 120), mode, bytes, ms: Date.now() - t0, out, id });
      console.log("");
      console.log(JSON.stringify({ ok: true, kind: "video", file: out, bytes, ms: Date.now() - t0, id }, null, 2));
      return 0;
    }
    if (/(fail|error|cancel)/.test(s)) {
      console.error("\n❌ 任务失败：" + JSON.stringify(st.j).slice(0, 300));
      return 1;
    }
  }
  console.error(`\n⏳ 等超时了，任务 ${id} 还在跑。稍后可以拿 id 再查。`);
  return 1;
}

(async () => {
  if (cmd === "image") process.exit(await genImage());
  if (cmd === "video") process.exit(await genVideo());

  if (cmd === "models") {
    const p = CFG?.modelsPath || "/v1/models";
    const r = await api(p, { timeout: 30_000 });
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
