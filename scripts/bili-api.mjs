#!/usr/bin/env node
/**
 * bili-api.mjs — B站读写工具层
 *
 * 设计原则：
 *   1. 读操作随便跑，写操作默认 dry-run，必须 --confirm
 *   2. 所有请求带 500ms 间隔，不触发风控
 *   3. 输出结构化，方便 Agent 消费
 *
 * 命令：
 *   node bili-api.mjs watch                 综合巡检：稿件 + 评论 + @ + 私信 + 未读
 *   node bili-api.mjs archives              我的稿件列表
 *   node bili-api.mjs comments <bvid|aid>   某视频的评论
 *   node bili-api.mjs mentions              @我的
 *   node bili-api.mjs messages              私信会话
 *   node bili-api.mjs unread                未读数
 *   node bili-api.mjs stats                 账号概况
 *   node bili-api.mjs reply <bvid|aid> "文本" [--root rpid] [--confirm]
 */

import fs from "fs";

const COOKIE_FILE = process.env.BILI_COOKIE_FILE || "/opt/life/secrets/bili_cookie.txt";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const GAP_MS = 500;

const cookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const jar = {};
for (const p of cookie.split(";")) { const i = p.indexOf("="); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }

let lastCall = 0;
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function get(url, params = {}) {
  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);

  const r = await fetch(u.toString(), {
    headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/", Origin: "https://www.bilibili.com", Cookie: cookie },
    signal: AbortSignal.timeout(20000),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { code: -999, message: "非JSON: " + t.slice(0, 100) }; }
}

async function post(url, params = {}) {
  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const body = new URLSearchParams({ ...params, csrf: jar.bili_jct });
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": UA, Referer: "https://www.bilibili.com/", Origin: "https://www.bilibili.com",
      Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { code: -999, message: "非JSON: " + t.slice(0, 100) }; }
}

function ts(unix) {
  if (!unix) return "-";
  let n = Number(unix);
  if (!Number.isFinite(n) || n <= 0) return "-";
  // B站时间戳单位混乱：私信接口用微秒，其他多为秒
  if (n > 1e14) n = n / 1000;        // 微秒 → 毫秒
  else if (n > 1e11) { /* 已是毫秒 */ }
  else n = n * 1000;                  // 秒 → 毫秒
  return new Date(n).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

async function resolveAid(x) {
  if (/^\d+$/.test(x)) return Number(x);
  const j = await get("https://api.bilibili.com/x/web-interface/view", { bvid: x });
  if (j.code !== 0) throw new Error(`解析 ${x} 失败: ${j.message}`);
  return j.data.aid;
}

// ── 命令实现 ────────────────────────────────────────

async function cmdStats() {
  const nav = await get("https://api.bilibili.com/x/web-interface/nav");
  if (nav.code !== 0) { console.log("❌", nav.code, nav.message); return; }
  const d = nav.data;
  const rel = await get("https://api.bilibili.com/x/relation/stat", { vmid: d.mid });
  console.log("=== 账号 ===");
  console.log("  昵称:", d.uname, "| UID:", d.mid, "| Lv", d.level_info?.current_level);
  console.log("  硬币:", d.money, "| 粉丝:", rel.data?.follower ?? "-", "| 关注:", rel.data?.following ?? "-");
  console.log("  实名:", d.vipStatus === 1 ? "✅ 已实名" : "❌ 未实名（投稿会被拦）");
  console.log("  大会员:", d.vip?.status ? "是" : "否");
}

async function cmdArchives() {
  const j = await get("https://member.bilibili.com/x/web/archives", {
    status: "is_pubing,pubed,not_pubed", pn: 1, ps: 20, coop: 1, interactive: 1,
  });
  if (j.code !== 0) { console.log("❌", j.code, j.message); return; }
  const list = j.data?.arc_audits || [];
  console.log(`=== 我的稿件（${list.length} 个）===`);
  if (!list.length) { console.log("  （还没有稿件）"); return; }
  for (const a of list) {
    const arc = a.Archive || a;
    console.log(`  [${arc.bvid}] ${arc.title}`);
    console.log(`      aid=${arc.aid} 状态=${a.Archive?.state_desc || arc.state_desc || arc.state} 播放=${arc.stat?.view ?? 0} 评论=${arc.stat?.reply ?? 0}`);
  }
}

async function cmdComments(key, page = 1) {
  const aid = await resolveAid(key);
  const j = await get("https://api.bilibili.com/x/v2/reply/main", { type: 1, oid: aid, mode: 3, next: page - 1, ps: 20 });
  if (j.code !== 0) { console.log("❌", j.code, j.message); return; }
  const replies = j.data?.replies || [];
  console.log(`=== aid=${aid} 评论（${replies.length} 条）===`);
  if (!replies.length) { console.log("  （无评论）"); return; }
  for (const r of replies) {
    console.log(`\n  [rpid=${r.rpid}] ${r.member?.uname} (uid ${r.mid})  ${ts(r.ctime)}  赞${r.like}`);
    console.log(`    ${r.content?.message?.replace(/\n/g, " ").slice(0, 200)}`);
    if (r.replies?.length) for (const s of r.replies) {
      console.log(`      ↳ ${s.member?.uname}: ${s.content?.message?.replace(/\n/g, " ").slice(0, 120)}`);
    }
  }
  console.log("\n  下一页 cursor:", j.data?.cursor?.next, "| 结束:", j.data?.cursor?.is_end);
}

async function cmdMentions() {
  const j = await get("https://api.bilibili.com/x/msgfeed/at", { build: 0, mobi_app: "web" });
  if (j.code !== 0) { console.log("❌", j.code, j.message); return; }
  const items = j.data?.items || [];
  console.log(`=== @我的（${items.length} 条）===`);
  if (!items.length) { console.log("  （无）"); return; }
  for (const it of items) {
    console.log(`\n  ${it.user?.nickname}  ${ts(it.at_time)}`);
    console.log(`    ${(it.item?.content || "").replace(/\n/g, " ").slice(0, 200)}`);
    if (it.item?.uri) console.log(`    链接: ${it.item.uri}`);
  }
}

async function cmdMessages() {
  const j = await get("https://api.vc.bilibili.com/session_svr/v1/session_svr/get_sessions", {
    session_type: 1, group_id: 0, build: 0, mobi_app: "web",
  });
  if (j.code !== 0) { console.log("❌", j.code, j.message); return; }
  const list = j.data?.session_list || [];
  console.log(`=== 私信会话（${list.length} 个）===`);
  if (!list.length) { console.log("  （无）"); return; }
  for (const s of list) {
    const who = s.talker_id ? `uid ${s.talker_id}` : "(系统)";
    let content = s.last_msg?.content || "";
    if (typeof content === "string" && content.trim().startsWith("{")) {
      try {
        const o = JSON.parse(content);
        content = o.content || o.text || o.title || content;
      } catch {}
    }
    const t = s.session_ts || s.last_msg?.timestamp || s.last_msg?.time || 0;
    console.log(`\n  ${who}  未读=${s.unread_count}  时间=${ts(t)}`);
    console.log(`    ${String(content).replace(/\n/g, " ").slice(0, 120)}`);
  }
}

async function cmdUnread() {
  const j = await get("https://api.bilibili.com/x/msgfeed/unread", { mobi_app: "web" });
  if (j.code !== 0) { console.log("❌", j.code, j.message); return; }
  console.log("=== 未读 ===");
  console.log(JSON.stringify(j.data, null, 2));
}

async function cmdReply(key, text, root, confirm) {
  const aid = await resolveAid(key);
  const params = { oid: aid, type: 1, message: text };
  if (root) { params.root = root; params.parent = root; }

  if (!confirm) {
    console.log("=== DRY RUN（未发送）===");
    console.log("  目标 aid:", aid);
    console.log("  内容:", text);
    if (root) console.log("  回复根评论:", root);
    console.log("\n  加 --confirm 才会真的发出去");
    return;
  }
  const j = await post("https://api.bilibili.com/x/v2/reply/add", params);
  console.log("=== 发送结果 ===");
  console.log("  code:", j.code, "| message:", j.message);
  if (j.code === 0) console.log("  ✅ 已发送 rpid:", j.data?.rpid, "| 链接:", j.data?.reply?.rpid ? `https://www.bilibili.com/h5/comment/sub?oid=${aid}&pageType=1&root=${j.data.reply.rpid}` : "-");
}

async function cmdWatch() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Anthropos 巡检  " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }));
  console.log("╚══════════════════════════════════════════╝");

  await cmdStats(); console.log("");
  const un = await get("https://api.bilibili.com/x/msgfeed/unread", { mobi_app: "web" });
  console.log("=== 未读汇总 ===");
  console.log(" ", JSON.stringify(un.data || {})); console.log("");

  await cmdArchives(); console.log("");
  await cmdMentions(); console.log("");
  await cmdMessages();
}

// ── 路由 ────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);
try {
  switch (cmd) {
    case "stats": await cmdStats(); break;
    case "archives": await cmdArchives(); break;
    case "comments": await cmdComments(args[0], Number(args[1] || 1)); break;
    case "mentions": await cmdMentions(); break;
    case "messages": await cmdMessages(); break;
    case "unread": await cmdUnread(); break;
    case "reply": {
      const confirm = args.includes("--confirm");
      const rootIdx = args.indexOf("--root");
      const root = rootIdx >= 0 ? args[rootIdx + 1] : null;
      const text = args[1];
      await cmdReply(args[0], text, root, confirm);
      break;
    }
    case "watch": await cmdWatch(); break;
    default:
      console.log("用法：node bili-api.mjs <watch|stats|archives|comments|mentions|messages|unread|reply> ...");
  }
} catch (e) {
  console.error("❌ 异常:", e.message);
  process.exit(1);
}
