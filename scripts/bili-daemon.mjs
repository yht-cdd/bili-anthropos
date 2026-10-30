#!/usr/bin/env node
/**
 * bili-daemon.mjs — B 站实时感知守护
 * ============================================================
 * 设计要点：
 *   1. 只读，绝不发任何内容（发送由 bili-send.mjs 单独负责）
 *   2. 三级轮询：L0 总量探针（45ms）→ L1 详情 → L2 落库
 *   3. 自适应节拍：空闲 45s，有活动 12s，出错指数退避到 300s
 *   4. 零依赖：只用 node:sqlite + 内置 fetch
 *   5. 断点续传：所有游标和已见 ID 都落盘，重启不重复不遗漏
 *
 * 用法：
 *   node bili-daemon.mjs                 常驻运行
 *   node bili-daemon.mjs --once          跑一轮就退出（用于 cron / 调试）
 *   node bili-daemon.mjs --interval 30   指定空闲节拍（秒）
 *   node bili-daemon.mjs --verbose       打印每次请求
 *
 * 退出码：0 正常 / 1 Cookie 失效 / 2 未捕获异常
 */

import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

// ── 配置 ────────────────────────────────────────────
const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || `${HOME}/secrets/bili_cookie.txt`;
const DB_FILE = process.env.BILI_DB || `${HOME}/bili/data/bili.db`;
const PID_FILE = `${HOME}/bili/data/daemon.pid`;
const EVENT_JSONL = `${HOME}/bili/data/events.jsonl`;
const ALERT_FILE = `${HOME}/ALERT.md`;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const GAP_MS = 400;          // 请求间隔，绝不并发
const IDLE_S = 45;           // 空闲节拍
const ACTIVE_S = 12;         // 有活动时的节拍
const MAX_BACKOFF_S = 300;   // 出错退避上限

const argv = process.argv.slice(2);
const ONCE = argv.includes("--once");
const VERBOSE = argv.includes("--verbose");
const IDLE_MS = (Number(argv[argv.indexOf("--interval") + 1]) || IDLE_S) * 1000;

// --probe-video BV1xx 或 aid：对任意公开视频跑一次评论采集（用于验证链路）
const probeIdx = argv.indexOf("--probe-video");
const PROBE_VIDEO = probeIdx >= 0 ? argv[probeIdx + 1] : null;

// ── 日志 ────────────────────────────────────────────
const ts = () => new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
function log(...a) {
  const line = `[${ts()}] ${a.join(" ")}`;
  console.log(line);
  try { fs.appendFileSync(`${HOME}/bili/logs/daemon.log`, line + "\n"); } catch {}
}
function vlog(...a) { if (VERBOSE) log("  ·", ...a); }

// ── Cookie ──────────────────────────────────────────
function loadCookie() {
  const raw = fs.readFileSync(COOKIE_FILE, "utf8").trim();
  const jar = {};
  for (const p of raw.split(";")) {
    const i = p.indexOf("=");
    if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return { raw, jar };
}
let { raw: COOKIE, jar: JAR } = loadCookie();

// ── HTTP ────────────────────────────────────────────
let lastCall = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function http(url, opts = {}) {
  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const r = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      "User-Agent": UA,
      Referer: "https://www.bilibili.com/",
      Origin: "https://www.bilibili.com",
      Cookie: COOKIE,
      ...(opts.headers || {}),
    },
    body: opts.body,
    signal: AbortSignal.timeout(opts.timeout || 20000),
  });
  const text = await r.text();
  vlog(`${opts.method || "GET"} ${r.status} ${url.slice(0, 90)}`);
  try { return JSON.parse(text); }
  catch { return { code: -999, message: `非JSON(${r.status}): ${text.slice(0, 80)}` }; }
}

// B 站时间戳单位混乱：私信微秒，其余多秒
function toMs(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n > 1e14) return Math.floor(n / 1000);   // 微秒
  if (n > 1e11) return n;                       // 毫秒
  return n * 1000;                              // 秒
}

// ── 数据库 ──────────────────────────────────────────
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    kind        TEXT NOT NULL,
    ref         TEXT,
    author      TEXT,
    author_id   TEXT,
    body        TEXT,
    origin_ts   INTEGER,
    seen_at     INTEGER,
    status      INTEGER DEFAULT 0,
    raw         TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, seen_at);
  CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);

  CREATE TABLE IF NOT EXISTS kv (
    k TEXT PRIMARY KEY,
    v TEXT
  );

  CREATE TABLE IF NOT EXISTS videos (
    bvid        TEXT PRIMARY KEY,
    aid         INTEGER,
    title       TEXT,
    state       TEXT,
    reply_count INTEGER DEFAULT 0,
    view        INTEGER DEFAULT 0,
    like_count  INTEGER DEFAULT 0,
    updated_at  INTEGER
  );
`);

const kvGet = (k, d = null) => {
  const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(k);
  return r ? r.v : d;
};
const kvSet = (k, v) => db.prepare("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(k, String(v));

/**
 * 写入事件。返回 true = 这是新事件
 */
function pushEvent(ev) {
  try {
    const r = db.prepare(`
      INSERT INTO events (id, kind, ref, author, author_id, body, origin_ts, seen_at, status, raw)
      VALUES (?,?,?,?,?,?,?,?,0,?)
    `).run(ev.id, ev.kind, ev.ref ?? null, ev.author ?? null, ev.author_id ?? null,
           (ev.body ?? "").slice(0, 2000), ev.origin_ts ?? 0, Date.now(), JSON.stringify(ev.raw ?? null).slice(0, 8000));
    if (r.changes > 0) {
      fs.appendFileSync(EVENT_JSONL, JSON.stringify({
        id: ev.id, kind: ev.kind, ref: ev.ref, author: ev.author, body: ev.body, ts: ev.origin_ts,
      }) + "\n");
      return true;
    }
  } catch (e) { log("pushEvent 失败", ev.id, e.message); }
  return false;
}

// ── 采集器 ──────────────────────────────────────────

/** L0：全局未读探针。这是所有轮询的触发源，45ms 一个请求 */
async function pollUnread() {
  const j = await http("https://api.bilibili.com/x/msgfeed/unread?mobi_app=web");
  if (j.code === -101) throw Object.assign(new Error("Cookie 失效"), { fatal: true });
  if (j.code !== 0) return null;
  return j.data;
}

/** L1-a：@我的 */
async function pollAt(limit = 20) {
  const j = await http("https://api.bilibili.com/x/msgfeed/at?build=0&mobi_app=web");
  if (j.code !== 0) return 0;
  const items = j.data?.items || [];
  let n = 0;
  for (const it of items.slice(0, limit)) {
    const id = `at:${it.id || it.at_id || JSON.stringify(it).slice(0, 40)}`;
    const uri = it.item?.uri || "";
    const body = it.item?.content || it.item?.title || it.item?.desc || "";
    const added = pushEvent({
      id, kind: "at", ref: uri,
      author: it.user?.nickname, author_id: String(it.user?.mid || ""),
      body, origin_ts: toMs(it.at_time) / 1000, raw: it,
    });
    if (added) n++;
  }
  return n;
}

/** L1-b：回复我的 */
async function pollReply(limit = 20) {
  const j = await http("https://api.bilibili.com/x/msgfeed/reply?build=0&mobi_app=web");
  if (j.code !== 0) return 0;
  const items = j.data?.items || [];
  let n = 0;
  for (const it of items.slice(0, limit)) {
    const id = `reply:${it.id || it.reply_id || JSON.stringify(it).slice(0, 40)}`;
    const body = it.item?.source_content || it.item?.content || it.content || "";
    const added = pushEvent({
      id, kind: "reply", ref: it.item?.uri || it.uri || "",
      author: it.user?.nickname, author_id: String(it.user?.mid || ""),
      body, origin_ts: toMs(it.reply_time || it.time) / 1000, raw: it,
    });
    if (added) n++;
  }
  return n;
}

/** L1-c：私信会话 → 逐条消息 */
async function pollSessions() {
  const j = await http("https://api.vc.bilibili.com/session_svr/v1/session_svr/get_sessions?session_type=1&group_id=0&build=0&mobi_app=web");
  if (j.code === -101) throw Object.assign(new Error("Cookie 失效"), { fatal: true });
  if (j.code !== 0) return 0;

  const list = (j.data?.session_list || []).filter(s => s.talker_id && s.talker_id !== Number(JAR.DedeUserID));
  let n = 0;

  for (const s of list) {
    const talker = String(s.talker_id);
    const prev = Number(kvGet(`sess_ts:${talker}`, 0));
    const now = Number(s.session_ts || 0);
    // 时间戳没动就跳过（省请求）
    if (now && prev && now <= prev) continue;

    const mj = await http(
      `https://api.vc.bilibili.com/svr_sync/v1/svr_sync/fetch_session_msgs` +
      `?talker_id=${talker}&session_type=1&size=20&build=0&mobi_app=web`
    );
    if (mj.code !== 0) continue;

    const msgs = mj.data?.messages || [];
    // 只处理对方发来的（sender_uid 不是自己）
    for (const m of msgs) {
      if (String(m.sender_uid) === String(JAR.DedeUserID)) continue;
      const seq = m.msg_seqno ?? m.msg_key ?? m.timestamp;
      const id = `dm:${talker}:${seq}`;
      let body = m.content || "";
      if (typeof body === "string" && body.trim().startsWith("{")) {
        try {
          const o = JSON.parse(body);
          body = o.content || o.text || o.title || o.desc?.[0]?.text || body;
        } catch {}
      }
      const added = pushEvent({
        id, kind: "dm", ref: talker,
        author: String(talker), author_id: talker,
        body: String(body).replace(/\\n/g, "\n"), origin_ts: Number(m.timestamp || 0), raw: m,
      });
      if (added) n++;
    }
    if (now) kvSet(`sess_ts:${talker}`, now);
  }
  return n;
}

/** L1-d：自有稿件 + 评论数对比 */
async function pollOwnVideos() {
  const j = await http(
    "https://member.bilibili.com/x/web/archives" +
    "?status=is_pubing,pubed,not_pubed&pn=1&ps=20&coop=1&interactive=1"
  );
  if (j.code !== 0) return 0;

  const list = j.data?.arc_audits || [];
  let n = 0;
  const upsert = db.prepare(`
    INSERT INTO videos (bvid, aid, title, state, reply_count, view, like_count, updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(bvid) DO UPDATE SET
      title=excluded.title, state=excluded.state,
      reply_count=excluded.reply_count, view=excluded.view,
      like_count=excluded.like_count, updated_at=excluded.updated_at
  `);

  for (const a of list) {
    const arc = a.Archive || a;
    if (!arc.bvid || !arc.aid) continue;

    // 只跑已发布稿件的评论
    const isPubed = (a.Archive?.state ?? arc.state) === 0 || a.Archive?.state_desc === "已发布";
    let replyCount = 0;

    if (isPubed) {
      // 最轻量的探针：只返回总数
      const cj = await http(`https://api.bilibili.com/x/v2/reply/count?type=1&oid=${arc.aid}`);
      if (cj.code === 0) {
        replyCount = cj.data?.count ?? 0;
        const prev = Number(kvGet(`rc:${arc.aid}`, 0));
        if (replyCount > prev) {
          n += await pollVideoComments(arc.aid, Math.min(replyCount - prev, 20));
        }
        kvSet(`rc:${arc.aid}`, replyCount);
      }
    }

    upsert.run(
      arc.bvid, arc.aid, arc.title || "", String(a.Archive?.state_desc ?? arc.state_desc ?? ""),
      replyCount, Number(arc.stat?.view ?? 0), Number(arc.stat?.like ?? 0), Date.now()
    );
  }
  return n;
}

/** 拉指定稿件的最新评论（按时间序，只抓真正新的） */
async function pollVideoComments(aid, want = 20) {
  const j = await http(`https://api.bilibili.com/x/v2/reply/main?type=1&oid=${aid}&mode=2&next=0&ps=${Math.min(want, 20)}`);
  if (j.code !== 0) return 0;

  const replies = j.data?.replies || [];
  let n = 0;
  for (const r of replies) {
    const rpid = String(r.rpid);
    // 跳过自己发的评论
    if (String(r.mid) === String(JAR.DedeUserID)) continue;
    const added = pushEvent({
      id: `comment:${rpid}`, kind: "comment", ref: `aid:${aid}`,
      author: r.member?.uname, author_id: String(r.mid),
      body: r.content?.message || "", origin_ts: Number(r.ctime || 0), raw: r,
    });
    if (added) n++;
  }
  return n;
}

// ── 主循环 ──────────────────────────────────────────
let stopping = false;
let backoff = 0;
let tickCount = 0;

async function tick() {
  tickCount++;
  const unread = await pollUnread();
  if (!unread) {
    backoff = backoff ? Math.min(backoff * 2, MAX_BACKOFF_S) : 30;
    log(`⚠️ unread 探针失败，退避 ${backoff}s`);
    return { interval: backoff * 1000, hits: 0 };
  }
  backoff = 0;

  let hits = 0;
  const dirty = [];

  if ((unread.at ?? 0) > 0) {
    const n = await pollAt();
    if (n) { hits += n; dirty.push(`at:+${n}`); }
  }

  if ((unread.reply ?? 0) > 0 || (unread.recv_reply ?? 0) > 0) {
    const n = await pollReply();
    if (n) { hits += n; dirty.push(`reply:+${n}`); }
  }

  if ((unread.chat ?? 0) > 0) {
    const n = await pollSessions();
    if (n) { hits += n; dirty.push(`dm:+${n}`); }
  } else if (tickCount % 12 === 0) {
    // 低频兜底：即使未读被别处清掉，也每 12 拍同步一次会话
    const n = await pollSessions();
    if (n) { hits += n; dirty.push(`dm:*+${n}`); }
  }

  // 稿件与评论：每 8 拍（约 6 分钟）一次
  if (tickCount % 8 === 0) {
    const n = await pollOwnVideos();
    if (n) { hits += n; dirty.push(`comment:+${n}`); }
  }

  kvSet("last_tick", Date.now());
  kvSet("last_unread", JSON.stringify(unread));

  if (dirty.length) log(`📥 新事件 ${dirty.join(" ")}`);

  return { interval: hits > 0 ? ACTIVE_MS : IDLE_MS, hits };
}

const ACTIVE_MS = ACTIVE_S * 1000;

async function main() {
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));

  log(`═══ bili-daemon 启动 pid=${process.pid} 空闲节拍=${IDLE_MS / 1000}s ═══`);

  // 启动自检
  const nav = await http("https://api.bilibili.com/x/web-interface/nav");
  if (nav.code !== 0 || !nav.data?.isLogin) {
    log(`❌ 登录态无效 code=${nav.code} ${nav.message || ""}`);
    process.exit(1);
  }
  log(`身份：${nav.data.uname} (uid ${nav.data.mid}) Lv${nav.data.level_info?.current_level}`);

  // ── 验证模式：对任意视频跑一次评论采集 ──
  if (PROBE_VIDEO) {
    let aid = Number(PROBE_VIDEO);
    if (!Number.isFinite(aid) || aid === 0) {
      const vj = await http(`https://api.bilibili.com/x/web-interface/view?bvid=${PROBE_VIDEO}`);
      if (vj.code !== 0) { log(`❌ 解析 ${PROBE_VIDEO} 失败: ${vj.message}`); process.exit(1); }
      aid = vj.data.aid;
      log(`视频：${vj.data.title}  aid=${aid}`);
    }
    const cj = await http(`https://api.bilibili.com/x/v2/reply/count?type=1&oid=${aid}`);
    log(`评论总数探针：code=${cj.code} count=${cj.data?.count}`);

    const n = await pollVideoComments(aid, 20);
    log(`本次采集新增事件：${n} 条`);
    const rows = db.prepare("SELECT id, author, substr(body,1,40) b, origin_ts FROM events WHERE kind='comment' ORDER BY seen_at DESC LIMIT 10").all();
    for (const r of rows) {
      log(`  ${r.id.padEnd(20)} ${(r.author || "").padEnd(12)} ${r.b}`);
    }
    log("═══ 验证完成 ═══");
    try { fs.unlinkSync(PID_FILE); } catch {}
    return;
  }

  // Cookie 被别的进程刷新过时重新读取
  let cookieMtime = fs.statSync(COOKIE_FILE).mtimeMs;

  while (!stopping) {
    let waitMs = IDLE_MS;
    try {
      const r = await tick();
      waitMs = r.interval;
    } catch (e) {
      if (e.fatal) {
        log(`❌ 致命：${e.message}`);
        try {
          fs.appendFileSync(ALERT_FILE, `\n## ${ts()} · bili-daemon 登录态失效\n\n需要重新扫码登录并上传 Cookie。\n`);
        } catch {}
        process.exit(1);
      }
      log(`⚠️ tick 异常：${e.message}`);
      waitMs = Math.min(Math.max(backoff, 30) * 1000, MAX_BACKOFF_S * 1000);
    }

    // 热重载 Cookie：cron 每天刷新 ticket 后会自动变更文件
    try {
      const m = fs.statSync(COOKIE_FILE).mtimeMs;
      if (m !== cookieMtime) {
        const l = loadCookie();
        COOKIE = l.raw; JAR = l.jar;
        cookieMtime = m;
        log("🔄 Cookie 已热重载");
      }
    } catch {}

    if (ONCE) break;
    await sleep(waitMs);
  }

  log("═══ bili-daemon 停止 ═══");
  try { fs.unlinkSync(PID_FILE); } catch {}
}

process.on("SIGTERM", () => { stopping = true; log("收到 SIGTERM"); });
process.on("SIGINT", () => { stopping = true; log("收到 SIGINT"); });

main().catch(e => { log("❌ 未捕获异常:", e.stack || e.message); process.exit(2); });
