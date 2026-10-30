#!/usr/bin/env node
/**
 * openi-api.mjs —— OpenI 启智每日 API 任务（给子代理用的原子操作）
 * ============================================================
 * 定位：这是「手」，不是「脑」。
 *   · 脑（子代理）决定：发什么内容、发到哪、值不值得发
 *   · 手（本脚本）决定：能不能发、今天还剩几次、AK 怎么放
 *
 * 为什么要硬编码限额：
 *   OpenI 积分规则里一天能拿的分是有上限的（commit 3 / fork 3 / PR 3 /
 *   issue 3 / 评论 2）。而且它明令禁止「空评论、评论后删除、重复创建项目」，
 *   违规会被判积分舞弊、**倒扣全部积分**。
 *   把限额和反刷写在代码里，子代理想刷也刷不动 —— 这比写在提示词里可靠。
 *
 * 素材优先级（materials 子命令）：
 *   ① 夸克网盘的工程文档（主人每天上传）
 *   ② 本地 knowledge/projects/（邮件通道同步来的）
 *   ③ 自己的 GitHub 仓库 yht-cdd/bili-anthropos 的 docs/
 *   都没有就明说没有，别编。
 *
 * AK 由本脚本从 secrets/openi_token.txt 读，调用方（含子代理）全程不接触。
 *
 * 用法：
 *   node openi-api.mjs materials
 *   node openi-api.mjs status
 *   node openi-api.mjs search <关键词>
 *   node openi-api.mjs fork <owner/repo>
 *   node openi-api.mjs issue <owner/repo> --title "标题" --body-file 文件
 *   node openi-api.mjs comment <owner/repo> --number 12 --body-file 文件
 *   node openi-api.mjs pr <owner/repo> --title "标题" --body-file 文件 --head 分支
 *   node openi-api.mjs commit <owner/repo> --path 路径 --content-file 文件 --message "…"
 *
 * 退出码：0 成功 / 1 失败 / 2 参数错 / 3 今日额度用尽或触发反刷
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const TOKEN_FILE = path.join(HOME, "secrets/openi_token.txt");
const GH_TOKEN_FILE = path.join(HOME, "secrets/github_token.txt");
const QUARK_CLI = path.join(HOME, "skills/quarkclouddrive/scripts/quark-drive.cjs");
const LOCAL_DOCS = path.join(HOME, "knowledge/projects");
const STATE_FILE = path.join(HOME, "bili/data/openi_tasks.json");
const API = "https://openi.pcl.ac.cn/api/v1";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36";

// 每日上限（照 OpenI 积分规则，取满但不越界）
const LIMITS = { commit: 3, fork: 3, pr: 3, issue: 3, comment: 2 };
// 内容太短就是灌水，规则里明令禁止
const MIN_LEN = { issue: 60, comment: 30, pr: 60, commit: 40 };

const argv = process.argv.slice(2);
const cmd = argv[0] || "status";
const opt = {};
for (let i = 1; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  }
}

// ── 凭据 ──────────────────────────────────────────────
function token() {
  try {
    const t = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    if (!/^[0-9a-f]{32,64}$/i.test(t)) throw new Error("格式不对");
    return t;
  } catch (e) {
    console.error(`❌ 读不到 OpenI AK：${e.message}`);
    process.exit(2);
  }
}
const TOK = token();

async function call(pathname, { method = "GET", body, timeoutMs = 25_000 } = {}) {
  const r = await fetch(`${API}${pathname}`, {
    method,
    headers: { Authorization: `token ${TOK}`, "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const t = await r.text();
  let j = {}; try { j = JSON.parse(t); } catch {}
  return { status: r.status, data: j, raw: t };
}

// ── 今日账本（限流 + 反刷）────────────────────────────
const today = () => new Date().toLocaleDateString("sv-SE");
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n");
}
function dayRec() {
  const s = loadState();
  return s[today()] || (s[today()] = { actions: [] });
}
function guard(kind, key = "") {
  const d = dayRec();
  const used = d.actions.filter((a) => a.kind === kind).length;
  if (used >= LIMITS[kind]) {
    return { ok: false, why: `今天 ${kind} 已做 ${used} 次，上限 ${LIMITS[kind]}` };
  }
  // 同一目标同一天不重复：防止「重复创建项目 / 对同一 issue 刷评论」
  if (d.actions.some((a) => a.kind === kind && a.key === key)) {
    return { ok: false, why: `今天已经对 ${key} 做过一次 ${kind}，不重复` };
  }
  return { ok: true, left: LIMITS[kind] - used };
}
function record(kind, key, extra = {}) {
  const s = loadState();
  const d = s[today()] || (s[today()] = { actions: [] });
  d.actions.push({ kind, key, at: new Date().toISOString(), ...extra });
  saveState(s);
}
function checkBody(kind, text) {
  const n = String(text || "").trim().length;
  if (n < (MIN_LEN[kind] || 30)) {
    return { ok: false, why: `${kind} 正文只有 ${n} 字，少于 ${MIN_LEN[kind]} 字 —— 这算灌水，规则会倒扣积分` };
  }
  return { ok: true, chars: n };
}

// ── 对外内容安全闸 ────────────────────────────────────
// 素材来自夸克工程文档 / 自己的 GitHub docs，是主人自己的东西，
// 但推到的是**公开仓库**。契约第六节禁止暴露运行环境，这里一律挡住。
const UNSAFE = [
  /\/opt\/life/i, /secrets\//i, /\broot@/, /\b\d{1,3}(?:\.\d{1,3}){3}\b/,
  /[\w.+-]+@[\w.-]+\.\w+/, /\b\d{15,19}\b/,
  /SESSDATA|bili_jct|refresh_token|access_token|api[_-]?key|password|passwd|Cookie|csrf|buvid/i,
  /token\s*[=:]\s*["']?[A-Za-z0-9_\-]{10,}/i,
  /\b\d+(?:\.\d+)?\s*(?:核|G内存|GB内存|Mi|GiB|G磁盘|GB磁盘)/i,
  /load average|内存只剩|磁盘只剩/i,
  /阿里云|腾讯云|华为云|iZbp|ecs-/i, /121\.41\./,
  /gho_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|ask_[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{30,}/,
];
function assertSafe(text) {
  const hit = UNSAFE.find((re) => re.test(String(text)));
  if (hit) return { ok: false, why: `内容命中敏感规则 /${hit.source}/ —— 这是公开仓库，不发。先自己改掉再试。` };
  return { ok: true };
}

// ── 素材 ──────────────────────────────────────────────
function parseJsonl(out) {
  return String(out)
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("{"))
    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean);
}

function quarkBrowse(fid) {
  const out = execFileSync("node", [QUARK_CLI, "browse", "--all", "--page-size", "50", "--parent-fid", fid], {
    encoding: "utf8", timeout: 60_000, env: { ...process.env, OPENCLAW_CLI: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const rows = parseJsonl(out);
  if (!rows.length) throw new Error("夸克没返回数据");
  const bad = rows.find((r) => r.code !== 0);
  if (bad) throw new Error(`夸克返回 ${bad.code} ${bad.msg || ""}`);
  const list = [];
  for (const r of rows) for (const f of r.data?.file_list || []) list.push(f);
  return list;
}

function quarkMaterials() {
  try {
    // search 实测会返回服务端异常 / 空结果，browse 反而稳定。
    // 根目录 → 下钻一层文件夹 → 只看文档类文件。
    const root = quarkBrowse("0");
    const all = [];
    for (const item of root) {
      if (item.category === 0 || item.file_type === "0") {
        try { for (const f of quarkBrowse(item.fid)) all.push(f); } catch {}
      } else {
        all.push(item);
      }
    }
    const docs = all.filter((f) => /\.(md|txt|docx?|pdf|pptx?|xlsx?|csv|json|py|mjs|ts)$/i.test(f.filename || ""));
    return {
      ok: docs.length > 0,
      files: docs.slice(0, 30).map((f) => ({
        name: f.filename, fid: f.fid, size: f.size || 0,
        updated: f.updated_at ? new Date(Number(f.updated_at)).toLocaleDateString("sv-SE") : "",
      })),
      why: docs.length ? "" : `夸克根目录 ${root.length} 项、下钻后 ${all.length} 项，但没有可当素材的文档`,
      hint: "挑一个文件，用 node openi-api.mjs material <fid> 取正文",
    };
  } catch (e) {
    return { ok: false, why: `夸克不可用：${String(e.message).slice(0, 140)}` };
  }
}

function localMaterials() {
  try {
    const files = fs.readdirSync(LOCAL_DOCS).filter((f) => f.endsWith(".md"));
    return {
      ok: files.length > 0,
      files: files.slice(0, 20).map((f) => {
        const p = path.join(LOCAL_DOCS, f);
        const s = fs.statSync(p);
        const lines = fs.readFileSync(p, "utf8").split("\n");
        // 跳过 YAML frontmatter，找第一个真正的标题
        let head = f;
        for (const l of lines) {
          const t = l.trim();
          if (/^#{1,3}\s+/.test(t)) { head = t.replace(/^#+\s*/, ""); break; }
        }
        return { name: f, path: p, size: s.size, title: head.slice(0, 70) };
      }),
    };
  } catch (e) {
    return { ok: false, why: String(e.message) };
  }
}

async function githubMaterials() {
  try {
    const gt = fs.readFileSync(GH_TOKEN_FILE, "utf8").trim();
    const r = await fetch("https://api.github.com/repos/yht-cdd/bili-anthropos/contents/docs", {
      headers: { Authorization: `token ${gt}`, "User-Agent": "Anthropos", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(15_000),
    });
    const a = await r.json();
    if (!Array.isArray(a)) return { ok: false, why: `GitHub 返回 ${r.status}` };
    return {
      ok: true,
      files: a.filter((f) => f.type === "file").map((f) => ({
        name: f.name, path: `docs/${f.name}`, size: f.size,
        download_url: f.download_url,
      })),
      note: "这是她自己仓库里已公开的工程文档，可以直接摘取要点",
    };
  } catch (e) {
    return { ok: false, why: String(e.message) };
  }
}

async function cmdMaterials() {
  const [q, l, g] = [quarkMaterials(), localMaterials(), await githubMaterials()];
  const sources = [
    { source: "夸克工程文档", priority: 1, ...q },
    { source: "本地 knowledge/projects", priority: 2, ...l },
    { source: "自己的 GitHub docs/", priority: 3, ...g },
  ];
  console.log(JSON.stringify({
    today: today(),
    sources,
    hint: "按顺序取：夸克有就用夸克；没有就用本地；再没有用 GitHub 自己仓库的文档。三处都没有就跳过今天，不要编内容。",
  }, null, 2));
}

// ── 各动作 ────────────────────────────────────────────
async function me() {
  const r = await call("/user");
  if (!r.data?.login) throw new Error(`拿不到用户：HTTP ${r.status} ${r.raw.slice(0, 100)}`);
  return r.data.login;
}
function readBody() {
  const f = opt["body-file"] || opt["content-file"];
  if (!f) throw new Error("缺 --body-file / --content-file");
  if (!fs.existsSync(f)) throw new Error(`文件不存在：${f}`);
  const text = fs.readFileSync(f, "utf8");
  // 所有要发出去的内容统一过闸，不靠调用方自觉
  const safe = assertSafe(text);
  if (!safe.ok) throw new Error(safe.why);
  return text;
}

/** 下载夸克里的某份工程文档，把正文交给子代理当素材 */
async function cmdMaterial() {
  const fid = argv[1];
  if (!fid || fid.startsWith("--")) { console.error("用法: material <fid>"); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "quark-doc-"));
  try {
    execFileSync("node", [QUARK_CLI, "download", "--fid", fid, "--output-dir", tmp, "--overwrite"], {
      encoding: "utf8", timeout: 180_000, env: { ...process.env, OPENCLAW_CLI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const files = fs.readdirSync(tmp).filter((f) => fs.statSync(path.join(tmp, f)).isFile());
    if (!files.length) throw new Error("下载完成但目录里没有文件");
    const p = path.join(tmp, files[0]);
    const buf = fs.readFileSync(p);
    const name = files[0];
    if (!/\.(md|txt|json|csv|py|mjs|js|ts|ya?ml|log)$/i.test(name)) {
      console.log(JSON.stringify({ ok: false, name, size: buf.length, why: "不是纯文本格式，需要先转换；这版只直接读文本类文档" }, null, 2));
      process.exit(3);
    }
    const text = buf.toString("utf8");
    console.log(JSON.stringify({
      ok: true, name, size: buf.length, chars: text.length,
      text: text.slice(0, 12000),
      hint: "这是主人自己的工程文档。摘取要点时自己再过一遍：服务器规格 / 路径 / 凭据 / UID / 邮箱不能进公开仓库。",
    }, null, 2));
  } catch (e) {
    console.error(`❌ 取素材失败：${String(e.message).slice(0, 200)}`);
    process.exit(1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function cmdStatus() {
  const login = await me();
  const d = dayRec();
  const counts = {};
  for (const k of Object.keys(LIMITS)) counts[k] = { used: d.actions.filter((a) => a.kind === k).length, limit: LIMITS[k] };
  console.log(JSON.stringify({ user: login, today: today(), counts, actions: d.actions }, null, 2));
}

async function cmdSearch() {
  const q = argv[1];
  if (!q) { console.error("用法: search <关键词>"); process.exit(2); }
  const r = await call(`/repos/search?q=${encodeURIComponent(q)}&limit=15`);
  const a = Array.isArray(r.data?.data) ? r.data.data : (Array.isArray(r.data) ? r.data : []);
  console.log(JSON.stringify(a.slice(0, 15).map((x) => ({
    full_name: x.full_name, description: String(x.description || "").slice(0, 80),
    stars: x.stars_count, forks: x.forks_count, private: x.private,
  })), null, 2));
}

async function cmdFork() {
  const repo = argv[1];
  if (!repo || !repo.includes("/")) { console.error("用法: fork <owner/repo>"); process.exit(2); }
  const g = guard("fork", repo);
  if (!g.ok) { console.log(JSON.stringify({ ok: false, why: g.why })); process.exit(3); }
  const login = await me();
  const [owner, name] = repo.split("/");
  // fork 大项目服务端要拷贝，实测 25 秒会超时，单独放宽到 90 秒
  const r = await call(`/repos/${owner}/${name}/forks`, { method: "POST", body: {}, timeoutMs: 90_000 });
  // 第一次调用可能客户端先超时、服务端其实已经 fork 完了；
  // 再调会返回 500 "already forked" —— 那也算达成，不记账两次。
  const already = /already forked/i.test(r.raw);
  const ok = r.status === 202 || r.status === 201 || r.status === 200 || already;
  if (ok) record("fork", repo, { to: `${login}/${name}`, note: already ? "服务端此前已完成" : "" });
  console.log(JSON.stringify({ ok, http: r.status, repo: `${login}/${name}`, why: ok ? "" : r.raw.slice(0, 200) }, null, 2));
  process.exit(ok ? 0 : 1);
}

async function cmdIssue() {
  const repo = argv[1];
  const title = opt.title;
  if (!repo || !title) { console.error("用法: issue <owner/repo> --title 标题 --body-file 文件"); process.exit(2); }
  const body = readBody();
  const b = checkBody("issue", body);
  if (!b.ok) { console.log(JSON.stringify({ ok: false, why: b.why })); process.exit(3); }
  const g = guard("issue", `${repo}#${title}`);
  if (!g.ok) { console.log(JSON.stringify({ ok: false, why: g.why })); process.exit(3); }
  const r = await call(`/repos/${repo}/issues`, { method: "POST", body: { title, body } });
  const ok = r.status === 201 || r.status === 200;
  if (ok) record("issue", `${repo}#${title}`, { number: r.data?.number });
  console.log(JSON.stringify({ ok, http: r.status, number: r.data?.number, url: r.data?.html_url, chars: b.chars, why: ok ? "" : r.raw.slice(0, 200) }, null, 2));
  process.exit(ok ? 0 : 1);
}

async function cmdComment() {
  const repo = argv[1];
  const num = opt.number;
  if (!repo || !num) { console.error("用法: comment <owner/repo> --number N --body-file 文件"); process.exit(2); }
  const body = readBody();
  const b = checkBody("comment", body);
  if (!b.ok) { console.log(JSON.stringify({ ok: false, why: b.why })); process.exit(3); }
  const g = guard("comment", `${repo}#${num}`);
  if (!g.ok) { console.log(JSON.stringify({ ok: false, why: g.why })); process.exit(3); }
  const r = await call(`/repos/${repo}/issues/${num}/comments`, { method: "POST", body: { body } });
  const ok = r.status === 201 || r.status === 200;
  if (ok) record("comment", `${repo}#${num}`, { id: r.data?.id });
  console.log(JSON.stringify({ ok, http: r.status, id: r.data?.id, chars: b.chars, why: ok ? "" : r.raw.slice(0, 200) }, null, 2));
  process.exit(ok ? 0 : 1);
}

async function cmdPr() {
  const repo = argv[1];
  const title = opt.title;
  const head = opt.head;
  if (!repo || !title || !head) { console.error("用法: pr <owner/repo> --title 标题 --head 分支 --body-file 文件"); process.exit(2); }
  const body = readBody();
  const b = checkBody("pr", body);
  if (!b.ok) { console.log(JSON.stringify({ ok: false, why: b.why })); process.exit(3); }
  const g = guard("pr", `${repo}#${head}`);
  if (!g.ok) { console.log(JSON.stringify({ ok: false, why: g.why })); process.exit(3); }
  const r = await call(`/repos/${repo}/pulls`, { method: "POST", body: { title, body, head, base: opt.base || "master" } });
  const ok = r.status === 201 || r.status === 200;
  if (ok) record("pr", `${repo}#${head}`, { number: r.data?.number });
  console.log(JSON.stringify({ ok, http: r.status, number: r.data?.number, url: r.data?.html_url, chars: b.chars, why: ok ? "" : r.raw.slice(0, 200) }, null, 2));
  process.exit(ok ? 0 : 1);
}

/** 一次真实 commit：clone → 写文件 → commit → push。走 git，不碰 contents API。 */
async function cmdCommit() {
  const repo = argv[1] || `hfdryb/openi-notes`;
  const filepath = opt.path;
  const message = opt.message;
  if (!filepath || !message) { console.error("用法: commit <owner/repo> --path 路径 --content-file 文件 --message 说明"); process.exit(2); }
  const content = readBody();
  const b = checkBody("commit", content);
  if (!b.ok) { console.log(JSON.stringify({ ok: false, why: b.why })); process.exit(3); }
  const g = guard("commit", `${repo}#${filepath}`);
  if (!g.ok) { console.log(JSON.stringify({ ok: false, why: g.why })); process.exit(3); }
  const login = await me();
  const r0 = await call(`/repos/${repo}`);
  const branch = r0.data?.default_branch || "master";
  const url = `https://${login}:${TOK}@openi.pcl.ac.cn/${repo}.git`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "openi-task-"));

  function git(args) {
    try {
      return { ok: true, out: String(execFileSync("git", args, {
        encoding: "utf8", timeout: 120_000, cwd: tmp, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, stdio: ["ignore", "pipe", "pipe"],
      }) || "").trim() };
    } catch (e) {
      return { ok: false, err: String(e.stderr || e.message).split(TOK).join("<REDACTED>").slice(0, 300) };
    }
  }

  let ok = false, why = "", sha = "";
  try {
    let r = git(["clone", "-q", "--depth", "1", url, tmp]);
    if (!r.ok) throw new Error(`clone: ${r.err}`);
    git(["-C", tmp, "config", "user.name", "Anthropos"]);
    git(["-C", tmp, "config", "user.email", `${login}@openi.pcl.ac.cn`]);
    const dest = path.join(tmp, filepath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf8");
    const st = git(["-C", tmp, "status", "--porcelain"]);
    if (!st.out) {
      ok = true; why = "内容没变化，跳过 commit（不制造空提交）";
    } else {
      r = git(["-C", tmp, "add", "-A"]); if (!r.ok) throw new Error(`add: ${r.err}`);
      r = git(["-C", tmp, "commit", "-q", "-m", message]); if (!r.ok) throw new Error(`commit: ${r.err}`);
      r = git(["-C", tmp, "push", "-q", "origin", `HEAD:${branch}`]); if (!r.ok) throw new Error(`push: ${r.err}`);
      const h = git(["-C", tmp, "rev-parse", "HEAD"]);
      sha = h.ok ? h.out.slice(0, 12) : "";
      ok = true;
    }
  } catch (e) {
    why = String(e.message).slice(0, 300);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (ok && sha) record("commit", `${repo}#${filepath}`, { sha });
  console.log(JSON.stringify({ ok, repo, path: filepath, branch, chars: b.chars, sha, why }, null, 2));
  process.exit(ok ? 0 : 1);
}

// ── 入口 ──────────────────────────────────────────────
try {
  if (cmd === "materials") await cmdMaterials();
  else if (cmd === "material") await cmdMaterial();
  else if (cmd === "status") await cmdStatus();
  else if (cmd === "search") await cmdSearch();
  else if (cmd === "fork") await cmdFork();
  else if (cmd === "issue") await cmdIssue();
  else if (cmd === "comment") await cmdComment();
  else if (cmd === "pr") await cmdPr();
  else if (cmd === "commit") await cmdCommit();
  else {
    console.error("用法: node openi-api.mjs [materials|status|search|fork|issue|comment|pr|commit] …");
    process.exit(2);
  }
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
