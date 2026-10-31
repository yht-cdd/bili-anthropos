#!/usr/bin/env node
/**
 * model-mode.mjs —— 模型模式的唯一开关
 * ============================================================
 * 有两种模式，切一次，四个地方同时生效：
 *
 *   auto  魔搭优先（常态）
 *         · 主模型     modelscope/Qwen/Qwen3.8-Flash-Next
 *         · 子代理阶梯 魔搭在前
 *         · 看视频     魔搭在前
 *
 *   amd   降级（魔搭额度/余额报错之后）
 *         · 主模型     amd/Qwen3.8-Flash-Next
 *         · 子代理阶梯 AMD 在前
 *         · 看视频     AMD 在前
 *
 * 为什么要有这个开关：
 *   2026-10-31 魔搭账户返回 insufficient balance，四个模型全挂。
 *   而她的主模型、子代理、视觉是三套各自独立的配置 —— 一处挂了另外两处不知道，
 *   于是「主模型还指着死的那个」这种状态能持续很久，看起来像她不想说话。
 *
 * 用法：
 *   node model-mode.mjs status          # 现在是什么模式
 *   node model-mode.mjs set auto        # 切回魔搭优先（0 点日切会自动做）
 *   node model-mode.mjs set amd         # 降级到 AMD（额度报错时自动做）
 *   node model-mode.mjs set amd --reason "insufficient balance"
 *   node model-mode.mjs set amd --no-switch-opencode   # 只改状态文件，不动 opencode.json
 *
 * 它做四件事：
 *   1. 写 config/model-mode.json（vision.mjs / spawn-task 读这个）
 *   2. 改 /root/.config/opencode/opencode.json 的默认 model
 *   3. 改 /root/.opencode.env 的 OC_PROVIDER_ID / OC_MODEL_ID（bridge 起来时读）
 *   4. 重排 config/agent-models.json 的 ladder
 *
 * 不重启任何服务 —— 调用方自己决定。bridge 内部有自己的改绑逻辑，
 * opencode.json 的默认模型要等 opencode 重启才对 Web UI 生效（bridge 不受影响）。
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const MODE_FILE = path.join(HOME, "config/model-mode.json");
const LADDER_FILE = path.join(HOME, "config/agent-models.json");
const OC_JSON = process.env.OC_JSON || "/root/.config/opencode/opencode.json";
const OC_ENV = process.env.OC_ENV || "/root/.opencode.env";

const PRESETS = {
  auto: {
    label: "魔搭优先（常态）",
    primary: { providerID: "modelscope", id: "Qwen/Qwen3.8-Flash-Next", variant: "high" },
    // 阶梯/视觉的优先 provider
    prefer: "modelscope",
  },
  amd: {
    label: "AMD Qwen3.8（固定降级档）",
    primary: { providerID: "amd", id: "Qwen3.8-Flash-Next", variant: "medium" },
    prefer: "amd",
  },
};

const argv = process.argv.slice(2);
const cmd = argv[0] || "status";
const opt = {};
for (let i = 1; i < argv.length; i += 1) {
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

const nowIso = () => new Date().toISOString();

function readMode() {
  try {
    return JSON.parse(fs.readFileSync(MODE_FILE, "utf8"));
  } catch {
    return { mode: "auto", updated: "", reason: "（没设过，按 auto）" };
  }
}

function writeMode(mode, reason) {
  fs.mkdirSync(path.dirname(MODE_FILE), { recursive: true });
  const prev = readMode();
  const j = {
    mode,
    label: PRESETS[mode].label,
    reason: String(reason || prev.reason || "手动切换"),
    updated: nowIso(),
    history: [...(prev.history || []), { mode, at: nowIso(), reason: String(reason || "") }].slice(-20),
  };
  fs.writeFileSync(MODE_FILE, JSON.stringify(j, null, 2) + "\n");
  return j;
}

/** 改 opencode.json 的默认 model（Web UI 新建会话用这个） */
function switchOpencode(preset) {
  try {
    const cfg = JSON.parse(fs.readFileSync(OC_JSON, "utf8"));
    const before = cfg.model;
    cfg.model = `${preset.primary.providerID}/${preset.primary.id}`;
    if (before === cfg.model) return `未变（${cfg.model}）`;
    fs.writeFileSync(OC_JSON, JSON.stringify(cfg, null, 2));
    return `${before} → ${cfg.model}`;
  } catch (e) {
    return `失败：${e.message}`;
  }
}

/** 改 .opencode.env 的 OC_PROVIDER_ID / OC_MODEL_ID（bridge 启动时读） */
function switchEnv(preset) {
  try {
    let s = "";
    try {
      s = fs.readFileSync(OC_ENV, "utf8");
    } catch {}
    const set = (txt, k, v) => {
      const re = new RegExp(`^${k}=.*$`, "m");
      return re.test(txt) ? txt.replace(re, `${k}=${v}`) : txt + (txt.endsWith("\n") || !txt ? "" : "\n") + `${k}=${v}\n`;
    };
    s = set(s, "OC_PROVIDER_ID", preset.primary.providerID);
    s = set(s, "OC_MODEL_ID", preset.primary.id);
    fs.writeFileSync(OC_ENV, s);
    try {
      fs.chmodSync(OC_ENV, 0o600);
    } catch {}
    return `${preset.primary.providerID} / ${preset.primary.id}`;
  } catch (e) {
    return `失败：${e.message}`;
  }
}

/**
 * 把已有会话改绑到当前模式的模型。
 *
 * 为什么必须有这一步：opencode.json 的 model 只影响**新建**会话。
 * 已经存在的会话（尤其是 bridge 一直在用的那个）会牢牢绑着创建时的模型，
 * 于是出现 2026-10-31 那个现象 —— 默认模型已经是 AMD 了，
 * 但 Web UI 里那个会话还指着已经余额不足的魔搭，发一句挂一句。
 */
async function rebindSessions(preset) {
  const PW_FILE = path.join(HOME, "secrets/opencode_password.txt");
  let pw = "";
  try {
    pw = fs.readFileSync(PW_FILE, "utf8").trim();
  } catch {
    return "跳过（读不到 opencode 密码）";
  }
  if (!pw) return "跳过（密码为空）";

  const auth = "Basic " + Buffer.from("opencode:" + pw).toString("base64");
  const BASE = process.env.OC_BASE || "http://127.0.0.1:4096";

  const call = async (p, opt = {}) => {
    const r = await fetch(BASE + p, {
      ...opt,
      headers: { Authorization: auth, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    const t = await r.text();
    try {
      return { status: r.status, j: JSON.parse(t) };
    } catch {
      return { status: r.status, raw: t.slice(0, 120) };
    }
  };

  let list;
  try {
    list = await call("/api/session");
  } catch (e) {
    return `跳过（opencode 连不上：${e.message}）`;
  }
  const arr = list.j?.data || [];
  if (!arr.length) return "没有会话";

  const want = `${preset.primary.providerID}/${preset.primary.id}`;
  const targets = arr.filter((s) => {
    const m = s.model || {};
    return `${m.providerID}/${m.id}` !== want;
  });
  if (!targets.length) return `已经全部是 ${want}`;

  let ok = 0;
  const failed = [];
  for (const s of targets) {
    const r = await call(`/api/session/${s.id}/model`, {
      method: "POST",
      body: JSON.stringify({ model: preset.primary }),
    });
    if (r.status >= 400) failed.push(s.id.slice(0, 16));
    else ok += 1;
  }
  return `${ok} 个改绑到 ${want}${failed.length ? `，${failed.length} 个失败` : ""}`;
}

/** 重排子代理阶梯：目标 provider 提到前面；阶梯里没有它就先插一条 */
function reorderLadder(preset) {
  try {
    const d = JSON.parse(fs.readFileSync(LADDER_FILE, "utf8"));
    const ladder = d.ladder || [];
    const prefer = preset.prefer;
    let head = ladder.filter((m) => m.providerID === prefer);
    const tail = ladder.filter((m) => m.providerID !== prefer);

    // 阶梯里还没有这个 provider（比如刚接进来的 brocod）—— 补一条到最前面，
    // 否则「重排」什么也做不了，子代理还是先用已经挂掉的那批。
    let added = false;
    if (!head.length) {
      head = [
        {
          providerID: preset.primary.providerID,
          id: preset.primary.id,
          label: `${preset.primary.id}（${preset.label}）`,
          free: true,
        },
      ];
      added = true;
    }

    const next = [...head, ...tail];
    const key = (arr) => arr.map((m) => `${m.providerID}/${m.id}`).join(",");
    if (key(next) === key(ladder)) return "已经是这个顺序";
    d.ladder = next;
    fs.writeFileSync(LADDER_FILE, JSON.stringify(d, null, 2) + "\n");
    return added ? `新增 ${prefer}/${preset.primary.id} 并放到首位` : `${head.length} 项提到前面`;
  } catch (e) {
    return `失败：${e.message}`;
  }
}

if (cmd === "status") {
  const cur = readMode();
  const preset = PRESETS[cur.mode] || PRESETS.auto;
  console.log(`当前模式 : ${cur.mode} —— ${preset.label}`);
  console.log(`切换时间 : ${cur.updated || "-"}`);
  console.log(`原因     : ${cur.reason || "-"}`);
  console.log(`主模型   : ${preset.primary.providerID}/${preset.primary.id}  (variant=${preset.primary.variant})`);
  try {
    const cfg = JSON.parse(fs.readFileSync(OC_JSON, "utf8"));
    console.log(`opencode : ${cfg.model}${cfg.model === preset.primary.providerID + "/" + preset.primary.id ? " ✓" : "  ⚠️ 与模式不一致"}`);
  } catch {
    console.log("opencode : （读不到配置）");
  }
  try {
    const d = JSON.parse(fs.readFileSync(LADDER_FILE, "utf8"));
    const first = (d.ladder || [])[0];
    console.log(`阶梯首位 : ${first ? first.providerID + "/" + first.id : "-"}`);
  } catch {}
  const hist = (cur.history || []).slice(-3);
  if (hist.length) {
    console.log("最近切换 :");
    for (const h of hist) console.log(`  ${h.at.slice(0, 19).replace("T", " ")}  ${h.mode}  ${h.reason}`);
  }
  process.exit(0);
}

if (cmd === "set") {
  const mode = argv[1];
  if (!PRESETS[mode]) {
    console.error(`❌ 模式只能是：${Object.keys(PRESETS).join(" / ")}`);
    process.exit(2);
  }
  const preset = PRESETS[mode];
  const j = writeMode(mode, opt.reason);
  console.log(`✓ 模式切到 ${mode} —— ${preset.label}`);
  if (!opt["no-switch-opencode"]) console.log(`  opencode.json : ${switchOpencode(preset)}`);
  else console.log("  opencode.json : 跳过（--no-switch-opencode）");
  console.log(`  env            : ${switchEnv(preset)}`);
  console.log(`  子代理阶梯     : ${reorderLadder(preset)}`);
  if (opt["no-rebind"]) {
    console.log("  会话改绑       : 跳过（--no-rebind）");
  } else {
    console.log(`  会话改绑       : ${await rebindSessions(preset)}`);
  }
  console.log(`  状态文件       : ${MODE_FILE}`);
  if (j.history.length > 1) console.log(`  上一次         : ${j.history.at(-2).mode}（${j.history.at(-2).reason}）`);
  process.exit(0);
}

console.error(`用法：
  node model-mode.mjs status
  node model-mode.mjs set auto|amd [--reason "…"] [--no-switch-opencode]`);
process.exit(1);
