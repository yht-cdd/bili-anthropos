#!/usr/bin/env node
// 醒来计划：每天 00:00 一次日切 + 01:00–23:00 随机 2–3 次
//
// 设计要点（为什么不是 cron）：
//   · 时刻是随机的，但随机结果必须落盘 —— 否则重启就重抽，随机等于没有
//   · 一次性排好全天，不是"醒来后再算下一次" —— 这样能看到今天还剩几次
//   · 日切是固定锚点，且不受冷却拦截 —— 它是日结，错过就没有那天的账
//   · 随机唤醒受冷却影响，但只顺延、不丢弃 —— 一天只有 2–3 次，丢一次就少一次
//
// 用法：
//   node wake-plan.mjs show              看今天的计划
//   node wake-plan.mjs regen             重排今天（测试用）
//   node wake-plan.mjs due               输出下一个该执行的（JSON，没有则空）
//   node wake-plan.mjs fire fixed|random:N   标记已执行
//   node wake-plan.mjs soon [分钟]        把下一个 slot 改成 N 分钟后（测试用）
//   node wake-plan.mjs touch-cooldown     把冷却起点设为现在（测试用）

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.LIFE_HOME || "/opt/life";
const FILE = path.join(HOME, "bili/data/wake_plan.json");

const CFG = {
  fixedAt: "00:00",       // 日切
  randomStart: "01:00",   // 随机窗口
  randomEnd: "23:00",
  countMin: 2,            // 每天 2 或 3 次（50/50）
  countMax: 3,
  minGapMin: 30,          // 随机 slot 之间至少 30 分钟
  cooldownSec: 300,       // 回复后 5 分钟内不唤醒
  graceHours: 2,          // 日切错过后的补跑宽限
  randomGraceHours: 2,    // 随机 slot 过期多久就作废（不补跑）
};

// ── 时间工具 ──────────────────────────────────────────
const dayOf = (v = Date.now()) => new Date(v).toLocaleDateString("sv-SE");
const hhmm = (v) => {
  const d = new Date(v);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const minOf = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s));
  if (!m) throw new Error(`无效时间：${s}`);
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi !== 0)) throw new Error(`无效时间：${s}`);
  return h * 60 + mi;
};
const stamp = (day, minutes) => {
  const d = new Date(`${day}T00:00:00`);
  d.setMinutes(minutes);
  return d.getTime();
};

// ── 排程 ──────────────────────────────────────────────
/** 把 [start, end) 切成 count 段，每段内随机取一点，段间留出最小间隔的余量 */
function makeSlots(day, count) {
  const start = minOf(CFG.randomStart);
  const end = minOf(CFG.randomEnd);
  const span = end - start;
  const seg = span / count;
  // 余量不超过段长的 1/4，也不超过最小间隔的一半
  const margin = Math.min(seg / 4, CFG.minGapMin / 2);

  const out = [];
  for (let i = 0; i < count; i += 1) {
    const lo = start + i * seg + (i === 0 ? 0 : margin);
    const hi = start + (i + 1) * seg - (i === count - 1 ? 0 : margin);
    const at = Math.round(lo + Math.random() * Math.max(1, hi - lo));
    out.push({ atMs: stamp(day, at), atText: `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`, fired: false });
  }
  return out;
}

export function makePlan(now = Date.now()) {
  const day = dayOf(now);
  const count = Math.random() < 0.5 ? CFG.countMin : CFG.countMax; // 50/50
  const fixedMin = minOf(CFG.fixedAt);
  return {
    schema: 1,
    date: day,
    createdAt: new Date(now).toISOString(),
    config: { ...CFG },
    fixed: {
      at: CFG.fixedAt,
      atMs: stamp(day, fixedMin),
      atText: CFG.fixedAt,
      fired: false,
    },
    random: { count, slots: makeSlots(day, count) },
    lastInteractionAt: null,
    log: [],
  };
}

const load = () => {
  try {
    const j = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return j && j.schema === 1 ? j : null;
  } catch {
    return null;
  }
};
const save = (p) => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2) + "\n");
  fs.renameSync(tmp, FILE);
};

/** 跨日自动换新计划。同一天不动（重启不重抽） */
export function ensure(now = Date.now()) {
  let p = load();
  if (p && p.date === dayOf(now)) return p;
  const old = p;
  p = makePlan(now);
  if (old) p.log.push({ at: new Date(now).toISOString(), kind: "rotate", from: old.date, to: p.date });
  save(p);
  return p;
}

/** 下一个该执行的 slot（已到点且未执行）。冷却只作用于 random。 */
export function due(now = Date.now()) {
  const p = ensure(now);

  // ① 日切：到点就跑；错过在宽限内补跑；超出宽限记一次错过
  if (!p.fixed.fired) {
    const late = now - p.fixed.atMs;
    if (late >= 0 && late <= CFG.graceHours * 3600_000) {
      return { plan: p, kind: "fixed", slot: p.fixed, atMs: p.fixed.atMs, delayedMs: late };
    }
    if (late > CFG.graceHours * 3600_000) {
      p.fixed.fired = true;
      p.fixed.missed = true;
      p.log.push({ at: new Date(now).toISOString(), kind: "miss", slot: "fixed", atText: p.fixed.atText });
      save(p);
    }
  }

  // ② 随机：按时间顺序找第一个到点的
  const cooldownUntil = p.lastInteractionAt ? Number(p.lastInteractionAt) + CFG.cooldownSec * 1000 : 0;
  for (let i = 0; i < p.random.slots.length; i += 1) {
    const s = p.random.slots[i];
    if (s.fired) continue;
    let t = s.atMs;
    // 冷却期内：顺延到冷却结束，不丢弃
    if (cooldownUntil > t) {
      t = cooldownUntil;
      const next = p.random.slots[i + 1];
      // 顺延会顶到下一个 slot，就吞掉这一次
      if (next && !next.fired && t >= next.atMs - CFG.minGapMin * 60_000) {
        s.fired = true;
        s.dropped = true;
        p.log.push({ at: new Date(now).toISOString(), kind: "drop", slot: `random:${i}`, atText: s.atText, reason: "cooldown" });
        save(p);
        continue;
      }
    }
    if (now >= t) {
      // 过期太久就作废：机器宕机半天后，不该在晚上连着补跑三次
      if (now - s.atMs > CFG.randomGraceHours * 3600_000) {
        s.fired = true;
        s.missed = true;
        p.log.push({ at: new Date(now).toISOString(), kind: "miss", slot: `random:${i}`, atText: s.atText });
        save(p);
        continue;
      }
      return { plan: p, kind: "random", index: i, slot: s, atMs: t, delayedMs: now - s.atMs };
    }
  }
  return null;
}

export function markFired(kind, index = null, now = Date.now()) {
  const p = ensure(now);
  if (kind === "fixed") p.fixed.fired = true;
  else if (p.random.slots[index]) p.random.slots[index].fired = true;
  p.log.push({ at: new Date(now).toISOString(), kind: "fire", slot: kind === "fixed" ? "fixed" : `random:${index}` });
  save(p);
  return p;
}

export function touchCooldown(now = Date.now()) {
  const p = ensure(now);
  p.lastInteractionAt = now;
  save(p);
  return p;
}

// ── CLI ───────────────────────────────────────────────
const isMain = process.argv[1] && process.argv[1].endsWith("wake-plan.mjs");
if (isMain) {
  const cmd = process.argv[2] || "show";
  const now = Date.now();

  if (cmd === "show") {
    due(now);                 // 先让过期标记落地
    const p = ensure(now);    // 再读最新状态
    console.log(`日期 ${p.date} | 随机 ${p.random.count} 次 | 冷却 ${CFG.cooldownSec}s`);
    const markOf = (x) => (x.missed ? "⊘ 已错过" : x.fired ? "✓ 已执行" : "… 待执行");
    console.log(`  日切 ${p.fixed.atText}  ${markOf(p.fixed)}  (${p.fixed.atMs ? new Date(p.fixed.atMs).toLocaleString("zh-CN") : "-"})`);
    for (let i = 0; i < p.random.slots.length; i += 1) {
      const s = p.random.slots[i];
      console.log(`  #${i + 1} ${s.atText}  ${s.dropped ? "⊘ 冷却丢弃" : markOf(s)}`);
    }
    if (p.lastInteractionAt) {
      const left = CFG.cooldownSec * 1000 - (now - p.lastInteractionAt);
      console.log(`  冷却：${left > 0 ? `还剩 ${Math.ceil(left / 1000)}s` : "已过"}`);
    }
    const d = due(now);
    console.log(`下一个：${d ? `${d.kind}${d.index !== undefined ? " #" + (d.index + 1) : ""}（应于 ${hhmm(d.atMs)}）` : "无"}`);
  } else if (cmd === "regen") {
    save(makePlan(now));
    console.log("已重排今天");
  } else if (cmd === "due") {
    const d = due(now);
    console.log(d ? JSON.stringify({ kind: d.kind, index: d.index, atMs: d.atMs, delayedMs: d.delayedMs }) : "");
  } else if (cmd === "fire") {
    const kind = process.argv[3] === "fixed" ? "fixed" : "random";
    const idx = kind === "random" ? Number(String(process.argv[3]).split(":")[1] || 0) : null;
    markFired(kind, idx, now);
    console.log("已标记");
  } else if (cmd === "touch-cooldown") {
    touchCooldown(now);
    console.log("冷却起点已设为现在");
  } else if (cmd === "soon") {
    const mins = Number(process.argv[3] || 2);
    const p = ensure(now);
    const target = now + mins * 60_000;
    let touched = false;
    // 优先改日切；日切已执行就改第一个未执行的随机 slot
    if (!p.fixed.fired) {
      p.fixed.atMs = target;
      p.fixed.atText = hhmm(target);
      touched = true;
    } else {
      const s = p.random.slots.find((x) => !x.fired);
      if (s) {
        s.atMs = target;
        s.atText = hhmm(target);
        touched = true;
      }
    }
    p.lastInteractionAt = null; // 清掉冷却，方便测试
    save(p);
    console.log(touched ? `已改到 ${mins} 分钟后（${hhmm(target)}）` : "没有可改的 slot");
  } else {
    console.log("用法: show | regen | due | fire fixed|random:N | soon [分钟] | touch-cooldown");
  }
}
