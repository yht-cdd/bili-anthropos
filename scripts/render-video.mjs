#!/usr/bin/env node
/**
 * render-video.mjs —— 把渲染丢给 GitHub Actions，跑完把片子取回来
 * ============================================================
 * 为什么不在她自己的机器上渲染：
 *   她的机器配置很低，Remotion 起一个 Chromium 就没了。渲染是「突发重活」，
 *   最适合按需租算力：GitHub Actions 的 ubuntu-latest 就是 4 vCPU / 16 GB，
 *   公开仓库每月 2000 分钟免费额度，一条 15 秒竖屏片大约 1–2 分钟。
 *
 * 流程：
 *   触发 workflow_dispatch → 轮询 run 状态 → 下载 artifact（zip）→ 解出 mp4
 *
 * 用法：
 *   node render-video.mjs --title "标题" [--subtitle "副标题"] [--seconds 15]
 *   node render-video.mjs --status            # 看最近一次渲染
 *   node render-video.mjs --title "..." --no-wait --out ~/video.mp4
 *
 * 凭据：环境变量 GH_TOKEN（需要 actions:write），或 $LIFE_HOME/secrets/github_token.txt
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const REPO = process.env.GITHUB_REPO || "yht-cdd/bili-anthropos";
const WORKFLOW = process.env.RENDER_WORKFLOW || "render.yml";
const API = "https://api.github.com";
const TOKEN_FILE = path.join(HOME, "secrets/github_token.txt");

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  }
}

function token() {
  const env = String(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
  if (env) return env;
  try { return fs.readFileSync(TOKEN_FILE, "utf8").trim(); } catch { return ""; }
}

async function gh(pathname, init = {}) {
  const t = token();
  if (!t) throw new Error(`没有 GitHub token（env GH_TOKEN 或 ${TOKEN_FILE}）`);
  const r = await fetch(API + pathname, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await r.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch {}
  if (r.status >= 300) throw new Error(`GitHub ${r.status}: ${text.slice(0, 200)}`);
  return j;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function latestRun() {
  const j = await gh(`/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`);
  return j?.workflow_runs?.[0] || null;
}

(async () => {
  if (opt.status) {
    const r = await latestRun();
    if (!r) { console.log("（还没有任何渲染记录）"); process.exit(0); }
    console.log(
      JSON.stringify(
        {
          run: r.id,
          status: r.status,
          conclusion: r.conclusion,
          created: r.created_at,
          url: r.html_url,
          branch: r.head_branch,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const title = String(opt.title || "").trim();
  if (!title && !opt.project) {
    console.error('用法: node render-video.mjs --title "标题" [--subtitle "..."] [--seconds 15] [--no-wait]');
    console.error('  或: node render-video.mjs --project <slug>   # 渲染 videoproj/<slug>/src 里的自定义工程');
    process.exit(2);
  }

  const inputs = {
    title: title || String(opt.project),
    subtitle: String(opt.subtitle || ""),
    kicker: String(opt.kicker || "ANTHROPOS"),
    accent: String(opt.accent || "#FF6B6B"),
    seconds: String(opt.seconds || 15),
    segments: "",
    project: "",
    // 只渲染一段：调试用，省得每次等整条片子
    frames: String(opt.frames || ""),
  };

  // ── 自定义工程：把 videoproj/<slug>/src 推到仓库再渲染 ──
  // 为什么走这一步：她那台机器不是 git 仓库，子代理写的代码没法直接
  // 出现在 GitHub Actions 的 checkout 里。所以用 Contents API 逐个文件推上去。
  if (opt.project) {
    const slug = String(opt.project);
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) {
      console.error(`❌ project 名不合法：${slug}`);
      process.exit(2);
    }
    const srcDir = opt["src-dir"] ? String(opt["src-dir"]) : path.join(HOME, "videoproj", slug, "src");
    if (!fs.existsSync(srcDir)) {
      console.error(`❌ 找不到源码目录：${srcDir}`);
      process.exit(2);
    }
    const files = fs.readdirSync(srcDir, { recursive: true })
      .map((f) => String(f).replace(/\\/g, "/"))
      .filter((f) => /\.(tsx?|jsx?|css|json)$/.test(f) && !f.includes("node_modules"));
    if (!files.length) {
      console.error(`❌ ${srcDir} 里没有可渲染的源码（.tsx/.ts/.css）`);
      process.exit(2);
    }
    console.log(`▶ 上传项目 ${slug}（${files.length} 个文件）→ video/projects/${slug}/src/`);
    for (const f of files) {
      const abs = path.join(srcDir, f);
      const content = fs.readFileSync(abs).toString("base64");
      const remote = `video/projects/${slug}/src/${f}`;
      // 先看有没有旧文件（更新要带 sha）
      let sha = "";
      try {
        const cur = await gh(`/repos/${REPO}/contents/${remote}`);
        sha = cur?.sha || "";
      } catch {}
      await gh(`/repos/${REPO}/contents/${remote}`, {
        method: "PUT",
        body: JSON.stringify({
          message: `video(${slug}): ${sha ? "update" : "add"} ${f}`,
          content,
          ...(sha ? { sha } : {}),
          branch: String(opt.ref || "main"),
        }),
      });
      console.log(`   ✓ ${f}`);
    }
    inputs.project = slug;
    // 自定义工程自己决定时长，这里只做兜底
    inputs.seconds = String(opt.seconds || 15);
  }

  // 有配音时间轴：视频场景严格按它的秒数切，渲染完再把音轨合上去
  let totalSeconds = Number(opt.seconds || 15);
  if (opt.timeline) {
    const tl = JSON.parse(fs.readFileSync(String(opt.timeline), "utf8"));
    const segs = (tl.segments || []).map((s) => ({
      index: s.index,
      text: String(s.text || "").slice(0, 90),
      from: Number(s.from),
      to: Number(s.to),
    }));
    if (!segs.length) { console.error("❌ timeline 里没有 segments"); process.exit(2); }
    totalSeconds = Number(segs[segs.length - 1].to);
    inputs.segments = JSON.stringify(segs);
    inputs.seconds = String(totalSeconds);
    console.log(`  按时间轴渲染：${segs.length} 段，共 ${totalSeconds}s`);
  }

  const t0 = Date.now();
  console.log(`▶ 触发渲染：${title}`);
  await gh(`/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: String(opt.ref || "main"), inputs }),
  });

  // 等一个「刚创建」的 run 出现（dispatch 是异步的，立刻查可能是旧的）
  let run = null;
  for (let i = 0; i < 20; i += 1) {
    await sleep(3000);
    const r = await latestRun();
    if (r && new Date(r.created_at).getTime() >= t0 - 5000) { run = r; break; }
  }
  if (!run) { console.error("❌ 没等到新的渲染任务，去 Actions 页面看看"); process.exit(1); }
  console.log(`   run ${run.id} → ${run.html_url}`);

  if (opt["no-wait"]) {
    console.log(JSON.stringify({ ok: true, run: run.id, url: run.html_url, waiting: false }));
    process.exit(0);
  }

  // 轮询到结束（上限 20 分钟）
  const deadline = Date.now() + 20 * 60_000;
  while (Date.now() < deadline) {
    await sleep(10_000);
    const r = await gh(`/repos/${REPO}/actions/runs/${run.id}`);
    process.stdout.write(`   状态 ${r.status}${r.conclusion ? " / " + r.conclusion : ""}\r`);
    if (r.status === "completed") {
      console.log("");
      if (r.conclusion !== "success") {
        console.error(`❌ 渲染失败：${r.conclusion} → ${r.html_url}`);
        process.exit(1);
      }
      run = r;
      break;
    }
  }

  // 取产物
  const arts = await gh(`/repos/${REPO}/actions/runs/${run.id}/artifacts`);
  const art = (arts?.artifacts || []).find((a) => a.name === "video");
  if (!art) { console.error("❌ 任务成功但没有 video 产物"); process.exit(1); }

  const out = path.resolve(String(opt.out || path.join(HOME, "tmp/video.mp4")));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const zip = `${out}.zip`;

  const t = token();
  const r = await fetch(art.archive_download_url, {
    headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json" },
    redirect: "follow",
    signal: AbortSignal.timeout(300_000),
  });
  if (!r.ok) { console.error(`❌ 下载产物失败 HTTP ${r.status}`); process.exit(1); }
  fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));

  try {
    // upload-artifact 会把文件摊平到压缩包根目录，路径就是 video.mp4
    execSync(`unzip -o -j "${zip}" video.mp4 -d "${path.dirname(out)}"`, { stdio: "pipe" });
    fs.renameSync(path.join(path.dirname(out), "video.mp4"), out);
  } catch (e) {
    console.error(`⚠️ 解压失败（zip 留在 ${zip}）：${String(e.message).split("\n")[0]}`);
    process.exit(1);
  } finally {
    try { fs.unlinkSync(zip); } catch {}
  }

  const size = fs.statSync(out).size;
  console.log(JSON.stringify({ ok: true, file: out, bytes: size, run: run.id, url: run.html_url }, null, 2));

  // 有配音就合进去：画面流直接复制，不动画质，只加音轨
  if (opt.audio) {
    const audio = path.resolve(String(opt.audio));
    if (!fs.existsSync(audio)) { console.error(`⚠️ 找不到音轨 ${audio}，视频保持无声`); process.exit(0); }
    const muxed = out.replace(/\.mp4$/, "") + "-with-audio.mp4";
    try {
      execSync(
        `ffmpeg -y -loglevel error -i "${out}" -i "${audio}" -c:v copy -c:a aac -b:a 192k -shortest "${muxed}"`,
        { timeout: 300_000 }
      );
      console.log(`🔊 已合入音轨：${muxed}（${(fs.statSync(muxed).size / 1024).toFixed(0)} KB）`);
    } catch (e) {
      console.error(`⚠️ 合音轨失败：${String(e.message).split("\n")[0]}`);
    }
  }
})();
