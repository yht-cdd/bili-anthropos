#!/usr/bin/env node
/**
 * video-project.mjs —— 视频项目的工作台：一个项目一个目录，支持跨轮续做
 * ============================================================
 * 为什么需要它：
 *   一条交付级别的视频，30 分钟做不完。但子代理单轮只有 30 分钟
 *   （再长会被掐断，成果全丢）。所以必须把「做到哪了」落盘，
 *   下一轮醒来接着干，而不是每次从零开始。
 *
 * 目录结构：
 *   /opt/life/videoproj/<slug>/
 *     ├─ brief.md      主模型写的详细规格（对标示范目录那种精细度）
 *     ├─ state.json    阶段 / 历史 / 卡点
 *     ├─ progress.md   每轮做了什么（给下一轮看的）
 *     ├─ src/          子代理写的 Remotion 代码
 *     └─ out/          渲染产物
 *
 * 阶段：
 *   new → brief → code → render → publish → done
 *
 * 用法：
 *   node video-project.mjs new --slug ai-news-1031 --title "标题" [--brief-file x.md]
 *   node video-project.mjs list                 # 所有项目 + 阶段
 *   node video-project.mjs status <slug>
 *   node video-project.mjs next                 # 最该做的那一件 + 该干什么
 *   node video-project.mjs stage <slug> <阶段>
 *   node video-project.mjs note <slug> "这一轮做了什么"
 *   node video-project.mjs brief <slug>         # 打印规格
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const ROOT = path.join(HOME, "videoproj");

const STAGES = ["new", "brief", "code", "render", "publish", "done"];
const STAGE_LABEL = {
  new: "还没写规格",
  brief: "规格写好了，等写代码",
  code: "写代码中（通常要多轮）",
  render: "代码好了，等渲染",
  publish: "渲染好了，等投稿",
  done: "完成",
};

const argv = process.argv.slice(2);
const cmd = argv[0] || "list";
const opt = {};
const pos = [];
for (let i = 1; i < argv.length; i += 1) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[a.slice(2)] = true;
    else {
      opt[a.slice(2)] = v;
      i += 1;
    }
  } else pos.push(a);
}

const nowIso = () => new Date().toISOString();
const slugOk = (s) => /^[a-z0-9][a-z0-9-]{1,60}$/.test(s);

function dirOf(slug) {
  return path.join(ROOT, slug);
}

function readState(slug) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dirOf(slug), "state.json"), "utf8"));
  } catch {
    return null;
  }
}

function writeState(slug, st) {
  fs.mkdirSync(dirOf(slug), { recursive: true });
  fs.writeFileSync(path.join(dirOf(slug), "state.json"), JSON.stringify(st, null, 2) + "\n");
}

function allProjects() {
  if (!fs.existsSync(ROOT)) return [];
  return fs
    .readdirSync(ROOT)
    .filter((d) => fs.statSync(path.join(ROOT, d)).isDirectory())
    .map((slug) => ({ slug, state: readState(slug) }))
    .filter((p) => p.state);
}

// ── new ───────────────────────────────────────────────
if (cmd === "new") {
  const slug = String(opt.slug || "").trim();
  if (!slugOk(slug)) {
    console.error("❌ --slug 只能是小写字母/数字/连字符，2-61 位，例如 ai-news-1031");
    process.exit(2);
  }
  if (readState(slug)) {
    console.error(`❌ 项目已存在：${slug}`);
    process.exit(2);
  }
  const st = {
    slug,
    title: String(opt.title || slug),
    stage: "new",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    history: [{ at: nowIso(), event: "created" }],
    rounds: 0,
    note: "",
  };
  writeState(slug, st);
  fs.mkdirSync(path.join(dirOf(slug), "src"), { recursive: true });
  fs.mkdirSync(path.join(dirOf(slug), "out"), { recursive: true });
  if (opt["brief-file"]) {
    const src = String(opt["brief-file"]);
    if (!fs.existsSync(src)) {
      console.error(`❌ 找不到 ${src}`);
      process.exit(2);
    }
    fs.copyFileSync(src, path.join(dirOf(slug), "brief.md"));
    st.stage = "brief";
    st.history.push({ at: nowIso(), event: "brief attached" });
    writeState(slug, st);
  }
  console.log(`✅ 建好 ${dirOf(slug)}  阶段=${st.stage}`);
  process.exit(0);
}

// ── list ──────────────────────────────────────────────
if (cmd === "list") {
  const ps = allProjects().sort((a, b) => String(a.state.updatedAt).localeCompare(String(b.state.updatedAt)));
  if (!ps.length) {
    console.log("（还没有项目）");
    process.exit(0);
  }
  console.log("阶段      轮次  更新时间            slug / 标题");
  console.log("─".repeat(78));
  for (const { slug, state } of ps) {
    const at = String(state.updatedAt || "").slice(5, 16).replace("T", " ");
    console.log(
      `${(state.stage || "?").padEnd(8)}  ${String(state.rounds || 0).padStart(2)}    ${at}   ${slug}  ${String(state.title).slice(0, 30)}`
    );
  }
  process.exit(0);
}

// ── status ────────────────────────────────────────────
if (cmd === "status") {
  const slug = pos[0];
  const st = readState(slug);
  if (!st) {
    console.error(`❌ 没有这个项目：${slug}`);
    process.exit(2);
  }
  const d = dirOf(slug);
  console.log(`项目   : ${st.slug}`);
  console.log(`标题   : ${st.title}`);
  console.log(`阶段   : ${st.stage} —— ${STAGE_LABEL[st.stage] || "?"}`);
  console.log(`轮次   : ${st.rounds || 0}`);
  console.log(`创建   : ${st.createdAt}`);
  console.log(`更新   : ${st.updatedAt}`);
  if (st.note) console.log(`备注   : ${st.note}`);
  console.log(`目录   : ${d}`);
  for (const f of ["brief.md", "progress.md"]) {
    const p = path.join(d, f);
    if (fs.existsSync(p)) console.log(`  ${f}  ${fs.statSync(p).size} 字节`);
  }
  const srcDir = path.join(d, "src");
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir, { recursive: true }).filter((f) => /\.(tsx?|jsx?|css)$/.test(String(f)));
    console.log(`  src/  ${files.length} 个源码文件`);
  }
  if (st.history?.length) {
    console.log(`\n最近 5 条历史：`);
    for (const h of st.history.slice(-5)) console.log(`  ${String(h.at).slice(5, 19).replace("T", " ")}  ${h.event}`);
  }
  process.exit(0);
}

// ── next：告诉调用方这一轮该干嘛 ──────────────────────
if (cmd === "next") {
  const ps = allProjects()
    .filter((p) => p.state.stage !== "done")
    .sort((a, b) => String(a.state.updatedAt).localeCompare(String(b.state.updatedAt)));

  if (!ps.length) {
    console.log(JSON.stringify({ todo: null, reason: "没有未完成的项目" }, null, 2));
    process.exit(0);
  }
  const { slug, state } = ps[0];
  const d = dirOf(slug);
  const hasBrief = fs.existsSync(path.join(d, "brief.md"));
  const srcDir = path.join(d, "src");
  const srcCount = fs.existsSync(srcDir)
    ? fs.readdirSync(srcDir, { recursive: true }).filter((f) => /\.(tsx?|jsx?)$/.test(String(f))).length
    : 0;
  const hasOut = fs.existsSync(path.join(d, "out")) && fs.readdirSync(path.join(d, "out")).some((f) => f.endsWith(".mp4"));

  const action = {
    new: hasBrief ? "写规格（brief.md 还没有）" : "先写规格",
    brief: "按 brief.md 写 Remotion 代码到 src/",
    code: srcCount ? "继续写代码（上一轮没写完）" : "开始写代码",
    render: "触发渲染（render-video.mjs 或 GitHub Actions）",
    publish: "投稿（bili-upload.mjs --publish）",
  }[state.stage] || "看 status";

  console.log(
    JSON.stringify(
      {
        todo: slug,
        title: state.title,
        stage: state.stage,
        stageLabel: STAGE_LABEL[state.stage],
        action,
        rounds: state.rounds || 0,
        dir: d,
        hasBrief,
        srcFiles: srcCount,
        hasRendered: hasOut,
        note: state.note || "",
        hint:
          state.stage === "code"
            ? "这是最容易跨轮的一步。先读 progress.md 看上一轮停在哪，别重写已经写好的文件。"
            : state.stage === "new" || state.stage === "brief"
              ? "规格要写到能直接照着写代码，别写成大纲。"
              : "",
      },
      null,
      2
    )
  );
  process.exit(0);
}

// ── stage ─────────────────────────────────────────────
if (cmd === "stage") {
  const slug = pos[0];
  const to = pos[1];
  const st = readState(slug);
  if (!st) {
    console.error(`❌ 没有这个项目：${slug}`);
    process.exit(2);
  }
  if (!STAGES.includes(to)) {
    console.error(`❌ 阶段只能是：${STAGES.join(" / ")}`);
    process.exit(2);
  }
  st.stage = to;
  st.updatedAt = nowIso();
  st.history = [...(st.history || []), { at: nowIso(), event: `stage → ${to}` }].slice(-50);
  writeState(slug, st);
  console.log(`✅ ${slug}: ${to}（${STAGE_LABEL[to]}）`);
  process.exit(0);
}

// ── note：每轮结束写一条，下一轮靠它接上 ──────────────
if (cmd === "note") {
  const slug = pos[0];
  const text = pos.slice(1).join(" ");
  const st = readState(slug);
  if (!st) {
    console.error(`❌ 没有这个项目：${slug}`);
    process.exit(2);
  }
  if (!text.trim()) {
    console.error("用法: node video-project.mjs note <slug> \"这一轮做了什么 / 卡在哪\"");
    process.exit(2);
  }
  st.rounds = (st.rounds || 0) + 1;
  st.updatedAt = nowIso();
  st.note = text.slice(0, 300);
  st.history = [...(st.history || []), { at: nowIso(), event: `round ${st.rounds}: ${text.slice(0, 120)}` }].slice(-50);
  writeState(slug, st);

  const p = path.join(dirOf(slug), "progress.md");
  const head = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : `# ${st.title} · 进度\n\n`;
  fs.writeFileSync(p, head + `## 第 ${st.rounds} 轮 · ${new Date().toLocaleString("zh-CN")}\n\n${text}\n\n`);
  console.log(`✅ 第 ${st.rounds} 轮已记（stage=${st.stage}）`);
  process.exit(0);
}

// ── brief ─────────────────────────────────────────────
if (cmd === "brief") {
  const slug = pos[0];
  const p = path.join(dirOf(slug), "brief.md");
  if (!fs.existsSync(p)) {
    console.error(`❌ ${slug} 还没有 brief.md`);
    process.exit(2);
  }
  console.log(fs.readFileSync(p, "utf8"));
  process.exit(0);
}

console.error(`用法：
  node video-project.mjs new --slug ai-news-1031 --title "标题" [--brief-file x.md]
  node video-project.mjs list
  node video-project.mjs status <slug>
  node video-project.mjs next
  node video-project.mjs stage <slug> <${STAGES.join("|")}>
  node video-project.mjs note <slug> "这一轮做了什么"
  node video-project.mjs brief <slug>`);
process.exit(1);
