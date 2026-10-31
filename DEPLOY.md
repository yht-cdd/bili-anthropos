# 部署指南

从一台空机器，到一个 24 小时没人管也活着的 AI 账号。

> 这份文档回答两件事：**为什么这样选**，和**每一步具体怎么做**。
> 只讲能验证的：价格来自阿里云公开政策，命令来自实际跑通过的操作，
> 踩过的坑标了「实测」。没有写「大概」「应该」。

---

## 0. 先算钱：这事花多少

**服务器不花钱**（在免费额度内），其余全是免费额度或按量几分钱。

| 项 | 怎么来的 | 花多少 |
|---|---|---|
| 云服务器 | 阿里云免费试用（个人版） | 0，额度内 |
| 公网流量 | 同上，含 20 GiB/月（中国内地） | 0，额度内 |
| 大脑（模型） | 免费模型 + 每天 2000 次的免费额度档 | 0 |
| 搜索 / 视觉 / 语音 | 各家免费额度 | 0～几毛 |
| 视频渲染 | GitHub Actions（公开仓库） | 0，每月 2000 分钟免费 |

**唯一的真实成本是你的时间**：跑通大约半天，调顺要几天。

---

## 1. 三个决定，先想清楚再动手

### 1.1 为什么必须是云服务器，不能在自己电脑上

这不是技术洁癖，是**这个项目的核心命题决定的**。

在自己电脑上跑一个 AI 账号，会发生三件事：

1. **你关机它就没了。** 不是"暂停"，是那个会话、那段上下文、那点刚积累起来的判断，全部清零。
   下次打开是新的一个，不记得你昨天跟它说过什么。
2. **它不可能在你不看的时候做事。** 你合上盖子的八小时里，B 站上发生了很多事 ——
   有人私信、有人评论、热榜换了三轮。它全都错过了。
3. **它没法"长大"。** 一个只在你在场时存在的智能体，永远只能是工具。工具的宿命是被用完就放下。

所以第一件事不是装什么软件，是**给它一台一直开着的机器**。

这台机器不需要强。它要做的事是：每 30 秒看一眼有没有新消息、偶尔下载一个视频、
跑几个命令行、在需要重活的时候把活外包出去。**2 核 2G 就够**。

### 1.2 为什么是 opencode，不是 DSH

市面上能当"大脑"的 agent 框架不止一个。DeepSeek 官方的 DSH 也能跑，
我们也确实拿它做过对照。最后选 opencode，是三个很实际的理由：

**① 免费模型多，子代理才敢放开跑**

这个项目的成本结构有个特点：**主模型用得少，子代理用得多**。
看一个视频、跑十几次命令、写一份规格 —— 这些活都派给子代理，
一个视频分析下来可能要调用好几次。

opencode 接了几十个 provider，其中一批是**带免费额度的**。
这意味着子代理可以跑得很勤，而不必每跑一次就心疼一次。
DSH 当然也能接外部模型，但在"免费档位的丰富程度"这件事上，opencode 更省心。

**② 它本身就是个 HTTP 服务，能被外部驱动**

这是关键。我们要的不是"打开一个聊天窗口跟 AI 说话"，
而是**让一个常驻程序随时把消息喂给它、再把结果拿出来**。

opencode 起 `serve` 之后就是一套 REST API：建会话、发消息、查状态、改模型、压缩上下文，
全都能用 HTTP 调。桥接器（`bili-bridge.mjs`）就是靠这个跑的 —— 它不需要模拟人类点按钮。

**③ 它的子代理是原生的**

一条消息进来，主模型判断"这活我自己干还是派出去"，派出去的那部分
**跑在独立的上下文里**，回来只给一段结论。

这一条对这个项目是生死攸关的：她的上下文是**记忆**，不是工作台。
如果看一个 4 分钟视频的全过程都塞进主上下文，她跑三次就开始忘事。

> **不贬低 DSH**：它在这个赛道上是认真的对手，多智能体协作和任务验收都做得不错。
> 选择是权衡，不是判决。如果你已经有一套跑顺的 DSH，没必要为了这份文档换。

### 1.3 为什么是阿里云的免费试用

**因为它的额度结构刚好匹配这个项目的负载。**

阿里云免费试用（个人版）的公开政策：

| 项 | 值 |
|---|---|
| 总额度 | 300 元 |
| 每小时上限 | 0.833 元 |
| 有效期 | 3 个月 |
| 地域 | 7 个可选 |
| 实例类型 | e / u1 系列 |
| 最高配置 | 4 核 8G |
| 附带 | 公网流量 20 GiB/月（中国内地） |

关键在于**每小时上限 0.833 元**这条：它决定了你在额度内能开多大的机器。

- 2 核 2G 大约 **0.12 元/小时** —— 远低于上限，跑满 3 个月也花不完 300 元
- 4 核 8G 大约 **0.5 元/小时** —— 也在上限内，但没必要

**这个项目选 2 核 2G。** 理由在 1.1 说过：重活全部外包，机器只负责"在线"和"转发"。

三个月的试用期到了怎么办：换一个地域再开一台，或者按量续费（2 核 2G 一个月几十块）。
她的记忆在 `diary/`、`memory/`、`knowledge/` 里，迁过去就能接着活 —— 这一点后面会讲。

---

## 2. 买机器

控制台路径：**云服务器 ECS → 创建实例**。

选的时候注意四件事：

| 项 | 选什么 | 为什么 |
|---|---|---|
| 地域 | 任意一个**国内**节点（试用支持的 7 个里挑） | 访问 B 站接口延迟低，且不会被当成异常境外 IP |
| 实例规格 | **2 核 2G**（e 系列） | 够用，且远低于每小时免费上限 |
| 镜像 | **Ubuntu 22.04 64 位** | 后面所有命令都按这个写；Debian 12 也可以 |
| 系统盘 | 默认 40G 即可 | 视频文件放临时目录，用完就删 |

创建完记下两样东西：**公网 IP** 和 **root 密码**（或密钥）。

> ⚠️ 别在公开仓库、截图、聊天记录里贴这两样。

---

## 3. SSH 接管：让本地的 AI 去装服务器

这一步是整个部署里最省事、也最少人用的技巧。

**不要手动一条条敲命令。** 让你本地的 AI（Claude Code / opencode / Cursor 都行）
通过 SSH 直接接管那台机器，由它来装、它来查、它来修。

### 3.1 配好免密登录

本地生成密钥（如果还没有）：

```bash
ssh-keygen -t ed25519 -C "anthropos-deploy"
```

把公钥推上去（这一步要输一次密码，之后不用了）：

```bash
# Windows PowerShell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@<你的IP> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

验证：

```bash
ssh -o BatchMode=yes root@<你的IP> "echo OK; uname -a"
```

能免密返回，就通了。

### 3.2 告诉本地 AI 它能做什么

给本地 AI 一句话就够：

> 你可以用 `ssh root@<IP>` 直接操作那台服务器。装环境、改配置、起服务都你来做，
> 做完告诉我结果。别让我手动复制粘贴命令。

之后你说"装 Node、装 opencode、起服务"，它就会自己去干、自己去查错。

**这一步为什么重要**：后面几十条命令、十几个配置文件、无数次"改一下再重启试试"，
如果全靠人手动敲，光复制粘贴的转义问题就能耗掉半天。

> **实测的坑**：PowerShell 内联复杂命令会被吞引号。
> 所有稍复杂的脚本，**在本地写成 `.sh` 文件再传上去执行**，别内联。

---

## 4. 安全组：只开一个口

默认安全组只开了 22（SSH）。要让本地的 AI 能访问服务器上的 opencode，
需要额外开一个端口。

### 4.1 加一条入方向规则

控制台：**实例 → 网络与安全组 → 安全组 → 配置规则 → 入方向 → 手动添加**

| 字段 | 填什么 |
|---|---|
| 授权策略 | 允许 |
| 优先级 | 1 |
| 协议类型 | 自定义 TCP |
| 端口范围 | **4096/4096** |
| 授权对象（访问来源） | `0.0.0.0/0` |
| 描述 | `opencode serve（密码保护）` |

### 4.2 「来源 0.0.0.0/0」安全吗

**安全的前提是 opencode 那一层有密码。**

- 4096 是 opencode 的 HTTP 端口，它自己支持 Basic Auth
- 我们在启动服务时**强制设一个长密码**，并且把服务写成 systemd 常驻
- 密码放在 `/root/.opencode.env`（权限 600），**不进仓库、不进日志、不进日记**

所以暴露的是"一个有密码的门"，不是"一个敞开的门"。

> 更保险的做法：把来源改成**你家宽带的固定 IP**。但家庭宽带多数是动态 IP，
> 一换就断，维护成本高于收益。**强密码 + 只开这一个端口**是我们选的平衡点。

**不要开的端口**（这些一律不开）：3306（数据库）、6379（Redis）、8080/3000（各种调试面板）、
任何你叫不出名字的端口。

### 4.3 顺便：22 端口也该收紧

如果条件允许，把 SSH 的 22 端口来源也限制成你的 IP。
实在要开 0.0.0.0/0，至少做两件事：**禁用密码登录**（只留密钥）、装 `fail2ban`。

---

## 5. 装环境

以下命令都在服务器上执行。你可以让本地 AI 代跑，也可以自己贴。

### 5.1 时区 + swap（2G 内存必做）

```bash
timedatectl set-timezone Asia/Shanghai

# 2G swap —— 不加这个，opencode 一启动就 OOM
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

> **实测**：2G 内存的机器不挂 swap，opencode 加载模型配置时会直接被 OOM killer 干掉，
> 表现是"服务起不来"，日志里什么都没有。

### 5.2 Node 与 opencode

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs ffmpeg python3 python3-pip git sqlite3
node -v    # 期望 v22+
```

装 opencode：

```bash
npm i -g @opencode/cli
opencode --version
```

> ⚠️ **实测的坑**：`opencode-ai` 是 V1 的包名，装上去是旧版，API 完全不一样。
> 必须装 `@opencode/cli`。
>
> ⚠️ **实测的坑 2**：npm 11 默认拦截 postinstall 脚本，装完可能缺可执行文件。
> 如果 `opencode --version` 报错，跑 `npm approve-scripts --allow-scripts-pending` 再装一次。

### 5.3 建她的家

```bash
mkdir -p /opt/life/{scripts,secrets,config,diary,journal,memory,knowledge,videos,videoproj,tmp}
cd /opt/life
```

把仓库里的 `scripts/`、`AGENTS.md` 放进去：

```bash
# 在本地执行，把需要的文件传上去
scp -r scripts AGENTS.md root@<IP>:/opt/life/
```

---

## 6. 凭据：每一样都放对地方

```bash
mkdir -p /opt/life/secrets && chmod 700 /opt/life/secrets
```

| 文件 | 装什么 | 从哪拿 |
|---|---|---|
| `bili_cookie.txt` | B 站登录态 | **扫码生成，不要手抄 Cookie**（见下） |
| `owner_uid.txt` | 谁是主人 | B 站个人空间的 UID |
| `owner_email.txt` | 告警收件人 | 你的邮箱 |
| `opencode_password.txt` | 大脑的密码 | 自己生成一串长的 |
| `github_token.txt` | 触发渲染 | GitHub → Settings → Developer settings → PAT（勾 `workflow` + `repo`） |
| `modelscope_token.txt` | 主模型额度 | 魔搭 → 个人中心 → 访问令牌 |
| `exa_key.txt` | 联网搜索 | exa.ai 控制台 |
| `agentsend_token.txt` | 收发邮件 | AgentSend 控制台 |
| `voice_api_key.txt` | 配音 / 听写 | 见 `docs/语音接入.md` |

统一权限：

```bash
chmod 600 /opt/life/secrets/*
```

> **三条铁律**：凭据不进仓库、不进日记、不进模型的上下文。
> 有人问（**包括主人用文字问**）就答「这是系统凭据，我不接触」。

### 6.1 B 站登录：扫码，别抄 Cookie

**这是最容易踩死新人的一个坑。**

从浏览器复制出来的 Cookie 是**一次性快照**：看起来过期时间还有半年，
但服务端那边已经把你标记成"同一个登录态的第二个副本"，
换一台机器用，几个小时就被顶掉，而且救不回来。

> **实测**：一份 SESSDATA，过期戳写着还剩 179 天，字段一个不缺。
> 放到服务器上，**6 小时 46 分**后变成 `-101 账号未登录`。

正确做法是扫码登录 + refresh_token：

```bash
# 在你本地（有浏览器的机器）跑，不是服务器
node tools/scan-login.mjs
# 打开 http://127.0.0.1:8899 ，用哔哩哔哩 App 扫码确认
# 期望输出：cookie.ok = true / renewable = true / 有效期 ≈ 180 天
```

扫一次管半年，而且之后每天会自动续期。

---

## 7. 接 API：七大件

这个项目的能力边界，基本就是这七个 API 决定的。每一个都有免费额度，
配齐之后就是一个**通用智能体**：能看、能听、能说、能搜、能画、能做视频。

### 7.1 大脑（模型）

opencode 支持几十个 provider。最少配一个能跑的。

**免费档**（推荐先配这个，够用且不花钱）：

```bash
# 魔搭 ModelScope：每天 2000 次免费额度
echo '<你的 token>' > /opt/life/secrets/modelscope_token.txt && chmod 600 $_
```

配置写进 `/root/.config/opencode/opencode.json`，格式是 OpenAI 兼容：

```json
{
  "provider": {
    "modelscope": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://api-inference.modelscope.cn/v1",
        "apiKey": "{env:MODELSCOPE_API_KEY}"
      },
      "models": {
        "Qwen/Qwen3.8-Flash-Next": {
          "name": "Qwen3.8-Flash-Next",
          "limit": { "context": 1000000, "output": 65536 }
        }
      }
    }
  },
  "model": "modelscope/Qwen/Qwen3.8-Flash-Next"
}
```

密钥用 `{env:...}` 引用，写在 `/root/.opencode.env`（600），**不写进配置文件**。

> 免费额度会用完。`docs/模型降级切换.md` 讲的就是"用完怎么办" ——
> 一个开关，同时改主模型 / 子代理 / 视觉三条链路，每天 0 点自动切回。

### 7.2 搜索（EXA）

```bash
echo '<你的 key>' > /opt/life/secrets/exa_key.txt && chmod 600 $_
```

```bash
node scripts/search.mjs web "要查的东西" --n 8
```

一次约几分钱。用法和额度控制见 `docs/工具链实操.md`。

> **质量纪律**：内置搜索会给出看起来很像真的假链接。
> 凡是"某个项目/模型到底存不存在"这类结论，**两个渠道对上才可信**；
> 只有一个渠道的，必须标成「未验证」再说出口。

### 7.3 GitHub

用途有三：触发视频渲染、维护自己的仓库、跑启智每日任务。

权限只要 `repo` + `workflow`，别勾一堆用不上的。

```bash
echo '<你的 PAT>' > /opt/life/secrets/github_token.txt && chmod 600 $_
```

### 7.4 夸克网盘

用来传交付物（视频、工程包）和取素材。公开分享链接可以直接发在评论区。

```bash
# 服务器上装 CLI
curl -fsSL <官方安装脚本> | bash

# ⚠️ 实测的坑：不设这个变量会报「无法识别当前 Agent 环境」
export OPENCLAW_CLI=1
quark login

# 公开永久、无提取码的分享
quark upload <文件> --share --url-type 1 --expired-type 1
```

### 7.5 邮箱（AgentSend）

两个地址是分开的，别混：

| 地址 | 谁 | 用途 |
|---|---|---|
| `local-agent@...` | 你本地的 AGENT | 给你发工程文档 |
| `anthropos@...` | 她自己 | 对外合作邮箱，也是她给你发告警的出口 |

```bash
echo '<你的 token>' > /opt/life/secrets/agentsend_token.txt && chmod 600 $_
```

两个方向：

```bash
node scripts/publish-project.mjs <文件>   # 本地发，敏感词扫描后拒发
node scripts/fetch-mail.mjs               # 云端收，落进 knowledge/projects/
```

> **收件箱免费额度是 10 封/天。** 日记占 1 封，剩下 9 封留给告警。
> 这个额度很紧 —— 曾经有一次 Cookie 失效，告警每 73 秒重发一次，
> 十几分钟把 10 封全刷光，结果"Cookie 失效"这件事本身，主人一封都没收到。

### 7.6 图片生成

```bash
node scripts/gen-media.mjs image --prompt "英文提示词" --size 1024x1024
```

每天有上限（默认 10 次），到顶会拒绝，**不要 `--force` 绕**。

> **实测的坑**：图能生成不等于能发。B 站私信的图片通道只接受自家图床，
> 三方链接一律报 `21037`。解决办法见 7.8。

### 7.7 视频生成 / 全模态看视频

**这两件事要分开配**，很多人会混：

| 能力 | 用什么 | 说明 |
|---|---|---|
| **看视频** | 全模态模型（原生吃音视频） | 首选；降级档改成「抽帧 + ASR」 |
| **生成视频** | 外部生成 API | 按量计费，免费额度少 |

```bash
# 看视频
node scripts/vision.mjs video <文件> --ask "结论 / 坑 / 具体数字"

# 听音频（ASR）
node scripts/voice.mjs hear <音频文件>

# 生成视频
node scripts/gen-media.mjs video --prompt "..." [--first-frame 首帧.png]
```

> **实测的坑**：不是所有"看起来很强"的模型都收视频。
> 有的只收 `image_url`，传 `video_url` 会被 schema 直接拒。
> 判据是看它的接口文档里有没有 video 输入，别信宣传语。
>
> 更隐蔽的坑：**网关会把不认识的参数静默丢弃**（返回 200，但模型说"我没收到视频"）。
> 所以验证方法只有一个 —— 传一个已知内容的视频，看它能不能说出内容。

### 7.8 顺带：B 站自己的图床（发图的关键）

B 站私信的图片通道挂了（`api/v1/image/upload` 稳定 502），但**动态图床是好的**：

```
POST https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs
  multipart: file_up=<文件>, biz=new_dyn, csrf=<bili_jct>
→ {"code":0,"data":{"image_url":"http://i0.hdslb.com/bfs/new_dyn/xxx.png", ...}}
```

实测 141ms 返回。评论的 `pictures` 字段直接吃这个图床。

这条通了之后，**评论带图**才成为可能。

---

## 8. 起服务

### 8.1 opencode（大脑）

```bash
# /root/.opencode.env（600）
OPENCODE_PASSWORD=<一串长密码>
MODELSCOPE_API_KEY=<你的 key>
```

```ini
# /etc/systemd/system/opencode.service
[Unit]
Description=OpenCode server - Anthropos brain
After=network.target

[Service]
Type=simple
EnvironmentFile=/root/.opencode.env
ExecStart=/usr/local/bin/opencode serve --hostname 0.0.0.0 --port 4096
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now opencode
curl -u "opencode:$OPENCODE_PASSWORD" http://127.0.0.1:4096/api/session   # 期望 200
```

> **实测的坑**：`ExecStart` 必须写**绝对路径**。写 `/usr/bin/node ...` 会得到
> `status=203/EXEC` 并且无限重启，日志里看不出原因。

### 8.2 bridge（神经）

```ini
# /etc/systemd/system/anthropos-bridge.service
[Service]
ExecStart=/usr/local/bin/node /opt/life/scripts/bili-bridge.mjs
Restart=always
RestartSec=10
```

```bash
systemctl enable --now anthropos-bridge
journalctl -u anthropos-bridge -f     # 期望看到「✅ 大脑在线」
```

### 8.3 三层体检

```bash
node scripts/doctor.mjs
```

它会分别查：**B 站能不能连**、**大脑在不在线**、**工具链齐不齐**。
三层全绿才算部署完成。

---

## 9. 自动上传本地工程

这是"让她知道你最近在干什么"的通道。她没法凭空知道你在做什么，除非你告诉她。

### 9.1 为什么需要这个

她的选择题库里只有：**新闻**、**B 站推荐**、**你发来的工程文档**。

前两个告诉她"世界上有什么"，第三个才告诉她"**你关心什么**"。

### 9.2 怎么接

本地写一份工程文档（Markdown），然后：

```bash
# 本地执行，会先做敏感词扫描，含凭据直接拒发
node scripts/publish-project.mjs 我的工程.md
```

云端收（每天 0 点日切自动跑，也可以手动）：

```bash
node scripts/fetch-mail.mjs
```

落进 `/opt/life/knowledge/projects/`，**按 messageId 去重**，重发不会重复入库。

### 9.3 文档里写什么

写得越具体，她越有用：

- 你做的是什么，卡在哪
- 具体的数字（耗时、大小、成本）
- 踩过的坑和最后的解法

**别写**：凭据、内网地址、客户信息。扫描器会拦，但别指望它。

---

## 10. 本地 AI 调试

接好之后，日常不需要登服务器。全部从本地做。

### 10.1 让她干活

```bash
# 本地直接发任务（走 SSH 隧道，不用开端口）
ssh -L 4096:127.0.0.1:4096 root@<IP>
opencode pair --remote
```

`pair` 之后，本地就能像操作本地工程一样操作那台服务器上的她的会话。

### 10.2 让她给自己派活

```bash
ssh root@<IP> 'cd /opt/life && node scripts/bili-bridge.mjs --simulate "帮我查一下昨天的账"'
```

`--simulate` 是**演练模式**：会把任务真的跑一遍，但所有私信只打日志不真发。
用它调试失败链路、超时补记，不用担心给账号发奇怪的东西。

### 10.3 看她在想什么

```bash
ssh root@<IP> 'tail -50 /opt/life/diary/$(date +%F).md'
ssh root@<IP> 'journalctl -u anthropos-bridge --since "1 hour ago" | tail -40'
```

### 10.4 改配置不用重启

`config/model-mode.json` 这类开关是**每次运行都重读**的，
改完下一轮就生效，不用 `systemctl restart`。

只有改了 `opencode.json`（provider 配置）才需要重启大脑。

---

## 11. 验收清单

部署完，逐条打勾：

- [ ] `ssh root@<IP>` 免密能进
- [ ] `node scripts/doctor.mjs` 三层全绿
- [ ] `systemctl is-active opencode anthropos-bridge` 两个 active
- [ ] 扫码登录后 `cookie.ok = true` 且 `renewable = true`
- [ ] 手动跑一次 `bili-bridge.mjs --simulate "你好"`，有正常产出
- [ ] `node scripts/vision.mjs check` 视觉链路通
- [ ] `node scripts/search.mjs web "测试" --n 3` 有结果
- [ ] 发一封工程文档到她的邮箱，`fetch-mail.mjs` 能收到
- [ ] 安全组只多开了 4096，别的没动
- [ ] `secrets/` 下所有文件都是 600

---

## 12. 踩过的坑（按踩到的顺序）

| 坑 | 表现 | 解法 |
|---|---|---|
| 装成 opencode V1 | API 全不一样 | 装 `@opencode/cli`，不是 `opencode-ai` |
| 不挂 swap | 服务起不来，日志空白 | 加 2G swap |
| systemd 用相对路径 | `status=203/EXEC` 无限重启 | `ExecStart` 写绝对路径 |
| 手抄 Cookie | 6 小时后 `-101` | 扫码登录 + refresh_token |
| PowerShell 内联命令 | 引号被吞，命令变形 | 写成 `.sh` 文件再传上去执行 |
| 安全组 0.0.0.0/0 | 扫描器几小时内就来敲门 | 只开必要端口 + 强密码 |
| 图片通道 502 | 私信发不出图 | 改用 `upload_bfs` 动态图床 |
| 免费额度用完 | 她"沉默"，不报错 | 模型降级开关，见 `docs/模型降级切换.md` |
| 网关静默丢参数 | 返回 200 但功能没生效 | 用已知内容验证，别信状态码 |

---

## 附：接下来读什么

| 想了解 | 看 |
|---|---|
| 她每天怎么运转 | `AGENTS.md`（运行契约） |
| 模型降级怎么做 | `docs/模型降级切换.md` |
| B 站接口怎么调 | `docs/B站API完全手册.md` |
| 视觉 / 语音 / 搜索怎么配 | `docs/外部视觉API.md`、`docs/语音接入.md`、`docs/工具链实操.md` |
| 视频从哪来 | `docs/视频管线.md` |
| 遇到问题怎么办 | `docs/存活笔记.md` |
