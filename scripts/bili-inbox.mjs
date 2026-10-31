#!/usr/bin/env node
/**
 * bili-inbox.mjs —— 评论 / @ / 回复我的 → 事件队列
 * ============================================================
 * 她原来只能看见私信。评论区里发生什么，她一概不知。
 * 这个脚本只做一件事：把**新的**评论收进来，写进 events 表。
 *
 * 为什么不直接回：
 *   回复必须过 bili-send 的四道闸（内容 / 限速 / 静默 / 类型）。
 *   这里只负责「收」，回不回、怎么回由她（或人）当场判断。
 *
 * 命令：
 *   node bili-inbox.mjs pull               收一轮，打印新增
 *   node bili-inbox.mjs pull --json        机器可读
 *   node bili-inbox.mjs list               还没处理的
 *   node bili-inbox.mjs stats              统计
 *   node bili-inbox.mjs pull --video BV1xx 只收这条视频的评论（调试用）
 *
 * 事件 id 约定：comment:<rpid> / at:<id> / reply:<id>
 * 退出码：0 正常 / 1 出错
 */

import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || `${HOME}/secrets/bili_cookie.txt`;
const DB_FILE = process.env.BILI_DB || `${HOME}/bili/data/bili.db`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const GAP_MS = 600;          // 请求间隔，别触发风控
const MAX_VIDEOS = 10;       // 只看最近 10 个稿
const MAX_AGE_DAYS = 7;      // 超过 7 天的旧评论不追

const argv = process.argv.slice(2);
const cmd = argv[0] || "pull";
const opt = {};
for (let i = 1; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  }
}

const cookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const jar = {};
for (const p of cookie.split(";")) { const i = p.indexOf("="); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
const SELF = String(jar.DedeUserID || "");
const CSRF = jar.bili_jct || "";

const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, ref TEXT, author TEXT, author_id TEXT,
    body TEXT, origin_ts INTEGER, seen_at INTEGER, status INTEGER DEFAULT 0, raw TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, seen_at);
`);

let lastCall = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, params = {}) {
  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString(), {
    headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/", Origin: "https://www.bilibili.com", Cookie: cookie },
    signal: AbortSignal.timeout(20_000),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { code: -999, message: t.slice(0, 120) }; }
}

// 时间戳在 events 表里有三种单位（秒/毫秒/微秒），展示前统一成毫秒
const normTs = (t) => {
  const n = Number(t) || 0;
  if (n > 1e14) return n / 1e3;
  if (n > 1e11) return n;
  if (n > 1e9) return n * 1e3;
  return n;
};
const day = (s) => new Date(normTs(s)).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
const clip = (s, n = 200) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

function addEvent(ev) {
  const now = Date.now();
  const r = db.prepare(`
    INSERT OR IGNORE INTO events(id, kind, ref, author, author_id, body, origin_ts, seen_at, status, raw)
    VALUES(?,?,?,?,?,?,?,?,0,?)
  `).run(ev.id, ev.kind, ev.ref || "", ev.author || "", String(ev.authorId || ""), ev.body || "", ev.originTs || now, now, JSON.stringify(ev.raw || {}));
  return r.changes > 0;
}

/** 我的已发布稿件 */
async function myVideos() {
  const j = await get("https://member.bilibili.com/x/web/archives", {
    status: "pubed", pn: 1, ps: MAX_VIDEOS, coop: 1, interactive: 1,
  });
  if (j.code !== 0) throw new Error(`取稿件失败 ${j.code} ${j.message || ""}`);
  return (j.data?.arc_audits || []).map((a) => {
    const x = a.Archive || a;
    return { aid: Number(x.aid), bvid: x.bvid, title: x.title };
  });
}

/** 某条视频的最新评论（按时间倒序） */
async function recentComments(aid) {
  // sort=0 按时间；老接口，但给的是「最新在前」，正好用来增量收
  const j = await get("https://api.bilibili.com/x/v2/reply", { type: 1, oid: aid, sort: 0, pn: 1, ps: 20 });
  if (j.code === 0 && Array.isArray(j.data?.replies)) return j.data.replies;
  // 兜底：主接口 mode=2
  const k = await get("https://api.bilibili.com/x/v2/reply/main", { type: 1, oid: aid, mode: 2, next: 0, ps: 20 });
  return k.data?.replies || [];
}

async function pull() {
  const added = [];
  const since = Date.now() - MAX_AGE_DAYS * 86400_000;

  let videos = [];
  if (opt.video) {
    const v = await get("https://api.bilibili.com/x/web-interface/view", { bvid: String(opt.video) });
    if (v.code !== 0) throw new Error(`解析 ${opt.video} 失败: ${v.message}`);
    videos = [{ aid: v.data.aid, bvid: v.data.bvid, title: v.data.title, foreign: true }];
  } else {
    videos = await myVideos();
  }

  for (const v of videos) {
    const reps = await recentComments(v.aid);
    for (const r of reps) {
      const ts = Number(r.ctime || 0) * 1000;
      if (ts && ts < since) continue;
      if (String(r.mid) === SELF) continue;          // 自己的评论不收回
      const body = clip(r.content?.message, 400);
      if (!body) continue;
      const ev = {
        id: `comment:${r.rpid}`,
        kind: "comment",
        ref: `aid:${v.aid}`,
        author: r.member?.uname || "",
        authorId: r.mid,
        body,
        originTs: ts,
        raw: { rpid: r.rpid, bvid: v.bvid, title: v.title, root: r.root || 0, like: r.like || 0, replies: (r.replies || []).length },
      };
      if (addEvent(ev)) added.push({ ...ev, at: ts });
    }
  }

  // 我动态下的评论（2026-10-31 补：之前只收稿件评论/@/回复，动态是盲区）
  try {
    const dyn = await get("https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space", {
      host_mid: SELF, offset: "", features: "itemOpUsStyle",
    });
    for (const it of dyn.data?.items || []) {
      const basic = it.basic || {};
      const oid = basic.comment_id_str || it.id_str;
      const ctype = Number(basic.comment_type || 17);
      if (!oid) continue;
      const dr = await get("https://api.bilibili.com/x/v2/reply/main", { type: ctype, oid, mode: 3, ps: 20 });
      for (const r of dr.data?.replies || []) {
        const ts = Number(r.ctime || 0) * 1000;
        if (ts && ts < since) continue;
        if (String(r.mid) === SELF) continue;
        const body = clip(r.content?.message, 400);
        if (!body) continue;
        const ev = {
          id: `dyn:${r.rpid}`,
          kind: "comment",
          ref: `oid:${oid}`,
          author: r.member?.uname || "",
          authorId: r.mid,
          body,
          originTs: ts,
          raw: { rpid: r.rpid, dyn_id: oid, ctype, surface: "dynamic", root: r.root || 0 },
        };
        if (addEvent(ev)) added.push({ ...ev, at: ts });
      }
    }
  } catch { /* 动态拉取失败不阻断其余收取 */ }

  // @我的
  const at = await get("https://api.bilibili.com/x/msgfeed/at", { build: 0, mobi_app: "web" });
  if (at.code === 0) {
    for (const it of at.data?.items || []) {
      const text = clip(it.item?.content, 400);
      if (!text) continue;
      const ts = Number(it.at_time || 0);
      if (ts && ts < since) continue;
      if (String(it.user?.mid) === SELF) continue;
      const uri = String(it.item?.uri || "");
      const aidMatch = uri.match(/(?:video|av)\/?(\d+)/i) || uri.match(/\/(\d{6,})/);
      const ev = {
        id: `at:${it.id}`,
        kind: "at",
        ref: aidMatch ? `aid:${aidMatch[1]}` : "",
        author: it.user?.nickname || "",
        authorId: it.user?.mid,
        body: text,
        originTs: ts,
        raw: { uri, at_id: it.id },
      };
      if (addEvent(ev)) added.push({ ...ev, at: ts });
    }
  }

  // 回复我的
  const rp = await get("https://api.bilibili.com/x/msgfeed/reply", { build: 0, mobi_app: "web" });
  if (rp.code === 0) {
    for (const it of rp.data?.items || []) {
      const text = clip(it.item?.content, 400);
      if (!text) continue;
      const ts = Number(it.reply_time || 0);
      if (ts && ts < since) continue;
      if (String(it.user?.mid) === SELF) continue;
      const oid = Number(it.item?.oid || 0);
      const ev = {
        id: `reply:${it.id}`,
        kind: "reply",
        ref: oid ? `aid:${oid}` : "",
        author: it.user?.nickname || "",
        authorId: it.user?.mid,
        body: text,
        originTs: ts,
        raw: { oid, root_id: it.item?.root_id, source: it.item?.source, uri: it.item?.uri },
      };
      if (addEvent(ev)) added.push({ ...ev, at: ts });
    }
  }

  return { added, videos: videos.length };
}

function listPending(limit = 20) {
  return db.prepare("SELECT * FROM events WHERE status = 0 ORDER BY origin_ts DESC LIMIT ?").all(limit);
}

function stats() {
  const by = db.prepare("SELECT kind, status, COUNT(*) c FROM events GROUP BY kind, status").all();
  return by;
}

try {
  if (cmd === "pull") {
    const { added, videos } = await pull();
    if (opt.json) {
      console.log(JSON.stringify({ ok: true, videos, added: added.length, items: added.map((a) => ({ id: a.id, kind: a.kind, author: a.author, id_uid: a.authorId, body: a.body })) }, null, 2));
    } else {
      console.log(`轮询 ${videos} 个稿件，新增 ${added.length} 条`);
      for (const a of added) console.log(`  [${a.kind}] ${a.author}: ${a.body.slice(0, 70)}`);
      if (!videos) console.log("  （还没有已发布的稿件，评论区是空的）");
    }
    process.exit(0);
  }

  if (cmd === "list") {
    const rows = listPending(Number(opt.limit || 20));
    if (!rows.length) { console.log("（没有待处理）"); process.exit(0); }
    for (const e of rows) {
      console.log(`\n[${e.kind}] ${e.id}`);
      console.log(`  ${e.author}（uid ${e.author_id}） ${day(e.origin_ts)}`);
      console.log(`  ${clip(e.body, 200)}`);
      console.log(`  回复：node bili-send.mjs approve ${e.id} "内容" && node bili-send.mjs send ${e.id} --confirm`);
    }
    process.exit(0);
  }

  if (cmd === "stats") {
    const rows = stats();
    if (!rows.length) { console.log("（events 表是空的）"); process.exit(0); }
    for (const r of rows) console.log(`${r.kind}\tstatus=${r.status}\t${r.c}`);
    process.exit(0);
  }

  console.log("用法：node bili-inbox.mjs <pull|list|stats> [--json] [--video BV1xx]");
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
}
