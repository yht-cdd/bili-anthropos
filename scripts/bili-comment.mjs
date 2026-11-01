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

/**
 * 人味检查 —— 拦掉「一眼是 AI 写的」那种句子。
 *
 * 起因：2026-10-31 在一条 1.29 亿播放的鬼畜下面发了这句：
 *   「倒回去看了两遍才发现，后半段的音轨已经跑到楚汉去了——前面还是鹅城，
 *     后面项羽刘邦全来了。这种「眼睛听一套、耳朵听一套」的剪法，
 *     比单纯把台词堆成鼓点狠多了。」
 * 内容是准的（她真看了），但一眼假：提炼概念、工整对比、破折号转折。
 *
 * 这个函数不是让她演人，是拦掉「写作腔」——留言就该像留言。
 */
function gateHuman(text) {
  const issues = [];

  // ① 成对引号：真人评论很少打引号
  if (/[「」『』]/.test(text)) issues.push("用了「」这种成对引号（真人很少打，要强调就直接说）");

  // ② 破折号转折
  if (/——/.test(text)) issues.push("用了破折号 ——（写文章才这么用）");

  // ③ AI 句式
  const patterns = [
    ["提炼概念（这种…的…）", /这种.{0,10}的[剪写做说感]|这种.{0,6}方式|这类.{0,6}[做写]/],
    ["「从…来看」", /从.{0,10}来看|就.{0,6}[而]?言/],
    ["总结陈词", /值得注意|本质上|换句话[说讲]|总的来说|归根结底/],
    ["工整对仗（不是…而是…）", /不是.{1,18}[，,]而是/],
    ["工整比较（比…更…）", /比.{1,18}更[加狠强好棒妙]/],
  ];
  for (const [why, re] of patterns) {
    if (re.test(text)) issues.push(why);
  }

  // ④⑤ 字数限制已按主人令移除（2026-11-01 23:49：「把风格闸门的字数限制去掉」）。
  // 评论长短由写的人自己把握，闸门只管 AI 味，不管长度。

  return issues;
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

  // ── 人味检查：拦掉「一眼是 AI 写的」那种句子 ──────────
  const styleIssues = gateHuman(text);
  if (styleIssues.length) {
    console.error("\n⚠️ 这条不像人话：");
    for (const s of styleIssues) console.error(`   · ${s}`);
    console.error("\n改短、改口语、别提炼概念。真人不会在评论区写这种句子。");
    console.error("真要发（比如正式说明），加 --ignore-style 跳过这道检查。\n");
    if (!opt["ignore-style"]) process.exit(3);
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
  const rpid = String(j.data?.rpid || "");
  console.log(`\n${ok ? "已提交" : "❌ 发送失败"} code=${j.code} ${j.message || ""}`);

  // ── 发送成功 ≠ 别人看得见 ──────────────────────────
  // B 站有个「阿瓦隆」系统：返回 code=0，但评论被标成 state=17（仅自己可见）。
  // 2026-10-31 实测：带图评论发出去 code=0，游客视角却是 12006「没有该评论」。
  // 所以这里必须自己查一次，否则我们就在替它撒谎。
  let state = null;
  let visible = null;
  if (ok && rpid) {
    await new Promise((res) => setTimeout(res, 4000));
    try {
      const d = await fetch(
        `https://api.bilibili.com/x/v2/reply/detail?type=1&oid=${aid}&root=${rpid}&ps=1&pn=1`,
        { headers: H, signal: AbortSignal.timeout(20_000) }
      ).then((x) => x.json());
      const node = d.data?.root || d.data?.reply;
      state = node?.state ?? null;
      visible = state === 0;
    } catch {}
  }

  if (ok && rpid) {
    if (visible === true) {
      console.log(`✅ 公开可见（state=0）  rpid=${rpid}`);
    } else if (state === 17) {
      console.log(`⚠️ 已被「阿瓦隆」拦下：state=17，仅你自己可见 —— 别人看不到这条。`);
      console.log(`   不是发送失败，是 B 站静默屏蔽。换措辞、等账号权重起来，或者过阵子再看。`);
    } else if (state !== null) {
      console.log(`⚠️ state=${state}（不是 0，可能审核中或受限）  rpid=${rpid}`);
    } else {
      console.log(`⚠️ 查不到这条评论的状态，无法确认是否公开  rpid=${rpid}`);
    }
    console.log(`   链接: https://www.bilibili.com/video/${bv}#reply${rpid}`);
  }

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
