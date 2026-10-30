#!/usr/bin/env node
/**
 * session-reset.mjs —— 清空所有会话，只留一个默认会话
 * ============================================================
 * 用来收拾「一堆废弃会话、私信落在一个死掉的模型上」这种局面。
 *
 * 它做四件事：
 *   1. 停桥接（不然它会在你删的过程中又写一条进去）
 *   2. 删掉服务端所有会话
 *   3. 建**一个**新会话，绑当前配置的模型，写进 bridge_session.json
 *   4. 起桥接
 *
 * 少一步都会出问题：不停服务 → 删完立刻被重建；不删干净 → 又落回旧会话。
 *
 * 用法：
 *   node session-reset.mjs --yes                 # 真删
 *   node session-reset.mjs --dry                 # 只看会删哪些
 *   node session-reset.mjs --yes --no-service    # 不动 systemd
 *
 * ⚠️ 会话记录不可恢复。跑之前先 node handover.mjs 把记忆抽出来。
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const OC_BASE = process.env.OC_BASE || "http://127.0.0.1:4096";
const SESSION_FILE = path.join(HOME, "bili/data/bridge_session.json");
const SERVICE = process.env.BRIDGE_SERVICE || "anthropos-bridge";

const argv = process.argv.slice(2);
const YES = argv.includes("--yes");
const DRY = argv.includes("--dry");
const NO_SERVICE = argv.includes("--no-service");

const MODEL = {
  providerID: process.env.OC_PROVIDER_ID || "modelscope",
  id: process.env.OC_MODEL_ID || "Qwen/Qwen3.8-Flash-Next",
};
const AGENT = process.env.OC_AGENT || "build";

const log = (...a) => console.log(`[reset ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${a.join(" ")}`);

let pwCache = "";
function getPassword() {
  if (pwCache) return pwCache;
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
  pwCache = pw;
  return pw;
}

async function oc(pathname, { method = "GET", body, timeout = 20_000 } = {}) {
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
    j = { __raw: t.slice(0, 200) };
  }
  return { status: r.status, ...j };
}

function service(cmd) {
  if (NO_SERVICE) return;
  try {
    execSync(`systemctl ${cmd} ${SERVICE}`, { stdio: "pipe", timeout: 30_000 });
    log(`systemctl ${cmd} ${SERVICE} ✓`);
  } catch (e) {
    log(`systemctl ${cmd} 失败（继续）：${String(e.message).split("\n")[0]}`);
  }
}

(async () => {
  const listRes = await oc("/api/session");
  const list = listRes.data || [];
  log(`服务端现有会话 ${list.length} 个`);
  for (const s of list.sort((a, b) => Number(a.time?.created || 0) - Number(b.time?.created || 0))) {
    console.log(`  ${String(s.id).slice(-8)}  ${(s.model?.id || "?").padEnd(34)} ${s.outcome || "-"}`);
  }

  if (DRY) {
    log("--dry：什么都没删。要真删加 --yes。");
    process.exit(0);
  }
  if (!YES) {
    console.error("⚠️ 这会删掉全部会话，不可恢复。确认后加 --yes。建议先跑 node handover.mjs。");
    process.exit(2);
  }

  // ① 停桥接：不然删到一半它又建一个新的
  service("stop");
  await new Promise((r) => setTimeout(r, 1500));

  // ② 全删
  let deleted = 0;
  let failed = 0;
  for (const s of list) {
    const r = await oc(`/api/session/${s.id}`, { method: "DELETE", timeout: 20_000 });
    // 204 = 删成功但没内容；404 = 本来就没有。都算删掉了。
    if (r.status === 200 || r.status === 204 || r.status === 404) deleted += 1;
    else {
      failed += 1;
      log(`删除失败 ${String(s.id).slice(-8)} status=${r.status}`);
    }
  }
  log(`已删除 ${deleted} 个${failed ? `，失败 ${failed} 个` : ""}`);

  // ③ 建唯一会话
  const created = await oc("/api/session", {
    method: "POST",
    body: { location: { directory: HOME }, agent: AGENT, model: MODEL },
  });
  const d = created.data || created;
  if (!d?.id) {
    console.error("❌ 建会话失败：", JSON.stringify(created).slice(0, 300));
    service("start");
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(
    SESSION_FILE,
    JSON.stringify({ id: d.id, createdAt: Date.now(), model: MODEL, why: "清空全部会话后建立的唯一默认会话" }, null, 2) + "\n"
  );
  log(`✅ 唯一默认会话：${d.id}`);
  log(`   模型 ${MODEL.providerID}/${MODEL.id} · 工作目录 ${HOME}`);

  // ③.5 记忆接续：让她先读交接档案，确认「接上了」再放消息进来
  const digest = path.join(HOME, "memory", `HANDOVER-${new Date().toLocaleDateString("sv-SE")}.md`);
  if (fs.existsSync(digest)) {
    const warm = [
      `你换了一个新会话 —— 旧的已经归档，不是丢了。`,
      `先读这两样，再回一句话：`,
      `  1) ${digest}（记忆交接档案：你是谁、最近在做什么、上次聊到哪）`,
      `  2) ${path.join(HOME, "AGENTS.md")}（运行契约，最高优先级）`,
      ``,
      `读完只回一句「接上了」，并带上：你现在手上最重要的一件事是什么。`,
      `不要执行别的动作，不要发私信，不要写文件。`,
    ].join("\n");
    try {
      await oc(`/api/session/${d.id}/prompt`, { method: "POST", body: { text: warm }, timeout: 60_000 });
      log("📖 已让她读交接档案，等回话…");
      const deadline = Date.now() + 180_000;
      let said = "";
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await oc(`/api/session/${d.id}`);
        const sess = s.data || s;
        const busy = Number(sess?.time?.busy || 0);
        const idle = Number(sess?.time?.idle || 0);
        if (!(idle > 0 && idle >= busy)) continue;
        const mj = await oc(`/api/session/${d.id}/message`);
        const msgs = mj.data || [];
        for (const m of msgs) {
          if (m.type !== "assistant") continue;
          const t = (m.content || []).filter((c) => c.type === "text").map((c) => String(c.text || "").trim()).filter(Boolean).join("\n");
          if (t) said = t;
        }
        break;
      }
      log(said ? `🗣 她说：${said.replace(/\s+/g, " ").slice(0, 140)}` : "（没等到回话，但会话已就绪）");
    } catch (e) {
      log("记忆接续没跑成（不影响后续）：", e.message);
    }
  } else {
    log(`（没找到 ${digest}，跳过记忆接续）`);
  }

  // ④ 起桥接
  service("start");
  await new Promise((r) => setTimeout(r, 1200));
  try {
    const st = execSync(`systemctl is-active ${SERVICE}`, { encoding: "utf8", timeout: 8000 }).trim();
    log(`桥接状态：${st}`);
  } catch {}

  const left = (await oc("/api/session")).data || [];
  log(`现在服务端只剩 ${left.length} 个会话`);
  if (left.length !== 1) log("⚠️ 会话数不是 1，检查是否有进程在偷偷新建");
  process.exit(left.length === 1 ? 0 : 1);
})();
