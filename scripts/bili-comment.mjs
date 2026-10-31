#!/usr/bin/env node
/**
 * bili-comment.mjs —— 看完视频后主动发一条评论（可带图）
 * ============================================================
 * 为什么单独一个脚本：
 *   bili-send.mjs 是「事件驱动」的（events 表里有条目才发），
 *   而这里的场景是「我看完一个视频，想主动说一句」——没有事件，只有 BV 号。
 *
 * 带图是这个脚本存在的第二个理由：
 *   2026-10-31 验明 x/dynamic/feed/draw/upload_bfs 可用（141ms 返回
 *   i0.hdslb.com/bfs/new_dyn/…），评论的 pictures 字段直接吃这个图床。
 *   之前 api/v1/image/upload 稳定 502、dyn_img 已 404，所以图片一直发不出去。
 *
 * 用法：
 *   node bili-comment.mjs <BV号> --text "评论内容" [--image 图.png] [--dry]
 *   node bili-comment.mjs <BV号> --text "…" --image 图.png --from-comments   # 用评论区随机一张图
 *   node bili-comment.mjs <BV号> --list                                    # 只看评论区
 *
 * 默认 dry-run，加 --confirm 才真发。这不叫「审核」，是防手滑。
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = path.join(HOME, "secrets/bili_cookie.txt");
const DB_FILE = path.join(HOME, "bili/data/bili.db");
const TMP = path.join(HOME, "tmp/comment");
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
const cookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const csrf = (cookie.match(/bili_jct=([^;]+)/) || [])[1] || "";
if (!/^BV[0-9A-Za-z]{10}$/.test(bv)) {
  console.error("用法: node bili-comment.mjs BV1xxxxxxxxx --text \"…\" [--image 图.png] [--dry]");
  process.exit(2);
}
if (!csrf) {
  console.error("❌ Cookie 里没有 bili_jct，发不了评论");
  process.exit(2);
}

const H = { "User-Agent": UA, Referer: `https://www.bilibili.com/video/${bv}/`, Cookie: cookie };

async function jget(url) {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30_000) });
  return JSON.parse(await r.text());
}

/** 上传一张图到 B 站动态图床，返回 pictures 数组里的一项 */
async function uploadImage(file) {
  const buf = fs.readFileSync(file);
  const form = new FormData();
  const name = path.basename(file);
  const type = /\.png$/i.test(name) ? "image/png" : "image/jpeg";
  form.append("file_up", new Blob([buf], { type }), name);
  form.append("biz", "new_dyn");
  form.append("csrf", csrf);

  const r = await fetch("https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs", {
    method: "POST",
    headers: { "User-Agent": UA, Referer: "https://t.bilibili.com/", Cookie: cookie },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const j = await r.json().catch(() => ({}));
  if (j.code !== 0 || !j.data?.image_url) {
    throw new Error(`上传失败 code=${j.code} ${j.message || ""}`);
  }
  return {
    img_src: j.data.image_url,
    img_width: j.data.image_width,
    img_height: j.data.image_height,
    img_size: j.data.img_size,
  };
}

/** 评论区的图（从别人的评论里拿） */
async function pickCommentImage(aid) {
  const j = await jget(`https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&sort=2&pn=1&ps=20`);
  const withPic = (j.data?.replies || []).filter((r) => r.content?.pictures?.length);
  if (!withPic.length) return null;
  const p = withPic[Math.floor(Math.random() * withPic.length)].content.pictures[0];
  return { url: p.img_src, w: p.img_width, h: p.img_height };
}

/** 下载远程图到本地（评论区的图要重新上传，因为不是自己账号的图床归属） */
async function download(url, out) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`下载图失败 HTTP ${r.status}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  return out;
}

async function listComments(aid) {
  const hot = await jget(`https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&sort=2&pn=1&ps=20`);
  const fresh = await jget(`https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&sort=0&pn=1&ps=20`);
  const show = (label, arr) => {
    console.log(`\n=== ${label} ===`);
    for (const r of (arr || []).slice(0, 10)) {
      const pic = r.content?.pictures?.length ? " 📷" : "";
      console.log(`  👍${String(r.like).padStart(6)}${pic}  ${String(r.content?.message || "").replace(/\n/g, " ").slice(0, 80)}`);
    }
  };
  show("热评", hot.data?.replies);
  show("最新", fresh.data?.replies);
}

(async () => {
  const v = await jget(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`);
  if (v.code !== 0) {
    console.error(`❌ 拿不到视频信息 code=${v.code} ${v.message || ""}`);
    process.exit(2);
  }
  const aid = v.data.aid;
  console.log(`视频: ${v.data.title}`);
  console.log(`  aid=${aid}  UP=${v.data.owner.name}  播放=${(v.data.stat.view / 10000).toFixed(0)}万  评论=${v.data.stat.reply}`);

  if (opt.list) {
    await listComments(aid);
    process.exit(0);
  }

  const text = String(opt.text || "").trim();
  if (!text) {
    console.error("❌ 没有 --text。评论内容由你写，脚本不代劳。");
    process.exit(2);
  }
  if (text.length > 900) {
    console.error(`❌ 太长（${text.length} > 900），B 站评论上限 1000 字`);
    process.exit(2);
  }

  // ── 图片 ────────────────────────────────────────────
  let picture = null;
  let srcNote = "";
  fs.mkdirSync(TMP, { recursive: true });

  if (opt.image) {
    if (!fs.existsSync(String(opt.image))) {
      console.error(`❌ 图片不存在：${opt.image}`);
      process.exit(2);
    }
    picture = await uploadImage(String(opt.image));
    srcNote = `本地图 ${path.basename(String(opt.image))}`;
  } else if (opt["from-comments"]) {
    const pick = await pickCommentImage(aid);
    if (!pick) {
      log("   ⚠️ 评论区没找到带图的，这条就不带图");
    } else {
      const local = path.join(TMP, `from-comment-${Date.now()}.png`);
      await download(pick.url, local);
      picture = await uploadImage(local);
      srcNote = `评论区抓的图（${Math.round(pick.w)}×${Math.round(pick.h)}）`;
    }
  }

  console.log(`\n─── 将要发送 ───`);
  console.log(`  评论: ${text}`);
  console.log(`  图片: ${picture ? `${srcNote} → ${picture.img_src}` : "不带"}`);

  if (!opt.confirm) {
    console.log("\n  (dry-run) 加 --confirm 才真发");
    process.exit(0);
  }

  // ── 发 ──────────────────────────────────────────────
  const body = new URLSearchParams({
    oid: String(aid),
    type: "1",
    message: text,
    csrf,
  });
  if (picture) body.set("pictures", JSON.stringify([picture]));

  const r = await fetch("https://api.bilibili.com/x/v2/reply/add", {
    method: "POST",
    headers: { ...H, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const j = await r.json().catch(() => ({}));
  const ok = j.code === 0;
  console.log(`\n${ok ? "✅ 已发出" : "❌ 发送失败"} code=${j.code} ${j.message || ""}`);
  if (j.data?.rpid) console.log(`  rpid=${j.data.rpid}  https://www.bilibili.com/video/${bv}#reply${j.data.rpid}`);

  // ── 记账 ────────────────────────────────────────────
  try {
    const db = new DatabaseSync(DB_FILE);
    db.prepare(`
      INSERT INTO sends(event_id, kind, target, user_id, text, rpid, sent_at, ok)
      VALUES(?,?,?,?,?,?,?,?)
    `).run("", "comment_post", `bv:${bv}`, String(v.data.owner.mid), text, String(j.data?.rpid || ""), Math.floor(Date.now() / 1000), ok ? 1 : 0);
    db.close();
  } catch (e) {
    log("  ⚠️ 记账失败:", e.message);
  }

  process.exit(ok ? 0 : 1);
})();
