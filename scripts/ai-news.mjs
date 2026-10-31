#!/usr/bin/env node
/**
 * ai-news.mjs —— 每天搜一遍 AI 圈的动静，给人看也能给模型看
 * ============================================================
 * 为什么要有它：
 *   她要「自己选题」，但选题不能靠凭空想。得先知道今天发生了什么。
 *   这个脚本用 EXA 搜四类东西，合成一份摘要：谁发了新模型、GitHub 上有什么新项目、
 *   有没有值得转述的教程、行业里有没有大变化。
 *
 * 用法：
 *   node ai-news.mjs                      # 搜最近 24 小时
 *   node ai-news.mjs --hours 48           # 搜两天
 *   node ai-news.mjs --json               # 只要结构化结果
 *   node ai-news.mjs --out /opt/life/knowledge/news/2026-10-31.md
 *
 * 凭据：secrets/exa_key.txt（或环境变量 EXA_API_KEY）
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const KEY_FILE = path.join(HOME, "secrets/exa_key.txt");
const NEWS_DIR = path.join(HOME, "knowledge/news");

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

const log = (...a) => console.error(...a);

function key() {
  const env = String(process.env.EXA_API_KEY || "").trim();
  if (env) return env;
  try {
    return fs.readFileSync(KEY_FILE, "utf8").trim();
  } catch {
    console.error(`❌ 没有 EXA key（${KEY_FILE} 或环境变量 EXA_API_KEY）`);
    process.exit(2);
  }
}

const KEY = key();
const HOURS = Number(opt.hours || 48);

// 四类查询。
// 关键：加 category。不加的话 neural 搜索会捞回一堆学术论文和新闻稿，
// 而我们要的是「哪个厂商发了新模型」「GitHub 上有什么新项目」。
const QUERIES = [
  {
    key: "models",
    label: "厂商发布 / 新模型",
    q: "Anthropic OpenAI Google Meta xAI releases new model announcement",
    n: 6,
  },
  {
    key: "models2",
    label: "开源模型 / 权重",
    q: "new open weights model released huggingface DeepSeek Qwen Kimi",
    n: 6,
  },
  {
    key: "repos",
    label: "GitHub 新项目",
    q: "open source AI agent framework LLM tool new repository",
    category: "github",
    n: 8,
  },
  {
    key: "tutorials",
    label: "实用教程 / 工程实践",
    q: "AI agent tutorial how to build best practices production guide",
    n: 6,
  },
  {
    key: "industry",
    label: "行业变化",
    q: "AI industry news funding acquisition policy regulation big change",
    category: "news",
    n: 6,
  },
];

async function search(item) {
  const body = {
    query: item.q,
    type: "neural",
    // 取两倍，后面本地按日期筛 + 去重
    numResults: item.n * 2,
    ...(item.category ? { category: item.category } : {}),
    // ⚠️ 不要用 startPublishedDate：AI 新闻源的 publishedDate 大量为空，
    //    服务端过滤会把结果砍到 0。改成拿回来自己筛。
    contents: { text: { maxCharacters: 1200 }, highlights: { numSentences: 3 } },
  };
  const r = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    log(`  ⚠️ ${item.label} 失败 HTTP ${r.status} ${t.slice(0, 120)}`);
    return [];
  }
  const j = await r.json();
  const cutoff = Date.now() - HOURS * 3600_000;
  return (j.results || [])
    .map((x) => {
      const published = String(x.publishedDate || "").slice(0, 10);
      const ts = published ? Date.parse(published) : 0;
      return {
        title: String(x.title || "").trim(),
        url: String(x.url || ""),
        published,
        ts,
        snippet: String(x.highlights?.join(" ") || x.text || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 400),
      };
    })
    // 有日期的必须在窗口内；没日期的留着（很多源不返回 publishedDate）
    .filter((x) => !x.ts || x.ts >= cutoff)
    .slice(0, item.n);
}

(async () => {
  const day = new Date().toLocaleDateString("sv-SE");
  log(`🔎 搜最近 ${HOURS} 小时的 AI 动态（${QUERIES.length} 类）`);

  const sections = [];
  for (const item of QUERIES) {
    log(`   ${item.label}…`);
    const results = await search(item);
    log(`   → ${results.length} 条`);
    sections.push({ ...item, results });
    await new Promise((r) => setTimeout(r, 400));
  }

  const total = sections.reduce((n, s) => n + s.results.length, 0);

  const out = {
    date: day,
    hours: HOURS,
    fetchedAt: new Date().toISOString(),
    total,
    sections: sections.map((s) => ({
      key: s.key,
      label: s.label,
      query: s.q,
      count: s.results.length,
      results: s.results,
    })),
  };

  // 写文件
  fs.mkdirSync(NEWS_DIR, { recursive: true });
  const jsonPath = path.join(NEWS_DIR, `${day}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));

  const md = [
    `# AI 动态 · ${day}`,
    ``,
    `> 最近 ${HOURS} 小时，共 ${total} 条。给选题用，不是新闻稿。`,
    ``,
    ...sections.flatMap((s) => [
      `## ${s.label}`,
      ``,
      ...(s.results.length
        ? s.results.map(
            (r) =>
              `- **[${r.title.slice(0, 70)}](${r.url})**${r.published ? ` · ${r.published}` : ""}\n  ${r.snippet.slice(0, 200)}`
          )
        : [`- （今天这类没有新东西）`]),
      ``,
    ]),
  ].join("\n");

  const mdPath = String(opt.out || path.join(NEWS_DIR, `${day}.md`));
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, md + "\n");

  if (opt.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(md);
    log(`\n📄 已存：${mdPath}`);
    log(`📄 结构化：${jsonPath}`);
  }
})();
