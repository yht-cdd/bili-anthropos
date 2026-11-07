#!/usr/bin/env node
/**
 * check-publish.mjs —— 定时投稿发布核查（2026-10-31 主人令）
 * 用法：node check-publish.mjs [BV号]   默认 BV1rZxk69EuX
 * 逻辑：
 *   view code=0        → 已发布：拉这条的评论进事件队列，私信告诉主人「查得到」
 *   view code=62003    → 还没发：10 分钟后 systemd 会再跑一次（timer 每 10 分钟，发布后自行退出）
 *   其他               → 私信报异常
 * 退出码：0=已发布或待发布（正常），1=异常
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const BVID = process.argv[2] || "BV1rZxk69EuX";
const cookie = fs.readFileSync(path.join(HOME, "secrets/bili_cookie.txt"), "utf8").trim();
const H = { Cookie: cookie, "User-Agent": "Mozilla/5.0" };

const r = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${BVID}`, { headers: H })
  .then((x) => x.json()).catch((e) => ({ code: -1, message: e.message }));

const mark = (s) => console.log(new Date().toISOString(), "|", s);

function dm(text) {
  try {
    execFileSync("node", [path.join(HOME, "scripts/bili-dm.mjs"), text], { timeout: 45_000 });
    mark("DM 已发");
  } catch (e) { mark("DM 发送失败: " + e.message.slice(0, 80)); }
}

if (r.code === 0) {
  const d = r.data;
  mark(`已发布：《${d.title}》 播放${d.stat?.view} 评论${d.stat?.reply}`);
  // 评论收进事件队列（30s 的 bridge 节拍随后会自动派发）
  try {
    const out = execFileSync("node", [path.join(HOME, "scripts/bili-inbox.mjs"), "pull", "--video", BVID], { timeout: 60_000 }).toString();
    mark("inbox pull: " + out.split("\n").filter(Boolean).slice(-2).join(" / "));
  } catch (e) { mark("inbox pull 失败: " + e.message.slice(0, 80)); }
  dm(`定时投稿查到了：《${d.title}》${BVID} 已发布，播放 ${d.stat?.view}。这条的评论已进收件队列，有评论我会按闸门规则回（0-7 点静默窗内会压到 7 点后发）。`);
  // 一次性任务：发布确认后自杀，别让 timer 反复发 DM
  try {
    execFileSync("systemctl", ["disable", "--now", "anthropos-publish-check.timer"], { timeout: 15_000 });
    execFileSync("rm", ["-f", "/etc/systemd/system/anthropos-publish-check.timer", "/etc/systemd/system/anthropos-publish-check.service"], { timeout: 10_000 });
    mark("timer 已自删（一次性任务完成）");
  } catch (e) { mark("timer 自删失败: " + e.message.slice(0, 80)); }
  process.exit(0);
} else if (r.code === 62003) {
  mark("还没发布（62003 等待发布），下次 timer 再查");
  process.exit(0);
} else {
  mark(`异常 code=${r.code} ${r.message || ""}`);
  dm(`查定时投稿 ${BVID} 异常：code=${r.code} ${r.message || ""}。你去 B 站创作中心看一眼状态。`);
  process.exit(1);
}
