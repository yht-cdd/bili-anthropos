#!/usr/bin/env node
/**
 * pick-video.mjs —— 从 B 站今天的推荐里，挑出「最该看」的那几条
 * ============================================================
 * 光有 bili-feed 不够：它给的是全站热点，不是她该看的。
 * 她要的是「既能学到东西、又是主人关心的方向」。
 *
 * 三个信号加起来打分：
 *   ① AI / 技术相关      —— 标题、分区里出现模型、编程、Agent、芯片这些
 *   ② 主人关心的          —— 和 knowledge/projects/ 里的工程文档关键词重合
 *   ③ 热度                —— 播放量 + 出现在几个来源里
 *
 * 用法：
 *   node pick-video.mjs                # 给前 5 条 + 每条的理由
 *   node pick-video.mjs --n 3
 *   node pick-video.mjs --json
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const FEED_DIR = path.join(HOME, "knowledge/feed");
const PROJ_DIR = path.join(HOME, "knowledge/projects");
const NEWS_DIR = path.join(HOME, "knowledge/news");

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[a.slice(2)] = true;
    else { opt[a.slice(2)] = v; i += 1; }
  }
}
const N = Number(opt.n || 5);

// ── 读今天的候选 ──────────────────────────────────────
function latestFeed() {
  if (!fs.existsSync(FEED_DIR)) return null;
  const files = fs.readdirSync(FEED_DIR).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) return null;
  const p = path.join(FEED_DIR, files[files.length - 1]);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// ── 主人关心什么：从工程文档里提关键词 ────────────────
function ownerKeywords() {
  const counts = new Map();
  const stop = new Set([
    "这个","那个","什么","可以","没有","就是","因为","所以","但是","如果","然后",
    "现在","已经","一个","我们","他们","自己","时候","问题","方法","东西","不是",
    "需要","应该","可能","还是","这样","那样","或者","而且","不过","其实","于是",
    "脚本","文件","目录","数据","结果","测试","下面","上面","前面","后面","这里",
    // 这些在工程文档里高频，但在标题里毫无区分度 —— 会把随便一条视频都判成「撞主人方向」
    "视频","本地","服务","运行","命令","代码","配置","安装","端口","路径","内容",
    "api","node","npm","true","false","json","http","https","the","and","for","with",
  ]);
  try {
    for (const f of fs.readdirSync(PROJ_DIR)) {
      if (!f.endsWith(".md")) continue;
      const t = fs.readFileSync(path.join(PROJ_DIR, f), "utf8");
      // 中文 2-4 字词组 + 英文单词
      const zh = t.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
      const en = (t.match(/\b[A-Za-z][A-Za-z0-9.+#-]{2,20}\b/g) || []).map((x) => x.toLowerCase());
      for (const w of [...zh, ...en]) {
        if (stop.has(w)) continue;
        counts.set(w, (counts.get(w) || 0) + 1);
      }
    }
  } catch {}
  return [...counts.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 120)
    .map(([w]) => w);
}

// ── AI / 技术关键词 ──────────────────────────────────
const AI_WORDS = [
  "AI","人工智能","模型","大模型","LLM","GPT","Claude","DeepSeek","Qwen","Kimi",
  "Agent","智能体","编程","代码","程序员","开发者","开源","GitHub","算法",
  "训练","推理","微调","算力","GPU","芯片","英伟达","AMD","开源模型","提示词",
  "自动化","部署","服务器","API","本地部署","工作流","Copilot","生成式",
];

function score(v, kws, newsWords) {
  const hay = `${v.title} ${v.tname || ""} ${v.up || ""}`.toLowerCase();
  const reasons = [];
  let s = 0;

  // ① AI 相关
  const aiHit = AI_WORDS.filter((w) => hay.includes(w.toLowerCase()));
  if (aiHit.length) {
    s += Math.min(6, aiHit.length * 3);
    reasons.push(`AI/技术（${aiHit.slice(0, 3).join("、")}）`);
  }

  // ② 和主人的工程文档重合
  // ⚠️ 太短的词会误伤：之前 "The" 撞上 "The Weeknd"，"AI" 撞上任何带 AI 两字的标题。
  //    所以这里要求词长 ≥ 3（英文）或 ≥ 2（中文且不在通用词表里）。
  const projHit = kws
    .filter((w) => w.length >= 3 || /[\u4e00-\u9fa5]{2,}/.test(w))
    .filter((w) => hay.includes(w.toLowerCase()))
    .slice(0, 5);
  if (projHit.length) {
    s += Math.min(9, projHit.length * 3);
    reasons.push(`撞主人方向（${projHit.join("、")}）`);
  }

  // ③ 和今天的新闻撞
  let nHit = [];
  if (newsWords.length) {
    nHit = newsWords
      .filter((w) => w.length >= 3)   // 同样别让 "The" 这种词混进来
      .filter((w) => hay.includes(w.toLowerCase()))
      .slice(0, 3);
    if (nHit.length) {
      s += nHit.length * 2;
      reasons.push(`今天新闻里提到（${nHit.join("、")}）`);
    }
  }

  // ④ 热度（封顶，别让大热点压死一切）
  const heat = Math.min(3, Math.max(0, Math.log10(Math.max(1, v.view)) - 4));
  s += heat;
  if (v.view > 500_000) reasons.push(`${Math.round(v.view / 10000)}万播放`);

  // ⑤ 多来源命中
  if ((v.sources || []).length > 1) {
    s += 1;
    reasons.push(`多来源（${v.sources.join("+")}）`);
  }

  // ⑥ 时长惩罚：超过 20 分钟今天看不完
  if (v.min > 20) {
    s -= 4;
    reasons.push("偏长");
  }

  // ⑦ 硬闸：和 AI / 技术一点关系都没有的，直接砍半。
  //    主人要的是「AI 方面的」，不是「今天最热的」。
  //    不做这一步，一只野生动物的视频能靠播放量压过所有 AI 内容。
  if (!aiHit.length && !projHit.length && !nHit.length) {
    s *= 0.5;
    reasons.push("与 AI 无关（降权）");
  }

  return { s, reasons };
}

// ── 今天的新闻关键词 ─────────────────────────────────
const VAGUE_EN = new Set(["the","and","for","with","new","from","this","that","you","are","its","but","not","can","has","have"]);

function newsWords() {
  try {
    const files = fs.readdirSync(NEWS_DIR).filter((f) => f.endsWith(".md")).sort();
    if (!files.length) return [];
    const t = fs.readFileSync(path.join(NEWS_DIR, files[files.length - 1]), "utf8");
    const words = new Set();
    for (const w of AI_WORDS) if (t.includes(w)) words.add(w);
    // 从标题里抓专有名词（跳过 the/and 这类虚词）
    for (const m of t.match(/\b[A-Z][A-Za-z0-9]{2,15}\b/g) || []) {
      if (VAGUE_EN.has(m.toLowerCase())) continue;
      words.add(m);
    }
    return [...words].slice(0, 40);
  } catch {
    return [];
  }
}

// ── 主流程 ───────────────────────────────────────────
const feed = latestFeed();
if (!feed) {
  console.error("❌ 没有 B 站推荐数据。先跑 node scripts/bili-feed.mjs");
  process.exit(2);
}

const kws = ownerKeywords();
const nw = newsWords();

const ranked = (feed.items || [])
  .map((v) => {
    const { s, reasons } = score(v, kws, nw);
    return { ...v, score: Math.round(s * 10) / 10, reasons };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, N);

const out = {
  at: new Date().toISOString(),
  feedDate: feed.at,
  ownerKeywords: kws.slice(0, 20),
  picked: ranked,
};

if (opt.json) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`从 ${feed.items?.length || 0} 条候选里挑 ${ranked.length} 条`);
  console.log(`（主人方向关键词：${kws.slice(0, 12).join("、") || "（工程文档太少，提取不到）"}）\n`);
  ranked.forEach((v, i) => {
    console.log(`${i + 1}. [${v.score}分] ${v.bvid}  ${v.min}分  ${v.tname || "未分类"}`);
    console.log(`   ${v.title}`);
    console.log(`   UP: ${v.up}  ${Math.round(v.view / 10000)}万播放`);
    console.log(`   为什么：${v.reasons.length ? v.reasons.join(" · ") : "没什么特别的（纯热点）"}`);
    console.log();
  });
}
