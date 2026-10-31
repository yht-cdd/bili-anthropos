#!/usr/bin/env node
/**
 * spawn-task.mjs —— 把重活派给子代理，主会话只收结论
 * ============================================================
 * 为什么要有这一层：
 *   主模型（她）的会话是长期记忆的容器。看一个 4 分钟视频、跑十几次命令、
 *   读一堆文件，这些过程全塞进主会话，上下文会被"过程"吃光，然后她就开始忘事。
 *   所以：主模型只做判断、回私信、派活、写总结；脏活累活打包给子代理。
 *
 * 子代理是什么：
 *   一个**全新的 opencode 会话**，自己去干活，干完只回一段结论。
 *   它看过的东西、跑过的命令，一个字都不进主会话。
 *   需要主人知道的，它自己用 bili-dm.mjs 发出去 —— 不靠桥接转发。
 *
 * 模型怎么选（免费优先，逐级降级）：
 *   config/agent-models.json 里的 ladder，从上往下试：
 *   DeepSeek → GLM-5.3-Flash → MiMo-2.6 → 其他免费 → （要主人点头才用付费）
 *
 * 免费额度用完了怎么办：
 *   不偷偷花钱。写一条待批记录，退出码 2，由她发私信问主人；
 *   主人回「同意」后桥接会写一张 12 小时的放行条，再跑才走付费模型。
 *
 * 用法：
 *   node spawn-task.mjs --task "看 BV1xx 这条视频，挑一个点推给主人"
 *   node spawn-task.mjs --task "..." --model opencode/deepseek-v4.1-flash-free
 *   node spawn-task.mjs --task "..." --timeout 1200 --keep
 *   node spawn-task.mjs --ladder                # 只看阶梯，不干活
 *   node spawn-task.mjs --task "..." --json     # 机器可读
 *
 * 退出码：
 *   0 干完了    1 出错    2 免费全挂，需要主人确认    3 付费未授权
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const OC_BASE = process.env.OC_BASE || "http://127.0.0.1:4096";
const CONFIG_FILE = path.join(HOME, "config/agent-models.json");
const APPROVAL_FILE = path.join(HOME, "bili/data/spend_approval.json");
const PENDING_FILE = path.join(HOME, "bili/data/spend_pending.json");
const USAGE_FILE = path.join(HOME, "bili/data/spawn_usage.jsonl");
const LEDGER_FILE = path.join(HOME, "exec/bridge.log");

// 阶梯顺序是硬约定（见 config/agent-models.json 的 _note）：
//   ① opencode 自带的 *-free 永远优先 —— 那是宿主给的免费额度，不用白不用
//   ② 它们全部失败才降级到她自己的魔搭模型
// 2026-10-30 曾因 opencode 额度耗尽把前六个删掉，2026-10-31 改回：
// 额度会恢复，不能因为今天失败就把这条通道永久关掉。
// 失败会快速返回（约 0.3s），六个全试完也不到 2 秒，代价可忽略。
const DEFAULT_LADDER = [
  { providerID: "opencode", id: "deepseek-v4.1-flash-free", label: "DeepSeek V4.1 Flash（免费）", free: true },
  { providerID: "opencode", id: "glm-5.3-flash-free", label: "GLM-5.3-Flash（免费）", free: true },
  { providerID: "opencode", id: "mimo-v2.6-flash-free", label: "MiMo-V2.6-Flash（免费）", free: true },
  { providerID: "opencode", id: "nemotron-3.5-super-vl-free", label: "Nemotron 3.5 Super VL（免费·能看图）", free: true },
  { providerID: "opencode", id: "flint-40b-free", label: "Flint 40B（免费）", free: true },
  { providerID: "opencode", id: "beam-free", label: "Beam（免费）", free: true },
  // ↓ 以下只在上面六个全挂时才轮到
  { providerID: "modelscope", id: "Qwen/Qwen3.8-Flash-Next", label: "Qwen3.8-Flash-Next（她自己的主模型·降级兜底）", free: true },
  { providerID: "modelscope", id: "deepseek-ai/DeepSeek-V4.1-Flash-1017", label: "DeepSeek V4.1 Flash 1017（魔搭·降级兜底）", free: true },
  { providerID: "modelscope", id: "Qwen/Qwen3.5-122B-A10B", label: "Qwen3.5-122B-A10B（魔搭·降级兜底）", free: true },
];
const DEFAULT_PAID = [
  { providerID: "modelscope", id: "Qwen/Qwen3.8-Flash-Next", label: "Qwen3.8-Flash-Next（魔搭·计额度）", free: false },
];

// ── 参数 ──────────────────────────────────────────────
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
const TASK = String(opt.task || "").trim();
const TIMEOUT_MS = Number(opt.timeout || 1800) * 1000;   // 默认 30 分钟：做视频这种活，15 分钟会卡在半路
const KEEP = !!opt.keep;
const JSON_OUT = !!opt.json;
const ALLOW_PAID = !!opt["allow-paid"];   // 主人手动跑时才给；她自己在契约里不许用
const FORCE_MODEL = String(opt.model || "").trim();

const log = (...a) => console.error(`[spawn ${new Date().toLocaleString("zh-CN", { hour12: false })}] ${a.join(" ")}`);

// ── 模型阶梯 ──────────────────────────────────────────
function loadLadder() {
  try {
    const j = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    const ladder = Array.isArray(j.ladder) && j.ladder.length ? j.ladder : DEFAULT_LADDER;
    const paid = Array.isArray(j.paid) && j.paid.length ? j.paid : DEFAULT_PAID;
    return { ladder, paid };
  } catch {
    return { ladder: DEFAULT_LADDER, paid: DEFAULT_PAID };
  }
}

const { ladder, paid } = loadLadder();
const ALL = [...ladder, ...paid];
const refOf = (m) => `${m.providerID}/${m.id}`;

function findModel(key) {
  const k = String(key).trim();
  let hit = ALL.find((m) => refOf(m) === k);
  if (hit) return hit;
  hit = ALL.find((m) => m.id === k);
  if (hit) return hit;
  // 允许临时指定清单外的模型（主人调试用），默认当付费
  const [providerID, ...rest] = k.split("/");
  if (providerID && rest.length) return { providerID, id: rest.join("/"), label: k, free: false, adhoc: true };
  return null;
}

if (opt.ladder) {
  console.log("免费阶梯（从上往下试）：");
  for (const m of ladder) console.log(`  ${refOf(m)}  ${m.label}`);
  console.log("\n付费（需主人确认）：");
  for (const m of paid) console.log(`  ${refOf(m)}  ${m.label}`);
  const ap = approvalInfo();
  console.log(`\n放行状态：${ap ? `有效至 ${new Date(ap.expiresAt).toLocaleString("zh-CN")}` : "无"}`);
  process.exit(0);
}

if (!TASK && !opt.ladder) {
  console.error('用法: node spawn-task.mjs --task "要做的事" [--model provider/id] [--timeout 秒] [--keep] [--json]');
  process.exit(1);
}

// ── 凭据（只读进内存，绝不打印）────────────────────────
let pwCache = { pw: "", at: 0 };
function getPassword() {
  if (pwCache.pw && Date.now() - pwCache.at < 60_000) return pwCache.pw;
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
  if (pw) pwCache = { pw, at: Date.now() };
  return pw;
}

async function oc(pathname, { method = "GET", body, timeout = 30_000 } = {}) {
  const pw = getPassword();
  if (!pw) throw new Error("拿不到 opencode 密码");
  const auth = "Basic " + Buffer.from(`opencode:${pw}`).toString("base64");
  const r = await fetch(OC_BASE + pathname, {
    method,
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    return { __status: r.status, __raw: t.slice(0, 300) };
  }
  if (r.status === 401) {
    pwCache = { pw: "", at: 0 };
    throw new Error("opencode 鉴权失败");
  }
  return { __status: r.status, ...j };
}

// ── 放行条 ────────────────────────────────────────────
function approvalInfo() {
  try {
    const j = JSON.parse(fs.readFileSync(APPROVAL_FILE, "utf8"));
    if (Number(j.expiresAt || 0) > Date.now()) return j;
  } catch {}
  return null;
}
function recordPending(tried, reason) {
  try {
    fs.mkdirSync(path.dirname(PENDING_FILE), { recursive: true });
    fs.writeFileSync(
      PENDING_FILE,
      JSON.stringify(
        { at: new Date().toISOString(), task: TASK.slice(0, 300), tried, reason, need: "付费模型放行" },
        null,
        2
      ) + "\n"
    );
  } catch {}
}
function clearPending() {
  try {
    fs.unlinkSync(PENDING_FILE);
  } catch {}
}
function recordUsage(rec) {
  try {
    fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
    fs.appendFileSync(USAGE_FILE, JSON.stringify(rec) + "\n");
  } catch {}
}
function ledger(line) {
  try {
    fs.appendFileSync(LEDGER_FILE, `${new Date().toISOString()} | ${line}\n`);
  } catch {}
}

// ── 子代理的干活契约 ──────────────────────────────────
function childPrompt(task) {
  return [
    `[子代理任务 · 无人值守]`,
    `你是 Anthropos 派出去的子代理。只做这一件事，做完把结论交回去。`,
    `主模型看不到你的过程，只读你最后一条消息 —— 所以过程随便写，结论必须写清。`,
    ``,
    `任务：`,
    `---`,
    task,
    `---`,
    ``,
    `交差规则：`,
    `1. 最后一条消息就是结论。400 字以内，写三件事：做了什么、结果是什么、有没有对外发送（发了什么、发给谁）。`,
    `   如果是搜索类任务，结论里**必须带来源链接**（至少两条）；查不到就说查不到，不要用「应该是」糊过去。`,
    `2. **只有任务里明确写了「推给主人 / 发给主人 / 用 bili-dm 发」才发**。没写就不许发，`,
    `   结论里写「未对外发送」。不要因为「这个结论挺重要」就自作主张发私信 —— 发不发由派活的人决定。`,
    `   要发的时候用：`,
    `     node /opt/life/scripts/bili-dm.mjs "内容"`,
    `   发完把发出去的正文原样附在结论里（同样 400 字以内），不要附过程。`,
    `3. 不提问、不等确认。缺信息就按最合理的假设做，并在结论里写清假设。`,
    `4. 除了任务明确要求的对外动作，不发评论 / 动态 / 弹幕 / 点赞 / 投币。`,
    `5. 不要再用 spawn-task 派活 —— 你就是最后一层。`,
    `6. 不要输出思考过程，不要贴整屏命令输出。`,
  ].join("\n");
}

// ── 跑一个子会话 ──────────────────────────────────────
function failureKind(error) {
  const all = `${error?.type || ""} ${error?.message || ""}`;
  const status = Number(error?.status || 0);
  if (status === 429 || /quota|insufficient|balance|rate.?limit|额度|余额|用量/i.test(all)) return "quota";
  if (status === 401 || status === 403 || /unauthor|invalid.?api.?key|permission/i.test(all)) return "auth";
  if (/no provider supported|model.?not.?found|does not exist|unknown model/i.test(all) || status === 404) return "model";
  if (status >= 500) return "server";
  if (/timeout|timed?\s?out|ECONNRESET|ECONNREFUSED|fetch failed/i.test(all)) return "network";
  return "other";
}

function brief(error) {
  const msg = String(error?.message || error?.type || "未知").replace(/\s+/g, " ");
  return msg.length > 90 ? msg.slice(0, 90) + "…" : msg;
}

function finalText(msgs) {
  const asst = msgs
    .filter((m) => m.type === "assistant")
    .sort((a, b) => Number(a.time?.created || 0) - Number(b.time?.created || 0));
  for (let i = asst.length - 1; i >= 0; i -= 1) {
    const txt = (asst[i].content || [])
      .filter((c) => c.type === "text")
      .map((c) => String(c.text || "").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
    if (txt) return txt;
  }
  return "";
}

async function runOne(model, attempt) {
  const t0 = Date.now();
  const task = attempt > 1 ? `${TASK}\n\n（第 ${attempt} 次尝试：上一次没跑起来，从头做即可。）` : TASK;

  const created = await oc("/api/session", {
    method: "POST",
    body: {
      location: { directory: HOME },
      agent: "build",
      model: { providerID: model.providerID, id: model.id },
    },
  });
  const sid = (created.data || created)?.id;
  if (!sid) return { ok: false, kind: "other", error: { message: "建会话失败" }, ms: Date.now() - t0 };

  const pr = await oc(`/api/session/${sid}/prompt`, {
    method: "POST",
    body: { text: childPrompt(task) },
    timeout: 60_000,
  });
  if (pr.__status && pr.__status >= 400) {
    return { ok: false, sid, kind: "other", error: { message: `prompt 提交失败 ${pr.__status}` }, ms: Date.now() - t0 };
  }

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    let d;
    try {
      const s = await oc(`/api/session/${sid}`, { timeout: 10_000 });
      d = s.data || s;
    } catch {
      continue;
    }
    const idle = Number(d?.time?.idle || 0);
    const busy = Number(d?.time?.busy || 0);
    if (!(idle > 0 && idle >= t0 - 3000 && (!busy || idle >= busy))) continue;

    const mj = await oc(`/api/session/${sid}/message`, { timeout: 15_000 });
    const msgs = mj.data || [];
    const end = msgs
      .filter((m) => m.type === "idle")
      .sort((a, b) => Number(b.time?.created || 0) - Number(a.time?.created || 0))[0];
    const outcome = String(end?.outcome || d?.outcome || "");
    const text = finalText(msgs);
    const failed = outcome === "failed" || (!!end?.error && outcome !== "succeeded");
    const tokens = msgs.find((m) => m.type === "assistant" && m.tokens)?.tokens || null;

    return {
      ok: !failed && !!text,
      sid,
      outcome,
      text,
      error: end?.error || null,
      kind: failed || !text ? failureKind(end?.error || {}) : "",
      tokens,
      ms: Date.now() - t0,
      empty: !failed && !text,
    };
  }
  return { ok: false, sid: null, kind: "timeout", error: { message: `超过 ${Math.round(TIMEOUT_MS / 1000)}s 没跑完` }, ms: Date.now() - t0 };
}

async function cleanup(sid) {
  if (!sid || KEEP) return;
  try {
    await oc(`/api/session/${sid}`, { method: "DELETE", timeout: 10_000 });
  } catch {}
}

// ── 主流程 ────────────────────────────────────────────
(async () => {
  const queue = FORCE_MODEL ? [findModel(FORCE_MODEL)].filter(Boolean) : ladder;
  if (!queue.length) {
    console.error(`❌ 找不到模型：${FORCE_MODEL}（用 --ladder 看清单）`);
    process.exit(1);
  }

  const tried = [];
  let spentPaid = false;
  let paidUsed = null;

  for (const model of queue) {
    // 免费模型直接跑；付费的要放行条
    if (!model.free) {
      const ap = approvalInfo();
      if (!ap && !ALLOW_PAID) {
        tried.push(`${model.label}：未授权`);
        continue;
      }
      paidUsed = model;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      log(`▶ ${model.label}（第 ${attempt} 次）`);
      let r;
      try {
        r = await runOne(model, attempt);
      } catch (e) {
        r = { ok: false, kind: "other", error: { message: e.message }, ms: 0 };
      }

      if (r.ok) {
        recordUsage({
          at: new Date().toISOString(),
          model: refOf(model),
          label: model.label,
          free: !!model.free,
          ok: true,
          ms: r.ms,
          tokens: r.tokens,
          task: TASK.slice(0, 120),
        });
        ledger(`子代理 | ${model.label} | ${TASK.replace(/\n/g, " ").slice(0, 60)} | 成功 | ${(r.ms / 1000).toFixed(1)}s | ${r.text.length}字 | ${refOf(model)}`);
        if (!model.free) clearPending();
        await cleanup(r.sid);

        if (JSON_OUT) {
          console.log(JSON.stringify({ ok: true, model: refOf(model), label: model.label, free: !!model.free, ms: r.ms, tokens: r.tokens, text: r.text }));
        } else {
          const head = `✅ 子代理完成（${model.label} · ${(r.ms / 1000).toFixed(1)}s${model.free ? "" : " · 付费"}）`;
          console.log(head + "\n" + "─".repeat(Math.min(head.length, 46)) + "\n" + r.text);
          console.log("\n" + "─".repeat(24) + `\n（以上是子代理的结论。过程没有进你的上下文，需要细节再让它跑一次。）`);
        }
        process.exit(0);
      }

      const kind = r.kind || "other";
      log(`✖ ${model.label} 失败（${kind}：${brief(r.error)}）`);

      // 空输出 / 超时：换模型没用，重试一次；其余确定性错误直接降级
      const retriable = kind === "other" || kind === "server" || kind === "network" || kind === "timeout" || r.empty;
      if (attempt === 1 && retriable) {
        await cleanup(r.sid);
        continue;
      }

      tried.push(`${model.label}：${kind} ${brief(r.error)}`);
      await cleanup(r.sid);
      if (!model.free) spentPaid = true;    // 付费模型也挂了，别再拿它试
      break;
    }
    if (spentPaid) break;
  }

  // 免费池走完了，付费还没授权 → 留一条待批，让人去问主人
  const ap = approvalInfo();
  recordPending(tried, ap ? "付费模型都失败了" : "免费模型全部不可用");
  ledger(`子代理 | 全部失败 | ${TASK.replace(/\n/g, " ").slice(0, 60)} | 需要确认 | 0s | 0字 | -`);

  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: false, needApproval: !ap && !ALLOW_PAID, paidUsed, tried, text: "" }));
  } else {
    console.log(`❌ 子代理没跑起来。`);
    for (const t of tried) console.log(`   · ${t}`);
    console.log(
      !ap && !ALLOW_PAID
        ? `\n免费模型都用完了。要继续得花 token —— 先问主人同不同意（他回「同意」后会自动放行 12 小时）。`
        : `\n付费模型也失败了。已经记下来，别再连着试。`
    );
  }
  process.exit(!ap && !ALLOW_PAID ? 2 : 1);
})();
