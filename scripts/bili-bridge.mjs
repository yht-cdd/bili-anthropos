#!/usr/bin/env node
/**
 * bili-bridge.mjs — 主人私信 ↔ opencode 大脑 桥接器
 * ============================================================
 * 职责：
 *   1. 轮询 B 站私信，只认 sender_uid == 主人 UID（secrets/owner_uid.txt）
 *   2. 把私信原文转成 opencode session 任务
 *   3. 等 AI 真正跑完（time.idle），提取回复文本
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
const OC_MODEL = { providerID: "modelscope", id: "Qwen/Qwen3.8-Flash-Next", variant: "high" };
const OC_AGENT = "build";

const POLL_MS = 12_000;        // 轮询间隔
const WAIT_MAX_MS = 300_000;   // 单任务最长等待 5 分钟
const ACK_AFTER_MS = 20_000;   // 超过 20 秒还没完就先回一句「收到」
const HEARTBEAT_EVERY = 25;    // 每 25 轮（约 5 分钟）写一次心跳
const MAX_TURNS = 45;          // ⚠️ /message 单次最多返回 50 条（分页），
                               //    所以阈值必须小于 50，否则「超过 80 条才换」永远触发不了

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

/** 取或建 session */
async function ensureSession() {
  let rec = null;
  try {
    rec = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
  } catch {}

  if (rec?.id) {
    try {
      const j = await oc(`/api/session/${rec.id}`);
      const d = j.data || j;
      if (d && d.id) {
        const msgs = await oc(`/api/session/${rec.id}/message`);
        const n = (msgs.data || []).length;
        if (n < MAX_TURNS) {
          return rec.id;
        }
        log(`会话已 ${n} 条消息，轮换新 session`);
      }
    } catch (e) {
      log("旧 session 不可用，重建:", e.message);
    }
  }

  const j = await oc("/api/session", {
    method: "POST",
    body: { location: { directory: HOME }, agent: OC_AGENT, model: OC_MODEL },
  });
  const d = j.data || j;
  if (!d?.id) throw new Error("创建 session 失败: " + JSON.stringify(j).slice(0, 200));
  fs.writeFileSync(
    SESSION_FILE,
    JSON.stringify({ id: d.id, createdAt: Date.now() }, null, 2)
  );
  log("🆕 新 session:", d.id);
  return d.id;
}

/** 从 messages 里提取本次任务的 assistant 文本 */
async function extractReply(sid, since, seen = new Set()) {
  const j = await oc(`/api/session/${sid}/message`);
  const msgs = j.data || [];
  // ⚠️ /message 返回是【最新在前】的倒序数组，且分页最多 50 条。
  //    所以「哪条属于本轮」不能用下标判断（方向是反的），也不能只用时间戳判断
  //    （两个任务隔几秒就会互相污染）。用消息 id 做差集，再按时间正序取最新一块。
  const picked = [];
  for (const m of msgs) {
    if (m.type !== "assistant") continue;
    if (seen.has(m.id)) continue;
    const t = Number(m.time?.created || 0);
    if (t && t < since - 60_000) continue;
    for (const c of m.content || []) {
      if (c.type === "text") {
        const s = String(c.text || "").trim();
        if (s) picked.push({ t, text: s });
      }
    }
  }
  if (!picked.length) return "";
  picked.sort((a, b) => a.t - b.t);
  const blocks = picked.map((x) => x.text);
  // 取最后一块；太短就把前一块拼上
  let out = blocks[blocks.length - 1];
  if (out.length < 12 && blocks.length > 1) {
    out = blocks[blocks.length - 2] + "\n\n" + out;
  }
  return out;
}

/**
 * 发任务并等结果
 *
 * kind 决定这段话的「出口」：
 *   reply      —— 有人问她（主人私信），产出会被转成私信发回去
 *   autonomous —— 她自己想干活，产出写进日记，不发任何人
 *   push       —— 自主动作，但**允许她用命令行主动推送一条给主人**
 *
 * 三者共用同一个会话和执行器，但终点完全不同。
 * 混用会让她的自言自语变成发给主人的消息 —— 这是必须分开的唯一理由。
 *
 * 为什么需要 push：autonomous 明确禁止发私信，
 * 但"主动推荐一条视频"这个动作本身就是要发私信。
 * 提示词得告诉她「自己用 bili-dm.mjs」，而不是「你的回复会自动转发」。
 */
async function runTask(text, { onAck, kind = "reply", timeoutMs = WAIT_MAX_MS } = {}) {
  const sid = await ensureSession();
  const since = Date.now();

  // 基线：任务开始前已有消息的 id 集合。
  // 不能用条数下标 —— /message 是倒序且分页，新消息在数组开头。
  let seen = new Set();
  try {
    const b = await oc(`/api/session/${sid}/message`, { timeout: 10_000 });
    seen = new Set((b.data || []).map((m) => m.id));
  } catch (e) {
    log("取消息基线失败（按空集处理）:", e.message);
  }

  const meta =
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
      : `[来源：主人 B 站私信 · ${ts()}]\n` +
        `---\n${text}\n---\n` +
        `（提醒：你的回复会被自动转发到主人 B 站私信，请用纯文本、直接给结论。）`;

  const j = await oc(`/api/session/${sid}/prompt`, {
    method: "POST",
    body: { text: meta },
    timeout: 40_000,
  });
  if (j.__status && j.__status >= 400) {
    throw new Error("prompt 提交失败: " + JSON.stringify(j).slice(0, 200));
  }

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
      const reply = await extractReply(sid, since, seen);
      return { ok: true, reply, sid, tookMs: Date.now() - since };
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

  return { ok: false, reply: "", sid, tookMs: Date.now() - since, timeout: true };
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
const AUTO_MAX_MS = 180_000;   // 自主回合比私信短：它不阻塞你，但不能真的挡住你
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
 * 跑一轮自主回合：产出只进日记，绝不发私信。
 * 失败也不发私信 —— 半夜弹一条「出错了」比不出声更糟。
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

    const r = await runTask(task, { kind, timeoutMs });
    const body = cleanReply(r.reply) || "（这一轮没有产出文字）";
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

  try {
    wakeMarkFired(d.kind, d.index);
  } catch (e) {
    log("⏰ 标记执行失败:", e.message);
  }
  return r;
}

// ── 主流程 ────────────────────────────────────────────
async function handleOwnerMessage(text, raw) {
  log("📨 主人: " + text.replace(/\n/g, " ").slice(0, 120));

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
    `2. 做完再决定要不要回。需要回就用：`,
    `     node /opt/life/scripts/bili-dm.mjs "你的回复" --to ${OWNER_UID}`,
    `   （不发 --to 默认也是主人；这个调用不受额度限制）`,
    `3. 不需要回就不发。比如纯闲聊、或者你已经在日记里记完了。`,
    `4. 把这一轮做了什么写进今天的日记。`,
    ``,
    `注意：主人可以不回复，但**不能不处理**。他给的指令必须执行或明确说明为什么做不了。`,
  ].join("\n");

  const t0 = Date.now();
  let r;
  try {
    r = await runTask(task, {
      kind: "push",
      timeoutMs: Math.max(WAIT_MAX_MS, 300_000),
      // 超过 20 秒还没做完，先回一句「收到」——不然主人会以为她没收到
      onAck: async () => {
        await sendDM("收到，正在处理…");
      },
    });
  } catch (e) {
    log("❌ 任务异常:", e.message);
    await sendDM("出错了：" + e.message.slice(0, 200));
    return;
  }

  const body = cleanReply(r.reply) || "（这一轮没有产出文字）";
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
};

if (MODE.push) {
  // 自主回合 + 允许她主动推送：产出进日记，但她可以自己调 bili-dm.mjs 发一条给主人
  const i = argv.indexOf("--push");
  const text = argv[i + 1] || "看看今天有什么值得推给主人的。";
  (async () => {
    const r = await runAutonomous(text, {
      title: "主动推送",
      kind: "push",
      timeoutMs: Number(process.env.PUSH_MAX_MS || 480_000),
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

    while (!stop) {
      try {
        await tick();        // ① 私信优先：有人找她，先把人伺候好
        await maybeWake();   // ② 没人找，才看时间
      } catch (e) {
        if (e.fatal) {
          log("💀 致命错误（Cookie 失效）：", e.message);
          try {
            fs.writeFileSync(`${HOME}/ALERT.md`, `# 告警\n\n${ts()}\n\nCookie 失效：${e.message}\n快去刷新 Cookie 并覆盖 ${COOKIE_FILE}\n`);
          } catch {}
          await sleep(60_000);
        } else {
          log("轮询异常:", e.message);
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
