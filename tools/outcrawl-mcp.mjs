/**
 * outcrawl-mcp.mjs —— 把 Outcrawl 的云端真实浏览器接成命令行工具
 *
 * 为什么需要它：
 *   容器里没有浏览器（chromium / playwright / selenium 全无），只有 curl。
 *   curl 拿到的 SPA 页面是 JS 空壳 —— 实测 x.com 返回 45KB HTML 但正文为空，
 *   而 Outcrawl 返回的是真渲染后的登录页。凡是「内容要等 JS 跑完才出现」的站点，
 *   curl 一律无效。这个脚本补的就是这一层。
 *
 * 它是什么：
 *   Outcrawl 是「真实 Chrome + 住宅 IP 出口 + 会话全程录制」的云端浏览器服务，
 *   通过 MCP（Streamable HTTP）暴露 30 个工具：抓取 / 搜索 / 全站爬 /
 *   浏览器代理执行 / 持久登录态 / 定时监控 / 会话回放。
 *
 * 额度：
 *   免费 1000 credits/月（未绑卡）。1 credit = 1 页 或 1 分钟浏览器。
 *   搜索 6 条 = 3 credits。每次响应都会回传本次花费。
 *
 * 怎么用：
 *   export OUT=...  或写 secrets/outcrawl_key.txt
 *   node tools/outcrawl-mcp.mjs tools                 # 列出全部工具
 *   node tools/outcrawl-mcp.mjs credits               # 查额度
 *   node tools/outcrawl-mcp.mjs scrape <url>          # 抓一页（Markdown）
 *   node tools/outcrawl-mcp.mjs scrape <url> --raw    # 强制实时渲染（不走缓存）
 *   node tools/outcrawl-mcp.mjs search "<query>"      # 搜索（含正文）
 *   node tools/outcrawl-mcp.mjs task "<自然语言任务>"      # 交给浏览器代理执行
 *   node tools/outcrawl-mcp.mjs call <tool> '<json>'  # 直接调任意 MCP 工具
 *
 * 安全红线：
 *   绝对不要把这个 key 提交进仓库，也绝对不要把 secrets/bili_cookie.txt
 *   交给它做 profile 登录态 —— 那等于把 B 站账号托管给第三方云浏览器，
 *   且住宅 IP 会让账号看起来在全球乱跳，极易触发风控封号。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENDPOINT = process.env.OUTCRAWL_URL || "https://api.outcrawl.ai/mcp";

/** 读 key：环境变量优先，其次 secrets 文件（600 权限，勿提交）。 */
function apiKey() {
  if (process.env.OUTCRAWL_API_KEY) return process.env.OUTCRAWL_API_KEY.trim();
  for (const p of [
    path.join(HERE, "..", "secrets", "outcrawl_key.txt"),
    path.join(process.env.LIFE_HOME || "/opt/life", "secrets", "outcrawl_key.txt"),
  ]) {
    try {
      const v = fs.readFileSync(p, "utf8").trim();
      if (v) return v;
    } catch {}
  }
  console.error(
    "❌ 没有 key。设 OUTCRAWL_API_KEY 环境变量，或写 secrets/outcrawl_key.txt（600 权限）"
  );
  process.exit(2);
}

let seq = 0;

/**
 * 一次 MCP tools/call。
 * 服务端可能回 JSON，也可能回 SSE（text/event-stream），两种都要认。
 */
async function callTool(name, args = {}, timeoutMs = 180_000) {
  const body = {
    jsonrpc: "2.0",
    id: ++seq,
    method: "tools/call",
    params: { name, arguments: args },
  };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 300)}`);
    return parseRpc(raw);
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`超时（${timeoutMs}ms）`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** 从 JSON 或 SSE 响应里取出 result/error，并摊平成文本。 */
function parseRpc(raw) {
  let text = raw.trim();
  if (text.startsWith("event:") || text.includes("\ndata:")) {
    const line = text.split("\n").find((l) => l.startsWith("data:"));
    if (line) text = line.slice(5).trim();
  }
  const msg = JSON.parse(text);
  if (msg.error) throw new Error(JSON.stringify(msg.error).slice(0, 400));
  const out = msg.result ?? {};
  const chunks = (out.content ?? []).map((c) => c.text ?? "").join("");
  return { text: chunks, isError: Boolean(out.isError) };
}

/**
 * Outcrawl 的返回形如：
 *   Usage: credits 1, cache HIT (...)
 *   { ...JSON... }
 * 第一行是计费说明，第二行起才是数据。这里拆开，两者都给调用方。
 */
function splitUsage(text) {
  if (!text.startsWith("Usage:")) return { usage: "", data: text };
  const nl = text.indexOf("\n");
  if (nl === -1) return { usage: text, data: "" };
  return { usage: text.slice(0, nl), data: text.slice(nl + 1) };
}

const [cmd, ...rest] = process.argv.slice(2);

const usage = `用法:
  node tools/outcrawl-mcp.mjs tools                    列出全部 MCP 工具
  node tools/outcrawl-mcp.mjs credits                  查免费额度
  node tools/outcrawl-mcp.mjs scrape <url> [--raw]     抓一页转 Markdown
  node tools/outcrawl-mcp.mjs search "<query>"         搜索（带回正文）
  node tools/outcrawl-mcp.mjs task "<任务>"            交给浏览器代理
  node tools/outcrawl-mcp.mjs call <tool> '<jsonArgs>' 调任意工具`;

try {
  if (!cmd || cmd === "-h" || cmd === "--help") {
    console.log(usage);
    process.exit(0);
  }

  if (cmd === "tools") {
    // tools/list 不走 tools/call，单独发一次
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++seq, method: "tools/list", params: {} }),
    });
    const raw = await res.text();
    let t = raw.trim();
    if (t.startsWith("event:") || t.includes("\ndata:")) {
      const l = t.split("\n").find((x) => x.startsWith("data:"));
      if (l) t = l.slice(5).trim();
    }
    const list = JSON.parse(t).result?.tools ?? [];
    console.log(`共 ${list.length} 个工具\n`);
    for (const x of list) {
      console.log(`● ${x.name}`);
      console.log(`  ${(x.description ?? "").replace(/\n/g, " ").slice(0, 160)}`);
    }
    process.exit(0);
  }

  if (cmd === "credits") {
    const { text } = await callTool("outcrawl_credits", {});
    console.log(splitUsage(text).data || text);
    process.exit(0);
  }

  if (cmd === "scrape") {
    const url = rest[0];
    if (!url) throw new Error("缺 URL");
    const raw = rest.includes("--raw");
    const { text } = await callTool("outcrawl_scrape", {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      ...(raw ? { maxAge: 0 } : {}),
    });
    const { usage: u, data } = splitUsage(text);
    const p = JSON.parse(data);
    console.error(u);
    console.log(p.markdown ?? data);
    process.exit(0);
  }

  if (cmd === "search") {
    const q = rest.join(" ");
    if (!q) throw new Error("缺 query");
    const { text } = await callTool("outcrawl_search", { query: q, limit: 6 });
    const { usage: u, data } = splitUsage(text);
    console.error(u);
    console.log(data);
    process.exit(0);
  }

  if (cmd === "task") {
    const task = rest.join(" ");
    if (!task) throw new Error("缺任务描述");
    // agent 立刻返回 runId，不阻塞；后续用 status/results 取结果
    const { text } = await callTool("outcrawl_agent", {
      task,
      caps: { budget: "2.00", steps: 40 },
    });
    console.log(text);
    process.exit(0);
  }

  if (cmd === "call") {
    const tool = rest[0];
    if (!tool) throw new Error("缺工具名");
    const args = rest[1] ? JSON.parse(rest[1]) : {};
    const { text } = await callTool(tool, args);
    const { usage: u, data } = splitUsage(text);
    if (u) console.error(u);
    console.log(data || text);
    process.exit(0);
  }

  console.error(`未知命令：${cmd}\n\n${usage}`);
  process.exit(2);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
