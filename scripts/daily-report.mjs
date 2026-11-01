#!/usr/bin/env node
// 昨天的账：把"昨天到底发生了什么"查出来，交给日切那次唤醒。
//
// 为什么不能让她自己回忆：
//   没有事实输入的日记，一定会长成"今天和三位观众聊了天"这种
//   读起来很顺、但对不上的东西。数字必须来自库和日志。
//
// 数据源（各司其职）：
//   bili.db / dm_seen   收到的私信（按读到的时刻算）
//   bili.db / sends     发出去的消息
//   bili.db / videos    视频进度
//   exec/bridge.log     任务回合（私信 / 自主）
//   diary/<day>.md      醒来次数
//
// 用法：
//   node daily-report.mjs            昨天
//   node daily-report.mjs --date 2026-10-29

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOME = process.env.LIFE_HOME || "/opt/life";
const DB = path.join(HOME, "bili/data/bili.db");
const LOG = path.join(HOME, "exec/bridge.log");
const DIARY = path.join(HOME, "diary");

const argv = process.argv.slice(2);
const di = argv.indexOf("--date");
const day =
  di >= 0 && argv[di + 1]
    ? argv[di + 1]
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toLocaleDateString("sv-SE");
      })();

const start = new Date(`${day}T00:00:00`).getTime();
const end = new Date(start);
end.setDate(end.getDate() + 1);
const END = end.getTime();

const lines = [];
const push = (s) => lines.push(s);

let db = null;
try {
  db = new DatabaseSync(DB);
} catch (e) {
  push(`（数据库打不开：${e.message}）`);
}

const count = (sql, ...a) => {
  try {
    return db.prepare(sql).get(...a)?.c ?? 0;
  } catch {
    return 0;
  }
};
const rows = (sql, ...a) => {
  try {
    return db.prepare(sql).all(...a);
  } catch {
    return [];
  }
};

// ── 私信 ──────────────────────────────────────────────
const dmNew = count("SELECT COUNT(*) c FROM dm_seen WHERE at >= ? AND at < ?", start, END);

// ── 发送 ──────────────────────────────────────────────
// ⚠️ sends.sent_at 是「秒」（与 B 站接口一致），其余表多是毫秒。
//    start / END 是毫秒，这里必须换算，否则一条都查不到。
const START_SEC = Math.floor(start / 1000);
const END_SEC = Math.floor(END / 1000);
const sentRows = rows(
  "SELECT kind, COUNT(*) c FROM sends WHERE sent_at >= ? AND sent_at < ? GROUP BY kind",
  START_SEC,
  END_SEC
);
const sentTotal = sentRows.reduce((n, r) => n + r.c, 0);
const sentDetail = sentRows.map((r) => `${r.kind || "未标记"} ${r.c}`).join(" / ");

// ── 视频 ──────────────────────────────────────────────
// 计数用 COUNT(*) 真数，BV 清单只展示前 5（LIMIT 5 只限展示，不冒充总数——11-01 自查纠正）
const watchedCount = count("SELECT COUNT(*) c FROM watched WHERE watched_at >= ? AND watched_at < ?", START_SEC, END_SEC);
const watched = rows(
  "SELECT bvid, title FROM watched WHERE watched_at >= ? AND watched_at < ? ORDER BY watched_at DESC LIMIT 5",
  START_SEC,
  END_SEC
);
const inProgress = rows(
  "SELECT bvid, title, state FROM videos WHERE state IS NOT NULL AND state NOT IN ('done','published') ORDER BY updated_at DESC LIMIT 3"
);

// ── bridge.log ────────────────────────────────────────
let ownerTasks = 0;
let autoRounds = 0;
let fails = 0;
try {
  const text = fs.readFileSync(LOG, "utf8");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const t = Date.parse(line.slice(0, 24));
    if (!(t >= start && t < END)) continue;
    if (line.includes("| 主人私信 |")) ownerTasks += 1;
    if (line.includes("| 自主回合 |")) autoRounds += 1;
    if (line.includes("| 失败 |")) fails += 1;
  }
} catch {}

// ── 日记里的醒来次数 ──────────────────────────────────
let wakeTotal = 0;
let wakeFixed = 0;
const diaryFile = path.join(DIARY, `${day}.md`);
try {
  const t = fs.readFileSync(diaryFile, "utf8");
  wakeTotal = (t.match(/^## .+· (醒来|日切)/gm) || []).length;
  wakeFixed = (t.match(/^## .+· 日切/gm) || []).length;
} catch {}

// ── 输出 ──────────────────────────────────────────────
push(`【${day} 的账】`);
push(`私信：新到 ${dmNew} 条 / 回你 ${ownerTasks} 条`);
push(`对外发送：${sentTotal} 条${sentDetail ? `（${sentDetail}）` : ""}`);
push(`看视频：${watchedCount} 条${watched.length ? `（${watched.map((v) => v.bvid).join("、")}${watchedCount > 5 ? " 等" : ""}）` : ""}`);
push(`进行中的视频：${inProgress.length ? inProgress.map((v) => `${v.bvid} ${v.state}`).join("、") : "无"}`);
push(`醒来：${wakeTotal} 次（日切 ${wakeFixed} / 随机 ${Math.max(0, wakeTotal - wakeFixed)}）+ 自主动作 ${autoRounds} 回合`);
if (fails) push(`失败：${fails} 次（看 exec/bridge.log）`);
if (!dmNew && !ownerTasks && !autoRounds && !watched.length) push(`（这一天没有发生什么）`);

console.log(lines.join("\n"));
