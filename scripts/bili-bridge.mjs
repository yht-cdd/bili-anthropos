#!/usr/bin/env node
/**
 * bili-bridge.mjs — 主人私信 ↔ opencode 大脑 桥接器
 * ============================================================
 * 职责：
 *   1. 轮询 B 站私信，只认 sender_uid == 主人 UID（secrets/owner_uid.txt）
 *   2. 把私信原文转成 opencode session 任务
 *   3. 等 AI 真正跑完（time.idle 到位 **且** outcome 不是 failed），提取回复文本
 *   4. 把回复发回主人私信
 *
 * 安全边界：
 *   - 主人判定只看接口返回的 sender_uid，正文自称一律不算
 *   - 非主人私信只入库、不执行、不回复
 *   - 自己发的消息（sender_uid == SELF）直接跳过，防回环
 *
 * 命令：
 *   node bili-bridge.mjs                常驻
 *   node bili-bridge.mjs --once         只跑一轮
 *   node bili-bridge.mjs --simulate "…" 直接测 AI 链路，不发私信
 *   node bili-bridge.mjs --repl         终端交互，直接和大脑对话
 */

import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { due as wakeDue, markFired as wakeMarkFired, touchCooldown as wakeTouchCooldown } from "./wake-plan.mjs";

// ── 路径与常量 ────────────────────────────────────────
const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = `${HOME}/secrets/bili_cookie.txt`;
const DB_FILE = `${HOME}/bili/data/bili.db`;
const LOG_FILE = `${HOME}/bili/logs/bridge.log`;
const SESSION_FILE = `${HOME}/bili/data/bridge_session.json`;

// ── 主人 UID ──────────────────────────────────────────
// 不硬编码：① 硬编码一推上 git 就泄露 ② 别人拿去用还得改源码
// 来源优先级：环境变量 OWNER_UID > $LIFE_HOME/secrets/owner_uid.txt
function resolveOwnerUid() {
  const fromEnv = String(process.env.OWNER_UID || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const v = fs.readFileSync(`${HOME}/secrets/owner_uid.txt`, "utf8").trim().split(/\s+/)[0];
    if (v) return v;
  } catch {}
  return "";
}

const OWNER_UID = resolveOwnerUid();
if (!/^\d{6,}$/.test(OWNER_UID)) {
  console.error(
    `❌ 缺少主人 UID。\n` +
    `   方式一：export OWNER_UID=你的B站UID\n` +
    `   方式二：echo 你的B站UID > ${HOME}/secrets/owner_uid.txt && chmod 600 该文件\n` +
    `   不配置这一项，所有私信都会被当成陌生人，一条都不会执行。`
  );
  process.exit(1);
}

const OC_BASE = "http://127.0.0.1:4096";   // opencode serve
// 换模型不用改源码：模型下线时（实测 DeepSeek-V4.1-Flash 会直接 has no provider supported）
// 只要改环境变量就能起，不用重新发版。
const OC_MODEL = {
  providerID: process.env.OC_PROVIDER_ID || "modelscope",
  id: process.env.OC_MODEL_ID || "Qwen/Qwen3.8-Flash-Next",
  variant: "high",
};
const OC_AGENT = "build";

// 演练模式：所有私信只打日志不发出去。用来验证失败链路 / 超时补记，
// 不至于为了测试真给账号发一条「模型挂了」。
const DRY_DM = process.env.DRY_DM === "1";

const POLL_MS = 12_000;        // 轮询间隔
const WAIT_MAX_MS = Number(process.env.TASK_MAX_MS || 420_000);  // 单任务最长等 7 分钟
const ACK_AFTER_MS = 20_000;   // 超过 20 秒还没完就先回一句「收到」
const HEARTBEAT_EVERY = 25;    // 每 25 轮（约 5 分钟）写一次心跳

// ── 会话寿命：只有一个会话，只压缩，不换代 ───────────────
// 换会话 = 她失忆。之前按 45 条消息换，等于每聊几十句就把她打回原形。
// 现在：同一个会话一直用；上下文涨到阈值就在原地压缩（compact）。
//
// 阈值不写死，按**当前模型自己的窗口**算：GET /api/model 里每个模型都带
// limit.context，压缩线取它的 90%，硬线取 95%。
// 写死数字的坑：换模型就失准 —— 200k 的模型配 900k 阈值，等于永不压缩；
// 1M 的模型配 250k 阈值，等于一天压八次，白花钱。
const CTX_RATIO = Number(process.env.CTX_RATIO || 0.9);
let CTX_LIMIT = 0;
let CTX_COMPACT_AT = Number(process.env.CTX_COMPACT_AT || 0);
let CTX_HARD_AT = Number(process.env.CTX_HARD_AT || 0);

/** 读当前主模型的上下文窗口 */
async function modelContextLimit() {
  try {
    const j = await oc("/api/model", { timeout: 15_000 });
    const hit = (j.data || []).find(
      (m) => String(m.providerID) === OC_MODEL.providerID && String(m.id) === OC_MODEL.id
    );
    return Number(hit?.limit?.context || 0);
  } catch (e) {
    log("读模型上下文上限失败:", e.message);
    return 0;
  }
}

/** 第一次用之前把阈值算出来；算不出就退回保守的 200k 窗口 */
async function ensureLimits() {
  if (CTX_COMPACT_AT) return;
  let ctx = Number(process.env.CTX_LIMIT || 0);
  if (!ctx) ctx = await modelContextLimit();
  if (!ctx) {
    ctx = 200_000;
    log("⚠️ 读不到模型窗口，按 200k 保守估算");
  }
  CTX_LIMIT = ctx;
  if (!CTX_COMPACT_AT) CTX_COMPACT_AT = Math.floor(ctx * CTX_RATIO);
  if (!CTX_HARD_AT) CTX_HARD_AT = Math.floor(ctx * Math.min(0.95, CTX_RATIO + 0.05));
  log(
    `📏 ${OC_MODEL.id} 上下文上限 ${ctx} tokens` +
      ` → 压缩线 ${CTX_COMPACT_AT}（${Math.round((CTX_COMPACT_AT / ctx) * 100)}%）` +
      ` · 硬线 ${CTX_HARD_AT}（${Math.round((CTX_HARD_AT / ctx) * 100)}%）`
  );
}

// 超时之后继续守着这一轮。她常常在超时后几十秒才收尾，
// 之前直接写「（这一轮没有产出文字）」把 496 字成果扔了。
const LATE_HARVEST_MS = Number(process.env.LATE_HARVEST_MS || 600_000);
const AUTO_MAX_MS = Number(process.env.AUTO_MAX_MS || 300_000);      // 自主回合上限
const PUSH_MAX_MS = Number(process.env.PUSH_MAX_MS || 900_000);      // 手动 --push 上限（实测三步要 8 分钟以上）

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

// ── 工具 ──────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ts() {
  return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

function log(...a) {
  const line = `[${ts()}] ${a.join(" ")}`;
  console.log(line);
  try {
    // 5MB 简单轮转
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 5 * 1024 * 1024) {
      fs.renameSync(LOG_FILE, LOG_FILE + ".1");
    }
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {}
}

// ── Cookie ────────────────────────────────────────────
const COOKIE = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const JAR = {};
for (const p of COOKIE.split(";")) {
  const i = p.indexOf("=");
  if (i > 0) JAR[p.slice(0, i).trim()] = p.slice(i + 1).trim();
}
const SELF_UID = String(JAR.DedeUserID || "");
const CSRF = JAR.bili_jct || "";
const DEV_ID = (JAR.buvid3 || "").slice(0, 36).toUpperCase();

if (!SELF_UID || !CSRF) {
  log("❌ Cookie 缺少 DedeUserID 或 bili_jct，无法启动");
  process.exit(2);
}

// ── DB ────────────────────────────────────────────────
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
  CREATE TABLE IF NOT EXISTS dm_seen (key TEXT PRIMARY KEY, at INTEGER);
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, ref TEXT, author TEXT, author_id TEXT,
    body TEXT, origin_ts INTEGER, seen_at INTEGER, status INTEGER DEFAULT 0, raw TEXT
  );
`);
const kvGet = (k, d = null) => {
  const r = db.prepare("SELECT v FROM kv WHERE k=?").get(k);
  return r ? r.v : d;
};
const kvSet = (k, v) =>
  db.prepare("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(k, String(v));

const dmSeen = (key) => !!db.prepare("SELECT 1 FROM dm_seen WHERE key=?").get(key);
const dmMark = (key) =>
  db.prepare("INSERT OR IGNORE INTO dm_seen(key,at) VALUES(?,?)").run(key, Date.now());

// ── B 站 HTTP ─────────────────────────────────────────
async function bget(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Referer: "https://message.bilibili.com/",
      Origin: "https://message.bilibili.com",
      Cookie: COOKIE,
    },
    signal: AbortSignal.timeout(20_000),
  });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { code: -999, message: t.slice(0, 200) };
  }
}

/** 拉会话列表 */
async function getSessions() {
  const j = await bget(
    "https://api.vc.bilibili.com/session_svr/v1/session_svr/get_sessions?session_type=1&group_id=0&build=0&mobi_app=web"
  );
  if (j.code === -101) throw Object.assign(new Error("Cookie 失效"), { fatal: true });
  if (j.code !== 0) {
    log("getSessions 失败", j.code, j.message || "");
    return [];
  }
  return j.data?.session_list || [];
}

/** 拉某会话最近消息（升序返回） */
async function fetchMsgs(talker) {
  const j = await bget(
    `https://api.vc.bilibili.com/svr_sync/v1/svr_sync/fetch_session_msgs?talker_id=${talker}&session_type=1&size=20&build=0&mobi_app=web`
  );
  if (j.code !== 0) {
    log("fetchMsgs 失败", j.code, j.message || "");
    return [];
  }
  const msgs = j.data?.messages || [];
  return msgs.slice().sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
}

/** 从私信消息里取纯文本 */
function msgText(m) {
  let body = m.content || "";
  if (typeof body === "string" && body.trim().startsWith("{")) {
    try {
      const o = JSON.parse(body);
      body = o.content ?? o.text ?? o.title ?? (Array.isArray(o.desc) ? o.desc[0]?.text : "") ?? body;
    } catch {}
  }
  return String(body).replace(/\\n/g, "\n").trim();
}

const msgKey = (m) => {
  const h = createHash("sha1").update(String(m.content || "")).digest("hex").slice(0, 12);
  return `${m.timestamp}|${m.sender_uid}|${h}`;
};

/** 发私信给主人 */
async function sendDM(text, receiver = OWNER_UID) {
  const clean = String(text || "").trim();
  if (!clean) return { ok: false, why: "空内容" };
  if (clean.length > 900) return { ok: false, why: "过长" };
  if (DRY_DM) {
    log(`[演练] 本该发私信（${clean.length} 字）：${clean.replace(/\n/g, " ").slice(0, 60)}`);
    return { ok: true, dry: true };
  }

  const form = new URLSearchParams({
    "msg[sender_uid]": SELF_UID,
    "msg[receiver_id]": receiver,
    "msg[receiver_type]": "1",
    "msg[msg_type]": "1",
    "msg[dev_id]": DEV_ID,
    "msg[timestamp]": String(Math.floor(Date.now() / 1000)),
    "msg[content]": JSON.stringify({ content: clean }),
    csrf: CSRF,
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch("https://api.vc.bilibili.com/web_im/v1/web_im/send_msg", {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Referer: "https://message.bilibili.com/",
          Origin: "https://message.bilibili.com",
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: COOKIE,
        },
        body: form.toString(),
        signal: AbortSignal.timeout(20_000),
      });
      const j = await r.json().catch(() => ({ code: -998 }));
      if (j.code === 0) {
        log(`📤 已发私信 (${clean.length}字) msg_key=${j.data?.msg_key}`);
        // 任何一次对外说话之后都进入冷却：5 分钟内不再自主唤醒
        try {
          wakeTouchCooldown();
        } catch {}
        return { ok: true, msgKey: j.data?.msg_key };
      }
      log(`⚠️ 发送失败 attempt=${attempt} code=${j.code} ${j.message || ""}`);
      if (j.code === -101) return { ok: false, why: "Cookie 失效" };
      await sleep(3000 * attempt);
    } catch (e) {
      log(`⚠️ 发送异常 attempt=${attempt} ${e.message}`);
      await sleep(3000 * attempt);
    }
  }
  return { ok: false, why: "重试耗尽" };
}

// ── opencode 大脑 ─────────────────────────────────────
let pwCache = { pw: "", at: 0 };

function getPassword() {
  if (pwCache.pw && Date.now() - pwCache.at < 60_000) return pwCache.pw;
  let pw = "";
  // ① 固定密码文件（首选）。设了 OPENCODE_PASSWORD 之后 journald 里的随机密码就失效了
  try {
    pw = fs.readFileSync(`${HOME}/secrets/opencode_password.txt`, "utf8").trim();
  } catch {}

  // ② 环境变量
  if (!pw) pw = String(process.env.OPENCODE_PASSWORD || "").trim();

  // ⚠️ 不要读 /root/.config/opencode/service.json 的 password ——
  //    实测那个是 401 的（客户端侧记录，不是服务端 Basic auth 密码）

  // ③ journald 兜底（未设固定密码时才有用；每次启动都变）
  if (!pw) {
    try {
      pw = execSync(
        `journalctl -u opencode --no-pager -n 300 2>/dev/null | grep -oP 'server password \\K\\S+' | tail -1`,
        { encoding: "utf8", timeout: 10_000 }
      ).trim();
    } catch {}
  }
  if (pw) pwCache = { pw, at: Date.now() };
  return pw;
}

async function oc(pathname, opts = {}) {
  const pw = getPassword();
  if (!pw) throw new Error("拿不到 opencode 密码");
  const auth = "Basic " + Buffer.from(`opencode:${pw}`).toString("base64");
  const r = await fetch(OC_BASE + pathname, {
    method: opts.method || "GET",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(opts.timeout || 30_000),
  });
  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    return { __status: r.status, __raw: t.slice(0, 300) };
  }
  if (r.status === 401) {
    pwCache = { pw: "", at: 0 }; // 密码变了，下次重取
    throw new Error("opencode 鉴权失败");
  }
  return j;
}

/** 确认大脑在线 */
async function brainAlive() {
  try {
    const j = await oc("/api/session", { timeout: 8000 });
    return Array.isArray(j.data) || Array.isArray(j);
  } catch (e) {
    log("大脑探测失败:", e.message);
    return false;
  }
}

/**
 * 拿会话。**只有一个会话，永远不换。**
 *
 * 换会话的代价是她失忆 —— 之前按 45 条消息换，每聊几十句就把她打回原形，
 * 而且 19:40 那次正在干活的会话被换掉，活直接没了。
 * 现在只在两种情况下建新会话：文件丢了、服务端确实没有这个会话。
 * 上下文太大就压缩（compact），压不动也留着 —— 记得住比清爽重要。
 */
async function ensureSession() {
  await ensureLimits();
  let rec = null;
  try {
    rec = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
  } catch {}

  if (rec?.id) {
    try {
      const j = await oc(`/api/session/${rec.id}`);
      const d = j.data || j;
      if (d?.id) {
        // 会话可能被绑在一个早就没额度的模型上（实测：绑了 deepseek 免费版，
        // 每天额度一烧光，她收到消息也只能回「今天免费额度用完了」）。
        // 会话不换，但模型必须和配置一致。
        const cur = d.model || {};
        if (cur.id && (cur.id !== OC_MODEL.id || cur.providerID !== OC_MODEL.providerID)) {
          log(`🔧 会话绑的是 ${cur.providerID}/${cur.id}，与配置不符，改绑`);
          await rebindModel(rec.id);
        }
        // 极端情况：已经撑到硬上限，先压一次再让她干活，不然这轮大概率报错
        const usage = await contextUsage(rec.id);
        if (usage >= CTX_HARD_AT) {
          log(`🚨 上下文 ${usage} tokens 超过硬上限 ${CTX_HARD_AT}，先压缩再干活`);
          await compactSession(rec.id, usage);
        }
        return rec.id;
      }
    } catch (e) {
      log("旧 session 不可用，重建:", e.message);
    }
  }
  return await createSession("", "会话文件丢失或服务端不存在");
}

async function createSession(prevId = "", why = "") {
  const j = await oc("/api/session", {
    method: "POST",
    body: { location: { directory: HOME }, agent: OC_AGENT, model: OC_MODEL },
  });
  const d = j.data || j;
  if (!d?.id) throw new Error("创建 session 失败: " + JSON.stringify(j).slice(0, 200));
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ id: d.id, createdAt: Date.now(), why }, null, 2));
  try {
    fs.appendFileSync(
      `${HOME}/bili/data/session_history.log`,
      `${new Date().toISOString()} | 新会话 ${d.id} | 上一条 ${prevId || "-"} | 原因 ${why || "首次"}\n`
    );
  } catch {}
  log(`🆕 新 session ${d.id}${why ? "（" + why + "）" : ""}`);
  return d.id;
}

/** 把会话的模型改绑到当前配置的模型（不换会话、不失忆） */
async function rebindModel(sid) {
  try {
    const j = await oc(`/api/session/${sid}/model`, { method: "POST", body: { model: OC_MODEL }, timeout: 20_000 });
    if (j.__status && j.__status >= 400) {
      log("改绑模型失败:", JSON.stringify(j).slice(0, 160));
      return false;
    }
    log(`🔧 已把会话模型改绑到 ${OC_MODEL.providerID}/${OC_MODEL.id}`);
    return true;
  } catch (e) {
    log("改绑模型异常:", e.message);
    return false;
  }
}

/** 回合结束后顺手压缩：不占她的回复时间，也不会因为压缩把她卡住 */
let COMPACTING = false;
async function maybeCompact(sid) {
  if (COMPACTING) return;
  await ensureLimits();
  if (await sessionRunning(sid)) return;
  const usage = await contextUsage(sid);
  if (usage < CTX_COMPACT_AT) return;
  COMPACTING = true;
  try {
    await compactSession(sid, usage);
  } finally {
    COMPACTING = false;
  }
}

/**
 * 这一轮真正喂进去的上下文有多大。
 * session.tokens 是**累计值**（跨所有回合相加），拿来做阈值会误判；
 * 单条 assistant 消息的 input + cache.read + output 才是「那一刻的上下文」。
 */
function turnTokens(m) {
  const t = m?.tokens;
  if (!t) return 0;
  return Number(t.input || 0) + Number(t.cache?.read || 0) + Number(t.output || 0);
}

async function contextUsage(sid) {
  try {
    const j = await oc(`/api/session/${sid}/message`, { timeout: 15_000 });
    for (const m of j.data || []) {
      // /message 最新在前，第一条有 token 的就是当前上下文
      if (m.type !== "assistant") continue;
      const v = turnTokens(m);
      if (v > 0) return v;
    }
  } catch (e) {
    log("读上下文用量失败:", e.message);
  }
  return 0;
}

/** 会话里是否有正在跑的回合（两种信号取或：进程侧 active + 时间戳） */
async function sessionRunning(sid) {
  try {
    const j = await oc("/api/session/active", { timeout: 8000 });
    const d = j.data || {};
    if (d[sid]) return true;
  } catch {}
  try {
    const s = await oc(`/api/session/${sid}`, { timeout: 8000 });
    const d = s.data || s;
    const busy = Number(d?.time?.busy || 0);
    const idle = Number(d?.time?.idle || 0);
    return busy > idle;
  } catch {
    return false;
  }
}

/**
 * 排一次压缩。
 *
 * 实测：POST /compact 带空对象 {} 才会被接受（不带 body 报 "Expected object"），
 * 返回的是一条 delivery=steer 的队列消息 —— 它**不会在空闲时自己跑**，
 * 而是等下一轮 prompt 开始时插进去执行。
 * 所以这里只负责「排上队」，不去傻等它降下来（等不到，白等两分钟）。
 */
let lastCompactAt = 0;
let compactWatch = null;   // 记下压缩前的用量，下一轮结束时对账
const COMPACT_GAP_MS = 15 * 60_000;   // 压缩本身也是花钱的，别每轮都排

async function compactSession(sid, before) {
  if (Date.now() - lastCompactAt < COMPACT_GAP_MS) {
    log("（距上次压缩不足 15 分钟，本轮不重复排）");
    return false;
  }
  try {
    const j = await oc(`/api/session/${sid}/compact`, {
      method: "POST",
      body: {},
      timeout: 30_000,
    });
    if (j.__status && j.__status >= 400) {
      log("压缩接口报错:", JSON.stringify(j).slice(0, 160));
      return false;
    }
    lastCompactAt = Date.now();
    compactWatch = { from: before, at: Date.now() };
    log(`🗜 已排入压缩队列（压缩前 ${before} tokens），下一轮开始前生效`);
    return true;
  } catch (e) {
    log("压缩失败:", e.message);
    return false;
  }
}

/** 从 messages 里提取本次任务的 assistant 文本 + 这一轮的结局 */
async function readTurn(sid, since, seen = new Set()) {
  const j = await oc(`/api/session/${sid}/message`);
  const msgs = j.data || [];
  // ⚠️ /message 返回是【最新在前】的倒序数组，且分页最多 50 条。
  //    所以「哪条属于本轮」不能用下标判断（方向是反的），也不能只用时间戳判断
  //    （两个任务隔几秒就会互相污染）。用消息 id 做差集，再按时间正序取最新一块。
  const picked = [];
  let end = null;      // 本轮的结束标记：opencode 每回合追加一条 type=idle 的消息，带 outcome
  let lastErr = null;
  for (const m of msgs) {
    const t = Number(m.time?.created || 0);
    if (m.type === "idle") {
      if (!seen.has(m.id) && (!end || t > Number(end.time?.created || 0))) end = m;
      continue;
    }
    if (m.type !== "assistant" || seen.has(m.id)) continue;
    if (m.error) lastErr = m.error;
    if (t && t < since - 60_000) continue;
    for (const c of m.content || []) {
      if (c.type === "text") {
        const s = String(c.text || "").trim();
        if (s) picked.push({ t, text: s });
      }
    }
  }
  picked.sort((a, b) => a.t - b.t);
  const blocks = picked.map((x) => x.text);
  // 取最后一块；太短就把前一块拼上
  let out = blocks.length ? blocks[blocks.length - 1] : "";
  if (out.length < 12 && blocks.length > 1) {
    out = blocks[blocks.length - 2] + "\n\n" + out;
  }
  return {
    text: out,
    outcome: String(end?.outcome || ""),
    error: end?.error || lastErr || null,
    endedAt: Number(end?.time?.created || 0),
  };
}

async function snapshotIds(sid) {
  try {
    const b = await oc(`/api/session/${sid}/message`, { timeout: 10_000 });
    return new Set((b.data || []).map((m) => m.id));
  } catch (e) {
    log("取消息基线失败（按空集处理）:", e.message);
    return new Set();
  }
}

/** 最新一条 user 消息的 id —— 用来判断「超时补记」期间有没有开新一轮 */
async function newestUserId(sid) {
  try {
    const j = await oc(`/api/session/${sid}/message`, { timeout: 10_000 });
    const u = (j.data || []).filter((m) => m.type === "user");
    return u.length ? u[0].id : "";
  } catch {
    return "";
  }
}

// ── 失败判定与告知 ────────────────────────────────────
// 只等 time.idle 是不够的：模型报错时 idle 照样会被置上，
// 于是「额度烧光 / 模型下线 / 401」全被当成「跑完了」，她就此沉默。
// opencode 其实给得很清楚：每回合的 idle 消息带 outcome，失败还带 error。
function redact(s) {
  return String(s || "")
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-***")
    .replace(/((?:api[_-]?key|token|password|passwd|secret|cookie)\s*[:=]\s*)\S+/gi, "$1***")
    .slice(0, 160);
}

function describeFailure(error) {
  const type = String(error?.type || "");
  const msg = redact(error?.message || "");
  const status = Number(error?.status || 0);
  const all = `${type} ${msg}`;
  if (status === 429 || /quota|insufficient|balance|rate.?limit|额度|余额|用量/i.test(all))
    return { kind: "quota", text: "模型额度用完了（429 / 余额不足）" };
  if (status === 401 || status === 403 || /unauthor|invalid.?api.?key|permission/i.test(all))
    return { kind: "auth", text: "模型鉴权失败（key 或权限）" };
  if (/no provider supported|model.?not.?found|does not exist|unknown model/i.test(all) || status === 404)
    return { kind: "model", text: "这个模型 id 已经没有 provider 支持了" };
  if (status >= 500) return { kind: "server", text: `模型服务端 ${status}` };
  if (/timeout|timed?\s?out|ECONNRESET|ECONNREFUSED|fetch failed|socket/i.test(all))
    return { kind: "network", text: "到模型那边的网络断了" };
  return { kind: "other", text: msg || type || "未知错误" };
}

let lastFailNoticeAt = 0;
let autoFailStreak = 0;
const FAIL_NOTICE_GAP_MS = 10 * 60_000;

/**
 * 失败了要说出来。之前是沉默 —— 她静静地躺五分钟，主人以为她不想理人。
 * 自主回合例外：半夜弹消息比不出声更糟，所以连续挂 3 次才报一次。
 */
async function notifyFailure(info, kind) {
  if (kind === "autonomous") {
    autoFailStreak += 1;
    if (autoFailStreak < 3) {
      log(`（自主回合连续失败 ${autoFailStreak} 次，先不打扰）`);
      return;
    }
  }
  if (Date.now() - lastFailNoticeAt < FAIL_NOTICE_GAP_MS) {
    log("（失败通知冷却中，跳过）");
    return;
  }
  lastFailNoticeAt = Date.now();
  const ok = await sendDM(
    `我这边模型这一轮没跑起来：${info.text}。自动重试过一次，还是不行。\n不是你的事，我过会儿再试。`
  );
  log(ok.ok ? "📤 已把「模型挂了」告诉主人" : `⚠️ 失败通知没发出去：${ok.why}`);
}

/**
 * 拼这一轮给她的说明：同一段话，出口不同，结尾的约束就不同。
 */
function buildTurnMeta(text, kind, { retry = false } = {}) {
  const note = retry
    ? `\n（这是同一任务的第 2 次尝试：上一轮中途挂了，你可能已经做过一部分 —— 先检查再继续，别重复发一样的东西。）`
    : "";
  const body =
    kind === "autonomous"
      ? `[来源：自主动作 · 无人值守 · 无回复对象 · ${ts()}]\n` +
        `---\n${text}\n---\n` +
        `（提醒：这一轮**没有任何收信人**。你的输出不会发给任何人，会被原样追加进当天的日记文件。\n` +
        `  写你做了什么、看到什么、想到什么；不要写「主人你好」这类对话开场。\n` +
        `  本轮只做只读动作和本地文件写入：不发评论、不发私信、不发动态、不点赞、不投币。）`
      : kind === "push"
      ? `[来源：自主动作 · 无人值守 · 允许主动推送 · ${ts()}]\n` +
        `---\n${text}\n---\n` +
        `（提醒：这一轮**没有收信人**，你的输出会写进日记、不会自动发给任何人。\n` +
        `  但你可以**自己动手发一条私信给主人**：\n` +
        `    node /opt/life/scripts/bili-dm.mjs "内容"\n` +
        `  这个工具代码级只能发给他，发不了第二个人。\n` +
        `  是否发、发什么、发几条，由你判断；除私信以外本轮不做其他对外写动作\n` +
        `  （不发评论 / 动态 / 弹幕 / 点赞 / 投币）。）`
      : kind === "comment"
      ? `[来源：B 站评论 / @ · 无人值守 · 回不回你定 · ${ts()}]\n` +
        `---\n${text}\n---\n` +
        `（提醒：这一轮没有收信人，你的输出会进日记。\n` +
        `  要回某一条，**必须走发送层**（它带四道闸：内容 / 限速 / 静默 / 类型）：\n` +
        `    node /opt/life/scripts/bili-send.mjs approve <事件id> "回复内容"\n` +
        `    node /opt/life/scripts/bili-send.mjs send <事件id> --confirm\n` +
        `  不加 --confirm 只演练。闸门拦下就说明不该发，别绕。\n` +
        `  不回完全可以：单个表情、纯夸奖、其他 AI、要 API key 的，都不值得回。\n` +
        `  本轮不发私信、不发动态、不发弹幕。）`
      : `[来源：主人 B 站私信 · ${ts()}]\n` +
        `---\n${text}\n---\n` +
        `（提醒：你的回复会被自动转发到主人 B 站私信，请用纯文本、直接给结论。）`;
  return body + note;
}

/**
 * 跑一轮，不重试。
 *
 * 判定「这一轮完了」有两条：时间上 idle 到位（旧逻辑只有这条），
 * 以及 outcome 不是 failed。少了后者，模型报错也会被当成做完 —— 这是她沉默五分钟的根因。
 */
async function runTurn(
  text,
  { onAck, kind = "reply", timeoutMs = WAIT_MAX_MS, lateTitle = "", retry = false } = {}
) {
  const sid = await ensureSession();
  const since = Date.now();
  const seen = await snapshotIds(sid);
  const meta = buildTurnMeta(text, kind, { retry });

  const j = await oc(`/api/session/${sid}/prompt`, {
    method: "POST",
    body: { text: meta },
    timeout: 40_000,
  });
  if (j.__status && j.__status >= 400) {
    throw new Error("prompt 提交失败: " + JSON.stringify(j).slice(0, 200));
  }
  const turnUser = await newestUserId(sid);

  const deadline = Date.now() + timeoutMs;
  let acked = false;

  while (Date.now() < deadline) {
    await sleep(2500);
    let d;
    try {
      const s = await oc(`/api/session/${sid}`, { timeout: 10_000 });
      d = s.data || s;
    } catch (e) {
      log("轮询 session 失败:", e.message);
      continue;
    }
    const idle = Number(d?.time?.idle || 0);
    const busy = Number(d?.time?.busy || 0);
    const finished = idle > 0 && idle >= since - 3000 && (!busy || idle >= busy);

    if (finished) {
      const t = await readTurn(sid, since, seen);
      const sessOutcome = String(d?.outcome || "");
      const outcome = t.outcome || sessOutcome;
      const failed = outcome === "failed" || (!t.outcome && !!t.error);
      // 上一轮排过压缩：这一轮开头它已经生效，收尾时对一次账
      if (compactWatch) {
        const u = await contextUsage(sid);
        if (u > 0 && u < compactWatch.from * 0.9) log(`✅ 压缩生效：${compactWatch.from} → ${u} tokens`);
        else log(`⚠️ 压缩后 ${u || "?"} tokens（压缩前 ${compactWatch.from}），没明显下降`);
        compactWatch = null;
      }
      // 回合结束后 20 秒再看上下文：等 active 标记彻底落下去，压缩才不会被自己挡住。
      // 放在后台，不占用她的回复时间。
      setTimeout(() => {
        maybeCompact(sid).catch((e) => log("自动压缩异常:", e.message));
      }, 20_000).unref?.();
      return {
        ok: !failed,
        failed,
        reply: t.text,
        outcome,
        error: t.error,
        sid,
        tookMs: Date.now() - since,
      };
    }

    if (!acked && onAck && Date.now() - since > ACK_AFTER_MS) {
      acked = true;
      try {
        await onAck();
      } catch (e) {
        log("ack 发送失败:", e.message);
      }
    }
  }

  // 超时：她很可能还在跑。别急着盖棺，先把这一轮守住。
  if (lateTitle) {
    harvestLate(sid, since, seen, lateTitle, turnUser).catch((e) => log("补记异常:", e.message));
  }
  return { ok: false, reply: "", sid, tookMs: Date.now() - since, timeout: true };
}

/**
 * 发任务并等结果（失败重试一次，仍失败就报出来）
 *
 * kind 决定这段话的「出口」：
 *   reply      —— 有人问她（主人私信），产出会被转成私信发回去
 *   autonomous —— 她自己想干活，产出写进日记，不发任何人
 *   push       —— 自主动作，但**允许她用命令行主动推送一条给主人**
 *
 * 三者共用同一个会话和执行器，但终点完全不同。
 * 混用会让她的自言自语变成发给主人的消息 —— 这是必须分开的唯一理由。
 */
async function runTask(text, opts = {}) {
  const first = await runTurn(text, opts);
  if (!first.failed) return first;

  const f1 = describeFailure(first.error);
  log(`↻ 这一轮失败了（${f1.kind}: ${f1.text}），按约定重试一次`);

  // 模型失效是「会话被绑死在那个 model 上」—— 但**不换会话**，
  // 只把模型改绑到当前配置的模型，然后重试。记忆比干净重要。
  if (f1.kind === "model") {
    const sid = first.sid || (() => {
      try {
        return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8")).id;
      } catch {
        return "";
      }
    })();
    if (sid) await rebindModel(sid);
  }

  await sleep(f1.kind === "quota" || f1.kind === "network" ? 30_000 : 8_000);

  const second = await runTurn(text, { ...opts, retry: true, onAck: null });
  if (!second.failed) {
    log("✅ 重试成功");
    return { ...second, retried: true };
  }

  const f2 = describeFailure(second.error);
  log(`❌ 重试仍然失败（${f2.kind}: ${f2.text}）—— 不再沉默`);
  await notifyFailure(f2, opts.kind || "reply");
  return { ...second, failure: f2, retried: true };
}

// ── 超时之后的补记 ────────────────────────────────────
// 「（这一轮没有产出文字）」是怎么来的：她跑了 8 分钟，我们 7 分钟就放弃了；
// 她在第 8 分钟写完、自己把私信发了，而我们早就往日记里盖了一句「没有产出」。
// 现在超时不收工：继续守着同一轮，跑完把正文和实际动作补进日记。
function harvestActions(sinceMs) {
  try {
    const p = `${HOME}/exec/bridge.log`;
    if (!fs.existsSync(p)) return "";
    const lines = fs.readFileSync(p, "utf8").trim().split("\n").slice(-300);
    const hits = [];
    for (const ln of lines) {
      const m = ln.match(/^(\S+) \| ([^|]+) \| (.*)$/);
      if (!m) continue;
      const t = Date.parse(m[1]);
      if (!t || t < sinceMs - 2000) continue;
      const what = m[2].trim();
      if (!/私信|回复|评论|动态|投稿/.test(what)) continue;
      const len = (m[3].match(/(\d+)字/) || [])[1] || "";
      hits.push(`· ${what}${len ? ` ${len} 字` : ""}`);
    }
    if (!hits.length) return "";
    return `\n\n（本轮外部动作：\n${hits.slice(-6).join("\n")}\n）`;
  } catch {
    return "";
  }
}

async function harvestLate(sid, since, seen, title, turnUser) {
  log(`🕯 这一轮超时了，继续守着（最多 ${Math.round(LATE_HARVEST_MS / 60000)} 分钟），跑完补记`);
  const deadline = Date.now() + LATE_HARVEST_MS;
  while (Date.now() < deadline) {
    await sleep(15_000);
    // 已经开了新一轮就别补了 —— 那会把下一轮的话记到这一轮头上
    if (turnUser) {
      const now = await newestUserId(sid);
      if (now && now !== turnUser) {
        log("🕯 会话里已经开了新一轮，放弃补记");
        return;
      }
    }
    if (await sessionRunning(sid)) continue;
    const t = await readTurn(sid, since, seen);
    const body = cleanReply(t.text);
    if (!body) {
      log(`🕯 收尾了，但没有文字（outcome=${t.outcome || "?"}）`);
      return;
    }
    diaryAppend(`${title}（补记）`, body + harvestActions(since));
    log(`🕯 补记完成 ${body.length} 字`);
    return;
  }
  log("🕯 守到上限，这一轮始终没回来");
}

// ── 回复清洗与分片 ────────────────────────────────────
function cleanReply(s) {
  return String(s || "")
    .replace(/```[a-zA-Z0-9]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sliceReply(s, max = 380, maxParts = 4) {
  const t = String(s || "").trim();
  if (!t) return [];
  if (t.length <= max) return [t];
  const parts = [];
  let rest = t;
  while (rest && parts.length < maxParts) {
    if (rest.length <= max) {
      parts.push(rest);
      rest = "";
      break;
    }
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf("。", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf("，", max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts[parts.length - 1] += "…";
  return parts.filter(Boolean);
}

// ── 自主动作通道 ──────────────────────────────────────
// 为什么单开一条路：私信回合的终点是「发一条消息」，自主回合没有收信人。
// 如果复用同一条路，她半夜自己干的活会被当成回复发到主人手机上。
const DIARY_DIR = `${HOME}/diary`;
let AUTO_BUSY = false;

/** 按本地日期追加日记（不覆盖，一天一个文件） */
function diaryAppend(title, body) {
  const d = new Date();
  const day = d.toLocaleDateString("sv-SE"); // YYYY-MM-DD，本地时区
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  fs.mkdirSync(DIARY_DIR, { recursive: true });
  const file = `${DIARY_DIR}/${day}.md`;
  const head = fs.existsSync(file) ? "" : `# ${day}\n`;
  fs.appendFileSync(file, `${head}\n## ${hhmm} · ${title}\n\n${String(body).trim()}\n`);
  return file;
}

/**
 * 跑一轮自主回合：产出只进日记，不自动发私信。
 * 失败也不立刻报警 —— 半夜弹一条「出错了」比不出声更糟，连续挂三次才报一次。
 */
async function runAutonomous(task, { title = "自主回合", timeoutMs = AUTO_MAX_MS, kind = "autonomous" } = {}) {
  if (AUTO_BUSY) {
    log("⏳ 已有自主回合在跑，跳过");
    return { ok: false, skipped: true };
  }
  AUTO_BUSY = true;
  const t0 = Date.now();
  try {
    log("🌙 自主回合开始: " + String(task).replace(/\n/g, " ").slice(0, 80));
    if (!(await brainAlive())) {
      log("❌ 大脑离线，自主回合放弃");
      return { ok: false, error: "brain offline" };
    }

    const r = await runTask(task, { kind, timeoutMs, lateTitle: title });
    const text = cleanReply(r.reply);
    const actions = harvestActions(t0);
    // 没有正文时，也要把「她这一轮到底动了什么」留下来 —— 一句「没有产出文字」
    // 会把「发了 496 字私信」这种事实抹掉。
    let body;
    if (text) {
      body = text + actions;
      autoFailStreak = 0;
    } else if (r.timeout) {
      body = "（这一轮没在时限内跑完，先记一笔；它跑完我会把正文补在这里）" + actions;
    } else if (r.failed) {
      body = `（这一轮模型没跑起来：${r.failure?.text || describeFailure(r.error).text}）` + actions;
    } else {
      body = "（这一轮没有文字输出）" + actions;
    }
    const file = diaryAppend(title, body);

    try {
      fs.appendFileSync(
        `${HOME}/exec/bridge.log`,
        `${new Date().toISOString()} | 自主回合 | ${String(task).replace(/\n/g, " ").slice(0, 60)} | ${
          r.ok ? "成功" : "失败"
        } | ${((Date.now() - t0) / 1000).toFixed(1)}s | ${body.length}字 | ${file}\n`
      );
    } catch {}

    log(`🌙 自主回合结束 ${r.ok ? "ok" : "fail"} ${((Date.now() - t0) / 1000).toFixed(1)}s → ${file}`);
    return { ok: r.ok, file, len: body.length };
  } catch (e) {
    log("❌ 自主回合异常:", e.message);
    return { ok: false, error: e.message };
  } finally {
    AUTO_BUSY = false;
  }
}

// ── 唤醒提示 ──────────────────────────────────────────
// 唤醒提示是「班前会」，不是「任务书」。
// 任务书要求她完成 N 项，完不成就编；班前会只告诉她处境和可选动作。
const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const todayStr = () => new Date().toLocaleDateString("sv-SE");
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv-SE");
};

/** 调 daily-report 拿昨天的账。看不懂宁可说看不懂，也不要让她自己回忆。 */
function dayReport(day) {
  try {
    const out = execSync(`node ${HOME}/scripts/daily-report.mjs --date ${day}`, {
      encoding: "utf8",
      timeout: 20_000,
    }).trim();
    return out || "（账本是空的）";
  } catch (e) {
    return `（账本读取失败：${String(e.message).slice(0, 120)}）`;
  }
}

/** 收工程文档邮件。失败不阻断日切 —— 没收到信也要照常记账。 */
function fetchMail() {
  try {
    const out = execSync(`node ${HOME}/scripts/fetch-mail.mjs`, {
      encoding: "utf8",
      timeout: 90_000,
    }).trim();
    return out || "（没有输出）";
  } catch (e) {
    return `（收信失败：${String(e.message).slice(0, 120)}）`;
  }
}

/** 00:00 日切：先收信，再复盘昨天，最后排今天 */
function buildDailyPrompt() {
  const y = yesterdayStr();
  const t = todayStr();
  const mail = fetchMail();
  return [
    `现在是 0 点。你醒来做日结。`,
    ``,
    `【第一件事：收信】`,
    mail,
    ``,
    `（[PROJECT] 开头的是工程文档，已经落进 knowledge/projects/。\n` +
      `  那是你「会什么」的唯一来源。以后有人问技术问题，先查这里；查不到就说没做过。）`,
    ``,
    `【昨天的账】`,
    dayReport(y),
    ``,
    `做两件事：`,
    `1) 写日记：把上面这些账写成一篇日记，追加到 ${DIARY_DIR}/${t}.md，标题用「## ${nowHHMM()} · 日切」。`,
    `   写你这一天实际做了什么、哪件事让你有想法、明天想改什么。`,
    `   数字必须和上面的账对得上。对不上就说不一致，不要圆。`,
    `2) 排今天：更新 ${HOME}/TODAY.md，写下今天打算做的事（不超过 3 条，要具体到能验证）。`,
    `   选的时候想清楚：工程文档告诉你**能**做什么，昨天的账告诉你**该**做什么。`,
    ``,
    `昨天没有值得写的事，就写「昨天没有特别的」。不要编。`,
    ``,
    `红线：这一轮不对外发任何东西。日记是给自己看的，不是给我汇报。`,
  ].join("\n");
}

/** 日切之后的第二回合：启智任务 / 仓库巡检 / 素材。都是「能做就做」 */
function buildNightTasks() {
  return [
    `【夜间自动项】日结已经做完了，这是额外的一轮。`,
    ``,
    `三件，能做就做，做不了就写一句为什么，别硬撑：`,
    `1. 启智（OpenI）每日任务：看 skills/github-openi-manager/ 的说明，能调 API 就调；`,
    `   需要网页登录 / 验证码的，跳过并记一句 —— 不要没到账就写「签到成功」。`,
    `2. 仓库巡检：看 github.com/yht-cdd/bili-anthropos 有没有新 issue / PR / CI 失败。`,
    `   有就按契约第十六节做（开分支 → 改 → 开 PR），没有就跳过。不许直推 main。`,
    `3. 素材：主人发过夸克链接就去取，没有就别追问。`,
    ``,
    `每件最多 5 分钟，超时就停。三件全跳过也可以。`,
    `这一轮不对外发任何东西（不发私信 / 评论 / 动态）。`,
  ].join("\n");
}

/** 随机唤醒：给处境，给选项，不派任务 */
function buildWakePrompt(d) {
  const p = d.plan;
  const idx = (d.index ?? 0) + 1;
  const total = p.random.count;
  const left = p.random.slots.filter((s) => !s.fired).length;
  return [
    `【醒来】现在是 ${nowHHMM()}，这是今天的第 ${idx}/${total} 次自主醒来（连这次还剩 ${left} 次）。`,
    ``,
    `你可以做这些，也可以一件都不做：`,
    `1) 看看自己 —— 读 STATE.json、STREAM.md 最近 20 行`,
    `2) 做一件小事，三选一：`,
    `   · 把今天发生的事整理进 STREAM.md`,
    `   · 跑一次 doctor.mjs，看自己还健康吗`,
    `   · 更新 TODAY.md，写下接下来想做什么`,
    `3) 写下来 —— 追加到 ${DIARY_DIR}/${todayStr()}.md，标题用「## ${nowHHMM()} · 醒来」`,
    ``,
    `没有值得做的事，就写一句「今天没什么特别的」然后收工。不要为了填满日记而编。`,
    ``,
    `红线：`,
    `· 这一轮不对外发任何东西（评论 / 私信 / 动态 / 弹幕都不行）`,
    `· 不确定就写不确定，不要编`,
    `· 日记是给自己看的，不是给我汇报`,
  ].join("\n");
}

/**
 * 到点就跑一轮。私信优先 —— 这个函数只在 tick() 之后调用。
 * 执行后无论成功失败都标记 fired：失败重试会让同一时刻被反复触发。
 */
async function maybeWake() {
  if (AUTO_BUSY) return null;

  let d;
  try {
    d = wakeDue();
  } catch (e) {
    log("⏰ 排程读取失败:", e.message);
    return null;
  }
  if (!d) return null;

  const isFixed = d.kind === "fixed";
  const title = isFixed ? "日切" : "醒来";
  const task = isFixed ? buildDailyPrompt() : buildWakePrompt(d);

  log(
    `⏰ 到点：${title}${d.index !== undefined ? " #" + (d.index + 1) : ""}` +
      `（应于 ${new Date(d.atMs).toLocaleTimeString("zh-CN")}，延迟 ${Math.round((d.delayedMs || 0) / 1000)}s）`
  );

  const r = await runAutonomous(task, { title, timeoutMs: AUTO_MAX_MS });

  // 日切跑完，把「昨天」的日记完整寄给主人。
  // 放在这时候是因为：日记是这一轮刚写完的，寄早了会漏掉最后一段。
  if (isFixed) {
    try {
      const out = execSync(`node ${HOME}/scripts/mail-diary.mjs --date ${yesterdayStr()}`, {
        encoding: "utf8",
        timeout: 120_000,
      }).trim();
      log(`📧 日记：${out.split("\n")[0]}`);
    } catch (e) {
      log("⚠️ 日记寄送失败:", String(e.message).split("\n")[0]);
    }

    // 日切之后再跑一轮「夜间自动项」：启智任务 / 仓库巡检 / 素材。
    // 单独一轮，不和日结抢超时；全跳过也没关系。
    try {
      await runAutonomous(buildNightTasks(), { title: "夜间自动项", timeoutMs: AUTO_MAX_MS });
    } catch (e) {
      log("⚠️ 夜间自动项异常:", String(e.message).split("\n")[0]);
    }
  }

  try {
    wakeMarkFired(d.kind, d.index);
  } catch (e) {
    log("⏰ 标记执行失败:", e.message);
  }
  return r;
}

// ── 付费放行条 ────────────────────────────────────────
// 免费模型用完时 spawn-task 会留一条待批记录；主人回一句「同意」，
// 这里给他 12 小时放行 —— 不点这个头，任何人（包括她自己）都不能花 token。
const APPROVAL_FILE = `${HOME}/bili/data/spend_approval.json`;
const PENDING_FILE = `${HOME}/bili/data/spend_pending.json`;
const APPROVE_RE = /^(同意|批准|可以|行|继续|花钱|ok|approve)([，,。.!！\s]*(继续|做|干|吧))*[，,。.!！\s]*$/i;

function maybeApproveSpend(text) {
  if (!APPROVE_RE.test(String(text || "").trim())) return null;
  let pending = null;
  try {
    pending = JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
  } catch {
    return null;   // 没有待批的事，就别把「好」当成授权
  }
  const grant = {
    grantedAt: new Date().toISOString(),
    expiresAt: Date.now() + 12 * 3600_000,
    by: "owner",
    note: String(pending.task || "").slice(0, 120),
  };
  try {
    fs.mkdirSync(`${HOME}/bili/data`, { recursive: true });
    fs.writeFileSync(APPROVAL_FILE, JSON.stringify(grant, null, 2) + "\n");
    fs.unlinkSync(PENDING_FILE);
  } catch (e) {
    log("写放行条失败:", e.message);
    return null;
  }
  log(`💳 主人批了付费：放行到 ${new Date(grant.expiresAt).toLocaleString("zh-CN")}`);
  return grant;
}

// ── 评论 / @ 轮询 ─────────────────────────────────────
// 私信之外的第二条感知线。只收不抢：收进来的评论进 events 表，
// 由她判断回不回；真要回的时候必须过 bili-send 的四道闸。
const INBOX_GAP_MS = Number(process.env.INBOX_GAP_MS || 5 * 60_000);
const INBOX_BATCH = Number(process.env.INBOX_BATCH || 3);
let lastInboxAt = 0;

function inboxPull() {
  try {
    const out = execSync(`node ${HOME}/scripts/bili-inbox.mjs pull --json`, {
      encoding: "utf8",
      timeout: 90_000,
    }).trim();
    const i = out.indexOf("{");
    return JSON.parse(i >= 0 ? out.slice(i) : out);
  } catch (e) {
    log("收评论失败:", String(e.message).split("\n")[0]);
    return null;
  }
}

async function pollInbox() {
  if (AUTO_BUSY) return null;
  if (Date.now() - lastInboxAt < INBOX_GAP_MS) return null;
  lastInboxAt = Date.now();

  const pulled = inboxPull();
  if (pulled?.added) log(`👀 新评论 ${pulled.added} 条（扫了 ${pulled.videos} 个稿件）`);

  let rows = [];
  try {
    // ⚠️ events 表是共用的：bili-daemon 也会往里写 dm 事件。
    //    这里必须按类型过滤，否则会把陌生私信当成评论塞给她（实测踩过）。
    rows = db
      .prepare("SELECT * FROM events WHERE status = 0 AND kind IN ('comment','at','reply') ORDER BY origin_ts ASC LIMIT ?")
      .all(INBOX_BATCH);
  } catch (e) {
    log("读 events 失败:", e.message);
    return null;
  }
  if (!rows.length) return null;

  const normTs = (t) => {
    const n = Number(t) || 0;
    if (n > 1e14) return n / 1e3;   // 微秒
    if (n > 1e11) return n;         // 毫秒
    if (n > 1e9) return n * 1e3;    // 秒（daemon 写的是这种）
    return n;
  };

  const lines = rows.map((e, i) => {
    const tag = e.kind === "comment" ? "评论" : e.kind === "at" ? "@我" : "回复我";
    let title = "";
    try { title = JSON.parse(e.raw || "{}").title || ""; } catch {}
    return (
      `${i + 1}) [${tag}] 事件 ${e.id} · ${e.author || "?"}（uid ${e.author_id || "?"}） · ` +
      `${new Date(normTs(e.origin_ts)).toLocaleString("zh-CN", { hour12: false })}` +
      (title ? `\n   来自《${title}》` : "") +
      `\n   内容：${String(e.body || "").replace(/\n/g, " ").slice(0, 300)}` +
      `\n   要回：bili-send approve ${e.id} "…" → bili-send send ${e.id} --confirm`
    );
  });

  const task = [
    `【评论来了】${rows.length} 条，你自己判断值不值得回。`,
    ``,
    lines.join("\n\n"),
    ``,
    `判断标准在契约第九节。这是**公开场合**：说错话删不掉，不回没人怪你。`,
  ].join("\n");

  const t0 = Date.now();
  const r = await runTask(task, { kind: "comment", timeoutMs: AUTO_MAX_MS, lateTitle: "收到评论" });

  const said = cleanReply(r.reply);
  const body = said
    ? said
    : r.timeout
    ? "（时限内没处理完，先记一笔；跑完会补记）"
    : r.failed
    ? `（模型没跑起来：${r.failure?.text || "未知"}）`
    : "（这一轮没有文字输出）";
  try {
    diaryAppend("收到评论", body + harvestActions(t0));
  } catch (e) {
    log("日记写入失败:", e.message);
  }

  // 交出去就算处理过，避免每 5 分钟重复塞给她。真回了的话 bili-send 会把 status 改成 1。
  for (const e of rows) db.prepare("UPDATE events SET status = 4 WHERE id = ? AND status = 0").run(e.id);
  log(`👀 评论回合结束 ${r.ok ? "ok" : "fail"} ${((Date.now() - t0) / 1000).toFixed(1)}s · ${rows.length} 条`);
  return { handled: rows.length, ok: r.ok };
}

// ── 告警 ──────────────────────────────────────────────
// 出事了要能找得到人。之前只写 ALERT.md，没人看。
// alert.mjs 会发邮件给主人，同类 30 分钟去重；这里只负责触发，不关心它怎么发。
function fireAlert(title, body, { urgent = false, file = "" } = {}) {
  try {
    const args = [title, body].map((s) => `"${String(s).replace(/"/g, '\\"')}"`).join(" ");
    const extra = `${urgent ? " --urgent" : ""}${file ? ` --file "${file}"` : ""}`;
    execSync(`node ${HOME}/scripts/alert.mjs ${args}${extra}`, {
      encoding: "utf8",
      timeout: 120_000,
      stdio: "pipe",
    });
    log(`📧 告警已发出：${title}`);
  } catch (e) {
    log(`⚠️ 告警发送失败（${title}）：${String(e.message).split("\n")[0]}`);
  }
}

// ── 主流程 ────────────────────────────────────────────
async function handleOwnerMessage(text, raw) {
  log("📨 主人: " + text.replace(/\n/g, " ").slice(0, 120));

  const grant = maybeApproveSpend(text);
  if (grant) {
    await sendDM("收到，放行 12 小时。这个活我现在继续做。");
  }

  if (!(await brainAlive())) {
    await sendDM("我这边大脑没起来（opencode 服务离线），已经记下你的消息，等恢复后处理。");
    return;
  }

  // 不再自动回复。把消息交给她，由她判断：
  //   是不是任务 → 是就真的做
  //   要不要回   → 要回就自己调 bili-dm.mjs
  const task = [
    `【有消息进来】`,
    `来源：B站私信`,
    `发送者 UID：${OWNER_UID}（**主人，有完全执行权**）`,
    `时间：${ts()}`,
    ``,
    `内容：`,
    `---`,
    text,
    `---`,
    ``,
    `怎么处理：`,
    `1. 先判断这是不是一个任务。是任务就**真的去做**（执行命令、查数据、改文件），不要只回一句「好的」。`,
    `2. 要看的视频、要跑的十几条命令、要读的一堆文件 —— **派给子代理**，别自己扛：`,
    `     node /opt/life/scripts/spawn-task.mjs --timeout 900 --task "具体要做什么、做完推给谁"`,
    `   子代理干完只回你一段结论，过程不进你的上下文；需要主人看到的，让它自己用 bili-dm 发。`,
    `3. 做完再决定要不要回。需要回就用：`,
    `     node /opt/life/scripts/bili-dm.mjs "你的回复" --to ${OWNER_UID}`,
    `   （不发 --to 默认也是主人；这个调用不受额度限制）`,
    `4. 不需要回就不发。比如纯闲聊、或者你已经在日记里记完了。`,
    `5. 把这一轮做了什么写进今天的日记。`,
    ``,
    grant
      ? `（主人刚批了付费额度，12 小时内可以跑付费模型，直接用 spawn-task 即可。）`
      : ``,
    `注意：主人可以不回复，但**不能不处理**。他给的指令必须执行或明确说明为什么做不了。`,
  ].join("\n");

  const t0 = Date.now();
  let r;
  try {
    r = await runTask(task, {
      kind: "push",
      timeoutMs: Number(process.env.REPLY_MAX_MS || 600_000),
      lateTitle: "收到主人私信",
      // 超过 20 秒还没做完，先回一句「收到」——不然主人会以为她没收到
      onAck: async () => {
        await sendDM("收到，正在处理…");
      },
    });
  } catch (e) {
    log("❌ 任务异常:", e.message);
    await sendDM("出错了：" + redact(e.message));
    return;
  }

  const said = cleanReply(r.reply);
  const actions = harvestActions(t0);
  let body;
  if (said) body = said + actions;
  else if (r.timeout) body = "（时限内没结束，先记一笔；跑完我会把正文补进下一篇）" + actions;
  else if (r.failed) body = `（模型没跑起来：${r.failure?.text || describeFailure(r.error).text}）` + actions;
  else body = "（这一轮没有文字输出）" + actions;   // 至少留下她这一轮动过什么
  try {
    diaryAppend("收到主人私信", body);
  } catch (e) {
    log("日记写入失败:", e.message);
  }

  log(`✅ 处理完成 ${((Date.now() - t0) / 1000).toFixed(1)}s | 产出 ${body.length} 字（是否回你，看她有没有调 bili-dm）`);

  // 工作账本
  try {
    fs.appendFileSync(
      `${HOME}/exec/bridge.log`,
      `${new Date().toISOString()} | 主人私信 | ${text.replace(/\n/g, " ").slice(0, 60)} | 成功 | ${(
        (Date.now() - t0) /
        1000
      ).toFixed(1)}s | ${body.length}字\n`
    );
  } catch {}
}

/** 一轮轮询 */
let tickCount = 0;
let tickErrStreak = 0;   // 连续失败次数，到 5 次就发告警（偶尔抽一下不用惊动主人）

async function tick() {
  tickCount++;
  const sessions = await getSessions();
  const ownerSess = sessions.find((s) => String(s.talker_id) === OWNER_UID);
  if (!ownerSess) {
    if (tickCount % HEARTBEAT_EVERY === 0) log(`💓 第 ${tickCount} 轮 | 会话数 ${sessions.length} | 主人会话未找到`);
    return { handled: 0 };
  }

  const changedTs = Number(ownerSess.session_ts || 0);

  // 首次启动只建基线，不处理历史
  if (!kvGet("bridge_baseline")) {
    const msgs = await fetchMsgs(OWNER_UID);
    for (const m of msgs) dmMark(msgKey(m));
    kvSet("bridge_baseline", Date.now());
    log(`基线建立：跳过历史 ${msgs.length} 条私信`);
    return { handled: 0 };
  }

  const prevTs = Number(kvGet("bridge_session_ts", 0));
  const unread = Number(ownerSess.unread_count || 0);
  const forceScan = tickCount % HEARTBEAT_EVERY === 0;   // 每 5 分钟无视缓存全量扫一次
  if (!forceScan && prevTs && changedTs && changedTs <= prevTs && unread === 0) {
    log(`💓 第 ${tickCount} 轮 | 无新消息 | 未读 0`);
    return { handled: 0 };
  }
  if (changedTs) kvSet("bridge_session_ts", changedTs);
  log(`🔔 扫描私信 | ts=${changedTs} unread=${unread} force=${forceScan}`);

  const msgs = await fetchMsgs(OWNER_UID);
  let handled = 0;

  for (const m of msgs) {
    // 只处理主人发来的
    if (String(m.sender_uid) !== OWNER_UID) {
      dmMark(msgKey(m));
      continue;
    }
    const key = msgKey(m);
    if (dmSeen(key)) continue;
    dmMark(key);

    const text = msgText(m);
    if (!text) {
      log("跳过空消息 msg_type=" + m.msg_type);
      continue;
    }

    await handleOwnerMessage(text, m);
    handled++;
  }

  return { handled };
}

// ── 入口 ──────────────────────────────────────────────
const argv = process.argv.slice(2);
const MODE = {
  once: argv.includes("--once"),
  simulate: argv.includes("--simulate"),
  repl: argv.includes("--repl"),
  autonomous: argv.includes("--autonomous"),
  push: argv.includes("--push"),
  usage: argv.includes("--usage"),
  compactNow: argv.includes("--compact-now"),
};

if (MODE.usage) {
  (async () => {
    const sid = await ensureSession();
    const u = await contextUsage(sid);
    console.log(
      JSON.stringify(
        {
          session: sid,
          contextTokens: u,
          contextLimit: CTX_LIMIT,
          usagePct: CTX_LIMIT ? Math.round((u / CTX_LIMIT) * 1000) / 10 : null,
          compactAt: CTX_COMPACT_AT,
          hardAt: CTX_HARD_AT,
        },
        null,
        2
      )
    );
    process.exit(0);
  })();
} else if (MODE.compactNow) {
  (async () => {
    const sid = await ensureSession();
    const u = await contextUsage(sid);
    const ok = await compactSession(sid, u);
    console.log(ok ? `已排入压缩队列：${u} tokens（下一轮开始时生效）` : `没排上（${u} tokens），看日志`);
    process.exit(ok ? 0 : 1);
  })();
} else if (MODE.push) {
  // 自主回合 + 允许她主动推送：产出进日记，但她可以自己调 bili-dm.mjs 发一条给主人
  const i = argv.indexOf("--push");
  const text = argv[i + 1] || "看看今天有什么值得推给主人的。";
  (async () => {
    const r = await runAutonomous(text, {
      title: "主动推送",
      kind: "push",
      timeoutMs: PUSH_MAX_MS,   // 实测三轮工具调用要 8 分钟以上，480s 必然半路放弃
    });
    console.log("\n──────── 回合结果 ────────");
    console.log(`ok=${r.ok}  日记=${r.file || "(无)"}  字数=${r.len || 0}`);
    console.log("（她是否真发了私信，看 exec/bridge.log 里的「主动私信」）");
    console.log("──────────────────────────");
    process.exit(r.ok ? 0 : 1);
  })();
} else if (MODE.autonomous) {
  const i = argv.indexOf("--autonomous");
  const text =
    argv[i + 1] ||
    "看看今天有什么值得记的：读一遍 STATE.json 和 STREAM.md 的最近几行，写一段你现在的状态。";
  (async () => {
    const r = await runAutonomous(text, { title: "手动触发" });
    console.log("\n──────── 自主回合结果 ────────");
    console.log(`ok=${r.ok}  日记=${r.file || "(无)"}  字数=${r.len || 0}`);
    console.log("（本次没有发送任何私信）");
    console.log("──────────────────────────────");
    process.exit(r.ok ? 0 : 1);
  })();
} else if (MODE.simulate) {
  const i = argv.indexOf("--simulate");
  const text = argv[i + 1] || "报告一下当前容器状态：内存、磁盘、服务是否正常。";
  (async () => {
    log("模拟主人任务:", text);
    if (!(await brainAlive())) {
      log("❌ 大脑离线");
      process.exit(1);
    }
    const r = await runTask(text, {
      onAck: async () => log("（触发 ack：收到，正在处理…）"),
    });
    log(`结果 ok=${r.ok} 用时=${(r.tookMs / 1000).toFixed(1)}s`);
    console.log("\n──────── 回复 ────────");
    console.log(cleanReply(r.reply) || "(空)");
    console.log("──────────────────────");
    process.exit(r.ok ? 0 : 1);
  })();
} else if (MODE.repl) {
  (async () => {
    const readline = await import("node:readline/promises");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    log("进入 REPL，直接和大脑对话。Ctrl+C 退出。");
    while (true) {
      const text = (await rl.question("\n你> ")).trim();
      if (!text) continue;
      const r = await runTask(text);
      console.log("\n她> " + (cleanReply(r.reply) || "(空)") + "\n");
    }
  })();
} else if (MODE.once) {
  (async () => {
    log("单轮运行");
    const r = await tick();
    log("本轮处理", r.handled, "条");
    process.exit(0);
  })();
} else {
  (async () => {
    log("═══ bili-bridge 启动 ═══");
    log(`self=${SELF_UID} owner=${OWNER_UID.slice(0, 3)}***${OWNER_UID.slice(-2)}（${OWNER_UID.length}位）dev_id=${DEV_ID}`);
    log(`opencode=${OC_BASE} model=${OC_MODEL.providerID}/${OC_MODEL.id}`);

    let stop = false;
    const bye = () => {
      stop = true;
      log("收到退出信号，准备停止");
    };
    process.on("SIGINT", bye);
    process.on("SIGTERM", bye);

    // 启动自检
    const alive = await brainAlive();
    log(alive ? "✅ 大脑在线" : "⚠️ 大脑离线，将重试");
    if (alive) await ensureLimits();

    while (!stop) {
      try {
        await tick();        // ① 私信优先：有人找她，先把人伺候好
        tickErrStreak = 0;
        await pollInbox();   // ② 评论区看看有没有新动静（5 分钟一次）
        await maybeWake();   // ③ 没人找，才看时间
      } catch (e) {
        if (e.fatal) {
          log("💀 致命错误（Cookie 失效）：", e.message);
          try {
            fs.writeFileSync(`${HOME}/ALERT.md`, `# 告警\n\n${ts()}\n\nCookie 失效：${e.message}\n快去刷新 Cookie 并覆盖 ${COOKIE_FILE}\n`);
          } catch {}
          fireAlert("Cookie 失效，我停了", `B 站接口返回凭证失效，桥接无法再收发消息。\n需要你把新的 Cookie 覆盖到服务器上的凭证文件。`, {
            urgent: true,
          });
          await sleep(60_000);
        } else {
          tickErrStreak += 1;
          log(`轮询异常（连续 ${tickErrStreak} 次）:`, e.message);
          if (tickErrStreak === 5) {
            fireAlert("轮询连续失败 5 次", `最近的错误：${e.message}\n我还在重试，但如果一直这样，需要你看一眼。`, {
              file: LOG_FILE,
            });
          }
        }
      }
      // 分片睡眠，便于快速响应退出
      const until = Date.now() + POLL_MS;
      while (Date.now() < until && !stop) await sleep(500);
    }
    log("═══ bili-bridge 已停止 ═══");
    process.exit(0);
  })();
}
