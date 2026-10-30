#!/usr/bin/env node
/**
 * bili-dm.mjs —— 发 B 站私信（带额度闸门）
 * ============================================================
 * 两种收信人，两套规则：
 *
 *   发给主人      —— 不限额。他叫她，她必须能回。
 *   发给陌生人    —— 走闸门：
 *                     · 每天最多 REPLY_DAILY 条（默认 8）
 *                     · 同一个人 30 天内只回一次
 *                     · 两次之间至少 60 秒
 *
 * 为什么要闸：私信是 B 站风控最凶的接口（判营销/骚扰），
 * 而且她一旦能主动找人，没有上限就是灾难。
 *
 * 用法：
 *   node bili-dm.mjs "内容"                      # 发给主人
 *   node bili-dm.mjs "内容" --to 123456          # 发给指定 UID（走闸门）
 *   node bili-dm.mjs "内容" --dry                # 预演，不真发
 *   node bili-dm.mjs --status                    # 看今天还剩多少额度
 *
 * 主人 UID 来源：环境变量 OWNER_UID > $LIFE_HOME/secrets/owner_uid.txt
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const HOME = process.env.LIFE_HOME || "/opt/life";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || path.join(HOME, "secrets/bili_cookie.txt");
const OWNER_FILE = path.join(HOME, "secrets/owner_uid.txt");
const QUOTA_FILE = path.join(HOME, "bili/data/reply_quota.json");
const LOG_FILE = path.join(HOME, "exec/bridge.log");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

// ── 闸门参数 ──────────────────────────────────────────
const REPLY_DAILY = 8;        // 每天最多回复陌生人几条
const SAME_USER_DAYS = 30;    // 同一个人多久之后才能再回
const MIN_GAP_SEC = 60;       // 两次回复之间至少隔多久
const MAX_LEN = 900;

const argv = process.argv.slice(2);
const opt = {};
let text = "";
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else {
      opt[argv[i].slice(2)] = v;
      i += 1;
    }
  } else if (!text) text = argv[i];
}

// ── 主人 UID ──────────────────────────────────────────
const ownerUid = (() => {
  const env = String(process.env.OWNER_UID || "").trim();
  if (env) return env;
  try {
    return fs.readFileSync(OWNER_FILE, "utf8").trim().split(/\s+/)[0];
  } catch {
    return "";
  }
})();
if (!/^\d{6,}$/.test(ownerUid)) {
  console.error(`❌ 读不到主人 UID（${OWNER_FILE}）`);
  process.exit(1);
}

const TO = String(opt.to || ownerUid).trim();
const IS_OWNER = TO === ownerUid;

// ── 额度账本 ──────────────────────────────────────────
const today = () => new Date().toLocaleDateString("sv-SE");
const dayOf = (iso) => new Date(iso).toLocaleDateString("sv-SE");

function loadQuota() {
  try {
    const j = JSON.parse(fs.readFileSync(QUOTA_FILE, "utf8"));
    return {
      log: Array.isArray(j.log) ? j.log : [],
      lastAt: Number(j.lastAt || 0),
    };
  } catch {
    return { log: [], lastAt: 0 }; // 文件不存在 = 全新安装
  }
}
function saveQuota(q) {
  fs.mkdirSync(path.dirname(QUOTA_FILE), { recursive: true });
  // 只留最近 30 天，防止无限增长
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const keep = q.log.filter((x) => dayOf(x.at) >= cutoff.toLocaleDateString("sv-SE"));
  fs.writeFileSync(QUOTA_FILE, JSON.stringify({ log: keep, lastAt: q.lastAt }, null, 2) + "\n");
}

function checkQuota() {
  const q = loadQuota();
  const todayCount = q.log.filter((x) => dayOf(x.at) === today() && x.to !== ownerUid).length;

  if (todayCount >= REPLY_DAILY) {
    return { ok: false, why: `今天已回复陌生人 ${todayCount} 条，达到上限 ${REPLY_DAILY}` };
  }

  const gap = Date.now() - q.lastAt;
  if (q.lastAt && gap < MIN_GAP_SEC * 1000) {
    return { ok: false, why: `距上次回复只有 ${Math.round(gap / 1000)}s，冷却 ${MIN_GAP_SEC}s` };
  }

  const sameUser = q.log
    .filter((x) => String(x.to) === TO)
    .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  if (sameUser) {
    const days = Math.floor((Date.now() - new Date(sameUser.at).getTime()) / 86_400_000);
    if (days < SAME_USER_DAYS) {
      return { ok: false, why: `${SAME_USER_DAYS} 天内已经回过这个 UID（${days} 天前）` };
    }
  }

  return { ok: true, left: REPLY_DAILY - todayCount };
}

// ── status ────────────────────────────────────────────
if (opt.status) {
  const q = loadQuota();
  const todayCount = q.log.filter((x) => dayOf(x.at) === today() && x.to !== ownerUid).length;
  console.log(
    JSON.stringify(
      {
        date: today(),
        owner: `已配置（${ownerUid.length} 位）`,
        repliedToday: todayCount,
        dailyLimit: REPLY_DAILY,
        left: Math.max(0, REPLY_DAILY - todayCount),
        lastAt: q.lastAt ? new Date(q.lastAt).toISOString() : null,
        recent: q.log.slice(-5),
      },
      null,
      2
    )
  );
  process.exit(0);
}

// ── 参数校验 ──────────────────────────────────────────
// 发图片：--image <公网 URL>。
// 注意：B 站自己的上传通道（api/v1/image/upload）实测稳定 502，
// 但 send_msg 的 msg_type=2 接受任意公网 URL（官方文档写「也可用三方图床」）。
// 所以这里只负责「用现成的 URL 发出去」，上传由别的地方负责。
const IMAGE_URL = typeof opt.image === "string" ? opt.image.trim() : "";

if (IMAGE_URL && !/^https?:\/\//i.test(IMAGE_URL)) {
  console.error(`❌ --image 需要完整的 http(s) URL，收到：${IMAGE_URL}`);
  process.exit(1);
}

// 把字面 "\n" 转成真换行：她在命令行里传的内容常常带转义符，
// 不处理的话 B 站私信里会原样显示成 "\n\n"
const clean = String(text).trim().replace(/\\n/g, "\n");
if (!clean && !IMAGE_URL) {
  console.error('用法: node bili-dm.mjs "内容" [--to UID] [--image URL] [--dry] [--status]');
  process.exit(2);
}
if (!IMAGE_URL && clean.length > MAX_LEN) {
  console.error(`❌ 太长（${clean.length} 字），B 站私信上限约 ${MAX_LEN}`);
  process.exit(1);
}
if (!/^\d{6,}$/.test(TO)) {
  console.error(`❌ --to 不是合法 UID：${TO}`);
  process.exit(1);
}

// ── 闸门检查（主人不受限）──────────────────────────────
if (!IS_OWNER) {
  const gate = checkQuota();
  if (!gate.ok) {
    console.error(`🚫 闸门拦下：${gate.why}`);
    process.exit(3);
  }
  console.error(`✅ 闸门放行（今天还剩 ${gate.left} 条）`);
}

if (opt.dry) {
  console.log(
    JSON.stringify(
      {
        dry: true,
        to: IS_OWNER ? "主人" : `${TO.slice(0, 4)}***${TO.slice(-2)}`,
        isOwner: IS_OWNER,
        kind: IMAGE_URL ? "image" : "text",
        len: clean.length,
  kind: IMAGE_URL ? "image" : "text",
        image: IMAGE_URL || undefined,
      },
      null,
      2
    )
  );
  process.exit(0);
}

// ── 发送 ──────────────────────────────────────────────
const cookie = fs.readFileSync(COOKIE_FILE, "utf8").trim();
const jar = {};
for (const kv of cookie.split(";")) {
  const i = kv.indexOf("=");
  if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
}
const SELF = jar.DedeUserID || "";
const CSRF = jar.bili_jct || "";
const DEV = String(jar.buvid3 || "").slice(0, 36).toUpperCase();

const form = new URLSearchParams({
  "msg[sender_uid]": SELF,
  "msg[receiver_id]": TO,
  "msg[receiver_type]": "1",
  "msg[msg_type]": IMAGE_URL ? "2" : "1",
  "msg[dev_id]": DEV,
  "msg[timestamp]": String(Math.floor(Date.now() / 1000)),
  "msg[content]": IMAGE_URL
    ? JSON.stringify({ url: IMAGE_URL, original: 1 })
    : JSON.stringify({ content: clean }),
  csrf: CSRF,
});

const r = await fetch("https://api.vc.bilibili.com/web_im/v1/web_im/send_msg", {
  method: "POST",
  headers: {
    "User-Agent": UA,
    Referer: "https://message.bilibili.com/",
    Origin: "https://message.bilibili.com",
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookie,
  },
  body: form.toString(),
  signal: AbortSignal.timeout(20_000),
});
const j = await r.json().catch(() => ({ code: -998 }));

if (j.code !== 0) {
  console.error(`❌ 发送失败 code=${j.code} ${j.message || ""}`);
  process.exit(1);
}

// ── 记账（成功才记）────────────────────────────────────
const q = loadQuota();
q.log.push({
  at: new Date().toISOString(),
  to: TO,
  isOwner: IS_OWNER,
  len: clean.length,
  kind: IMAGE_URL ? "image" : "text",
  hash: createHash("sha1").update(clean).digest("hex").slice(0, 8),
});
q.lastAt = Date.now();
saveQuota(q);

try {
  fs.appendFileSync(
    LOG_FILE,
    `${new Date().toISOString()} | ${IS_OWNER ? "主动私信给主人" : "回复陌生人"} | ${clean
      .replace(/\n/g, " ")
      .slice(0, 50)} | 成功 | 0s | ${clean.length}字 | to=${IS_OWNER ? "owner" : TO.slice(0, 4) + "***"}\n`
  );
} catch {}

console.log(
  JSON.stringify({
    ok: true,
    to: IS_OWNER ? "owner" : "other",
    kind: IMAGE_URL ? "image" : "text",
    msg_key: j.data?.msg_key,
    len: clean.length,
  })
);
