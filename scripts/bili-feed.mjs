#!/usr/bin/env node
/**
 * bili-feed.mjs —— 看 B 站今天在推什么（首页推荐 + 热门 + 排行）
 * ============================================================
 * 为什么不用搜新闻：
 *   EXA 搜回来的是「谁发了什么模型」，而 B 站推荐是**平台算法筛过的**——
 *   它直接告诉你「今天什么东西有人看」。做 B 站内容，后者比前者有用。
 *
 * 三个来源各有分工：
 *   首页推荐（rcmd）  —— 算法觉得你会看什么（个人画像）
 *   热门（popular）   —— 全站都在看什么
 *   排行（ranking）   —— 分区权重最高的
 *
 * 用法：
 *   node bili-feed.mjs                       # 三个来源各取一批，去重
 *   node bili-feed.mjs --n 20                # 最多给 20 条
 *   node bili-feed.mjs --max-min 20          # 只要 20 分钟以内的
 *   node bili-feed.mjs --json                # 结构化输出
 *   node bili-feed.mjs --kind rcmd|popular|rank   # 只看一个来源
 *
 * 注意：rcmd 要 WBI 签名，靠 scripts/wbi.mjs。
 */

import fs from "node:fs";
import path from "node:path";
import { wbiSignedUrl } from "./wbi.mjs";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = path.join(HOME, "secrets/bili_cookie.txt");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i += 1) {
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

const N = Number(opt.n || 20);
const MAX_MIN = Number(opt["max-min"] || 30);
const cookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const H = { "User-Agent": UA, Referer: "https://www.bilibili.com/", Cookie: cookie };
const log = (...a) => console.error(...a);

const rand = (n) => Math.floor(Math.random() * n) + 1;

async function get(url) {
  try {
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(25_000) });
    const j = await r.json();
    if (j.code !== 0) {
      log(`  ⚠️ code=${j.code} ${j.message || ""}`);
      return null;
    }
    return j;
  } catch (e) {
    log(`  ⚠️ ${e.message}`);
    return null;
  }
}

/** 统一成同一种形状 */
function norm(v, source) {
  const stat = v.stat || {};
  return {
    bvid: String(v.bvid || ""),
    title: String(v.title || v.name || "").replace(/<[^>]+>/g, ""),
    up: String(v.owner?.name || v.up_name || ""),
    upMid: String(v.owner?.mid || ""),
    duration: Number(v.duration || 0),
    view: Number(stat.view || 0),
    like: Number(stat.like || 0),
    danmaku: Number(stat.danmaku || 0),
    reply: Number(stat.reply || 0),
    tname: String(v.tname || ""),
    pubdate: v.pubdate ? new Date(v.pubdate * 1000).toISOString().slice(0, 10) : "",
    source,
  };
}

(async () => {
  const kind = String(opt.kind || "all");
  const buckets = [];

  if (kind === "all" || kind === "rcmd") {
    log("① 首页推荐（WBI 签名）");
    try {
      const u = await wbiSignedUrl("https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd", {
        web_location: "1430650",
        fresh_type: "4",
        feed_version: "V8",
        ps: "12",
        fresh_idx: String(rand(30)),
        fresh_idx_1h: String(rand(30)),
      });
      const j = await get(u);
      const items = (j?.data?.item || []).filter((x) => x.bvid).map((x) => norm(x, "首页推荐"));
      log(`   → ${items.length} 条`);
      buckets.push(...items);
    } catch (e) {
      log(`   签名失败：${e.message}`);
    }
  }

  if (kind === "all" || kind === "popular") {
    log("② 热门");
    const j = await get(`https://api.bilibili.com/x/web-interface/popular?ps=20&pn=${Math.min(3, rand(3))}`);
    const items = (j?.data?.list || []).map((x) => norm(x, "热门"));
    log(`   → ${items.length} 条`);
    buckets.push(...items);
  }

  if (kind === "all" || kind === "rank") {
    log("③ 排行");
    const j = await get("https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all");
    const items = (j?.data?.list || []).map((x) => norm(x, "排行"));
    log(`   → ${items.length} 条`);
    buckets.push(...items);
  }

  // 去重（同一个 bvid 只留一条，但记下它在几个来源出现过）
  const map = new Map();
  for (const it of buckets) {
    if (!it.bvid) continue;
    if (map.has(it.bvid)) {
      const cur = map.get(it.bvid);
      cur.sources = [...new Set([...(cur.sources || [cur.source]), it.source])];
    } else {
      map.set(it.bvid, { ...it, sources: [it.source] });
    }
  }

  let list = [...map.values()];

  // 时长过滤：太长的今天看不完
  const tooLong = list.filter((x) => x.duration > MAX_MIN * 60);
  list = list.filter((x) => x.duration > 30 && x.duration <= MAX_MIN * 60);

  // 排序：多来源命中的优先，再按播放
  list.sort((a, b) => {
    const sa = (a.sources?.length || 1) * 10_000_000 + a.view;
    const sb = (b.sources?.length || 1) * 10_000_000 + b.view;
    return sb - sa;
  });

  list = list.slice(0, N);

  const out = {
    at: new Date().toISOString(),
    maxMin: MAX_MIN,
    total: list.length,
    filteredOut: tooLong.length,
    items: list.map((x) => ({
      bvid: x.bvid,
      title: x.title,
      up: x.up,
      min: Math.round((x.duration / 60) * 10) / 10,
      view: x.view,
      danmaku: x.danmaku,
      reply: x.reply,
      tname: x.tname,
      sources: x.sources,
    })),
  };

  // 存档，方便翻历史
  const dir = path.join(HOME, "knowledge/feed");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${new Date().toLocaleDateString("sv-SE")}.json`), JSON.stringify(out, null, 2));

  if (opt.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(`B 站今天在推什么 · ${new Date().toLocaleString("zh-CN")}`);
    console.log(`（${list.length} 条，已滤掉 ${tooLong.length} 条超过 ${MAX_MIN} 分钟的长片）\n`);
    for (const x of out.items) {
      const src = x.sources.length > 1 ? x.sources.join("+") : x.sources[0];
      console.log(`${String(Math.round(x.view / 10000)).padStart(5)}万  ${x.bvid}  ${x.min}分  [${src}] ${x.tname}`);
      console.log(`       ${x.title}`);
      console.log(`       UP: ${x.up}  ·  弹幕 ${x.danmaku}  评论 ${x.reply}`);
    }
  }
})();
