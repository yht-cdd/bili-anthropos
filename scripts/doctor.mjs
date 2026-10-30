#!/usr/bin/env node
/**
 * doctor.mjs — 三层体检
 * ============================================================
 * 用法：
 *   node scripts/doctor.mjs          人看（彩色分级）
 *   node scripts/doctor.mjs --json   agent 读（就是它的输入）
 *
 * 退出码：0 全绿 / 1 有 error / 2 脚本自身异常
 *
 * 判据三条（写在 AGENT-INSTALL.md 里）：
 *   ① 只看 failed[]，不要因为某句 detail 听起来像问题就动手
 *   ② 按 L0 → L1 → L2 的顺序修，底层错了上层报的错都是噪音
 *   ③ 每条失败都配了「怎么办」，不在里面的别自己发明
 */

import fs from "fs";
import { execSync } from "child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const JSON_MODE = process.argv.includes("--json");

const checks = { L0: [], L1: [], L2: [] };

function add(layer, id, ok, detail, hint) {
  checks[layer].push({ id, ok, detail: String(detail ?? ""), ...(hint ? { hint } : {}) });
}

function sh(cmd, timeout = 8000) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

async function main() {
  // ═══ L0 地基：系统本身 ═══
  const nodeV = process.version.replace(/^v/, "");
  const nodeMajor = Number(nodeV.split(".")[0]);
  add("L0", "node", nodeMajor >= 20, `node ${nodeV}`, nodeMajor >= 20 ? null : "npm i -g n && n 24，或装 NodeSource 源");

  const ocV = sh("opencode --version");
  const ocMajor = Number((ocV.match(/v?(\d+)\./) || [])[1] || 0);
  add("L0", "opencode", ocMajor >= 2, ocV || "未安装", ocMajor >= 2 ? null : "npm i -g @opencode/cli（不是 opencode-ai，那是 V1）");

  const tz = sh("date +%Z");
  add("L0", "timezone", /CST|UTC\+8/.test(tz) || sh("timedatectl show -p Timezone --value").includes("Shanghai"),
    `TZ=${tz}`, "timedatectl set-timezone Asia/Shanghai");

  const swap = Number((sh("free -m | grep -i swap") || "").split(/\s+/)[3] || 0);
  add("L0", "swap", swap >= 1024, `swap ${swap}MB`, swap >= 1024 ? null : "fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile");

  const disk = Number((sh("df -m / | tail -1") || "").split(/\s+/)[3] || 0);
  add("L0", "disk", disk >= 5000, `剩余 ${disk}MB`, disk >= 5000 ? null : "清理磁盘，opencode + ffmpeg 约需 600MB，另需空间存数据");

  // ═══ L1 大脑：opencode ═══
  const ocActive = sh("systemctl is-active opencode") === "active";
  add("L1", "service", ocActive, ocActive ? "active" : "未运行", "systemctl enable --now opencode");

  // ⚠️ 别用 `ss -tlnp | grep 4096`：ss 的 Send-Q 列也可能是 4096，
  // 任何服务只要 Send-Q=4096 就会让这项假通过。必须精确匹配本地地址列。
  const listen = sh("ss -tlnH 2>/dev/null | awk '{print $4}' | grep -x '127.0.0.1:4096'");
  add("L1", "port", listen === "127.0.0.1:4096", listen || "127.0.0.1:4096 未监听",
    "检查 /etc/systemd/system/opencode.service 的 --port 4096 和 --hostname 127.0.0.1");

  const pw = sh(`bash ${HOME}/scripts/opencode-password.sh`);
  add("L1", "password", pw.length > 20, pw ? `长度 ${pw.length}` : "取不到", "看 journalctl -u opencode | grep 'server password'；脚本在 scripts/opencode-password.sh");

  let apiOk = false, apiDetail = "";
  if (pw) {
    try {
      const r = await fetch("http://127.0.0.1:4096/api/session", {
        headers: { Authorization: "Basic " + Buffer.from(`opencode:${pw}`).toString("base64") },
        signal: AbortSignal.timeout(8000),
      });
      const ct = r.headers.get("content-type") || "";
      apiOk = r.status === 200 && ct.includes("json");
      apiDetail = `HTTP ${r.status} ${ct}`;
    } catch (e) {
      apiDetail = e.message;
    }
  }
  add("L1", "api", apiOk, apiDetail || "未测", apiOk ? null : "401 = 密码不对；200 但是 HTML = 路径少了 /api 前缀");

  // ═══ L2 神经：桥接 ═══
  const brActive = sh("systemctl is-active anthropos-bridge") === "active";
  add("L2", "service", brActive, brActive ? "active" : "未运行", "systemctl enable --now anthropos-bridge");

  const brEnabled = sh("systemctl is-enabled anthropos-bridge") === "enabled";
  add("L2", "autostart", brEnabled, brEnabled ? "enabled" : "disabled", "systemctl enable anthropos-bridge");

  const cookieFile = `${HOME}/secrets/bili_cookie.txt`;
  const cookieExists = fs.existsSync(cookieFile);
  let cookieDetail = cookieExists ? "存在" : "缺失";
  if (cookieExists) {
    const st = fs.statSync(cookieFile);
    const mode = (st.mode & 0o777).toString(8);
    const hasJct = fs.readFileSync(cookieFile, "utf8").includes("bili_jct=");
    const hasSess = /SESSDATA=[^;]{20,}/.test(fs.readFileSync(cookieFile, "utf8"));
    cookieDetail = `权限 ${mode}，SESSDATA ${hasSess ? "有" : "无"}，bili_jct ${hasJct ? "有" : "无"}`;
    add("L2", "cookie", hasJct && hasSess, cookieDetail, "从浏览器 F12 导出 Cookie，至少需要 SESSDATA / bili_jct / DedeUserID / buvid3");
  } else {
    add("L2", "cookie", false, cookieDetail, `写入 ${cookieFile}，chmod 600`);
  }

  const agentsFile = `${HOME}/AGENTS.md`;
  const agentsExists = fs.existsSync(agentsFile);
  const agentsTxt = agentsExists ? fs.readFileSync(agentsFile, "utf8") : "";
  // 关键不是「文件在不在」，是「占位符换没换」。<OWNER_UID> 留着不换，
  // 她认不出主人，所有私信都会被当成陌生人 —— 而 doctor 会显示绿。
  const ownerFilled = agentsExists && !/<OWNER_UID>|<OWNER_NAME>|<SELF_UID>|<SELF_NAME>/.test(agentsTxt);
  add("L2", "agents", agentsExists && agentsTxt.includes("主人") && ownerFilled,
    agentsExists ? `${agentsTxt.split("\n").length} 行${ownerFilled ? "" : "，⚠️ 占位符未替换"}` : "缺失",
    "cp AGENTS.md /opt/life/AGENTS.md，并把 <OWNER_UID> 换成真实 UID");

  // 桥接器从 owner_uid.txt 读主人 UID（不硬编码，防推到 git 泄露）。
  // 这里还要查一致性：契约里写的和代码认的必须是同一个人，
  // 否则会出现「她以为主人是 A，桥接器只放行 B」——两个都绿，但功能是坏的。
  const agentsUid = (agentsTxt.match(/主人\s*UID[：:]\s*`?(\d{6,})/) || [])[1] || "";
  const ownerFile = `${HOME}/secrets/owner_uid.txt`;
  let ownerUid = "";
  try { ownerUid = fs.readFileSync(ownerFile, "utf8").trim().split(/\s+/)[0]; } catch {}
  const maskUid = (u) => (u ? `${u.slice(0, 3)}***${u.slice(-2)}（${u.length}位）` : "空");
  const ownerOk = /^\d{6,}$/.test(ownerUid);
  const consistent = ownerOk && (!agentsUid || agentsUid === ownerUid);
  let ownerDetail = ownerOk ? maskUid(ownerUid) : "缺失";
  if (ownerOk && agentsUid && agentsUid !== ownerUid) {
    ownerDetail += `，⚠️ 与契约不一致（契约里是 ${maskUid(agentsUid)}）`;
  }
  add("L2", "owner", consistent, ownerDetail,
    `echo 你的B站UID > ${ownerFile} && chmod 600 ${ownerFile}；两个地方必须是同一个 UID`);

  const baseline = sh(`node -e '
    try {
      const {DatabaseSync} = require("node:sqlite");
      const db = new DatabaseSync("${HOME}/bili/data/bili.db");
      const r = db.prepare("SELECT v FROM kv WHERE k=?").get("bridge_baseline");
      console.log(r ? r.v : "");
    } catch(e) { console.log(""); }
  '`);
  add("L2", "baseline", !!baseline, baseline ? new Date(Number(baseline)).toISOString() : "未建立",
    "systemctl stop anthropos-bridge && node scripts/bili-bridge.mjs --once && systemctl start anthropos-bridge");

  // 汇总
  const failed = [];
  for (const [layer, list] of Object.entries(checks)) {
    for (const c of list) if (!c.ok) failed.push(`${layer}/${c.id}`);
  }
  const ok = failed.length === 0;

  if (JSON_MODE) {
    console.log(JSON.stringify({ ok, home: HOME, layers: checks, failed }, null, 2));
  } else {
    console.log(`\n  Anthropos 体检 · ${HOME}\n  ${"=".repeat(60)}`);
    const names = { L0: "L0 地基（系统）", L1: "L1 大脑（opencode）", L2: "L2 神经（桥接）" };
    for (const [layer, list] of Object.entries(checks)) {
      console.log(`\n  ${names[layer]}`);
      for (const c of list) {
        const mark = c.ok ? "✓" : "✗";
        console.log(`    ${mark} ${c.id.padEnd(12)} ${c.detail}`);
        if (!c.ok && c.hint) console.log(`      → ${c.hint}`);
      }
    }
    console.log(`\n  ${"=".repeat(60)}`);
    console.log(ok ? "  ✅ 三层全绿\n" : `  ❌ ${failed.length} 项未通过：${failed.join(", ")}\n`);
  }

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("doctor 自身异常:", e.message);
  process.exit(2);
});
