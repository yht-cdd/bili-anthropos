#!/usr/bin/env node
/**
 * deliver.mjs —— 把文件交到主人手上
 * ============================================================
 * 规则（契约第十五节）：
 *   图片 → 直接私信
 *   视频 / 工程 / 压缩包 → 夸克分享链接 → 私信发链接
 *   邮箱 → 只做保底
 *   公开链接 → 可以发到公共区域（评论 / 动态），私密的不行
 *
 * 用法：
 *   node deliver.mjs 文件 [--to owner] [--public] [--via auto|quark|email] [--dry]
 *   node deliver.mjs 视频.mp4 --public        # 同时把链接发到评论区（仅限可公开内容）
 *
 * 退出码：0 成功 / 1 失败 / 2 参数错 / 3 通道不可用
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const HOME = process.env.LIFE_HOME || "/opt/life";
const argv = process.argv.slice(2);
const opt = {};
const pos = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true;
    else { opt[argv[i].slice(2)] = v; i += 1; }
  } else pos.push(argv[i]);
}

const file = pos[0] ? path.resolve(pos[0]) : "";
if (!file || !fs.existsSync(file)) {
  console.error("用法: node deliver.mjs 文件 [--to owner] [--public] [--via auto|quark|email] [--dry]");
  process.exit(2);
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const ext = path.extname(file).toLowerCase();
const isImage = IMAGE_EXT.has(ext);
const sizeMB = fs.statSync(file).size / 1024 / 1024;
const via = String(opt.via || "auto");

const log = (...a) => console.log(...a);

function has(bin) {
  try { execSync(`command -v ${bin}`, { stdio: "pipe" }); return true; } catch { return false; }
}

/** 传夸克并要一个分享链接 */
function quarkShare(f, isPublic) {
  const bin = String(process.env.QUARK_CLI || "quark");
  if (!has(bin)) throw Object.assign(new Error("服务器上没有夸克 CLI"), { code: 3 });
  // url-type 1 = 公开永久；2 = 私密。公开链接才能往公共区域发。
  const urlType = isPublic ? 1 : 2;
  const out = execSync(
    `OPENCLAW_CLI=1 ${bin} upload "${f}" --share --url-type ${urlType} --expired-type 1`,
    { encoding: "utf8", timeout: 600_000 }
  );
  const m = String(out).match(/https:\/\/pan\.quark\.cn\/s\/\S+/);
  if (!m) throw new Error("夸克没返回分享链接：" + String(out).slice(-200));
  return m[0].trim();
}

/** 发私信（文字） */
function dm(text) {
  const r = execSync(`node ${HOME}/scripts/bili-dm.mjs ${JSON.stringify(text)}`, {
    encoding: "utf8",
    timeout: 90_000,
  });
  return String(r).trim();
}

/** 图片私信：需要能发图的客户端；没有就退化成链接 */
function dmImage(f) {
  if (!has("bili")) return { ok: false, why: "没有能发图私信的客户端" };
  try {
    const r = execSync(`bili dm send --image "${f}"`, { encoding: "utf8", timeout: 180_000 });
    return { ok: true, detail: String(r).trim().slice(0, 200) };
  } catch (e) {
    return { ok: false, why: String(e.message).split("\n")[0] };
  }
}

function mail(text) {
  // 邮件只发给主人；发信动作走 alert.mjs 的同一套通道，但标题不同
  const r = execSync(
    `node ${HOME}/scripts/alert.mjs ${JSON.stringify("交付：" + path.basename(file))} ${JSON.stringify(text)}`,
    { encoding: "utf8", timeout: 120_000 }
  );
  return String(r).trim();
}

(async () => {
  log(`📦 ${path.basename(file)}  ${sizeMB.toFixed(1)}MB  ${isImage ? "图片" : "文件"}`);

  if (opt.dry) {
    log(JSON.stringify({ dry: true, file, isImage, sizeMB, via, public: !!opt.public }, null, 2));
    process.exit(0);
  }

  // ① 图片：优先私信，发不了退化成链接
  if (isImage && via !== "quark" && via !== "email") {
    const r = dmImage(file);
    if (r.ok) {
      log(`✅ 图片已发私信`);
      process.exit(0);
    }
    log(`⚠️ 图片私信不可用（${r.why}），改走夸克链接`);
  }

  // ② 文件（或图片降级）：夸克 + 私信链接
  if (via === "auto" || via === "quark") {
    try {
      const url = quarkShare(file, !!opt.public);
      log(`🔗 ${url}`);
      const msg = `给你：${path.basename(file)}\n${url}`;
      dm(msg);
      log(`✅ 链接已私信给主人`);
      if (opt.public) log(`   公开链接（可以发评论区）：${url}`);
      process.exit(0);
    } catch (e) {
      log(`⚠️ 夸克通道失败：${e.message}`);
      if (via === "quark") process.exit(e.code || 1);
    }
  }

  // ③ 邮箱保底：只发文字说明，不承诺带附件
  try {
    mail(`文件：${path.basename(file)}（${sizeMB.toFixed(1)}MB）\n夸克通道不可用，暂时只能告诉你路径：${file}`);
    log(`⚠️ 已用邮箱告知主人（只发了文字，没带文件）`);
    process.exit(1);
  } catch (e) {
    console.error(`❌ 全部通道都失败：${e.message}`);
    process.exit(1);
  }
})();
