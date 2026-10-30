# 安装

> 从一台干净的 Ubuntu 22.04 到「主人发私信 → 她执行 → 回复」的全过程。
> 全程实测过，每个坑都撞到过。

---

## 前置

| 项 | 要求 |
|---|---|
| 系统 | Ubuntu 22.04（20.04/24.04 应该也行，未测） |
| 内存 | **2 GB 起**。1G 会被 opencode + Node 撑爆 |
| 磁盘 | 20 GB 起（opencode 约 300MB，ffmpeg 约 300MB） |
| Node | **≥ 20**（实测 v24.22.2） |
| 网络 | 能访问 `api.bilibili.com`、`api.vc.bilibili.com`；GitHub 可能不通（见坑 6） |
| 账号 | 一个 B 站账号 + **已登录的浏览器**（用来导 Cookie） |

---

## 一、系统基线

### 1.1 时区与 swap

```bash
timedatectl set-timezone Asia/Shanghai

# 2G swap（2G 内存必须加，否则 opencode 一启动就 OOM）
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10
```

### 1.2 Node 与 opencode

```bash
# ⚠️ 不要装 opencode-ai，那是 V1
npm i -g @opencode/cli

node -v      # 期望 v24.x
opencode --version   # 期望 v2.x
```

> **为什么强调这个**：`opencode-ai`（V1，1.19.5）和 `@opencode/cli`（V2，2.2.x）是两个不同的 npm 包，
> 装错了不会自动升级。V1 的 API 路径和 V2 完全不同，本文档的所有端点都是 V2 的。

### 1.3 媒体工具（可选，但建议）

```bash
apt-get update -qq
apt-get install -y ffmpeg
```

装完她能处理视频文件（转码/截帧/抽音轨）。**注意：这不会让她「看懂」画面**，
看懂需要多模态模型 API。

---

## 二、建她的家

```bash
mkdir -p /opt/life/{scripts,secrets,exec,journal,diary,bili/{data,logs,drafts,outbox,assets}}
chmod 700 /opt/life/secrets
```

### 2.1 放契约 + 主人 UID

```bash
cp AGENTS.md /opt/life/AGENTS.md
```

**必须是同一个值**：你自己的 B 站 UID，要写进两个地方。

```bash
OWNER_UID=你的B站UID
OWNER_NAME=你的B站昵称
SELF_UID=这个AI账号的UID
SELF_NAME=这个AI账号的昵称

# ① 契约里（给她看的自然语言，她据此判定谁有权限）
sed -i "s/<OWNER_UID>/$OWNER_UID/g; s/<OWNER_NAME>/$OWNER_NAME/g" /opt/life/AGENTS.md
sed -i "s/<SELF_UID>/$SELF_UID/g;   s/<SELF_NAME>/$SELF_NAME/g" /opt/life/AGENTS.md

# ② 桥接器里（代码判定用，不进 git）
echo "$OWNER_UID" > /opt/life/secrets/owner_uid.txt
chmod 600 /opt/life/secrets/owner_uid.txt
```

> ⚠️ **为什么不硬编码进代码**：硬编码有两个毛病 —— 一推上 git 就泄露，别人拿去用还得改源码。
> 桥接器读不到这个值会**直接拒绝启动**（退出码 1），而不是静默把所有人当陌生人。
>
> 也支持环境变量：`export OWNER_UID=...`，优先级高于文件。

**验证两处都替换干净了：**

```bash
grep -c '<OWNER_UID>\|<SELF_UID>' /opt/life/AGENTS.md    # 期望 0
cat /opt/life/secrets/owner_uid.txt                       # 期望是你的 UID
```

### 2.2 放脚本

```bash
cp scripts/*.mjs scripts/*.sh /opt/life/scripts/
chmod +x /opt/life/scripts/*.sh
```

### 2.3 放 Cookie

从已登录的浏览器导出（F12 → Application → Cookies → `bilibili.com`），至少需要这些字段：

```
SESSDATA=...
bili_jct=...
DedeUserID=...
buvid3=...
```

写进文件：

```bash
cat > /opt/life/secrets/bili_cookie.txt <<'EOF'
SESSDATA=xxx; bili_jct=xxx; DedeUserID=xxx; buvid3=xxx; ...
EOF
chmod 600 /opt/life/secrets/bili_cookie.txt
```

**验证**：

```bash
node /opt/life/scripts/bili-cookie.mjs check
# 期望退出码 0，打出昵称/等级
```

---

## 三、起服务

### 3.1 opencode（大脑）

```bash
cp systemd/opencode.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now opencode
sleep 15

systemctl is-active opencode          # 期望 active
ss -tlnp | grep 4096                  # 期望 LISTEN 127.0.0.1:4096
```

**取密码并验证**：

```bash
PW=$(bash /opt/life/scripts/opencode-password.sh)
echo "密码长度: ${#PW}"     # 期望 43
curl -s -o /dev/null -w "%{http_code}\n" -u "opencode:$PW" http://127.0.0.1:4096/api/session
# 期望 200
```

### 3.2 bridge（神经）

```bash
cp systemd/anthropos-bridge.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now anthropos-bridge
```

**必须先建基线**，否则启动时会把历史私信全当成新任务：

```bash
systemctl stop anthropos-bridge
node /opt/life/scripts/bili-bridge.mjs --once
# 期望输出：基线建立：跳过历史 N 条私信
systemctl start anthropos-bridge
```

### 3.3 验收

```bash
# 1. 她认不认得自己
node /opt/life/scripts/bili-bridge.mjs --simulate "报出你的名字、你的 B 站 UID、主人 UID"
# 期望：Anthropos / 你的账号 UID / 你填的 OWNER_UID

# 2. 她能不能真执行
node /opt/life/scripts/bili-bridge.mjs --simulate "查一下内存和磁盘，用一句话回答"
# 期望：报出真实数值（和 free -m 对得上）

# 3. 端到端
# 用主人账号给这个 B 站账号发一条私信，等 12 秒
journalctl -u anthropos-bridge -n 20 --no-pager | grep "📨"
```

---

## 四个坑

### 坑 1 · `ExecStart=/usr/bin/node` → `status=203/EXEC`

**现象**：

```
Failed to locate executable /usr/bin/node: No such file or directory
Failed at step EXEC spawning /usr/bin/node
```

服务无限重启，`systemctl status` 显示 `activating (auto-restart)`。

**根因**：Node 是二进制包装安装的，在 `/usr/local/bin/node`，不在 `/usr/bin`。

**修法**：

```bash
NODE=$(command -v node)
sed -i "s|^ExecStart=.*|ExecStart=$NODE /opt/life/scripts/bili-bridge.mjs|" \
  /etc/systemd/system/anthropos-bridge.service
systemctl daemon-reload && systemctl restart anthropos-bridge
```

### 坑 2 · session 少给 `model` → 永远不执行

**现象**：`POST /api/session` 返回 200，`POST /prompt` 也返回 200，
消息对象里 `delivery: "steer"` 看起来正常 —— 但 `time` 里只有 `busy`，没有 `idle`，
而且**目标文件根本没被创建**。

**根因**：新建 session 时只给了 `location` + `agent`，没给 `model`。
没有模型的 session 会接收消息，但不会调度执行。

**修法**：

```json
{
  "location": { "directory": "/opt/life" },
  "agent": "build",
  "model": { "providerID": "opencode", "id": "deepseek-v4.1-flash-free", "variant": "max" }
}
```

**判据**：验证「AI 有没有真的执行」，**不能看 API 返回码，要看副作用**——
文件有没有被创建、命令输出对不对得上。

### 坑 3 · 密码每次都变，且不在配置文件里

**现象**：重启 opencode 后所有 API 调用 401。

**根因**：V2.2.2 的密码是每次启动随机生成的 43 字符，**只打进 journald**，
不写 `service.json`。而且三个环境变量（`OPENCODE_PASSWORD` / `OPENCODE_SERVER_PASSWORD` /
`OPENCODE_API_KEY`）实测都无法固定它。

**修法**：用 `scripts/opencode-password.sh` 兜底提取（先找 `service.json`，再抓 journald）。
桥接器缓存密码 60 秒，遇 401 自动清缓存重取。

**验证**：

```bash
PW=$(bash /opt/life/scripts/opencode-password.sh)
curl -s -o /dev/null -w "%{http_code}\n" -u "opencode:$PW" http://127.0.0.1:4096/api/session
```

### 坑 4 · 首次启动把历史私信全执行了

**现象**：服务一启动，日志刷出十几条 `📨 主人: ...`，全是几个月前的消息。

**根因**：没有基线，所有未标记的消息都被当成新任务。

**修法**：

```bash
systemctl stop anthropos-bridge
node /opt/life/scripts/bili-bridge.mjs --once   # 建基线
systemctl start anthropos-bridge
```

重建基线（想重新处理历史时）：

```bash
node -e '
const {DatabaseSync}=require("node:sqlite");
const db=new DatabaseSync("/opt/life/bili/data/bili.db");
db.exec("DELETE FROM dm_seen; DELETE FROM kv WHERE k IN (\"bridge_baseline\",\"bridge_session_ts\")");
console.log("已清空，下次 tick 会重建基线");
'
```

---

## 三个「看起来像但其实是」的坑

### 坑 5 · `GET /session` 返回 200，但那是 HTML

不带 `/api` 前缀的路径（`/session`、`/config`、`/agent`、`/provider`）全部返回 200，
内容是 SPA 的 HTML 首页。

**判据**：看 `Content-Type` 是不是 `application/json`。不是就是兜底页面。

### 坑 6 · GitHub 直连超时（国内 ECS）

```
GnuTLS recv error (-110): The TLS connection was non-properly terminated.
Failed to connect to github.com port 443 after 130271 ms: Connection timed out
```

**修法**（三选一）：

```bash
# A. 用镜像
git clone https://ghproxy.net/https://github.com/user/repo.git

# B. 本地下 zip 再 scp
# 本地：下载 codeload.github.com 的 zip
scp repo.zip root@host:/opt/refs/
# 服务器：unzip

# C. apt/npm 反而很快（阿里云内网），可以直接装包
```

### 坑 7 · `msg_key` 是 19 位数字，超过 JS 安全整数

`7702380000000000000` > `Number.MAX_SAFE_INTEGER`（9007199254740991）。
`JSON.parse` 之后末几位会被抹平，拿它当去重键会误判。

**修法**：用 `timestamp | sender_uid | sha1(content)[0:12]`。

---

## 验收清单

| 检查项 | 命令 | 期望 |
|---|---|---|
| 时区 | `date` | CST +0800 |
| swap | `free -m \| grep Swap` | 2047 |
| Node | `node -v` | v20+ |
| opencode | `opencode --version` | v2.x |
| 大脑 | `systemctl is-active opencode` | active |
| 端口 | `ss -tlnp \| grep 4096` | 127.0.0.1:4096 |
| 鉴权 | `curl -u opencode:$PW .../api/session` | 200 |
| 桥接 | `systemctl is-active anthropos-bridge` | active |
| 自启 | `systemctl is-enabled anthropos-bridge` | enabled |
| 契约 | `--simulate "你的主人 UID 是多少"` | 答对你填的值 |
| 执行 | `--simulate "查内存"` | 数值和 `free -m` 一致 |
| 端到端 | 真发一条私信 | 12 秒内检测，5-10 秒回复 |
| 隔离 | 换个账号发私信 | 不回复、不执行 |

---

## 常见故障排查

| 症状 | 先查什么 |
|---|---|
| 私信发了没反应 | `journalctl -u anthropos-bridge -n 30` 看有没有 `📨`；没有就是轮询没跑到 |
| 有 `📨` 但没回复 | 看有没有 `✅ 任务完成`；没有就是大脑卡住，查 `systemctl status opencode` |
| 回复是空的 | 看 `GET /api/session/{id}/message`，assistant 消息里有没有 `type:"text"` |
| 401 | 密码变了，`bash scripts/opencode-password.sh` 重取 |
| 服务反复重启 | `journalctl -u anthropos-bridge -n 50`，多半是 ExecStart 路径或 Cookie 文件缺失 |
| 内存快满 | `ps -eo rss,cmd --sort=-rss \| head`；opencode 硬限 1100M |
| Cookie 失效 | `node scripts/bili-cookie.mjs check`，重新导出覆盖 |

---

## 安全提醒

1. **不要开放 4096 到公网**。opencode 必须绑 `127.0.0.1`，远程用 SSH 隧道。
2. **不要让她主动给陌生人发私信**。B 站封号最高发区，且会滑向讨好型聊天机器人。
3. **私信发送只允许回复主人**，这条在桥接器里是代码级硬限制，不是配置项。
4. **不要装桌面环境**。2G 内存扛不住。
5. **记得备份 `/opt/life/`**。磁盘丢了等于她的记忆全失。
6. **`secrets/` 目录 700，Cookie 文件 600**，永远不进版本控制。
