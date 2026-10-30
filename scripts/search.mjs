#!/usr/bin/env node
/**
 * search.mjs —— 联网检索（交叉验证用）
 * ============================================================
 * 为什么要有第二条搜索线：
 *   内置搜索会给出**看起来很像真的**假仓库、假链接。判断「某个项目/权重是否存在」时，
 *   单渠道结论一律不可信，必须两个渠道对上。
 *
 * 这个脚本不绑定供应商：地址、路径、鉴权头都写在 config/search-api.json。
 * 默认按 Exa 风格实现（/search、/contents、/findSimilar），换别家只改 buildSearchBody()。
 *
 * 用法：
 *   node search.mjs web "查询" [--n 10]
 *   node search.mjs contents <url> [<url>...]
 *   node search.mjs similar <url> [--n 10]
 *   node search.mjs check          # 只验证 key 能不能用
 *
 * 凭据：config 里的 keyFile，或环境变量 SEARCH_API_KEY
 * 退出码：0 成功 / 1 失败 / 2 配置错
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const CFG_FILE = process.env.SEARCH_CONFIG || path.join(HOME, "config/search-api.json");

let CFG = null;
try { CFG = JSON.parse(fs.readFileSync(CFG_FILE, "utf8")); } catch {}
if (!CFG) {
  console.error(`❌ 没有配置文件 ${CFG_FILE}\n   照 config/search-api.example.json 抄一份。`);
  process.exit(2);
}

const BASE = String(process.env.SEARCH_BASE || CFG.baseUrl || "").replace(/\/+$/, "");
const KEY_FILE = path.join(HOME, CFG.keyFile || "secrets/search_api_key.txt");
const AUTH_HEADER = String(CFG.authHeader || "x-api-key");

const argv = process.argv.slice(2);
const cmd = argv[0] || "";
const opt = {};
const pos = [];
for (let i = 1; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  } else pos.push(argv[i]);
}

function apiKey() {
  const env = String(process.env.SEARCH_API_KEY || "").trim();
  if (env) return env;
  try { return fs.readFileSync(KEY_FILE, "utf8").trim(); } catch { return ""; }
}
const KEY = apiKey();
if (!KEY) {
  console.error(`❌ 没有搜索 key。放到 ${KEY_FILE} 或设 SEARCH_API_KEY。`);
  process.exit(2);
}

/**
 * 发请求。
 * 为什么要留一条 curl 通道：这台机器上 Node 的 fetch 连不上某些 Cloudflare 站点
 * （DNS 只给 AAAA，Node 走 IPv6 直接失败，curl 的 Happy Eyeballs 能降级到 IPv4）。
 * 所以先试 fetch，失败再用 curl 兜一次 —— 不然「能搜」会变成「看网络运气」。
 */
function curlCall(pathname, body) {
  const tmp = path.join(os.tmpdir(), `search-body-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(body));
  try {
    const out = execSync(
      `curl -s --max-time 90 -X POST "${BASE}${pathname}" ` +
        `-H "${AUTH_HEADER}: ${KEY}" -H "Content-Type: application/json" -d @${JSON.stringify(tmp)}`,
      { encoding: "utf8", timeout: 100_000 }
    );
    return JSON.parse(out);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

async function call(pathname, body) {
  try {
    const r = await fetch(BASE + pathname, {
      method: "POST",
      headers: { [AUTH_HEADER]: KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const t = await r.text();
    if (r.status >= 300) throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
    return JSON.parse(t);
  } catch (e) {
    const msg = String(e.message || "");
    if (/HTTP \d/.test(msg)) throw e;          // 服务端明确报错，别再用 curl 重试
    return curlCall(pathname, body);
  }
}

/** 每次搜索都花钱（Exa 约 $0.007/次），记一笔 */
function recordCost(kind, query, cost) {
  try {
    const f = path.join(HOME, "bili/data/search_usage.jsonl");
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(
      f,
      JSON.stringify({ at: new Date().toISOString(), kind, query: String(query).slice(0, 100), usd: Number(cost || 0) }) + "\n"
    );
  } catch {}
}

/** 请求体形状集中在这里 —— 换供应商只改这个函数 */
function buildSearchBody(q, n) {
  return { query: q, numResults: Number(n), type: "auto" };
}

(async () => {
  try {
    if (cmd === "check") {
      const j = await call(CFG.searchPath || "/search", buildSearchBody("test", 1));
      const n = (j?.results || []).length;
      console.log(JSON.stringify({ ok: true, base: BASE, results: n }, null, 2));
      process.exit(0);
    }

    if (cmd === "web") {
      const q = pos.join(" ").trim();
      if (!q) { console.error('用法: node search.mjs web "查询" [--n 10]'); process.exit(2); }
      const j = await call(CFG.searchPath || "/search", buildSearchBody(q, opt.n || 8));
      recordCost("web", q, j?.costDollars?.total);
      const rows = (j?.results || []).map((x) => ({
        title: String(x.title || "").slice(0, 120),
        url: x.url || "",
        published: x.publishedDate || "",
        snippet: String(x.text || x.summary || "").replace(/\s+/g, " ").slice(0, 300),
      }));
      console.log(JSON.stringify({ ok: true, query: q, count: rows.length, results: rows }, null, 2));
      process.exit(0);
    }

    if (cmd === "contents") {
      if (!pos.length) { console.error("用法: node search.mjs contents <url> [<url>...]"); process.exit(2); }
      const j = await call(CFG.contentsPath || "/contents", { urls: pos, text: true });
      recordCost("contents", pos.join(" "), j?.costDollars?.total);
      const rows = (j?.results || []).map((x) => ({
        url: x.url || "",
        title: String(x.title || "").slice(0, 120),
        chars: String(x.text || "").length,
        text: String(x.text || "").slice(0, 4000),
      }));
      console.log(JSON.stringify({ ok: true, count: rows.length, pages: rows }, null, 2));
      process.exit(0);
    }

    if (cmd === "similar") {
      const url = pos[0] || "";
      if (!url) { console.error("用法: node search.mjs similar <url>"); process.exit(2); }
      const j = await call(CFG.similarPath || "/findSimilar", { url, numResults: Number(opt.n || 8) });
      recordCost("similar", url, j?.costDollars?.total);
      const rows = (j?.results || []).map((x) => ({ title: x.title || "", url: x.url || "" }));
      console.log(JSON.stringify({ ok: true, count: rows.length, results: rows }, null, 2));
      process.exit(0);
    }

    console.error("用法：node search.mjs <web|contents|similar|check> ...");
    process.exit(2);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
})();
