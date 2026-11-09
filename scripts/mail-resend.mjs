#!/usr/bin/env node
// mail-resend.mjs — 走 Resend API 发邮件（主人 2026-11-07 提供 key，替代 agentsend 的 10 封/天限制）
// 凭据：secrets/resend_token.txt（600，脚本内读，永不回显）
// 用法：
//   node mail-resend.mjs --to <email> --subject "标题" --text "正文" [--html "<p>..</p>"]
//   node mail-resend.mjs ... --file <路径>      把文本文件内容并进正文（不是附件）
//   node mail-resend.mjs ... --attach <路径>    真正的二进制附件（可重复，video/mp4 等）
//   node mail-resend.mjs --test            # 给主人 gmail 发一封自检
// 默认收件人 = 主人 gmail（主人示例指定）。
//
// 附件上限：Resend 官方写「max 40MB per email, after Base64 encoding」。
// 2026-11-10 加 --attach 就是为了发视频（14.2MB → base64 约 18.9MB，够）。
// ⚠️ 沙箱域限制：from 用 onboarding@resend.dev 时，只能发给账户自己的已验证地址；
//    发别处会 403。要发给任意收件人，得先在 Resend 验证一个自有域名。
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const KEY_FILE = path.join(os.homedir(), ".config", "resend_token.txt"); // 兜底路径
const HOME = "/opt/life";
const TOKEN = fs
  .readFileSync(path.join(HOME, "secrets/resend_token.txt"), "utf8")
  .trim();
const OWNER_GMAIL = "egegvehr666@gmail.com"; // 主人 Resend 示例里的收件地址

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--test") opt.test = true;
  else if (args[i].startsWith("--")) {
    const k = args[i].slice(2);
    const v = args[++i];
    // --attach 可以重复给多次，攒成数组
    if (k === "attach") (opt.attach ||= []).push(v);
    else opt[k] = v;
  }
}

const MIME = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".md": "text/markdown",
  ".txt": "text/plain",
};

/** 真附件：读成 base64 塞进 Resend 的 attachments 数组 */
function buildAttachments(paths = []) {
  return paths.map((p) => {
    const abs = path.resolve(String(p));
    if (!fs.existsSync(abs)) throw new Error(`附件不存在：${abs}`);
    const size = fs.statSync(abs).size;
    return {
      filename: path.basename(abs),
      content: fs.readFileSync(abs).toString("base64"),
      contentType: MIME[path.extname(abs).toLowerCase()] || "application/octet-stream",
      _size: size,
    };
  });
}

async function send({ to, subject, text, html, attachments }) {
  const payload = {
    from: "onboarding@resend.dev",
    to: [to || OWNER_GMAIL],
    subject,
    html: html || `<pre style="white-space:pre-wrap">${String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`,
  };
  if (attachments && attachments.length) {
    // 去掉内部的 _size 字段，Resend 不认
    payload.attachments = attachments.map(({ filename, content, contentType }) => ({ filename, content, contentType }));
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

if (opt.test) {
  const { status, j } = await send({
    subject: "Anthropos · Resend 通道自检",
    text: `这是一封自检邮件。时间：${new Date().toISOString()}。如果你收到它，说明 Resend 发信链路通了。`,
  });
  console.log(JSON.stringify({ status, id: j.id, error: j.error?.message || null }));
  process.exit(status === 200 ? 0 : 1);
}

if (!opt.subject) {
  console.error('用法: node mail-resend.mjs --to <email> --subject "标题" --text "正文" | --test');
  process.exit(2);
}

let text = opt.text || "";
if (opt.file) {
  const body = fs.readFileSync(opt.file, "utf8");
  text = text ? `${text}\n\n——\n附件内容（${path.basename(opt.file)}）：\n\n${body}` : body;
}

let attachments = [];
if (opt.attach && opt.attach.length) {
  attachments = buildAttachments(opt.attach);
  const totalB64 = attachments.reduce((n, a) => n + Math.ceil(a._size / 3) * 4, 0);
  console.log(
    `附件 ${attachments.length} 个：` +
      attachments.map((a) => `${a.filename} ${(a._size / 1024 / 1024).toFixed(2)}MB`).join(" / ") +
      `（base64 后合计 ${(totalB64 / 1024 / 1024).toFixed(2)}MB，上限 40MB）`
  );
  if (totalB64 > 40 * 1024 * 1024) {
    console.error("❌ 超过 Resend 40MB（base64 后）上限，发不出去");
    process.exit(2);
  }
}

const { status, j } = await send({ to: opt.to, subject: opt.subject, text, attachments });
console.log(JSON.stringify({ status, id: j.id, error: j.error?.message || null }));
process.exit(status === 200 ? 0 : 1);
