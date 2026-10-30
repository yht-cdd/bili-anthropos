#!/usr/bin/env node
/**
 * handover.mjs —— 换代前把记忆抽成一份能带走的档案
 * ============================================================
 * 会话可以删，记忆不能丢。
 * 这个脚本把她散在各处的「我是谁 / 我在做什么 / 最近发生了什么」抽成一份摘要，
 * 同时把旧会话的对话原文另存一份完整档案（摘要给人看，原文备查）。
 *
 * 用法：
 *   node handover.mjs                       # 抽当前会话
 *   node handover.mjs --session ses_xxx     # 指定会话
 *   node handover.mjs --days 7              # 日记回看几天（默认 3）
 *   node handover.mjs --out /path/x.md
 *
 * 只读：除了写 memory/ 和 archive/ 下的两个文件，不改任何东西。
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const OC_BASE = process.env.OC_BASE || "http://127.0.0.1:4096";
const SESSION_FILE = path.join(HOME, "bili/data/bridge_session.json");

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
const DAYS = Number(opt.days || 3);
const today = new Date().toLocaleDateString("sv-SE");
const OUT = opt.out || path.join(HOME, "memory", `HANDOVER-${today}.md`);

let pwCache = "";
function getPassword() {
  if (pwCache) return pwCache;
  let pw = "";
  try {
    pw = fs.readFileSync(path.join(HOME, "secrets/opencode_password.txt"), "utf8").trim();
  } catch {}
  if (!pw) pw = String(process.env.OPENCODE_PASSWORD || "").trim();
  if (!pw) {
    try {
      pw = execSync(`journalctl -u opencode --no-pager -n 300 2>/dev/null | grep -oP 'server password \\K\\S+' | tail -1`, {
        encoding: "utf8",
        timeout: 10_000,
      }).trim();
    } catch {}
  }
  pwCache = pw;
  return pw;
}

async function oc(pathname) {
  const pw = getPassword();
  if (!pw) throw new Error("拿不到 opencode 密码");
  const auth = "Basic " + Buffer.from(`opencode:${pw}`).toString("base64");
  const r = await fetch(OC_BASE + pathname, { headers: { Authorization: auth }, signal: AbortSignal.timeout(20_000) });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return {};
  }
}

function read(file, cap = 4000) {
  try {
    const s = fs.readFileSync(path.join(HOME, file), "utf8").trim();
    return s.length > cap ? s.slice(0, cap) + `\n…（截断，原文 ${s.length} 字）` : s;
  } catch {
    return "";
  }
}

function listDir(dir, cap = 40) {
  try {
    return fs.readdirSync(path.join(HOME, dir)).filter((f) => !f.startsWith(".")).slice(0, cap).join("、");
  } catch {
    return "";
  }
}

function recentDiaries(days) {
  try {
    const files = fs
      .readdirSync(path.join(HOME, "diary"))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .slice(-days);
    const out = [];
    for (const f of files) {
      const body = fs.readFileSync(path.join(HOME, "diary", f), "utf8").trim();
      // 每篇只取标题 + 每节前两行，避免把整本日记搬过来
      const lines = body.split("\n");
      const picked = [];
      for (const ln of lines) {
        if (/^##\s/.test(ln)) picked.push("\n" + ln);
        else if (ln.trim() && picked.length && !picked[picked.length - 1].endsWith("…")) picked.push(ln.trim().slice(0, 120) + "…");
      }
      out.push(`### ${f}\n${picked.join("\n").slice(0, 2500)}`);
    }
    return out.join("\n\n");
  } catch {
    return "";
  }
}

function msgText(m) {
  return (m.content || [])
    .filter((c) => c.type === "text")
    .map((c) => String(c.text || "").trim())
    .filter(Boolean)
    .join("\n");
}

(async () => {
  // ① 找会话
  let sid = String(opt.session || "").trim();
  if (!sid) {
    try {
      sid = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8")).id;
    } catch {}
  }

  let transcript = "";
  let tail = "";
  if (sid) {
    const j = await oc(`/api/session/${sid}/message`);
    const msgs = (j.data || []).slice().sort((a, b) => Number(a.time?.created || 0) - Number(b.time?.created || 0));
    const rows = [];
    for (const m of msgs) {
      if (m.type !== "user" && m.type !== "assistant") continue;
      const raw = m.type === "user" ? String(m.text || "") : msgText(m);
      if (!raw.trim()) continue;
      rows.push({ role: m.type, text: raw.trim(), at: Number(m.time?.created || 0) });
    }
    transcript = rows
      .map((r) => `### ${r.role === "user" ? "收到" : "她说"} · ${new Date(r.at).toLocaleString("zh-CN", { hour12: false })}\n\n${r.text}\n`)
      .join("\n");
    // 尾声只留最后 12 轮，且每轮截断，防止摘要本身把新会话撑爆
    tail = rows
      .slice(-12)
      .map((r) => `- ${r.role === "user" ? "收到" : "她说"}：${r.text.replace(/\s+/g, " ").slice(0, 160)}`)
      .join("\n");
  }

  // ② 拼摘要
  const doc = [
    `# 记忆交接 · ${today}`,
    ``,
    `> 这是换会话之前从各处抽出来的档案。旧会话已归档到 archive/。`,
    `> 你不需要背下来 —— 它只是让你知道「昨天为止你是谁」。细节在文件里，按需去读。`,
    ``,
    `## 一、我是谁`,
    read("META.md", 1500) || "（META.md 为空）",
    ``,
    `## 二、自我认知（摘要）`,
    read("SELF.md", 2500) || "（SELF.md 为空）",
    ``,
    `## 三、当前状态`,
    read("STATE.json", 800) || "（STATE.json 为空）",
    ``,
    `## 四、定过的事 / 还没答的问题`,
    read("BELIEFS.md", 1500) ? `**信念**\n${read("BELIEFS.md", 1500)}` : "",
    read("QUESTIONS.md", 1200) ? `**问题**\n${read("QUESTIONS.md", 1200)}` : "",
    ``,
    `## 五、最近 ${DAYS} 天的日记（每节取开头）`,
    recentDiaries(DAYS) || "（还没有日记）",
    ``,
    `## 六、今天的计划`,
    read("TODAY.md", 1200) || "（TODAY.md 为空）",
    ``,
    `## 七、记忆流最近 40 行`,
    (() => {
      const s = read("STREAM.md", 100000);
      if (!s) return "（STREAM.md 为空）";
      return s.split("\n").slice(-40).join("\n");
    })(),
    ``,
    `## 八、手上有什么`,
    `- 工程知识：${listDir("knowledge/projects") || "（空）"}`,
    `- 疤痕（踩过的坑）：${listDir("scars") || "（空）"}`,
    `- 手账：${listDir("journal") || "（空）"}`,
    `- 技能：${listDir("skills") || "（空）"}`,
    ``,
    `## 九、旧会话尾声（只留最后 12 轮）`,
    tail || "（没有会话记录）",
    ``,
  ]
    .filter((x) => x !== "")
    .join("\n");

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, doc + "\n");

  // ③ 原文归档
  let archivePath = "";
  if (transcript) {
    const dir = path.join(HOME, "archive");
    fs.mkdirSync(dir, { recursive: true });
    archivePath = path.join(dir, `session-${String(sid).slice(-8)}-${today}.md`);
    fs.writeFileSync(
      archivePath,
      `# 旧会话原文归档 · ${sid}\n\n导出时间：${new Date().toLocaleString("zh-CN", { hour12: false })}\n\n${transcript}\n`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        session: sid || "(无)",
        digest: OUT,
        digestBytes: Buffer.byteLength(doc),
        archive: archivePath || "(无内容)",
        archiveBytes: transcript ? Buffer.byteLength(transcript) : 0,
        rounds: tail ? tail.split("\n").length : 0,
      },
      null,
      2
    )
  );
})();
