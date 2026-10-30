#!/usr/bin/env node
/**
 * sfx.mjs —— 用程序合成音效，铺一条和画面严丝合缝的声轨
 * ============================================================
 * 为什么先做音效、TTS 反而可选：
 *   音效可以**算**出来 —— ffmpeg 合成，时长精确到毫秒，不花钱、不排队、不依赖任何 API。
 *   人声不行，它必须调外部服务。
 *   所以默认路径是：程序音效铺底 → 需要人声再加 TTS。别让片子因为「配音没配好」而发不出去。
 *
 * 两种用法：
 *   1) 单个音效：node sfx.mjs make --cue whoosh --seconds 0.9 --out a.mp3
 *   2) 整条声轨：node sfx.mjs mix --plan audio.json --out voice.mp3
 *
 * audio.json（时间单位秒，可以写 "00:00:03.2"）：
 *   {
 *     "total": 13,
 *     "bed":  { "cue": "pad", "gain": 0.18 },
 *     "cues": [
 *       { "at": 0,    "cue": "ding",   "gain": 0.7 },
 *       { "at": 3.8,  "cue": "whoosh", "seconds": 0.9, "gain": 0.6 },
 *       { "at": 10,   "cue": "boom",   "gain": 0.8 }
 *     ],
 *     "voice": "/opt/life/tmp/ep01/voice.mp3"     // 可选：人声轨
 *   }
 *
 * 退出码：0 成功 / 1 失败 / 2 参数错
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
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

const SR = 44100;

/**
 * 音效库。每个都返回 ffmpeg 的 lavfi 输入串 + 后处理链。
 * 原则：能算就别采样 —— 不依赖任何素材文件，跑在哪台机器上都一样。
 */
const CUES = {
  // 轻点一下，用于字幕/数字出现
  tick: (d) => ({
    input: `sine=frequency=1600:duration=${d}:sample_rate=${SR}`,
    filters: `afade=t=out:st=0:d=${Math.max(0.03, d * 0.9)}:curve=exp,volume=0.5`,
  }),
  // 两声「叮咚」，用于结论落定
  ding: (d) => ({
    input: `sine=frequency=880:duration=${d}:sample_rate=${SR}`,
    filters: `afade=t=out:st=0:d=${d}:curve=exp,volume=0.55`,
  }),
  // 低沉的「咚」，用于重点强调
  boom: (d) => ({
    input: `sine=frequency=70:duration=${d}:sample_rate=${SR}`,
    filters: `afade=t=out:st=0:d=${d}:curve=exp,volume=0.9`,
  }),
  // 失败/警告
  buzz: (d) => ({
    input: `sine=frequency=140:duration=${d}:sample_rate=${SR}`,
    filters: `vibrato=f=18:d=0.6,afade=t=out:st=${d * 0.7}:d=${d * 0.3},volume=0.5`,
  }),
  // 转场呼啸：粉噪扫频
  whoosh: (d) => ({
    input: `anoisesrc=color=pink:duration=${d}:sample_rate=${SR}`,
    filters: [
      `highpass=f=300`,
      `lowpass=f=6000`,
      `afade=t=in:st=0:d=${(d * 0.35).toFixed(3)}`,
      `afade=t=out:st=${(d * 0.55).toFixed(3)}:d=${(d * 0.45).toFixed(3)}`,
      `volume=0.55`,
    ].join(","),
  }),
  // 上升音：频率从 180 扫到 720
  riser: (d) => ({
    input: `aevalsrc=0.25*sin(2*PI*(180+540*t/${d})*t):d=${d}:s=${SR}`,
    filters: `afade=t=in:st=0:d=${(d * 0.2).toFixed(3)},afade=t=out:st=${(d * 0.85).toFixed(3)}:d=${(d * 0.15).toFixed(3)}`,
  }),
  // 氛围垫：两个低频正弦 + 轻微颤动，适合当底噪
  pad: (d) => ({
    input: `aevalsrc=0.08*sin(2*PI*110*t)+0.06*sin(2*PI*164.8*t)+0.04*sin(2*PI*220*t):d=${d}:s=${SR}`,
    filters: `tremolo=f=0.25:d=0.3,lowpass=f=1200,afade=t=in:st=0:d=0.8,afade=t=out:st=${Math.max(0.5, d - 1.2)}:d=1.2`,
  }),
  // 打字机：短促的噪声点
  typing: (d) => ({
    input: `anoisesrc=color=white:duration=${d}:sample_rate=${SR}`,
    filters: `highpass=f=2000,lowpass=f=9000,tremolo=f=12:d=0.9,afade=t=out:st=${(d * 0.9).toFixed(3)}:d=${(d * 0.1).toFixed(3)},volume=0.25`,
  }),
};

function toSec(v, fallback = 0) {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  const m2 = s.match(/^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m2) return Number(m2[1]) * 60 + Number(m2[2]);
  return fallback;
}

const DEFAULT_SEC = { tick: 0.08, ding: 0.5, boom: 0.9, buzz: 0.6, whoosh: 0.8, riser: 1.4, pad: 8, typing: 2 };

function renderCue(name, seconds, out, gain = 1) {
  const make = CUES[name];
  if (!make) throw new Error(`没有这个音效：${name}（可用：${Object.keys(CUES).join(", ")}）`);
  const d = Number(seconds || DEFAULT_SEC[name] || 0.5);
  const { input, filters } = make(d.toFixed(3));
  execSync(
    `ffmpeg -y -loglevel error -f lavfi -i "${input}" -af "${filters},volume=${Number(gain).toFixed(2)}" -t ${d.toFixed(3)} -ar ${SR} -ac 1 -codec:a libmp3lame -b:a 128k "${out}"`,
    { timeout: 120_000 }
  );
  return d;
}

function duration(file) {
  const v = execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${file}"`, { encoding: "utf8" }).trim();
  return Number(v) || 0;
}

function make() {
  const name = String(opt.cue || "");
  if (!name) { console.error(`用法: sfx.mjs make --cue <${Object.keys(CUES).join("|")}> [--seconds 0.8] [--gain 1] --out x.mp3`); return 2; }
  const out = path.resolve(String(opt.out || path.join(HOME, "tmp", `sfx-${name}-${Date.now()}.mp3`)));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const d = renderCue(name, Number(opt.seconds || 0), out, Number(opt.gain || 1));
  console.log(JSON.stringify({ ok: true, cue: name, seconds: d, file: out, bytes: fs.statSync(out).size }, null, 2));
  return 0;
}

/** 整条声轨：氛围垫 + 若干音效（按 at 摆放）+ 可选人声 */
function mix() {
  const planFile = String(opt.plan || "");
  if (!planFile || !fs.existsSync(planFile)) { console.error("用法: sfx.mjs mix --plan audio.json --out voice.mp3"); return 2; }
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const total = toSec(plan.total, 0);
  if (total <= 0) { console.error("❌ plan 里要有 total（总时长，秒）"); return 2; }

  const dir = path.resolve(String(opt["out-dir"] || path.join(HOME, "tmp", `sfx-${Date.now()}`)));
  fs.mkdirSync(dir, { recursive: true });
  const out = path.resolve(String(opt.out || path.join(dir, "audio.mp3")));

  // ① 底噪床：没有就生成一条静音
  const bedFile = path.join(dir, "bed.mp3");
  if (plan.bed && plan.bed.cue) {
    renderCue(plan.bed.cue, total, bedFile, Number(plan.bed.gain ?? 0.2));
  } else {
    execSync(
      `ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=${SR}:cl=mono" -t ${total.toFixed(3)} -codec:a libmp3lame -b:a 128k "${bedFile}"`,
      { timeout: 60_000 }
    );
  }

  // ② 逐个音效
  const inputs = [`-i "${bedFile}"`];
  const chains = [];
  const labels = ["[0:a]"];
  let idx = 1;

  for (const c of plan.cues || []) {
    const at = toSec(c.at, 0);
    const f = path.join(dir, `cue-${idx}.mp3`);
    const d = renderCue(c.cue, Number(c.seconds || 0), f, 1);
    inputs.push(`-i "${f}"`);
    const delayMs = Math.max(0, Math.round(at * 1000));
    // adelay 之后按 gain 调音量，再标个标签等 amix
    chains.push(`[${idx}:a]adelay=${delayMs}|${delayMs},volume=${Number(c.gain ?? 0.7).toFixed(2)}[c${idx}]`);
    labels.push(`[c${idx}]`);
    idx += 1;
    if (at + d > total + 0.05) console.error(`  ⚠️ 音效 ${c.cue} 在 ${at}s 起、长 ${d}s，超出总长 ${total}s`);
  }

  // ③ 人声
  let voiceIdx = -1;
  if (plan.voice && fs.existsSync(plan.voice)) {
    inputs.push(`-i "${String(plan.voice)}"`);
    voiceIdx = idx;
    chains.push(`[${voiceIdx}:a]volume=${Number(plan.voiceGain ?? 1).toFixed(2)}[v]`);
    labels.push(`[v]`);
    idx += 1;
  }

  // ④ 混音：以底噪床长度为准，最后压一下防爆音
  // ⚠️ 每条链之间必须是分号；少一个分号，ffmpeg 会把 [v][0:a] 当成串联而不是并联
  const pre = chains.length ? chains.join(";") + ";" : "";
  const filter = `${pre}${labels.join("")}amix=inputs=${labels.length}:duration=first:dropout_transition=0,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=11`;
  execSync(
    `ffmpeg -y -loglevel error ${inputs.join(" ")} -filter_complex "${filter}" -t ${total.toFixed(3)} -ar ${SR} -ac 1 -codec:a libmp3lame -b:a 128k "${out}"`,
    { timeout: 300_000 }
  );

  const secs = duration(out);
  console.log(
    JSON.stringify(
      { ok: Math.abs(secs - total) < 0.2, file: out, seconds: Number(secs.toFixed(2)), planned: total, cues: (plan.cues || []).length, voice: plan.voice || null, bytes: fs.statSync(out).size },
      null,
      2
    )
  );
  return Math.abs(secs - total) < 0.2 ? 0 : 1;
}

if (cmd === "list") {
  for (const k of Object.keys(CUES)) console.log(`${k.padEnd(8)} 默认 ${DEFAULT_SEC[k]}s`);
  process.exit(0);
}
if (cmd === "make") process.exit(make());
if (cmd === "mix") process.exit(mix());
console.error("用法：node sfx.mjs <list|make|mix> ...");
process.exit(2);
