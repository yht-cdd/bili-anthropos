#!/usr/bin/env node
/**
 * video-study.mjs —— 研究一个视频：看片 + 读评论 + 存档 + 可选发评论
 * ============================================================
 * 给谁用：**子代理**。不是她自己。
 *   看片要占几千 token，读评论再占几千，主模型扛几次就忘事了。
 *   所以这一整套只跑在子代理里，回来只给一句「干了什么」。
 *
 * 一个视频一个文件夹：
 *   /opt/life/videos/<BV>/
 *     ├─ video.mp4          原视频
 *     ├─ meta.json          标题/UP/播放/简介/置顶评论
 *     ├─ subtitle.txt       音轨转写（ASR）
 *     ├─ comments.json      随机抽的评论（含热评、UP 评论、置顶）
 *     ├─ analysis.md        视频描述 —— **必须写明是抽帧还是直传**
 *     ├─ comment-sent.json  发出去的评论（如果发了）
 *     └─ index.md           给人看的索引
 *
 * 用法：
 *   node video-study.mjs BV1xxxxxxxxx                    # 只看，不评论
 *   node video-study.mjs BV1xxxxxxxxx --comment "…"      # 看 + 发评论（不带图）
 *   node video-study.mjs BV1xxxxxxxxx --comment "…" --image 图.png
 *   node video-study.mjs BV1xxxxxxxxx --comment "…" --from-comments   # 图从评论区抓
 *   node video-study.mjs BV1xxxxxxxxx --n 10             # 随机抽几条评论（默认 10）
 *   node video-study.mjs BV1xxxxxxxxx --no-video         # 不下载视频（省磁盘）
 *
 * 发评论默认 dry-run，加 --confirm 才真发。
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { execFileSync, spawnSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = path.join(HOME, "secrets/bili_cookie.txt");
const VIDEO_ROOT = path.join(HOME, "videos");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const argv = process.argv.slice(2);
const bv = String(argv[0] || "").trim();
const opt = {};
for (let i = 1; i < argv.length; i += 1) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[a.slice(2)] = true;
    else {
      opt[a.slice(2)] = v;
      i += 1;
    }
  }
}

const log = (...a) => console.error(...a);
const N = Number(opt.n || 10);

if (!/^BV[0-9A-Za-z]{10}$/.test(bv)) {
  console.error("用法: node video-study.mjs BV1xxxxxxxxx [--comment \"…\"] [--image 图] [--from-comments] [--confirm]");
  process.exit(2);
}

const cookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const H = { "User-Agent": UA, Referer: `https://www.bilibili.com/video/${bv}/`, Cookie: cookie };

async function jget(url) {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30_000) });
  return JSON.parse(await r.text());
}

const dir = path.join(VIDEO_ROOT, bv);
fs.mkdirSync(dir, { recursive: true });

const strip = (s) =>
  String(s || "")
    // B 站部分评论内容带 HTML 实体（机器人/脚本发的尤其多），不解码会看到 &#39; 这种
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);

// ── ① 元数据 ──────────────────────────────────────────
log("① 拉视频信息");
const v = await jget(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`);
if (v.code !== 0) {
  console.error(`❌ 拿不到视频: code=${v.code} ${v.message || ""}`);
  process.exit(2);
}
const meta = {
  bvid: bv,
  aid: v.data.aid,
  title: v.data.title,
  up: v.data.owner?.name,
  upMid: v.data.owner?.mid,
  desc: strip(v.data.desc).slice(0, 2000),
  duration: v.data.duration,
  pubdate: new Date(v.data.pubdate * 1000).toISOString(),
  stat: {
    view: v.data.stat.view,
    like: v.data.stat.like,
    coin: v.data.stat.coin,
    favorite: v.data.stat.favorite,
    reply: v.data.stat.reply,
    danmaku: v.data.stat.danmaku,
  },
  pages: (v.data.pages || []).map((p) => ({ page: p.page, part: p.part, duration: p.duration })),
  fetchedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
log(`   ${meta.title}  |  UP=${meta.up}  |  ${(meta.stat.view / 10000).toFixed(0)}万播放  ${meta.stat.reply} 评论`);

// ── ② 评论：置顶 / UP 主 / 随机 N 条 ─────────────────
log("② 读评论区");
const hotPage = await jget(`https://api.bilibili.com/x/v2/reply?type=1&oid=${meta.aid}&sort=2&pn=1&ps=20`);
const pickNode = (r) => ({
  rpid: String(r.rpid || ""),
  user: r.member?.uname || "",
  mid: String(r.member?.mid || ""),
  like: Number(r.like || 0),
  text: strip(r.content?.message).slice(0, 500),
  images: (r.content?.pictures || []).map((p) => p.img_src),
  ctime: r.ctime ? new Date(r.ctime * 1000).toISOString() : "",
});

const pinned = (() => {
  const arr = hotPage.data?.top_replies || [];
  return arr.length ? pickNode(arr[0]) : null;
})();
// data.upper 本身不是评论对象，data.upper.top 才是 UP 主置顶的那条
const upReply = hotPage.data?.upper?.top ? pickNode(hotPage.data.upper.top) : null;

// 随机池：时间排序抓 3 页（60 条），去掉置顶/UP，再随机抽
const pool = [];
for (let pn = 1; pn <= 3; pn += 1) {
  const p = await jget(`https://api.bilibili.com/x/v2/reply?type=1&oid=${meta.aid}&sort=0&pn=${pn}&ps=20`);
  for (const r of p.data?.replies || []) {
    if (String(r.rpid) === String(pinned?.rpid)) continue;
    if (r.member?.mid && String(r.member.mid) === String(meta.upMid)) continue;
    pool.push(pickNode(r));
  }
  await new Promise((r) => setTimeout(r, 300));
}
const sampled = shuffle(pool).slice(0, N);

const comments = {
  pinned,
  upReply,
  sampled,
  poolSize: pool.length,
  sampledAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(dir, "comments.json"), JSON.stringify(comments, null, 2));
log(`   置顶=${pinned ? "有" : "无"}  UP评论=${upReply ? "有" : "无"}  随机池 ${pool.length} 条 → 抽 ${sampled.length} 条`);

// ── ③ 下载视频 ────────────────────────────────────────
let videoFile = "";
if (!opt["no-video"]) {
  log("③ 下载视频");
  try {
    const out = execFileSync(process.execPath, [path.join(HOME, "scripts", "bili-video.mjs"), bv, "--qn", "32"], {
      encoding: "utf8",
      timeout: 600_000,
      cwd: HOME,
    });
    const m = out.match(/(\/[^\s]+\.mp4)/);
    if (m) {
      const from = m[1];
      const to = path.join(dir, "video.mp4");
      if (from !== to) fs.copyFileSync(from, to);
      videoFile = to;
      log(`   存到 ${to}（${(fs.statSync(to).size / 1024 / 1024).toFixed(1)} MB）`);
    } else {
      log("   ⚠️ 下载成功但没解析出路径");
    }
  } catch (e) {
    log(`   ⚠️ 下载失败：${String(e.message).split("\n")[0]}`);
  }
}

// ── ④ 音轨转写（ASR）────────────────────────────────
let subtitle = "";
if (videoFile) {
  log("④ 音轨转写");
  try {
    const audio = path.join(dir, "audio.mp3");
    execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", videoFile, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audio], { timeout: 300_000 });
    const raw = execFileSync(process.execPath, [path.join(HOME, "scripts", "voice.mjs"), "hear", audio], {
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const i = raw.indexOf("{");
    const j2 = i >= 0 ? JSON.parse(raw.slice(i)) : null;
    subtitle = String(j2?.text || "").trim();
    if (subtitle) {
      fs.writeFileSync(path.join(dir, "subtitle.txt"), subtitle + "\n");
      log(`   ${subtitle.length} 字`);
    } else {
      log("   没识别出文字");
    }
    try { fs.unlinkSync(audio); } catch {}
  } catch (e) {
    log(`   ⚠️ ASR 失败：${String(e.message).split("\n")[0]}`);
  }
}

// ── ⑤ 看视频 ──────────────────────────────────────────
let analysis = "";
let method = "未分析";
if (videoFile) {
  log("⑤ 看视频（vision）");
  // 用 spawnSync 才能同时拿到 stdout（分析结果）和 stderr（日志里的「直传/抽帧」）
  const r = spawnSync(
    process.execPath,
    [
      path.join(HOME, "scripts", "vision.mjs"), "video", videoFile,
      // 字幕已经在第 ④ 步拿到了，这里不重复跑 ASR
      ...(subtitle ? ["--no-asr"] : []),
      "--ask", "这个视频讲了什么？画面和声音分别说；如果音画对不上就直说。最后用一句话说它靠什么吸引人。",
    ],
    { encoding: "utf8", timeout: 900_000, maxBuffer: 16 * 1024 * 1024 }
  );
  analysis = String(r.stdout || "").trim();
  const err = String(r.stderr || "");

  // 从日志里读真实路径，别猜
  if (err.includes("不吃视频") || err.includes("指定抽帧")) method = "抽帧 + ASR";
  else if (err.includes("→ 直传")) method = "视频直传（外部视觉 API）";
  else if (err.includes("分 ") && err.includes("块")) method = "分段直传（外部视觉 API）";
  else method = analysis ? "未知（vision 没报方式）" : "未分析";

  if (analysis) fs.writeFileSync(path.join(dir, "analysis-raw.md"), analysis + "\n");
  if (!analysis) log(`   ⚠️ vision 没输出分析：${r.error?.message || err.slice(0, 120)}`);
}

// ── ⑥ 写 analysis.md ─────────────────────────────────
const md = [
  `# ${meta.title}`,
  ``,
  `- **BV**：${bv}  ·  **UP**：${meta.up}  ·  **时长**：${Math.round(meta.duration / 60)} 分`,
  `- **播放**：${meta.stat.view.toLocaleString()}  ·  **评论**：${meta.stat.reply.toLocaleString()}  ·  **点赞**：${meta.stat.like.toLocaleString()}`,
  `- **发布**：${meta.pubdate.slice(0, 10)}`,
  `- **分析方式**：**${method}**  ${method.startsWith("抽帧") ? "（当前模型不吃视频直传，画面靠抽帧、声音靠 ASR）" : "（视频直传给外部视觉 API）"}`,
  `- **分析时间**：${new Date().toLocaleString("zh-CN")}`,
  ``,
  `## 简介`,
  ``,
  meta.desc ? "```\n" + meta.desc.slice(0, 800) + "\n```" : "（无简介）",
  ``,
  `## 视频分析`,
  ``,
  analysis || "（这一轮没拿到分析结果）",
  ``,
  subtitle ? `## 音轨转写（ASR）\n\n\`\`\`\n${subtitle.slice(0, 3000)}\n\`\`\`` : `## 音轨转写\n\n（没有）`,
  ``,
  `## 置顶评论`,
  ``,
  pinned ? `> ${pinned.text}\n>\n> —— ${pinned.user}（👍${pinned.like}）` : "（无）",
  ``,
  upReply ? `## UP 主评论\n\n> ${upReply.text}\n>\n> —— ${upReply.user}（👍${upReply.like}）` : "",
  ``,
  `## 随机 ${sampled.length} 条评论（从 ${pool.length} 条池子里随机）`,
  ``,
  ...sampled.map((c, i) => `${i + 1}. **${c.user}**（👍${c.like}）${c.images.length ? ` 📷${c.images.length}` : ""}\n   ${c.text}`),
  ``,
].filter((x) => x !== null && x !== undefined).join("\n");

fs.writeFileSync(path.join(dir, "analysis.md"), md);
log(`⑥ 档案写入 ${dir}`);

// ── ⑦ 发评论（可选）──────────────────────────────────
let sent = null;
if (opt.comment) {
  const args = [path.join(HOME, "scripts", "bili-comment.mjs"), bv, "--text", String(opt.comment)];
  if (opt.image) args.push("--image", String(opt.image));
  if (opt["from-comments"]) args.push("--from-comments");
  if (opt.confirm) args.push("--confirm");
  log("⑦ 发评论");
  try {
    const out = execFileSync(process.execPath, args, { encoding: "utf8", timeout: 300_000, maxBuffer: 8 * 1024 * 1024 });
    sent = { at: new Date().toISOString(), text: String(opt.comment), output: out.trim() };
    fs.writeFileSync(path.join(dir, "comment-sent.json"), JSON.stringify(sent, null, 2));
    log(out.trim().split("\n").slice(-3).join("\n"));
  } catch (e) {
    sent = { at: new Date().toISOString(), text: String(opt.comment), error: String(e.message).split("\n")[0] };
    fs.writeFileSync(path.join(dir, "comment-sent.json"), JSON.stringify(sent, null, 2));
    log(`   ⚠️ ${sent.error}`);
  }
}

// ── ⑧ 索引 ────────────────────────────────────────────
const idx = [  `# ${meta.title}`,
  ``,
  `| 项 | 内容 |`,
  `|---|---|`,
  `| BV | ${bv} |`,
  `| UP | ${meta.up} |`,
  `| 时长 | ${Math.round(meta.duration / 60)} 分 |`,
  `| 播放 | ${meta.stat.view.toLocaleString()} |`,
  `| 分析方式 | **${method}** |`,
  `| 视频 | ${videoFile ? "video.mp4 ✓" : "未下载"} |`,
  `| 字幕 | ${subtitle ? `subtitle.txt（${subtitle.length} 字）` : "无"} |`,
  `| 评论 | comments.json（抽样 ${sampled.length} / 池 ${pool.length}） |`,
  `| 评论已发 | ${sent ? (sent.error ? "失败：" + sent.error : "见 comment-sent.json") : "没发"} |`,
  ``,
  `分析全文见 \`analysis.md\`。`,
].join("\n");
fs.writeFileSync(path.join(dir, "index.md"), idx);

// ── ⑧.5 总日志：一行一个视频，以后 grep 就能翻 ─────────
try {
  fs.appendFileSync(
    path.join(VIDEO_ROOT, "log.jsonl"),
    JSON.stringify({
      at: new Date().toISOString(),
      bv,
      title: meta.title,
      up: meta.up,
      method,
      durationMin: Math.round(meta.duration / 60),
      view: meta.stat.view,
      sampled: sampled.length,
      pool: pool.length,
      subtitleChars: subtitle.length,
      analysisChars: analysis.length,
      comment: sent ? (sent.error ? "failed" : "sent") : "none",
      dir,
    }) + "\n"
  );
} catch (e) {
  log("   ⚠️ 总日志写入失败:", e.message);
}

// ── ⑧.6 观看账本：日结的「看视频 N 条」读这张表 ────────
// 此前 daily-report 拿投稿统计表 videos 冒充观看记录，永远是 0（2026-11-01 日结实锤）。
try {
  const dbase = new DatabaseSync(path.join(HOME, "bili/data/bili.db"));
  dbase.exec(
    "CREATE TABLE IF NOT EXISTS watched (bvid TEXT PRIMARY KEY, title TEXT, duration_s INTEGER, watched_at INTEGER, method TEXT, verdict TEXT)"
  );
  dbase.prepare(
    "INSERT OR REPLACE INTO watched(bvid,title,duration_s,watched_at,method,verdict) VALUES(?,?,?,?,?,?)"
  ).run(bv, meta.title, Math.round(meta.duration), Math.floor(Date.now() / 1000), method, sent ? (sent.error ? "failed" : "sent") : "none");
  dbase.close();
} catch (e) {
  log("   ⚠️ watched 落账失败:", e.message);
}

// ── ⑨ 结论（给子代理 → 主模型看的）────────────────────
console.log(JSON.stringify({
  ok: true,
  bv,
  title: meta.title,
  dir,
  method,
  durationMin: Math.round(meta.duration / 60),
  view: meta.stat.view,
  comments: { sampled: sampled.length, pool: pool.length, pinned: !!pinned, upReply: !!upReply },
  subtitleChars: subtitle.length,
  analysisChars: analysis.length,
  commentSent: sent ? (sent.error ? null : true) : false,
  files: fs.readdirSync(dir),
}, null, 2));
