#!/usr/bin/env node
/**
 * model-scout.mjs —— 自己探一遍「现在到底哪些模型能用」，并排出阶梯
 * ============================================================
 * 为什么要有它：
 *   模型阶梯写死在配置文件里，等于假设「环境不会变」。
 *   但 2026-10-31 一天之内就变了两回：opencode 免费额度耗尽、魔搭余额不足。
 *   写死的列表在变的那一天就全废了，而她还不知道自己脚下的地板没了。
 *
 * 它做什么：
 *   ① 读 opencode 配了哪些 provider / model（含 key）
 *   ② 逐个发一个极简请求探活（不建会话，直接打 provider 端点，几秒一个）
 *   ③ 按「可用性 → 工具调用 → 上下文 → 延迟」排序
 *   ④ 输出建议阶梯；--apply 才写回 config/agent-models.json
 *
 * 用法：
 *   node model-scout.mjs                # 只探活 + 给建议
 *   node model-scout.mjs --apply        # 探活 + 直接改配置
 *   node model-scout.mjs --json         # 结构化输出
 *   node model-scout.mjs --timeout 20   # 单个模型探测超时（秒）
 *
 * 注意：它只负责「谁活着、谁快、谁大」。哪个更适合干什么，
 * 还是要人来判断 —— 探活能测出「能不能用」，测不出「好不好用」。
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const OC_JSON = process.env.OC_JSON || "/root/.config/opencode/opencode.json";
const LADDER_FILE = path.join(HOME, "config/agent-models.json");
const CACHE_FILE = path.join(HOME, "bili/data/model-scout.json");

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
const TIMEOUT = Number(opt.timeout || 25) * 1000;
const log = (...a) => console.error(...a);

// ── 读配置 ────────────────────────────────────────────
function loadProviders() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(OC_JSON, "utf8"));
  } catch (e) {
    console.error(`❌ 读不到 ${OC_JSON}: ${e.message}`);
    process.exit(2);
  }
  const out = [];
  for (const [pid, p] of Object.entries(cfg.provider || {})) {
    const base = p.options?.baseURL || "";
    let key = p.options?.apiKey || "";
    // {env:XXX} → 从环境变量取
    const m = key.match(/^\{env:([A-Z0-9_]+)\}$/);
    if (m) key = String(process.env[m[1]] || "").trim();
    for (const [mid, mm] of Object.entries(p.models || {})) {
      out.push({
        providerID: pid,
        id: mid,
        name: mm.name || mid,
        base,
        key,
        context: Number(mm.limit?.context || 0),
        output: Number(mm.limit?.output || 0),
        toolCall: mm.tool_call !== false,
        reasoning: !!mm.reasoning,
      });
    }
  }
  return out;
}

// ── 探活：发一个极简请求，看它能不能回一个字 ────────────
async function probe(m) {
  if (!m.base || !m.key) return { ok: false, why: "缺 baseURL 或 key" };
  const t0 = Date.now();
  try {
    const r = await fetch(`${m.base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${m.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: m.id,
        messages: [{ role: "user", content: "只回一个字：好" }],
        max_tokens: 16,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const ms = Date.now() - t0;
    const txt = await r.text();
    let j = null;
    try { j = JSON.parse(txt); } catch {}

    if (r.status !== 200) {
      const msg = j?.error?.message || j?.message || txt.slice(0, 100);
      return { ok: false, ms, why: `HTTP ${r.status} ${String(msg).slice(0, 80)}` };
    }
    const ans = j?.choices?.[0]?.message?.content;
    if (!ans || !String(ans).trim()) {
      // 有的模型 max_tokens 太小时会空（全被推理吃掉），不算死
      return { ok: true, ms, why: "回了空（可能是推理吃掉了 max_tokens）", weak: true };
    }
    return { ok: true, ms, why: String(ans).trim().slice(0, 20) };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, why: String(e.message).split("\n")[0].slice(0, 80) };
  }
}

// ── 打分：能用第一，然后工具调用、上下文、速度 ──────────
function score(m) {
  if (!m.ok) return -1;
  let s = 100;
  s += m.toolCall ? 30 : 0;              // 子代理要跑命令，没工具调用基本没用
  s += Math.min(40, (m.context || 0) / 25000); // 上下文 1M 加满 40
  s += m.reasoning ? 10 : 0;
  s += Math.max(0, 20 - (m.ms || 0) / 1000);   // 越快越好，25 秒以上不加分
  if (m.weak) s -= 15;                    // 空回复扣分
  return Math.round(s * 10) / 10;
}

(async () => {
  const all = loadProviders();
  log(`发现 ${all.length} 个模型，开始探活（单个超时 ${TIMEOUT / 1000}s）\n`);

  const results = [];
  for (const m of all) {
    const r = await probe(m);
    const row = { ...m, ...r, score: 0 };
    row.score = score(row);
    results.push(row);
    const mark = row.ok ? (row.weak ? "△" : "✓") : "✗";
    log(`${mark} ${m.providerID}/${m.id}  ${m.ok ? (row.ms / 1000).toFixed(1) + "s" : r.why}`);
  }

  const alive = results.filter((r) => r.ok).sort((a, b) => b.score - a.score);
  const dead = results.filter((r) => !r.ok);

  log(`\n活着 ${alive.length} / 死的 ${dead.length}`);

  const ladder = alive.map((m) => ({
    providerID: m.providerID,
    id: m.id,
    label: `${m.name}${m.context ? `（${Math.round(m.context / 1000)}k）` : ""}`,
    free: true,
    _score: m.score,
  }));

  const out = {
    at: new Date().toISOString(),
    total: results.length,
    alive: alive.length,
    dead: dead.length,
    ladder,
    deadList: dead.map((d) => `${d.providerID}/${d.id}: ${d.why}`),
  };

  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(out, null, 2) + "\n");
  } catch {}

  if (opt.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(`\n=== 建议阶梯（按可用性 / 工具调用 / 上下文 / 速度排序）===\n`);
    ladder.forEach((m, i) => {
      const src = alive[i];
      console.log(`  ${i + 1}. ${m.providerID}/${m.id}`);
      console.log(`     ${m.label}  得分 ${m._score}  ${(src.ms / 1000).toFixed(1)}s  ${src.toolCall ? "能调工具" : "⚠️ 无工具调用"}`);
    });
    if (dead.length) {
      console.log(`\n=== 探不通的（别再往阶梯里放）===`);
      for (const d of out.deadList) console.log(`  ✗ ${d}`);
    }
    console.log(`\n想把这份阶梯写进配置：node model-scout.mjs --apply`);
  }

  if (opt.apply) {
    if (!alive.length) {
      console.error("\n❌ 一个能用的都没有，不写配置（写了等于让她彻底哑掉）");
      process.exit(1);
    }
    let prev = {};
    try { prev = JSON.parse(fs.readFileSync(LADDER_FILE, "utf8")); } catch {}
    const next = {
      _comment: prev._comment || "子代理的模型阶梯。从上往下试，第一个跑通的就用。",
      _note: `2026-10-31 由 model-scout.mjs 自动探活重建（${new Date().toLocaleString("zh-CN")}）。探到 ${alive.length} 个可用、${dead.length} 个不可用。`,
      ladder: ladder.map(({ _score, ...rest }) => rest),
      paid: prev.paid || [],
    };
    fs.mkdirSync(path.dirname(LADDER_FILE), { recursive: true });
    fs.writeFileSync(LADDER_FILE, JSON.stringify(next, null, 2) + "\n");
    console.log(`\n✅ 已写入 ${LADDER_FILE}（${next.ladder.length} 项）`);
  }
})();
