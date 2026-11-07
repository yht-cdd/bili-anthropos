#!/usr/bin/env node
/**
 * bili-video.mjs —— 把一个 B 站视频下载到本地，交给 vision.mjs 看
 * ============================================================
 * 为什么不直接用 yt-dlp：它带一堆依赖，而且 B 站的风控要 Cookie + Referer + WBI，
 * 这三样我们本来就有，多一个依赖反而多一处会坏的。
 *
 * 用法：
 *   node bili-video.mjs BV1xxxxxxxxx              # 默认 P1，480p
 *   node bili-video.mjs BV1xxxxxxxxx --p 2        # 第 2 个分P
 *   node bili-video.mjs BV1xxxxxxxxx --qn 64      # 720p（可能要登录）
 *   node bili-video.mjs BV1xxxxxxxxx --info       # 只看信息，不下载
 *   node bili-video.mjs <完整URL>
 *
 * 输出：最后一行是文件路径（方便被其他脚本 grep）
 *
 * 注意：
 *   · 下载要用 Referer，否则 CDN 返回 403
 *   · 未实名 / 低等级账号拿不到高清，qn=32(480p) 最稳
 *   · 长视频体积大，下载完记得清 tmp
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { wbiQuery } from "./wbi.mjs";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || path.join(HOME, "secrets/bili_cookie.txt");
const OUT_DIR = path.join(HOME, "tmp/video");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const argv = process.argv.slice(2);
const opt = {};
let input = "";
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else {
      opt[argv[i].slice(2)] = v;
      i += 1;
    }
  } else if (!input) input = argv[i];
}

if (!input) {
  console.error("用法: node bili-video.mjs <BV号或URL> [--p N] [--qn 32|64|80] [--info]");
  process.exit(2);
}

const bvid = (/(BV[0-9A-Za-z]{10})/.exec(input) || [])[1] || input;
if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) {
  console.error(`❌ 认不出 BV 号：${input}`);
  process.exit(2);
}

const cookie = (() => {
  try {
    return fs.readFileSync(COOKIE_FILE, "utf8").trim();
  } catch {
    return "";
  }
})();
if (!cookie) console.error("⚠️  没有 Cookie，可能拿不到播放地址");

const H = { "user-agent": UA, referer: `https://www.bilibili.com/video/${bvid}/`, cookie };

const getJSON = async (url) => {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30_000) });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`非 JSON（HTTP ${r.status}）：${t.slice(0, 120)}`);
  }
};

// ── 1. 视频信息 ───────────────────────────────────────
const view = await getJSON(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
if (view.code !== 0) {
  console.error(`❌ view 失败 code=${view.code} ${view.message || ""}`);
  process.exit(1);
}
const d = view.data;
const pages = d.pages || [{ page: 1, cid: d.cid, part: d.title, duration: d.duration }];
const wantP = Number(opt.p || 1);
const page = pages.find((p) => p.page === wantP) || pages[0];

console.error(`📺 ${d.title}`);
console.error(`   UP: ${d.owner?.name}  |  总时长 ${d.duration}s  |  分P ${pages.length} 个`);
console.error(`   本次: P${page.page} "${page.part}" ${page.duration}s  cid=${page.cid}`);

// ── 2. 播放地址（WBI 签名）─────────────────────────────
const qn = String(opt.qn || 32);
const q = await wbiQuery({
  bvid,
  cid: String(page.cid),
  qn,
  fnval: "1", // durl（音视频合一，省一步合并）
  fourk: "0",
  platform: "pc",
  high_quality: "1",
});
const play = await getJSON(`https://api.bilibili.com/x/player/wbi/playurl?${q}`);
if (play.code !== 0) {
  console.error(`❌ playurl 失败 code=${play.code} ${play.message || ""}`);
  process.exit(1);
}
const pd = play.data;
const durl = pd.durl?.[0];
if (!durl?.url) {
  console.error(`❌ 没拿到 durl。可用清晰度：${(pd.accept_quality || []).join(",")}`);
  process.exit(1);
}

console.error(`   清晰度: ${pd.quality}（可用 ${(pd.accept_quality || []).join(",")}）`);
console.error(`   文件: ${Math.round(durl.size / 1024 / 1024 * 10) / 10} MB`);

if (opt.info) {
  console.log(JSON.stringify({ bvid, cid: page.cid, title: d.title, duration: page.duration, size: durl.size, quality: pd.quality }));
  process.exit(0);
}

// ── 3. 下载 ───────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, `${bvid}-P${page.page}-${qn}.mp4`);

if (fs.existsSync(out) && fs.statSync(out).size > 1024) {
  console.error(`   已存在，跳过下载：${out}`);
} else {
  console.error(`   下载中…`);
  const r = await fetch(durl.url, {
    headers: { "user-agent": UA, referer: `https://www.bilibili.com/video/${bvid}/` },
    signal: AbortSignal.timeout(600_000),
  });
  if (!r.ok) {
    console.error(`❌ 下载失败 HTTP ${r.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(out, buf);
  console.error(`   ✓ ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
}

// ── 4. 校验 ───────────────────────────────────────────
try {
  const p = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", out],
    { encoding: "utf8", timeout: 30_000 }
  );
  const j = JSON.parse(p);
  const v = (j.streams || []).find((s) => s.codec_type === "video") || {};
  const hasAudio = (j.streams || []).some((s) => s.codec_type === "audio");
  console.error(`   校验: ${v.width}×${v.height}  时长 ${Number(j.format?.duration || 0).toFixed(1)}s  音轨=${hasAudio ? "有" : "无"}`);
} catch (e) {
  console.error(`   ⚠️ 校验失败: ${e.message}`);
}

console.log(out);
