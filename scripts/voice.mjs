#!/usr/bin/env node
/**
 * voice.mjs —— 说话（TTS）与听话（ASR）的适配层
 * ============================================================
 * 这个脚本**不绑定任何供应商**。谁家的服务都行，只要在 config/voice-api.json 里
 * 填地址、路径、模型名。默认认两种接口形态：
 *
 *   style = "chat"      —— 把合成/识别挂在 chat/completions 上（有的服务这么做：
 *                          TTS 要求 messages 里放一条 assistant，ASR 只收音频不收文本）
 *   style = "endpoint"  —— 标准 OpenAI 形态：/v1/audio/speech、/v1/audio/transcriptions
 *
 * 为什么单独一层：
 *   配音是视频的最后一块。它还会顺带解决「听」——同一个服务往往两样都给。
 *
 * 用法：
 *   node voice.mjs say "要说的话" [--voice 名字] [--out /path/x.mp3]
 *   node voice.mjs say --file 口播稿.txt --out /opt/life/tmp/voice.mp3
 *   node voice.mjs hear 音频文件 [--out 文本.txt]
 *   node voice.mjs plan --file plan.json --out-dir /opt/life/tmp/ep01   ← 按时间轴配音
 *   node voice.mjs voices                  # 列出可用音色（靠服务端的报错或接口）
 *   node voice.mjs usage
 *
 * 配置：$LIFE_HOME/config/voice-api.json（结构见 config/voice-api.example.json）
 * 凭据：配置里的 keyFile，或环境变量 VOICE_API_KEY
 * 退出码：0 成功 / 1 失败 / 2 参数或配置错 / 3 超额度
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const CFG_FILE = process.env.VOICE_CONFIG || path.join(HOME, "config/voice-api.json");
const USAGE_FILE = path.join(HOME, "bili/data/voice_usage.jsonl");

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

let CFG = null;
try { CFG = JSON.parse(fs.readFileSync(CFG_FILE, "utf8")); } catch {}
if (!CFG) {
  console.error(`❌ 没有配置文件 ${CFG_FILE}\n   照 config/voice-api.example.json 抄一份，填上你自己的服务地址和模型名。`);
  process.exit(2);
}

const BASE = String(process.env.VOICE_BASE || CFG.baseUrl || "").replace(/\/+$/, "");
const KEY_FILE = path.join(HOME, CFG.keyFile || "secrets/voice_api_key.txt");
const TTS = CFG.tts || {};
const ASR = CFG.asr || {};
const DAILY_MAX = Number(process.env.VOICE_DAILY_MAX || CFG.dailyMax || 60);

function apiKey() {
  const env = String(process.env.VOICE_API_KEY || "").trim();
  if (env) return env;
  try { return fs.readFileSync(KEY_FILE, "utf8").trim(); } catch { return ""; }
}
const KEY = apiKey();

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
  if (Number(todayCount()) >= DAILY_MAX) {
    console.error(`🚫 今天已经合成/识别 ${todayCount()} 次，到上限 ${DAILY_MAX}。`);
    return false;
  }
  return true;
}

async function post(pathname, body, timeout = 120_000) {
  const r = await fetch(BASE + pathname, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("audio") || ct.includes("octet-stream")) {
    return { status: r.status, audio: Buffer.from(await r.arrayBuffer()), ct };
  }
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, raw: t };
}

/** 长文本切块：按句末标点切，单块不超过 limit 字 */
function chunk(text, limit = 180) {
  const out = [];
  let buf = "";
  for (const ch of String(text)) {
    buf += ch;
    if (buf.length >= limit && /[。！？!?；;\n]/.test(ch)) { out.push(buf.trim()); buf = ""; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.length ? out : [String(text)];
}

async function synthOne(text, voice, format) {
  const style = TTS.style || "chat";
  if (style === "endpoint") {
    const r = await post(TTS.path || "/v1/audio/speech", {
      model: TTS.model,
      input: text,
      voice: voice || TTS.voice,
      response_format: format,
    });
    if (r.audio) return r.audio;
    throw new Error(`HTTP ${r.status}: ${(r.raw || "").slice(0, 180)}`);
  }
  // chat 形态：把要说的句子放在 assistant 位，服务把它「读出来」
  const r = await post(TTS.path || "/v1/chat/completions", {
    model: TTS.model,
    messages: [{ role: TTS.role || "assistant", content: text }],
    ...(voice || TTS.voice ? { audio: { voice: voice || TTS.voice, format } } : {}),
  });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${(r.raw || "").slice(0, 200)}`);
  const b64 = r.j?.choices?.[0]?.message?.audio?.data;
  if (!b64) throw new Error("返回里没有 audio.data：" + JSON.stringify(r.j).slice(0, 180));
  return Buffer.from(b64, "base64");
}

async function say() {
  let text = String(opt.text || opt._ || "").trim();
  if (!text && opt.file) text = fs.readFileSync(String(opt.file), "utf8").trim();
  if (!text) { console.error('用法: voice.mjs say "要说的话" [--voice 名字] [--out x.mp3]'); return 2; }
  if (!gate()) return 3;

  const format = String(opt.format || TTS.format || "wav");
  const parts = chunk(text);
  const tmpDir = path.join(HOME, "tmp/voice");
  fs.mkdirSync(tmpDir, { recursive: true });
  const files = [];
  const t0 = Date.now();

  for (let i = 0; i < parts.length; i += 1) {
    const buf = await synthOne(parts[i], String(opt.voice || TTS.voice || ""), format);
    const f = path.join(tmpDir, `part-${Date.now()}-${i}.${format}`);
    fs.writeFileSync(f, buf);
    files.push(f);
    process.stderr.write(`  合成 ${i + 1}/${parts.length}\r`);
  }
  process.stderr.write("\n");

  const out = path.resolve(String(opt.out || path.join(HOME, "tmp", `voice-${Date.now()}.mp3`)));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  if (files.length === 1) {
    execSync(`ffmpeg -y -loglevel error -i "${files[0]}" -codec:a libmp3lame -b:a 128k "${out}"`, { timeout: 120_000 });
  } else {
    const list = path.join(tmpDir, `list-${Date.now()}.txt`);
    fs.writeFileSync(list, files.map((f) => `file '${f}'`).join("\n"));
    execSync(
      `ffmpeg -y -loglevel error -f concat -safe 0 -i "${list}" -codec:a libmp3lame -b:a 128k "${out}"`,
      { timeout: 180_000 }
    );
  }
  for (const f of files) { try { fs.unlinkSync(f); } catch {} }

  const bytes = fs.statSync(out).size;
  const secs = (() => {
    try {
      const d = execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${out}"`, { encoding: "utf8" }).trim();
      return Number(Number(d).toFixed(1));
    } catch { return null; }
  })();
  record({ kind: "tts", chars: text.length, chunks: parts.length, bytes, secs, ms: Date.now() - t0, out });
  console.log(JSON.stringify({ ok: true, file: out, bytes, seconds: secs, chars: text.length, chunks: parts.length }, null, 2));
  return 0;
}

async function hear() {
  const file = String(opt._ || "");
  const src = file || String(opt.input || "");
  if (!src || !fs.existsSync(src)) { console.error("用法: voice.mjs hear <音频文件> [--out 文本.txt]"); return 2; }
  if (!gate()) return 3;

  const t0 = Date.now();
  const style = ASR.style || "chat";
  const format = path.extname(src).slice(1).toLowerCase() || "mp3";
  let text = "";

  if (style === "endpoint") {
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(src)]), path.basename(src));
    form.append("model", String(ASR.model || ""));
    const r = await fetch(BASE + (ASR.path || "/v1/audio/transcriptions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "api-key": KEY },
      body: form,
      signal: AbortSignal.timeout(300_000),
    });
    const t = await r.text();
    if (r.status !== 200) { console.error(`❌ HTTP ${r.status}: ${t.slice(0, 200)}`); return 1; }
    try { text = JSON.parse(t).text || ""; } catch { text = t; }
  } else {
    const b64 = fs.readFileSync(src).toString("base64");
    const r = await post(ASR.path || "/v1/chat/completions", {
      model: ASR.model,
      messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: b64, format } }] }],
    }, 300_000);
    if (r.status !== 200) { console.error(`❌ HTTP ${r.status}: ${(r.raw || "").slice(0, 220)}`); return 1; }
    text = String(r.j?.choices?.[0]?.message?.content || "").trim();
  }

  if (!text) { console.error("❌ 没识别出文字"); return 1; }
  const out = opt.out ? path.resolve(String(opt.out)) : "";
  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, text + "\n"); }
  record({ kind: "asr", file: src, chars: text.length, ms: Date.now() - t0, out: out || null });
  console.log(JSON.stringify({ ok: true, text, chars: text.length, file: out || null, ms: Date.now() - t0 }, null, 2));
  return 0;
}

// ── 按时间轴配音 ─────────────────────────────────────
// 关键：**时长由计划决定，不由模型决定**。
// 短了补静音，长了加速（超上限就报错，让人改稿），最后产出精确时间轴。
// 这样视频可以按「秒」来排场景，不会出现音画错位。
function toSec(v) {
  if (typeof v === "number") return v;
  const s = String(v || "").trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  const m2 = s.match(/^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m2) return Number(m2[1]) * 60 + Number(m2[2]);
  throw new Error(`看不懂的时间：${v}`);
}

function probeSec(file) {
  const d = execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${file}"`, {
    encoding: "utf8",
  }).trim();
  return Number(d) || 0;
}

/** 把一段音频塞进恰好 target 秒：不够补静音，超了加速，超上限直接报错 */
function fitTo(src, target, out, maxSpeed) {
  const actual = probeSec(src);
  const ratio = target > 0 ? actual / target : 1;
  if (ratio > maxSpeed) {
    throw new Error(
      `这段实际 ${actual.toFixed(2)}s，要塞进 ${target.toFixed(2)}s 得加速 ${ratio.toFixed(2)}x，` +
        `超过上限 ${maxSpeed}x —— 稿子太长，删一点或者把窗口放大。`
    );
  }
  const af = ratio > 1.01 ? `atempo=${ratio.toFixed(3)},` : "";
  // apad 补静音 + -t 精确截断，两个一起用才保证「刚好 target 秒」
  execSync(
    `ffmpeg -y -loglevel error -i "${src}" -af "${af}apad" -t ${target.toFixed(3)} -ar 44100 -ac 1 -codec:a libmp3lame -b:a 128k "${out}"`,
    { timeout: 180_000 }
  );
  return probeSec(out);
}

async function plan() {
  const f = String(opt.file || "");
  if (!f || !fs.existsSync(f)) { console.error("用法: voice.mjs plan --file plan.json --out-dir 目录"); return 2; }
  const spec = JSON.parse(fs.readFileSync(f, "utf8"));
  const segs = Array.isArray(spec.segments) ? spec.segments : [];
  if (!segs.length) { console.error("❌ plan.json 里没有 segments"); return 2; }

  const outDir = path.resolve(String(opt["out-dir"] || path.join(HOME, "tmp", `voice-${Date.now()}`)));
  fs.mkdirSync(outDir, { recursive: true });
  const maxSpeed = Number(opt["max-speed"] || 1.25);
  const voice = String(opt.voice || TTS.voice || "");

  const timeline = [];
  const files = [];
  let cursor = 0;

  for (let i = 0; i < segs.length; i += 1) {
    const s = segs[i];
    const from = s.from !== undefined ? toSec(s.from) : s.start !== undefined ? toSec(s.start) : cursor;
    const to = s.to !== undefined ? toSec(s.to) : from + Number(s.seconds || 0);
    const target = Number((to - from).toFixed(3));
    if (target <= 0.3) throw new Error(`第 ${i + 1} 段窗口太短（${target}s），至少 0.3s`);
    if (Math.abs(from - cursor) > 0.05) {
      console.error(`⚠️ 第 ${i + 1} 段起点 ${from}s 和上一段结尾 ${cursor}s 对不上，按 ${cursor}s 接上`);
    }
    if (!gate()) return 3;

    const raw = path.join(outDir, `raw-${String(i + 1).padStart(2, "0")}.mp3`);
    fs.writeFileSync(raw, await synthOne(String(s.text || ""), voice, String(TTS.format || "wav")));

    const fitted = path.join(outDir, `seg-${String(i + 1).padStart(2, "0")}.mp3`);
    const got = fitTo(raw, target, fitted, maxSpeed);
    try { fs.unlinkSync(raw); } catch {}
    files.push(fitted);

    timeline.push({
      index: i + 1,
      text: String(s.text || ""),
      from: Number(from.toFixed(3)),
      to: Number(to.toFixed(3)),
      seconds: target,
      actual: Number(got.toFixed(3)),
      file: path.basename(fitted),
    });
    cursor = Number(to.toFixed(3));
    process.stderr.write(`  段 ${i + 1}/${segs.length}  ${target}s\r`);
  }
  process.stderr.write("\n");

  // 拼接：每段刚好是窗口长度，总长必须等于最后一段的 to
  const voiceFile = path.join(outDir, "voice.mp3");
  const list = path.join(outDir, "_list.txt");
  fs.writeFileSync(list, files.map((x) => `file '${x}'`).join("\n"));
  execSync(
    `ffmpeg -y -loglevel error -f concat -safe 0 -i "${list}" -ar 44100 -ac 1 -codec:a libmp3lame -b:a 128k "${voiceFile}"`,
    { timeout: 300_000 }
  );
  try { fs.unlinkSync(list); } catch {}

  const total = probeSec(voiceFile);
  const drift = Number((total - cursor).toFixed(3));
  const result = {
    ok: Math.abs(drift) < 0.35,
    voice: voiceFile,
    seconds: Number(total.toFixed(2)),
    planned: Number(cursor.toFixed(2)),
    drift,
    segments: timeline,
  };
  fs.writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify(result, null, 2) + "\n");
  record({ kind: "tts-plan", segments: timeline.length, seconds: result.seconds, out: voiceFile });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) console.error(`⚠️ 总长 ${result.seconds}s 与计划 ${result.planned}s 差 ${drift}s，超过 0.35s 容差`);
  return result.ok ? 0 : 1;
}

(async () => {
  // 位置参数：hear 的音频路径
  const pos = [];
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) { i += argv[i + 1] && !argv[i + 1].startsWith("--") ? 1 : 0; continue; }
    pos.push(argv[i]);
  }
  opt._ = pos[0] || "";

  if (cmd === "say") process.exit(await say());
  if (cmd === "hear") process.exit(await hear());
  if (cmd === "plan") {
    try {
      process.exit(await plan());
    } catch (e) {
      console.error(`❌ ${e.message}`);
      process.exit(1);
    }
  }

  if (cmd === "voices") {
    try {
      await synthOne("测试", "__不存在的音色__", "wav");
      console.log("（服务没有报错，列不出音色；看它家的文档）");
    } catch (e) {
      const m = String(e.message).match(/Available voices:\s*\[([^\]]+)\]/);
      if (m) console.log(m[1].split(",").map((s) => s.trim()).join("\n"));
      else console.log("列不出来：" + String(e.message).slice(0, 200));
    }
    process.exit(0);
  }

  if (cmd === "usage") {
    const day = new Date().toLocaleDateString("sv-SE");
    let rows = [];
    try {
      rows = fs.readFileSync(USAGE_FILE, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => String(x.at).startsWith(day));
    } catch {}
    console.log(JSON.stringify({ date: day, count: rows.length, limit: DAILY_MAX, items: rows }, null, 2));
    process.exit(0);
  }

  console.error("用法：node voice.mjs <say|hear|voices|usage> ...");
  process.exit(2);
})();
