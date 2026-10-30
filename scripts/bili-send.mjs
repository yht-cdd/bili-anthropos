#!/usr/bin/env node
/**
 * bili-send.mjs — 回复发送层（四道闸）
 * ============================================================
 * 这是整条链路里唯一会「对外说话」的模块。设计原则：
 *
 *   1. 默认 dry-run —— 不加 --confirm 绝不真的发出去
 *   2. 四道闸 —— 内容 / 限速 / 静默 / 类型，任一不过就拒绝
 *   3. 私信禁发 —— 代码级硬禁用，不是配置项
 *   4. 全程留痕 —— 每一条发送都写 sends 表，可追溯可撤销分析
 *
 * 命令：
 *   node bili-send.mjs list                      待处理事件
 *   node bili-send.mjs show <eventId>            单条详情（含上下文）
 *   node bili-send.mjs approve <eventId> "文本"   登记待发送回复
 *   node bili-send.mjs send <eventId> [--confirm] 过闸并发送
 *   node bili-send.mjs reject <eventId> [理由]    标记忽略
 *   node bili-send.mjs stats                     发送统计与配额
 *
 * 退出码：0 成功 / 1 拒绝 / 2 异常
 */

import fs from "fs";
import { DatabaseSync } from "node:sqlite";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || `${HOME}/secrets/bili_cookie.txt`;
const DB_FILE = process.env.BILI_DB || `${HOME}/bili/data/bili.db`;
const AUDIT_LOG = `${HOME}/bili/logs/sends.log`;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

// ── 限速配置（改这里就是改策略）────────────────────
const LIMIT = {
  sameTargetGapMs: 90_000,   // 同一目标最小间隔 90 秒
  hourly: 3,                 // 每小时最多 3 条
  daily: 20,                 // 每天最多 20 条
  sameUserGapMs: 30 * 60_000,// 同一用户 30 分钟内只回一次
  quietFrom: 0,              // 静默开始（0 点）
  quietTo: 7,                // 静默结束（7 点）
  maxLen: 500,               // 单条最长 500 字
  minLen: 2,
  allowDM: false,            // 🔴 私信发送硬开关，默认关
};

// ── Cookie ──────────────────────────────────────────
const rawCookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const JAR = {};
for (const p of rawCookie.split(";")) {
  const i = p.indexOf("=");
  if (i > 0) JAR[p.slice(0, i).trim()] = p.slice(i + 1).trim();
}

// ── DB ──────────────────────────────────────────────
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS drafts (
    event_id   TEXT PRIMARY KEY,
    text       TEXT NOT NULL,
    created_at INTEGER,
    status     INTEGER DEFAULT 0   -- 0=待发 1=已发 2=拒绝
  );

  CREATE TABLE IF NOT EXISTS sends (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT,
    kind     TEXT,
    target   TEXT,
    user_id  TEXT,
    text     TEXT,
    rpid     TEXT,
    sent_at  INTEGER,
    ok       INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_sends_time ON sends(sent_at);
`);

const log = (...a) => {
  const line = `[${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}] ${a.join(" ")}`;
  console.log(line);
  try { fs.appendFileSync(AUDIT_LOG, line + "\n"); } catch {}
};

function loadCookie() {
  const raw = fs.readFileSync(COOKIE_FILE, "utf8").trim();
  const jar = {};
  for (const p of raw.split(";")) {
    const i = p.indexOf("=");
    if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return jar;
}

async function http(url, opts = {}) {
  const r = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      "User-Agent": UA,
      Referer: "https://www.bilibili.com/",
      Origin: "https://www.bilibili.com",
      Cookie: fs.readFileSync(COOKIE_FILE, "utf8").trim(),
      ...(opts.headers || {}),
    },
    body: opts.body,
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { code: -999, message: text.slice(0, 120) }; }
}

// ══════════════════════════════════════════════════
// 四道闸
// ══════════════════════════════════════════════════

const BANNED = [
  { re: /(微信|QQ|qq|vx|VX|加我|私聊|群号)/, why: "含联系方式" },
  { re: /\d{6,}/, why: "含疑似号码" },
  { re: /https?:\/\//, why: "含外链" },
  { re: /(政治|色情|赌博|代刷|刷粉|刷赞)/, why: "含敏感词" },
  { re: /(傻[逼比]|蠢|垃圾|滚|闭嘴|脑残)/, why: "含攻击性表达" },
  { re: /(我是\s*AI|作为\s*AI|语言模型|无法回答)/, why: "AI 自我暴露/回避话术" },
];

/** 闸一：内容 */
function gateContent(text, event) {
  const t = (text || "").trim();
  if (t.length < LIMIT.minLen) return { ok: false, why: `太短（${t.length} 字）` };
  if (t.length > LIMIT.maxLen) return { ok: false, why: `太长（${t.length} > ${LIMIT.maxLen}）` };
  for (const b of BANNED) {
    if (b.re.test(t)) return { ok: false, why: `内容违规：${b.why}` };
  }
  // 不允许纯表情/纯标点
  if (!/[\u4e00-\u9fa5a-zA-Z0-9]/.test(t)) return { ok: false, why: "无有效字符" };

  // 防复读：与该用户最近 20 条回复不重复
  const recent = db.prepare(
    "SELECT text FROM sends WHERE user_id = ? ORDER BY sent_at DESC LIMIT 20"
  ).all(event.author_id || "").map(r => r.text);
  if (recent.includes(t)) return { ok: false, why: "与该用户历史回复重复" };

  return { ok: true };
}

/** 闸二：限速 */
function gateRate(event) {
  // ⚠️ sends.sent_at 全表约定用「秒」，与 B 站接口时间戳一致。
  //    ledger-check 补录的也是秒。两边混用会让这个闸门直接失效：
  //    毫秒 now 减秒级旧记录 = 一个永远成立的巨大差值 → 冷却判断永远通过。
  const now = Math.floor(Date.now() / 1000);
  const gapSameSec = LIMIT.sameTargetGapMs / 1000;
  const gapUserSec = LIMIT.sameUserGapMs / 1000;

  const hourCount = db.prepare("SELECT COUNT(*) c FROM sends WHERE sent_at > ? AND ok = 1")
    .get(now - 3600).c;
  if (hourCount >= LIMIT.hourly) return { ok: false, why: `小时配额用尽（${hourCount}/${LIMIT.hourly}）` };

  const dayCount = db.prepare("SELECT COUNT(*) c FROM sends WHERE sent_at > ? AND ok = 1")
    .get(now - 86400).c;
  if (dayCount >= LIMIT.daily) return { ok: false, why: `日配额用尽（${dayCount}/${LIMIT.daily}）` };

  const lastSame = db.prepare("SELECT MAX(sent_at) t FROM sends WHERE target = ? AND ok = 1")
    .get(event.ref || "")?.t;
  if (lastSame && now - lastSame < gapSameSec) {
    const wait = Math.ceil(gapSameSec - (now - lastSame));
    return { ok: false, why: `同目标冷却中，还需 ${wait} 秒` };
  }

  const lastUser = db.prepare("SELECT MAX(sent_at) t FROM sends WHERE user_id = ? AND ok = 1")
    .get(event.author_id || "")?.t;
  if (lastUser && now - lastUser < gapUserSec) {
    const wait = Math.ceil((gapUserSec - (now - lastUser)) / 60);
    return { ok: false, why: `同一用户冷却中，还需 ${wait} 分钟` };
  }

  return { ok: true, hourCount, dayCount };
}

/** 闸三：静默时段 */
function gateQuiet() {
  const h = Number(new Date().toLocaleString("en-US", {
    timeZone: "Asia/Shanghai", hour: "2-digit", hour12: false,
  }));
  if (h >= LIMIT.quietFrom && h < LIMIT.quietTo) {
    return { ok: false, why: `静默时段（${LIMIT.quietFrom}:00–${LIMIT.quietTo}:00）` };
  }
  return { ok: true };
}

/** 闸四：类型 */
function gateKind(event) {
  if (event.kind === "dm" && !LIMIT.allowDM) {
    return { ok: false, why: "私信发送已代码级禁用" };
  }
  if (!["comment", "at", "reply"].includes(event.kind)) {
    return { ok: false, why: `不支持的事件类型: ${event.kind}` };
  }
  return { ok: true };
}

// ══════════════════════════════════════════════════
// 发送实现
// ══════════════════════════════════════════════════

async function sendComment(event, text) {
  // event.ref = "aid:123456"
  const aid = String(event.ref || "").replace("aid:", "");
  if (!/^\d+$/.test(aid)) return { code: -1, message: `无法解析 aid: ${event.ref}` };

  const jar = loadCookie();
  const body = new URLSearchParams({
    oid: aid,
    type: "1",
    message: text,
    csrf: jar.bili_jct,
  });

  // 如果是对某条评论的回复，带上 root
  const extra = JSON.parse(event.raw || "null");
  const root = extra?.rpid ? String(extra.rpid) : null;
  if (root) { body.set("root", root); body.set("parent", root); }

  return http("https://api.bilibili.com/x/v2/reply/add", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

/** 各错误码的处置建议 */
function explain(code, message) {
  const m = {
    0: "✅ 成功",
    "-101": "🔴 未登录 → SESSDATA 过期，必须重新扫码",
    "-400": "内容非法 → 丢弃，不重试",
    "-404": "目标不存在 → 事件作废",
    "-412": "🟠 风控拦截 → 建议全链路停 2 小时",
    "-509": "🟡 频率超限 → 退避 15 分钟",
    "-352": "🟡 buvid 缺失 → 补 buvid3 后重试",
    12002: "评论已关闭 → 事件作废",
  };
  return m[code] || `未知错误 ${code} ${message || ""}`;
}

// ══════════════════════════════════════════════════
// 命令
// ══════════════════════════════════════════════════

function cmdList() {
  const rows = db.prepare(`
    SELECT e.id, e.kind, e.ref, e.author, e.body,
           datetime(e.origin_ts, 'unixepoch', '+8 hours') t,
           d.text draft, d.status dstatus
    FROM events e
    LEFT JOIN drafts d ON d.event_id = e.id
    WHERE e.status = 0
    ORDER BY e.seen_at DESC LIMIT 50
  `).all();

  if (!rows.length) { log("（无待处理事件）"); return; }
  console.log(`\n待处理 ${rows.length} 条：\n`);
  for (const r of rows) {
    const tag = r.draft ? (r.dstatus === 0 ? "📝待发" : "已处理") : "⏳待生成";
    console.log(`${tag}  [${r.id}]  ${r.kind}  ${(r.author || "").slice(0, 12)}  ${r.t || ""}`);
    console.log(`      原文：${(r.body || "").replace(/\n/g, " ").slice(0, 66)}`);
    if (r.draft) console.log(`      草稿：${r.draft.replace(/\n/g, " ").slice(0, 66)}`);
    console.log("");
  }
}

function cmdShow(id) {
  const e = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  if (!e) { console.log("找不到事件:", id); return; }
  console.log("═".repeat(52));
  console.log("事件 ID :", e.id);
  console.log("类型    :", e.kind);
  console.log("目标    :", e.ref);
  console.log("用户    :", e.author, `(${e.author_id})`);
  console.log("B站时间 :", new Date(e.origin_ts * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }));
  console.log("内容    :");
  console.log((e.body || "").split("\n").map(l => "   " + l).join("\n"));
  const d = db.prepare("SELECT * FROM drafts WHERE event_id = ?").get(id);
  if (d) console.log("当前草稿:", d.text, `(status=${d.status})`);
  console.log("═".repeat(52));
  console.log("\n原始数据（截断）:");
  console.log((e.raw || "").slice(0, 600));
}

function cmdApprove(id, text) {
  if (!text) { console.log("用法: approve <eventId> \"回复文本\""); return; }
  const e = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  if (!e) { console.log("找不到事件:", id); return; }

  const g = gateContent(text, e);
  if (!g.ok) { log(`❌ 闸一不通过：${g.why}`); process.exit(1); }

  db.prepare(`
    INSERT INTO drafts(event_id, text, created_at, status) VALUES(?,?,?,0)
    ON CONFLICT(event_id) DO UPDATE SET text=excluded.text, created_at=excluded.created_at, status=0
  `).run(id, text, Date.now());
  log(`✅ 已登记草稿（${text.length} 字）：${text}`);
}

async function cmdSend(id, confirm) {
  const e = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  if (!e) { console.log("找不到事件:", id); return; }

  const d = db.prepare("SELECT * FROM drafts WHERE event_id = ?").get(id);
  if (!d) { console.log("该事件还没有草稿。先用 approve 登记。"); return; }
  if (d.status === 1) { console.log("该事件已发送过，跳过。"); return; }

  // 四道闸
  const gates = [
    ["④ 类型", gateKind(e)],
    ["③ 静默", gateQuiet()],
    ["② 限速", gateRate(e)],
    ["① 内容", gateContent(d.text, e)],
  ];
  console.log("\n─── 四道闸 ───");
  let blocked = null;
  for (const [name, g] of gates) {
    console.log(`  ${g.ok ? "✅" : "❌"} ${name}  ${g.ok ? "" : g.why}`);
    if (!g.ok) { blocked = blocked || `${name}：${g.why}`; break; }
  }
  if (blocked) { log(`\n🚫 拒绝发送 —— ${blocked}`); process.exit(1); }

  console.log("\n─── 即将发送 ───");
  console.log("  目标：", e.ref, "| 类型：", e.kind);
  console.log("  回复：", d.text);

  if (!confirm) {
    console.log("\n  (dry-run) 加 --confirm 才会真的发出去");
    return;
  }

  const j = await sendComment(e, d.text);
  console.log("\n─── 结果 ───");
  console.log("  code:", j.code, "|", explain(j.code, j.message));

  const ok = j.code === 0 ? 1 : 0;
  db.prepare(`
    INSERT INTO sends(event_id, kind, target, user_id, text, rpid, sent_at, ok)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(id, e.kind, e.ref, e.author_id, d.text, String(j.data?.rpid || ""), Math.floor(Date.now() / 1000), ok);

  if (ok) {
    db.prepare("UPDATE drafts SET status = 1 WHERE event_id = ?").run(id);
    db.prepare("UPDATE events SET status = 1 WHERE id = ?").run(id);
    log(`✅ 已发送 rpid=${j.data?.rpid}`);
  } else {
    log(`❌ 发送失败 code=${j.code}`);
    // 风控类错误：把事件退回，但不重试
    if (j.code === -412 || j.code === -404 || j.code === 12002) {
      db.prepare("UPDATE events SET status = 3 WHERE id = ?").run(id);
      log("   该事件已标记作废，不再重试");
    }
  }
}

function cmdReject(id, reason) {
  db.prepare("UPDATE events SET status = 2 WHERE id = ?").run(id);
  db.prepare("UPDATE drafts SET status = 2 WHERE event_id = ?").run(id);
  log(`✅ 已忽略 [${id}] ${reason || ""}`);
}

function cmdStats() {
  const now = Math.floor(Date.now() / 1000);
  const h = db.prepare("SELECT COUNT(*) c FROM sends WHERE sent_at > ? AND ok=1").get(now - 3600).c;
  const d = db.prepare("SELECT COUNT(*) c FROM sends WHERE sent_at > ? AND ok=1").get(now - 86400).c;
  const total = db.prepare("SELECT COUNT(*) c FROM sends WHERE ok=1").get().c;
  const fail = db.prepare("SELECT COUNT(*) c FROM sends WHERE ok=0").get().c;
  const pending = db.prepare("SELECT COUNT(*) c FROM events WHERE status=0").get().c;
  const drafted = db.prepare("SELECT COUNT(*) c FROM drafts WHERE status=0").get().c;

  console.log("\n─── 配额 ───");
  console.log(`  本小时  ${h}/${LIMIT.hourly}`);
  console.log(`  今日    ${d}/${LIMIT.daily}`);
  console.log("\n─── 累计 ───");
  console.log(`  成功    ${total}`);
  console.log(`  失败    ${fail}`);
  console.log("\n─── 队列 ───");
  console.log(`  待处理事件  ${pending}`);
  console.log(`  已登记草稿  ${drafted}`);
  console.log("\n─── 最近 10 条发送 ───");
  const rows = db.prepare("SELECT event_id, target, substr(text,1,30) t, ok, sent_at FROM sends ORDER BY sent_at DESC LIMIT 10").all();
  if (!rows.length) { console.log("  （无）"); return; }
  for (const r of rows) {
    const t = new Date(r.sent_at * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
    console.log(`  ${r.ok ? "✅" : "❌"} ${t}  ${r.target}  ${r.t}`);
  }
}

// ── 路由 ────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);
try {
  switch (cmd) {
    case "list": cmdList(); break;
    case "show": cmdShow(args[0]); break;
    case "approve": cmdApprove(args[0], args[1]); break;
    case "send": await cmdSend(args[0], args.includes("--confirm")); break;
    case "reject": cmdReject(args[0], args.slice(1).join(" ")); break;
    case "stats": cmdStats(); break;
    default:
      console.log(`用法：
  node bili-send.mjs list                      待处理事件
  node bili-send.mjs show <eventId>            单条详情
  node bili-send.mjs approve <eventId> "文本"   登记草稿
  node bili-send.mjs send <eventId> [--confirm] 过闸并发送
  node bili-send.mjs reject <eventId> [理由]    标记忽略
  node bili-send.mjs stats                     配额与统计

当前限速：
  同一目标   ≥ ${LIMIT.sameTargetGapMs / 1000} 秒
  每小时     ≤ ${LIMIT.hourly} 条
  每天       ≤ ${LIMIT.daily} 条
  同一用户   ≥ ${LIMIT.sameUserGapMs / 60000} 分钟
  静默时段   ${LIMIT.quietFrom}:00 – ${LIMIT.quietTo}:00
  私信发送   ${LIMIT.allowDM ? "允许" : "🔴 禁用"}`);
  }
} catch (e) {
  console.error("❌ 异常:", e.message);
  process.exit(2);
}
