#!/usr/bin/env node
/**
 * wbi.mjs — B 站 WBI 签名工具（可被其他脚本 import，也可命令行调用）
 *
 * 原理：
 *   1. 从 nav 接口拿 wbi_img.img_url / sub_url
 *   2. 各取文件名，拼成 64 字符
 *   3. 用固定 64 位置换表打乱，取前 32 位 = mixinKey
 *   4. 参数排序 → 拼接 → urlencode → md5(query + mixinKey) = w_rid
 *
 * 用法（模块）：
 *   import { wbiQuery, wbiSignedUrl } from "./wbi.mjs";
 *   const q = await wbiQuery({ oid: "170001", type: "1" });
 *   const url = `https://api.bilibili.com/x/v2/reply/wbi/main?${q}`;
 *
 * 用法（命令行）：
 *   node wbi.mjs                     打印当前 mixinKey
 *   node wbi.mjs --test              对公开视频跑一次签名请求自检
 */

import fs from "fs";
import { createHash } from "crypto";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const COOKIE_FILE = process.env.BILI_COOKIE_FILE || "/opt/life/secrets/bili_cookie.txt";

// B 站固定的 64 位置换表。这是常量，不要动。
const MIXIN_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

const CACHE_TTL_MS = 3600_000;
let _cache = null;

function readCookie() {
  try { return fs.readFileSync(COOKIE_FILE, "utf8").trim(); }
  catch { return ""; }
}

export function getMixinKey(orig) {
  return MIXIN_TAB.map(i => orig[i]).join("").slice(0, 32);
}

/** 拉取并缓存 mixinKey（wbi key 每周轮换，不能硬编码） */
export async function getMixinKeyCached(force = false) {
  if (!force && _cache && _cache.expires > Date.now()) return _cache.mixinKey;

  const r = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: {
      "User-Agent": UA,
      "Referer": "https://www.bilibili.com/",
      Cookie: readCookie(),
    },
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json();
  if (!j?.data?.wbi_img?.img_url) throw new Error(`取 wbi_img 失败 code=${j?.code} ${j?.message || ""}`);

  const imgKey = j.data.wbi_img.img_url.split("/").pop().split(".")[0];
  const subKey = j.data.wbi_img.sub_url.split("/").pop().split(".")[0];
  const mixinKey = getMixinKey(imgKey + subKey);

  _cache = { mixinKey, imgKey, subKey, expires: Date.now() + CACHE_TTL_MS };
  return mixinKey;
}

/**
 * 对参数签名，返回可以直接拼在 URL 后面的 query string
 * 会自动加上 wts 和 w_rid
 */
export async function wbiQuery(params) {
  const mixinKey = await getMixinKeyCached();
  const p = { ...params, wts: String(Math.floor(Date.now() / 1000)) };

  const query = Object.keys(p)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(p[k]).replace(/[!'()*]/g, ""))}`)
    .join("&");

  const w_rid = createHash("md5").update(query + mixinKey).digest("hex");
  return `${query}&w_rid=${w_rid}`;
}

/** 便利方法：直接返回带签名的完整 URL */
export async function wbiSignedUrl(baseUrl, params) {
  return `${baseUrl}?${await wbiQuery(params)}`;
}

// ── 命令行 ──────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  const args = process.argv.slice(2);

  if (args.includes("--test")) {
    console.log("=== WBI 自检 ===");
    const mk = await getMixinKeyCached(true);
    console.log("imgKey   :", _cache.imgKey.slice(0, 16) + "…");
    console.log("subKey   :", _cache.subKey.slice(0, 16) + "…");
    console.log("mixinKey :", mk);

    const url = await wbiSignedUrl("https://api.bilibili.com/x/v2/reply/wbi/main", {
      oid: "170001", type: "1", mode: "3", next: "0", ps: "5",
    });
    console.log("\n请求:", url.slice(0, 120) + "…");

    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Referer": "https://www.bilibili.com/",
        "Cookie": readCookie(),
      },
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    console.log("响应: code =", j.code, "|", j.message || "");
    if (j.code === 0) {
      console.log("✅ 签名有效，拿到", (j.data?.replies || []).length, "条评论");
    } else {
      console.log("❌ 签名失败");
      process.exit(1);
    }
  } else {
    const mk = await getMixinKeyCached(true);
    console.log("mixinKey :", mk);
    console.log("imgKey   :", _cache.imgKey);
    console.log("subKey   :", _cache.subKey);
    console.log("有效期   :", new Date(_cache.expires).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }));
  }
}
