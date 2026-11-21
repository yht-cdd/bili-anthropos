# Outcrawl 接入 —— 给没有浏览器的容器补一层真实 Chrome

> 2026-11-21 接入。工具脚本：`tools/outcrawl-mcp.mjs`

## 一、为什么要它

容器里**没有浏览器**。实测确认：

```
chromium / chromium-browser / google-chrome / firefox   → 全无
python playwright / selenium                             → 未装
node playwright / puppeteer                              → 未装
```

只有 `curl`。而 curl 只能拿 HTML 源码，拿不到「等 JS 跑完才有」的内容。

**实测对比（x.com）**：

| 方式 | 结果 |
|---|---|
| `curl` | 45,844 字节 HTML，`<title>X. It's what's happening</title>`，正文为空 |
| Outcrawl | 真渲染后的登录页正文（`# Happening now. Continue with phone ...`） |

所以这不是「替换浏览器」，是**补上容器从来没有的那一层**。

## 二、它是什么

真实 Chrome + **住宅 IP 出口** + 会话全程录制回放。通过 MCP（Streamable HTTP）暴露 **30 个工具**：

| 类别 | 工具 | 用途 |
|---|---|---|
| 抓取 | `outcrawl_scrape` | 单页转 Markdown / HTML / 截图 / 按 schema 出 JSON |
| 搜索 | `outcrawl_search` | 搜索并把命中页渲染，**给正文不只摘要** |
| 全站 | `outcrawl_crawl` | 从种子 URL 读 sitemap + 链接图，限量限量爬 |
| 浏览器代理 | `outcrawl_agent` + 8 个 | 自然语言下任务，真浏览器点击输入导航；可**暂停交真人**、可问问题、可传文件、可收下载 |
| 会话回放 | `outcrawl_sessions_*`、`session_network`、`session_request` | 每次会话全程录制，可查每个请求的 header/body/耗时 |
| 持久身份 | `outcrawl_profile_create` | 存 cookie 与站点存储，**登录态跨调用保留**，可固定国家/城市 |
| 监控 | `outcrawl_monitor_create` | 定时监控，DOM 级 diff（自动忽略广告/时间戳/元素重排），推 Discord/Slack/webhook |
| 治理 | `outcrawl_rules_set` | 预算上限、站点白黑名单，编译成**真闸门**（不是提示） |

## 三、额度

| 项 | 值 |
|---|---|
| 免费 | **1000 credits/月**，不绑卡 |
| 计价 | 1 credit = 1 页 或 1 分钟浏览器 |
| 实测 | 单页抓取 = 1 credit；搜索 6 条 = 3 credits |
| 付费 | Builder $49 / 10,000；Pro $199 / 50,000 |
| 并发 | 免费档 2 个浏览器、120 请求/分钟 |

每次响应第一行都会回传本次花费，例如：

```
Usage: credits 1, cache HIT (served from the scrape cache; cachedAt says when it was captured).
```

**注意**：`outcrawl_credits` 查的是「购买的额度池」，会显示 `balance: 0, exhausted: true`，但免费月度额度是**另一个数字**，调用照常成功。这是两个概念，别被它误导。

## 四、怎么用

### 1. 配置 key

```bash
# 方式一：环境变量
export OUTCRAWL_API_KEY='ock_xxx'
# 方式二：文件（推荐，权限 600，已在 .gitignore）
echo 'ock_xxx' > secrets/outcrawl_key.txt
chmod 600 secrets/outcrawl_key.txt
```

### 2. 命令行

```bash
node tools/outcrawl-mcp.mjs tools                 # 列出全部 30 个工具
node tools/outcrawl-mcp.mjs credits               # 查额度
node tools/outcrawl-mcp.mjs scrape <url>          # 抓一页（走缓存，便宜）
node tools/outcrawl-mcp.mjs scrape <url> --raw    # 强制实时渲染
node tools/outcrawl-mcp.mjs search "<query>"      # 搜索（含正文）
node tools/outcrawl-mcp.mjs task "<自然语言任务>"   # 交给浏览器代理
node tools/outcrawl-mcp.mjs call <tool> '<json>'  # 调任意工具
```

### 3. 接进 DSH（可选）

`cordis.patch.yml` 里加（**新增条目必须用 `insert:`，裸条目会被当成覆盖而报 `entry not found`**）：

```yaml
- insert:
    - id: mcp-outcrawl
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: outcrawl
        transport: streamable-http
        url: https://api.outcrawl.ai/mcp
        headers:
          Authorization: !!js '"Bearer " + process.env.OUTCRAWL_API_KEY'
        toolCallTimeoutMs: 180000
```

key 走 `process.env.OUTCRAWL_API_KEY`，**不要写进配置文件**。

## 五、什么时候用、什么时候不用

| 场景 | 用不用 | 理由 |
|---|---|---|
| 海外资料调研（JS 站、Exa 搜不到的） | ✅ | 补 Exa 与 curl 的短板 |
| 同行动态监控 | ✅ | `monitor_create` 现成能力 |
| 需要登录态的第三方后台 | ✅ | `profile_create` 存 cookie |
| **B 站数据抓取** | ❌ | 已有 `scripts/bili-api.mjs` + 本地 cookie，更快更安全 |
| **B 站账号操作** | ❌ **绝对不用** | 见下 |
| **替代容器浏览器** | — | 容器本来没浏览器，这是新增不是替换 |

## 六、两条安全红线

### 红线一：key 不进仓库
仓库是 **public**。`secrets/outcrawl_key.txt` 必须在 `.gitignore` 里；配置里只引用环境变量。

### 红线二：绝不把 bili_cookie 交给它
`secrets/bili_cookie.txt` 那 1091 字节是账号全部权限（私信 + 投稿 + 评论）。

一旦通过 `profile_create` 让它托管登录态，等于：
1. **账号托管给第三方云浏览器**；
2. 住宅 IP 会让账号**看起来在全球各地乱跳**，极易触发风控封号；
3. 住宅出口本身来自他人家庭宽带，用于自己的主力账号**明确危险**。

用于公开研报、海外站点调研可以；用于自己的主力账号不行。

## 七、本机没有的东西（记录备查）

- 没有本地浏览器，所以 `outcrawl` 是唯一的 JS 渲染途径
- DSH 安装里自带 `playwright` 包（`node_modules/playwright`），但**未装浏览器内核**，且未挂载成工具

## 八、实测记录（2026-11-21）

| 测试 | 结果 |
|---|---|
| MCP initialize | ✅ `outcrawl 0.4.14` |
| `tools/list` | ✅ 30 个工具 |
| 缓存页抓取 | ✅ 1 credit |
| `maxAge:0` 实时渲染 | ✅ 1 credit |
| example.com | ✅ 正常 |
| bilibili 榜单页 | ⚠️ 只拿到页脚（榜单是 XHR 异步加载，需交互才能出） |
| x.com | ✅ 真渲染（curl 只有空壳） |
| credits 查询 | ⚠️ 显示 `balance: 0 / exhausted: true`，但调用正常（月度免费额度是另一个数字） |
