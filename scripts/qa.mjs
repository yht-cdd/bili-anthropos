#!/usr/bin/env node
/**
 * qa.mjs —— 陌生人问答台账
 * ============================================================
 * 为什么要单独记：
 *   教程发出去之后，同一个问题会被十个人问，同一个人会在三个视频底下问同一件事。
 *   不记账，她每次都在从零开始答；记了账，子代理一上来就知道「这个人问过什么、
 *   我在哪个视频底下答过什么」。
 *
 * 记录维度（契约要求）：UID / 时间 / 哪条视频底下。
 *
 * 用法：
 *   node qa.mjs log --uid 123 --surface comment --video BV1xx --rpid 456 --role stranger --text "…"
 *   node qa.mjs log --uid 123 --surface dm --role her --text "…"
 *   node qa.mjs context --uid 123 [--video BV1xx] [--limit 12]   # 给子代理读的历史
 *   node qa.mjs list [--uid 123]                                 # 会话清单
 *   node qa.mjs stats
 *
 * 退出码：0 成功 / 1 失败 / 2 参数错
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOME = process.env.LIFE_HOME || "/opt/life";
const DB_FILE = process.env.BILI_DB || `${HOME}/bili/data/bili.db`;

const argv = process.argv.slice(2);
const cmd = argv[0] || "";
const opt = {};
for (let i = 1; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  }
}

const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS qa_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    surface TEXT NOT NULL,
    video TEXT DEFAULT '',
    rpid TEXT DEFAULT '',
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    at INTEGER NOT NULL,
    meta TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_qa_uid ON qa_turns(uid, at);
  CREATE INDEX IF NOT EXISTS idx_qa_video ON qa_turns(video, at);
`);

const now = Date.now();
const fmt = (t) => new Date(Number(t)).toLocaleString("zh-CN", { hour12: false });

function need(k) {
  const v = String(opt[k] || "").trim();
  if (!v) { console.error(`❌ 缺少 --${k}`); process.exit(2); }
  return v;
}

if (cmd === "log") {
  const uid = need("uid");
  const role = String(opt.role || "stranger");
  if (!["stranger", "her"].includes(role)) { console.error("❌ --role 只能是 stranger / her"); process.exit(2); }
  const text = need("text");
  db.prepare(
    "INSERT INTO qa_turns(uid, surface, video, rpid, role, text, at, meta) VALUES(?,?,?,?,?,?,?,?)"
  ).run(
    uid,
    String(opt.surface || "dm"),
    String(opt.video || ""),
    String(opt.rpid || ""),
    role,
    text.slice(0, 4000),
    now,
    String(opt.meta || "")
  );
  console.log(JSON.stringify({ ok: true, uid, role, surface: opt.surface || "dm", video: opt.video || "" }));
  process.exit(0);
}

if (cmd === "context") {
  const uid = need("uid");
  const video = String(opt.video || "");
  const limit = Number(opt.limit || 12);

  // 优先取「同一视频底下」的历史；私信没有 video，就取这个人的全部
  const rows = video
    ? db.prepare("SELECT role, text, at, video, surface, rpid FROM qa_turns WHERE uid=? AND video=? ORDER BY at DESC LIMIT ?").all(uid, video, limit)
    : db.prepare("SELECT role, text, at, video, surface, rpid FROM qa_turns WHERE uid=? ORDER BY at DESC LIMIT ?").all(uid, limit);

  const turns = rows.reverse().map((r) => ({
    role: r.role,
    text: r.text,
    at: fmt(r.at),
    video: r.video || "",
    surface: r.surface,
  }));

  // 顺带给他所有出现过的视频，便于判断「这人还在别处问过什么」
  const videos = db.prepare("SELECT video, COUNT(*) c, MAX(at) last FROM qa_turns WHERE uid=? AND video<>'' GROUP BY video ORDER BY last DESC LIMIT 5").all(uid);

  console.log(JSON.stringify({ ok: true, uid, video: video || "(全部)", turns, videos }, null, 2));
  process.exit(0);
}

if (cmd === "list") {
  const uid = String(opt.uid || "");
  const rows = uid
    ? db.prepare("SELECT video, COUNT(*) c, MIN(at) first, MAX(at) last FROM qa_turns WHERE uid=? GROUP BY video ORDER BY last DESC").all(uid)
    : db.prepare("SELECT uid, video, COUNT(*) c, MIN(at) first, MAX(at) last FROM qa_turns GROUP BY uid, video ORDER BY last DESC LIMIT 40").all();

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessions: rows.map((r) => ({
          uid: r.uid || uid,
          video: r.video || "(私信)",
          turns: r.c,
          first: fmt(r.first),
          last: fmt(r.last),
        })),
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (cmd === "stats") {
  const total = db.prepare("SELECT COUNT(*) c FROM qa_turns").get().c;
  const people = db.prepare("SELECT COUNT(DISTINCT uid) c FROM qa_turns").get().c;
  const videos = db.prepare("SELECT COUNT(DISTINCT video) c FROM qa_turns WHERE video<>''").get().c;
  console.log(JSON.stringify({ ok: true, turns: total, people, videos }, null, 2));
  process.exit(0);
}

console.error("用法：node qa.mjs <log|context|list|stats> ...");
process.exit(2);
