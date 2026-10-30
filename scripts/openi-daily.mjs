#!/usr/bin/env node
/**
 * openi-daily.mjs —— OpenI 启智每日任务
 * ============================================================
 * 为什么要有这个脚本，而不是让模型自己照着 SKILL.md 做：
 *
 *   ① SKILL.md 把 AK 的路径写成了 `.opencode/secrets`，实际是
 *      `.opencode/secrets.md`。她按路径去找，ENOENT，于是日记里写
 *      「token 不在本机」，积分任务跳过。整件事是文档骗了人。
 *   ② SKILL.md 是 Windows/PowerShell 写的（curl.exe / $env:TEMP / 代理端口），
 *      在这台 Linux 机器上一行都跑不了。
 *   ③ 契约第四节禁止她读 secrets。让她去翻 AK 本身就是破例。
 *
 * 所以：**凭据由脚本读，她只调脚本，全程不接触 AK。**
 *
 * 内容源（按顺序）：
 *   1. diary/public/YYYY-MM-DD.md  —— 她自己写的「可以公开」版本（推荐）
 *   2. 没有的话，从 diary/YYYY-MM-DD.md 做**段落级过滤**兜底
 *
 * ⚠️ 推的是公开仓库。契约第六节禁止对外暴露运行环境：
 *    宿主机规格（核数/内存/磁盘）、IP、主机名、所在城市、云厂商、
 *    敏感路径、密钥、邮箱、UID —— 一个字都不许出去。
 *    所以这里做段落过滤（整段丢掉，不做字符串替换，替换容易漏），
 *    推之前再扫一遍，扫到就整篇不发。
 *
 * 用法：
 *   node openi-daily.mjs status          看状态
 *   node openi-daily.mjs run             推今天的笔记
 *   node openi-daily.mjs run --dry       只看会推什么，不真发
 *   node openi-daily.mjs init            确保仓库存在
 *
 * 退出码：0 成功 / 1 失败 / 2 配置缺失 / 3 今天没内容可推（不算故障）
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const TOKEN_FILE = path.join(HOME, "secrets/openi_token.txt");
const DIARY_DIR = path.join(HOME, "diary");
const PUBLIC_DIR = path.join(HOME, "diary/public");
const STATE_FILE = path.join(HOME, "bili/data/openi_daily.json");
const API = "https://openi.pcl.ac.cn/api/v1";
const REPO_NAME = "openi-notes";
const MIN_CHARS = 200;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36";
const argv = process.argv.slice(2);
const cmd = argv[0] || "status";
const DRY = argv.includes("--dry");

// ── 敏感内容：命中就整段丢掉 ──────────────────────────
// 宁可少推一点，也不要因为漏了一个正则把服务器信息发到公开仓库。
const SENSITIVE = [
  /\/opt\/life/i,
  /secrets\//i,
  /\broot@/,
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/,                   // IP
  /[\w.+-]+@[\w.-]+\.\w+/,                          // 邮箱
  /\b\d{15,19}\b/,                                  // B 站 UID / 长 ID
  /SESSDATA|bili_jct|refresh_token|access_token|api[_-]?key|password|passwd|Cookie|csrf|buvid/i,
  /token\s*[=:]\s*["']?[A-Za-z0-9_\-]{10,}/i,
  /\b\d+(?:\.\d+)?\s*(?:核|G内存|GB内存|Mi|GiB|G磁盘|GB磁盘|核CPU)/i,
  /load average|free -h|内存只剩|可用内存|磁盘只剩/i,
  /阿里云|腾讯云|华为云|AWS|ecs-|iZbp|instance-id/i,  // 云厂商 / 主机名
  /121\.41\./,
  /gho_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|ask_[A-Za-z0-9]{20,}/,
];

const isSensitive = (s) => SENSITIVE.some((re) => re.test(s));

/** 按 ## 段落切，丢掉含敏感内容的整段 */
function filterDiary(raw) {
  const parts = String(raw).split(/\n(?=##\s)/);
  const keep = [];
  let dropped = 0;
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    // 第一行是文件标题（# YYYY-MM-DD），没有信息量但也没风险
    if (t.startsWith("# 20") && t.split("\n").length === 1) continue;
    if (isSensitive(t)) {
      dropped += 1;
      continue;
    }
    keep.push(t);
  }
  return { text: keep.join("\n\n"), kept: keep.length, dropped };
}

// ── HTTP ──────────────────────────────────────────────
function token() {
  try {
    const t = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    if (!/^[0-9a-f]{32,64}$/i.test(t)) throw new Error("格式不对");
    return t;
  } catch (e) {
    console.error(`❌ 读不到 OpenI AK（${TOKEN_FILE}）：${e.message}`);
    process.exit(2);
  }
}

async function call(tok, pathname, { method = "GET", body } = {}) {
  const r = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `token ${tok}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": UA,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  const t = await r.text();
  let j = {};
  try { j = JSON.parse(t); } catch {}
  return { status: r.status, data: j, raw: t };
}

// ── 状态文件 ──────────────────────────────────────────
const today = () => new Date().toLocaleDateString("sv-SE");
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n");
}

// ── 内容准备 ──────────────────────────────────────────
function prepareContent() {
  const day = today();
  const pub = path.join(PUBLIC_DIR, `${day}.md`);
  const pri = path.join(DIARY_DIR, `${day}.md`);

  if (fs.existsSync(pub)) {
    const raw = fs.readFileSync(pub, "utf8");
    if (isSensitive(raw)) {
      return { ok: false, why: "公开版笔记里仍然含敏感内容，整篇不发", source: pub, hits: SENSITIVE.filter((r) => r.test(raw)).length };
    }
    return { ok: true, text: raw.trim(), source: "public", file: pub };
  }

  if (!fs.existsSync(pri)) {
    return { ok: false, why: `今天没有日记（${pri}），也没有公开版（${pub}）` };
  }
  const raw = fs.readFileSync(pri, "utf8");
  const f = filterDiary(raw);
  if (f.text.length < MIN_CHARS) {
    return { ok: false, why: `过滤后只剩 ${f.text.length} 字（丢弃 ${f.dropped} 段），少于 ${MIN_CHARS} 字，不发`, source: "filtered" };
  }
  if (isSensitive(f.text)) {
    return { ok: false, why: "过滤后仍检出敏感内容，整篇不发", source: "filtered", hits: SENSITIVE.filter((r) => r.test(f.text)).length };
  }
  const header = [
    `# ${day} · 工程笔记`,
    "",
    "> 从当天的日记里摘出可以公开的部分自动同步。涉及运行环境、凭据、",
    "> 具体账号和宿主机规格的段落已整段移除，不是删改，是没选进来。",
    "",
  ].join("\n");
  return { ok: true, text: header + f.text, source: "filtered", kept: f.kept, dropped: f.dropped, file: pri };
}

// ── 命令 ──────────────────────────────────────────────
async function cmdStatus() {
  const tok = token();
  const hasToken = true;
  const me = await call(tok, "/user");
  const login = me.data?.login || "";
  const repo = await call(tok, `/repos/${login}/${REPO_NAME}`);
  const st = loadState();
  const c = prepareContent();
  console.log(JSON.stringify({
    token: hasToken ? `已配置（${tok.length} 位）` : "缺失",
    user: login || `失败 HTTP ${me.status}`,
    repo: repo.status === 200 ? `${login}/${REPO_NAME}（public, ${repo.data.default_branch}）` : `不存在 HTTP ${repo.status}`,
    today: today(),
    pushedToday: st[today()]?.pushed || false,
    lastPush: st.last || null,
    content: c.ok
      ? { ready: true, source: c.source, chars: c.text.length, kept: c.kept, dropped: c.dropped }
      : { ready: false, why: c.why },
  }, null, 2));
  process.exit(repo.status === 200 ? 0 : 1);
}

async function cmdInit() {
  const tok = token();
  const me = await call(tok, "/user");
  const login = me.data?.login;
  if (!login) { console.error(`❌ 拿不到用户：HTTP ${me.status} ${me.raw.slice(0, 120)}`); process.exit(1); }
  let repo = await call(tok, `/repos/${login}/${REPO_NAME}`);
  if (repo.status === 200) {
    console.log(`✅ 仓库已存在：${repo.data.full_name}（${repo.data.default_branch}）`);
    process.exit(0);
  }
  repo = await call(tok, "/user/repos", {
    method: "POST",
    body: {
      name: REPO_NAME,
      description: "Anthropos 的每日工程笔记——从她自己的日记摘出可公开的部分，如实记录，不灌水。",
      private: false,
      auto_init: true,
    },
  });
  if (repo.status >= 300) {
    console.error(`❌ 创建失败 HTTP ${repo.status} ${repo.raw.slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`✅ 已创建 ${repo.data.full_name}`);
}

/**
 * 真正落地走 git，不走 contents REST API。
 * 原因一：OpenI 的 PUT /contents 实测 422「SHA Required」，跟标准 Gitea 行为不一样。
 * 原因二：积分规则里「每日 commit」认的是 git commit，git 通道本来就是已验证的那条路。
 */
function git(tok, args, cwd) {
  try {
    const out = execFileSync("git", args, {
      encoding: "utf8",
      timeout: 120_000,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { ok: true, out: String(out || "").trim() };
  } catch (e) {
    const raw = String(e.stderr || e.message || "");
    return { ok: false, err: raw.split(tok).join("<REDACTED>").trim().slice(0, 400) };
  }
}

async function cmdRun() {
  const tok = token();
  const st = loadState();
  if (st[today()]?.pushed && !DRY) {
    console.log(`（今天已经推过了：${st[today()].commit}）`);
    process.exit(0);
  }

  const c = prepareContent();
  if (!c.ok) {
    console.log(JSON.stringify({ ok: false, why: c.why }));
    saveState({ ...st, last: { at: new Date().toISOString(), ok: false, why: c.why } });
    process.exit(3);
  }

  const preview = c.text.slice(0, 420).replace(/\n/g, " / ");
  if (DRY) {
    console.log(JSON.stringify({
      dry: true, source: c.source, chars: c.text.length,
      kept: c.kept, dropped: c.dropped,
      preview,
    }, null, 2));
    process.exit(0);
  }

  const me = await call(tok, "/user");
  const login = me.data?.login;
  if (!login) { console.error(`❌ 拿不到 OpenI 用户：HTTP ${me.status}`); process.exit(1); }

  let repo = await call(tok, `/repos/${login}/${REPO_NAME}`);
  if (repo.status !== 200) {
    repo = await call(tok, "/user/repos", {
      method: "POST",
      body: { name: REPO_NAME, description: "Anthropos 的每日工程笔记", private: false, auto_init: true },
    });
    if (repo.status >= 300) {
      console.error(`❌ 建仓失败 HTTP ${repo.status} ${repo.raw.slice(0, 160)}`);
      process.exit(1);
    }
  }
  const branch = repo.data?.default_branch || "master";
  const filepath = `daily/${today()}.md`;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "openi-notes-"));
  const url = `https://${login}:${tok}@openi.pcl.ac.cn/${login}/${REPO_NAME}.git`;
  let ok = false;
  let why = "";
  let commit = "";
  let changes = 0;

  try {
    let r = git(tok, ["clone", "-q", "--depth", "1", url, tmp]);
    if (!r.ok) throw new Error(`clone 失败：${r.err}`);

    // 作者信息不能带真实邮箱，公开仓库会留一辈子
    git(tok, ["-C", tmp, "config", "user.name", "Anthropos"]);
    git(tok, ["-C", tmp, "config", "user.email", `${login}@openi.pcl.ac.cn`]);

    const dest = path.join(tmp, "daily");
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(tmp, filepath), c.text, "utf8");

    const status = git(tok, ["-C", tmp, "status", "--porcelain"]);
    changes = status.out ? status.out.split("\n").filter(Boolean).length : 0;

    if (changes === 0) {
      ok = true;                       // 内容没变，不制造空 commit（刷分红线）
      why = "内容没有变化，跳过 commit";
    } else {
      r = git(tok, ["-C", tmp, "add", "-A"]);
      if (!r.ok) throw new Error(`git add 失败：${r.err}`);
      r = git(tok, ["-C", tmp, "commit", "-q",
        "-m", `notes: ${today()} 的工程笔记（${c.text.length} 字，来自她自己的日记）`]);
      if (!r.ok) throw new Error(`git commit 失败：${r.err}`);
      r = git(tok, ["-C", tmp, "push", "-q", "origin", `HEAD:${branch}`]);
      if (!r.ok) throw new Error(`git push 失败：${r.err}`);
      const head = git(tok, ["-C", tmp, "rev-parse", "HEAD"]);
      commit = head.ok ? head.out.slice(0, 12) : "";
      ok = true;
    }
  } catch (e) {
    why = String(e.message).split(tok).join("<REDACTED>").slice(0, 300);
    ok = false;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const next = {
    ...st,
    [today()]: { pushed: ok, at: new Date().toISOString(), source: c.source, chars: c.text.length, commit, path: filepath, changes },
    last: { at: new Date().toISOString(), ok, why },
  };
  saveState(next);

  console.log(JSON.stringify({
    ok,
    repo: `${login}/${REPO_NAME}`,
    path: filepath,
    source: c.source,
    chars: c.text.length,
    kept: c.kept,
    dropped: c.dropped,
    changes,
    commit,
    why,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

if (cmd === "status") await cmdStatus();
else if (cmd === "init") await cmdInit();
else if (cmd === "run") await cmdRun();
else {
  console.error("用法: node openi-daily.mjs [status|init|run] [--dry]");
  process.exit(2);
}
