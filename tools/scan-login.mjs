/**
 * scan-login.mjs —— 本地扫码页面
 *
 * 解决一个很笨但很致命的问题：B 站二维码只有 180 秒寿命。
 * 由人「生成一张 → 发给人 → 人再扫」这套流程，等人看到就已经过期了。
 *
 * 所以改成：本地起一个页面，页面自己盯着二维码，快过期就换一张。
 * 你什么时候打开都能扫，扫完页面直接告诉你成功。
 *
 * 扫码成功后把凭证写到 RESULT_FILE，再由外部脚本传去服务器。
 */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import QRCode from "qrcode";

const APPKEY = "4409e2ce8ffd12b8";
const APPSEC = "59b43e04ad6965f34319062b478f83dd";
const PORT = 8899;
const RESULT_FILE = path.join(os.tmpdir(), "bili-login-result.json");
const TTL_MS = 170_000;          // 官方 180 秒，留 10 秒余量提前换

let cur = { url: "", code: "", at: 0, n: 0 };
let result = null;
let pollTimer = null;
let lastErr = "";

const say = (...a) => console.error(`[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}]`, ...a);

function signed(params) {
  const all = { ...params, ts: String(Math.floor(Date.now() / 1000)) };
  const qs = Object.keys(all).sort().map((k) => `${k}=${encodeURIComponent(all[k])}`).join("&");
  return new URLSearchParams({
    ...all,
    sign: crypto.createHash("md5").update(qs + APPSEC).digest("hex"),
  });
}

async function post(pathname, params) {
  const r = await fetch(`https://passport.bilibili.com${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
    },
    body: signed(params).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { code: -999, message: t.slice(0, 160) };
  }
}

async function freshQr() {
  try {
    const j = await post("/x/passport-tv-login/qrcode/auth_code", { appkey: APPKEY, local_id: "0" });
    if (j.code !== 0 || !j.data?.url) {
      lastErr = `生成失败 code=${j.code} ${j.message || ""}`;
      say(lastErr);
      return;
    }
    cur = { url: j.data.url, code: j.data.auth_code, at: Date.now(), n: cur.n + 1 };
    lastErr = "";
    say(`新二维码 #${cur.n} ${cur.code.slice(0, 8)}…`);
    startPoll();
  } catch (e) {
    lastErr = e.message;
    say("生成异常", e.message);
  }
}

function startPoll() {
  clearInterval(pollTimer);
  const mine = cur.code;
  pollTimer = setInterval(async () => {
    if (result || cur.code !== mine) return clearInterval(pollTimer);
    if (Date.now() - cur.at > TTL_MS) {
      clearInterval(pollTimer);
      say("二维码到期，换一张");
      return freshQr();
    }
    try {
      const j = await post("/x/passport-tv-login/qrcode/poll", {
        appkey: APPKEY,
        auth_code: mine,
        local_id: "0",
      });
      if (j.code === 0 && j.data) {
        result = j.data;
        clearInterval(pollTimer);
        fs.writeFileSync(RESULT_FILE, JSON.stringify(j.data, null, 2), { mode: 0o600 });
        say(`✅ 扫码成功 mid=${j.data.mid} → 已写 ${RESULT_FILE}`);
      } else if (j.code !== 86039 && j.code !== 86101) {
        lastErr = `${j.code} ${j.message}`;
      }
    } catch (e) {
      lastErr = e.message;
    }
  }, 3000);
}

const PAGE = `<!doctype html><html lang="zh"><meta charset="utf-8">
<title>B站扫码登录 · Anthropos</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
         background:#f6f7f9; color:#1a1a1a; }
  @media (prefers-color-scheme:dark){ body{background:#131417;color:#e8e8e8} .card{background:#1c1e22;border-color:#2a2d33}
    .hint{color:#9aa0a6} }
  .card { background:#fff; border:1px solid #e6e8eb; border-radius:16px; padding:28px 32px;
          box-shadow:0 8px 30px rgba(0,0,0,.07); text-align:center; max-width:520px; }
  h1 { font-size:17px; font-weight:600; margin:0 0 4px; }
  .sub { font-size:13px; color:#8a8f98; margin-bottom:18px; }
  img { width:300px; height:300px; image-rendering:pixelated; border-radius:8px; background:#fff; }
  .bar { height:4px; background:#eee; border-radius:2px; overflow:hidden; margin:16px 0 10px; }
  .bar i { display:block; height:100%; background:#00a1d6; transition:width .9s linear; }
  .hint { font-size:12.5px; color:#8a8f98; line-height:1.7; }
  .ok { font-size:15px; color:#16a34a; font-weight:600; }
  .err { font-size:12px; color:#dc2626; margin-top:8px; }
</style>
<div class="card">
  <h1>用「哔哩哔哩」App 扫这个码</h1>
  <div class="sub" id="sub">二维码会自动更换，不用赶时间</div>
  <img id="qr" src="/qr.png" alt="二维码">
  <div class="bar"><i id="bar" style="width:100%"></i></div>
  <div class="hint" id="hint">扫完手机上点「确认登录」</div>
  <div class="err" id="err"></div>
</div>
<script>
let seen = "";
async function tick(){
  try{
    const s = await (await fetch('/status',{cache:'no-store'})).json();
    if(s.done){
      document.getElementById('sub').innerHTML = '<span class="ok">✅ 登录成功，可以关掉这个页面了</span>';
      document.getElementById('hint').textContent = '凭证已取回（mid ' + s.mid + '）';
      document.getElementById('bar').style.width = '0%';
      return;
    }
    if(s.code !== seen){
      seen = s.code;
      document.getElementById('qr').src = '/qr.png?t=' + Date.now();
      document.getElementById('sub').textContent = '二维码会自动更换，不用赶时间';
    }
    const left = Math.max(0, 170 - Math.floor(s.age/1000));
    document.getElementById('bar').style.width = Math.min(100, left/170*100) + '%';
    document.getElementById('err').textContent = s.err || '';
  }catch(e){}
  setTimeout(tick, 2000);
}
tick();
</script></html>`;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  if (u.pathname === "/status") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(
      JSON.stringify({
        code: cur.code,
        age: Date.now() - cur.at,
        n: cur.n,
        done: !!result,
        mid: result?.mid || null,
        err: lastErr,
      })
    );
  }
  if (u.pathname === "/qr.png") {
    if (!cur.url) {
      res.writeHead(503);
      return res.end();
    }
    try {
      const png = await QRCode.toBuffer(cur.url, { width: 600, margin: 2, errorCorrectionLevel: "M" });
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
      return res.end(png);
    } catch (e) {
      res.writeHead(500);
      return res.end(String(e.message));
    }
  }
  if (u.pathname === "/result") {
    res.writeHead(result ? 200 : 404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(result || { waiting: true }));
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(PAGE);
});

server.listen(PORT, "127.0.0.1", async () => {
  say(`页面已就绪 → http://127.0.0.1:${PORT}`);
  await freshQr();
});
