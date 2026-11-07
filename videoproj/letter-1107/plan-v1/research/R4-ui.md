# R4 · 界面还原调研（HF 模型页 / DeepSeek 聊天页 / Claude Code 终端）

调研日期：2026-11-07　　调研员：界面还原调研子代理
原始数据：`assets/hf/tree.json`（88 条，递归 + expand，已去掉安全扫描字段）、`assets/deepseek/reply.json`

> 约定：**【实测】** = API/HTML/CSS 原样取得；**【截图】** = 从本地参考截图目测取色/量尺寸（±2px）；**【推断】** = 合理推断，开发时可微调；查不到写「未查到」。

---

## 1. Hugging Face：deepseek-ai/DeepSeek-V4.1-Flash-1017

### 1.1 仓库是否存在
**存在【实测】**。`GET /api/models/deepseek-ai/DeepSeek-V4.1-Flash-1017` 返回 200，无需改用其他仓库。

### 1.2 头部信息【实测】
| 字段 | 值 | 页面上的显示 |
|---|---|---|
| id | deepseek-ai/DeepSeek-V4.1-Flash-1017 | `deepseek-ai / DeepSeek-V4.1-Flash-1017` |
| likes | 5370 | `Like 5.37k` |
| 组织关注数 | 153496 | `Follow DeepSeek 153k` |
| downloads（上月） | 259,511 | `Downloads last month 259,511` |
| pipeline_tag | image-text-to-text | 第一个标签 `Image-Text-to-Text` |
| library | transformers | |
| license | mit | `License: mit` |
| 标签（页面顺序） | Image-Text-to-Text · Transformers · Safetensors · deepseek_v41 · text-generation · Eval Results · 8-bit precision · fp8 · License: mit | 与截图一致 |
| 原始 tags | transformers, safetensors, deepseek_v41, text-generation, image-text-to-text, license:mit, eval-results, endpoints_compatible, 8-bit, fp8, deploy:azure, region:us | |
| 参数量 | safetensors.total = 763,205,315,794 | 右栏 `Model size 763B params` |
| Tensor type | BF16 1,976,441,856 / F32 42,307,282 / F8_E4M3 204,015,223,296 / I8 557,171,343,360 | `Tensor type BF16 · F32 · F8_E4M3 · I8` |
| 架构 | DeepseekV41ForCausalLM，model_type deepseek_v41，quant fp8 | |
| createdAt / lastModified | 2026-10-17T02:40:38Z / 2026-10-17T05:46:55Z | 列表里显示「21 days ago」（以 11-07 计） |
| 主分支 sha | 1bae0e1088993b9b82de08f59de5be5a34e42170 | 最新提交短 sha `1bae0e1` |
| 提交数 / 贡献者 | 4 commits / 1 contributor（msr2000） | `History: 4 commits` |
| Community 讨论数 | 54 | 标签 `Community 54` |
| 仓库总大小 | 页面分支栏显示 `510 GB`；safetensors.totalFileSize = 510,304,178,606；usedStorage = 510,750,942,072 | |
| Inference Providers | together / scaleway / novita / baseten（均 live） | 截图右栏显示 Novita +1 |

### 1.3 文件统计【实测】
- 递归共 **88 项**：83 个文件 + 5 个目录（encoding、encoding/tests、inference、inference/examples、inference/examples/images）。
- **safetensors 分片：48 个**，`model-00001-of-00048.safetensors` ~ `model-00048-of-00048.safetensors`，**全部是 LFS（页面上标 `xet`）**。
- **分片总大小：510,296,708,312 字节 = 510.30 GB（十进制）= 475.25 GiB**。
- 最小分片 #1 是 970,533,624 B（页面显示 971 MB）；最大分片 #48 是 101,537,926,640 B（≈101.54 GB）。
- 另有 `model.safetensors.index.json`（7,470,294 B，不是 LFS）。如果片里把 index 也圈出来就是 49 个 safetensors 相关文件，**权重分片本身是 48 个**。
- 全部文件合计 510,311,045,295 B。非 safetensors 文件里只有 `inference/examples/images/carrots.jpeg` 是 LFS。

### 1.4 Files and versions 页根目录（页面实际显示的就是这一层，按顺序）
页面**不会递归显示**子目录，只显示根目录：先列文件夹，再按名称排文件。根目录一共 **57 行**。首屏只渲染前 **50 行**，最后一行是 `Load more files` 按钮（点了才加载剩下 7 行）【实测，webfetch + HTML】。

| # | 名称 | 大小（页面格式） | LFS/xet | 最近提交信息 | 时间 |
|---|---|---|---|---|---|
| 1 | 📁 encoding | — | — | Release DeepSeek-V4.1-Flash-1017 | 21 days ago |
| 2 | 📁 inference | — | — | Release DeepSeek-V4.1-Flash-1017 | 21 days ago |
| 3 | .gitattributes | 1.59 kB | 否 | Update gitattributes | 21 days ago |
| 4 | LICENSE | 1.08 kB | 否 | Release DeepSeek-V4.1-Flash-1017 | 21 days ago |
| 5 | README.md | 5.23 kB | 否 | Release DeepSeek-V4.1-Flash-1017 | 21 days ago |
| 6 | config.json | 3.31 kB | 否 | Release DeepSeek-V4.1-Flash-1017 | 21 days ago |
| 7–54 | model-000NN-of-00048.safetensors（48 个） | 见下表 | xet | Add files using upload-large-folder tool | 21 days ago |
| 55 | model.safetensors.index.json | 7.47 MB | 否 | Add files using upload-large-folder tool | 21 days ago |
| 56 | tokenizer.json | 6.37 MB | 否 | Release DeepSeek-V4.1-Flash-1017 | 21 days ago |
| 57 | tokenizer_config.json | 801 Bytes【推断格式】 | 否 | Release DeepSeek-V4.1-Flash-1017 | 21 days ago |

**48 个分片在页面上显示的大小**（#1–#44 来自页面实测；#45–#48 在「Load more」之后，按 HF 三位有效数字规则【推断】）：
- #1 `971 MB`；#2 `1.32 GB`
- #3–#42 大部分是 `7.39 GB`。显示 `7.41 GB` 的有 #5、#11、#17；显示 `7.4 GB` 的有 #23、#27、#31、#35、#39（注意 HF 会写成 `7.4 GB`，不是 `7.40 GB`）
- #43 `1.32 GB`；#44 `2.65 GB`；#45 `2.57 GB`；#46 `2.71 GB`；#47 `102 GB`；#48 `102 GB`（后两个是两块约 101.5 GB 的巨型分片，很适合做结尾「重锤」）
- 精确字节数见 `assets/hf/tree.json`

**动画建议**：滚到最底需要先模拟点击 `Load more files`（或者直接把 57 行全部渲染出来，省掉这个按钮）。最后两个 102 GB 分片可以放慢、加粗圈注。

### 1.5 每行 DOM 结构 / 列（原 HTML 类名，Tailwind v4）【实测】
外层：`ul.mb-8.rounded-b-lg.border.border-t-0`。上方连着一个圆角顶栏 LastCommit 盒子（头像 + `msr2000` + `Release DeepSeek-V4.1-Flash-1017` + `1bae0e1` + `21 days ago`）。
每行是 `li.grid.grid-cols-24.h-10.place-content-center.gap-x-3.border-t.px-3`，**行高 40px**，24 栏网格，行间用 1px 上边框 gray-200 分隔。

| 列 | 栅格（lg） | 内容 | 样式 |
|---|---|---|---|
| 文件名 | col-span-10 | 文件图标（32×32 viewBox，`text-gray-300`，1em）+ 文件名 `truncate`；后面跟 `Safe` 小徽章（h-[1.125rem]，圆角 border，text-xs，gray-400，带盾牌图标）；LFS 文件再加一个小按钮（xet 图标 + 下拉） | 文件名用 Source Sans Pro 16px，gray-900 系 |
| 大小 | col-span-4（右对齐，xl:pr-10） | `7.39 GB`（font-mono 0.8rem/24px，gray-400）+ `xet` 徽章（rounded-md border px-1 py-0.5 text-xs semibold gray-700）+ 20×20 下载图标方框（rounded-sm border gray-500） | |
| 最近提交 | col-span-7 | 提交标题，`font-mono text-sm text-gray-400`，可截断 | IBM Plex Mono 14px |
| 时间 | col-span-3（右对齐） | `<time>21 days ago</time>`，text-gray-400 | |

文件夹行：图标 `text-blue-400`（#60a5fa）实心文件夹，大小列为空。
最后一行 `Load more files`：`bg-linear-to-b from-gray-50-to-white h-10 rounded-b-lg`，居中，hover 时加下划线。

### 1.6 HF 视觉规格（React 重建用）
**字体【实测，style.css】**
- 正文：`"Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif`（预加载 400/600/700 三个字重）
- 等宽：`"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`。用于仓库名 `DeepSeek-V4.1-Flash-1017`（截图里标题是等宽粗体）、文件大小、提交信息、Model tree 标题、`Ctrl K` 快捷键
- 字号：根字号 16px；text-sm 14px，text-xs 12px，标题 h1 是 text-xl（20px）
- 字体资源：Google Fonts 上有 Source Sans 3（Source Sans Pro 的后继版本）和 IBM Plex Mono

**颜色【实测，oklch 已换算成 Tailwind 标准 hex】**
| 令牌 | hex | 用途 |
|---|---|---|
| gray-50 | #f9fafb | 头部渐变底色、Load more 渐变 |
| gray-100 | #f3f4f6 | 头部下边框 |
| gray-200 | #e5e7eb | 行分隔线、按钮边框、标签 chip 边框 |
| gray-300 | #d1d5db | 文件图标 |
| gray-400 | #9ca3af | 大小、提交信息、时间、Safe 徽章 |
| gray-500 | #6b7280 | 次级图标 |
| gray-600 | #4b5563 | 未激活标签文字 |
| gray-700 | #374151 | 激活标签下划线、xet 徽章文字 |
| gray-800 | #1f2937 | 激活标签文字 |
| gray-900 | #111827 | 「Use this model」黑按钮底、正文主色 |
| blue-400 | #60a5fa | 文件夹图标 |
| red-500 | #ef4444 | Like 心形（截图里心形是红色描边）；片中红色标注圈也可以用这个色或 #ff3b30 |
| 头像黄 | #FFD21E（HF 吉祥物黄）【推断】 | Logo 🤗 |

**布局【截图 1880px 宽，±2px】**
- 顶部导航：高约 62px，白底，下边框 gray-100；内容容器最大宽约 1500px，左右边距约 186px（≈ `container` 加 xl 断点）。Logo 用 🤗 + 「Hugging Face」粗体 18px；搜索框 w≈384px h≈36px，圆角 8px，带 `Ctrl K` kbd；右侧菜单 Models / Datasets / Spaces / Buckets / Docs / Enterprise / Pricing，每个前面一个灰色小图标
- 仓库头部：`bg-linear-to-t from-gray-50-to-white`，上内边距 36px（sm:pt-9）
  - 第 1 行：组织头像（DeepSeek 蓝鲸）+ `deepseek-ai`（gray-400）`/` + 等宽粗体仓库名 + 复制图标 + `♡ Like | 5.37k` 分段按钮 + `Follow 🐋 DeepSeek | 153k`
  - 第 2 行：标签 chip，高约 28px，圆角 6–8px，1px gray-200 边框，白底，左边带彩色图标
  - 第 3 行：标签栏 `h-12`（48px）。`.tab-alternate`：左右内边距 14px，高 100%，下边框 2px 透明；激活态下边框 gray-700、文字 gray-800 semibold；未激活 gray-600 medium。三个标签依次是：`Model card`（立方体图标）｜`Files and versions`（列表图标 + `xet` 小徽章）｜`Community`（黄色气泡图标 + 黑底白字 `54` 计数）
  - 标签栏右侧：`⋮` 方按钮 · `Deploy ▾` · `→ Copy to bucket` · 黑色 `Use this model ▾`（bg gray-900，白字，圆角 8px，h≈32px）
- Model card 页：左侧正文约 700px 宽（标题 `DeepSeek-V4.1-Flash-1017` 20px semibold、大 deepseek logo、徽章行、Introduction）；右栏约 590px 宽，左侧 1px 分隔线：Downloads 折线图（紫色 #8b5cf6 系【截图】）、Safetensors 信息块、Inference Providers 聊天框、Model tree
- Files 页：标签栏下面一行是分支选择器 `main ▾` + 仓库名 + `510 GB` + `Go to file` 搜索框（h-8，xl:w-48）+ `1 contributor` + `History: 4 commits` 圆角按钮；再往下是 LastCommit 盒子和文件列表

**图标**：HF 使用 Carbon/UIM 系的单色 SVG（viewBox 0 0 32 32 / 24 24），尺寸 1em。重建时可以用 `@iconify` 里的 `carbon:document`、`carbon:folder`、`carbon:download`、`carbon:security` 替代【推断】。

---

## 2. DeepSeek 网页聊天界面（chat.deepseek.com 风格）

### 2.1 色值【实测：fe-static.deepseek.com/chat/static/main.312b2a151e.css 的设计令牌】
| 令牌 | hex | 用途 |
|---|---|---|
| deepseek-500（brand-primary） | **#3964FE** | 品牌主色，用于主按钮、品牌文字、激活态 |
| deepseek-450 | #5686FE | 主按钮 hover |
| deepseek-400 | #679EFE | primary-dimmed（发送键禁用/浅态） |
| deepseek-300 | #B7C8FE | ghost 激活态边框 |
| deepseek-100 | #E4EDFD | |
| deepseek-50 | #EDF3FE | ghost 激活态填充（深度思考开启时的底色） |
| Logo SVG 填充 | **#4D6BFE** | GitHub 官方 logo.svg 里的颜色（logo 用这个，UI 用 #3964FE） |
| label-primary | #0F1115 | 主文字（问候语、历史标题） |
| label-secondary | #61666B | |
| label-tertiary | #81858C | 次要文字 |
| label-caption | #ADB2B8 | 分组标题（30 天内 / 2026-10）、占位符 |
| bg-base | #FFFFFF | 主区背景 |
| 侧栏背景 | #F9FAFB（neutral-bluish-50）【截图目测匹配】 | |
| interactive-hover | rgba(38,49,72,.06) | 历史条 hover |
| border-l2 | rgba(0,0,0,.10) | 输入框描边 |

字体【实测】：`--dsw-font-family: "quote-cjk-patch", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, ...`。中文实际回落到系统字体（Windows 下是微软雅黑，Mac 下是苹方）。代码字体：Menlo, Monaco, Consolas…

### 2.2 布局【截图 1880×935，±2px】
- **左侧栏** 宽 ≈ 256px，背景 #F9FAFB，右边 1px 浅分隔线
  - 顶部（y≈24）：鲸鱼 logo + 「deepseek」字标（约 140×22，#4D6BFE）；右侧有搜索🔍和收起侧栏两个 20px 图标（#81858C）
  - 「⊕ 开启新对话」按钮：x 8–244，高 ≈ 40px，全圆角（pill），白底，有很淡的阴影（0 1px 3px rgba(0,0,0,.08)），文字 14px #0F1115 居中
  - 分组标题（12–13px，#ADB2B8）：「30 天内」「2026-10」「2026-09」……；第一个分组标题右侧有一个批量管理小图标
  - 历史条：14px，#0F1115，行高约 40px，左边距 18px，单行截断
  - 底部用户条（y≈907）：28px 圆形灰底头像，里面一个字母，后面是邮箱，右侧 `···`。**真实邮箱必须替换**，建议写 `user****@example.com` 或 `B站UP主`，头像字母用「U」
- **主区**：白底，内容水平居中（中心约 x=1082）
  - 问候行（y≈357）：鲸鱼图标 ≈ 34×26 + 「你好，我能帮什么忙吗？」，约 24px，粗体（600–700），#0F1115，间距 12px
  - 输入框：宽 ≈ 776px（x 695–1471），高 ≈ 124px，圆角 ≈ 24px，白底，1px rgba(0,0,0,.1) 描边，带大范围柔和阴影（0 0 0 .5px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.04)）【推断】
    - 占位符「给 DeepSeek 发送消息」：16px #ADB2B8，左上内边距 16px
    - 左下两个 pill 按钮：「⚛ 深度思考」「🌐 智能搜索」。高 ≈ 34px，内边距 0 12px，13–14px，圆角全圆。截图里两个都是激活态：底 #EDF3FE、边框 #B7C8FE、文字和图标 #3964FE；未激活态是白底、边框 rgba(0,0,0,.12)、文字 #61666B
    - 右下：回形针附件图标（20px #0F1115）+ 圆形发送键（直径 ≈ 34px，内有白色 ↑）。无输入时底色 #B7C8FE/#679EFE（截图为浅蓝 #A9BEFF 一类），有输入后变 #3964FE
- 发送后的对话态【推断，按官网常见版式】：用户气泡靠右，底色 #EFF6FF 一类浅蓝/浅灰，圆角 14px；AI 回复左侧带鲸鱼头像，正文 16px、行高 28px，Markdown（加粗、有序列表、标题）；输入框移到底部

### 2.3 侧栏假历史标题（替换真实记录，与本片无关的通用标题）
建议 8 条（可按「30 天内」3 条 + 「2026-10」3 条 + 「2026-09」2 条分组）：
1. 周末露营装备清单
2. Python 读取 Excel 报错
3. 番茄炒蛋怎么更好吃
4. 英文邮件润色
5. 年终总结开头怎么写
6. 解释一下量子纠缠
7. 推荐几本科幻小说
8. 正则匹配手机号

用户条：头像字母「U」+ `user****@example.com`。

### 2.4 Logo 获取
- **GitHub 官方仓库（推荐，已验证 200）**：`https://raw.githubusercontent.com/deepseek-ai/DeepSeek-V2/main/figures/logo.svg`，10,656 B，是鲸鱼 + 「deepseek」完整字标，单色 `#4D6BFE`，viewBox 0 0 195 41.36（Pixso 导出）。`DeepSeek-V3/main/figures/logo.svg` 已 404。
- 只要鲸鱼图标的话，可以从上面这个 SVG 里拆出左侧鲸鱼 path，或者用 HF 组织头像 `https://cdn-avatars.huggingface.co/v1/production/uploads/6538815d1bdb3c40db94fbfa/xMBly9PUMphrFVMxLX4kq.png`（PNG）
- 维基共享资源 `File:DeepSeek_logo.svg`：本次请求超时，**未查到**
- 主色：logo 用 #4D6BFE，网页 UI 品牌色用 #3964FE

---

## 3. 「真实的 DeepSeek 回复」——**未取得**

- 已按要求在服务器上跑了 3 次（ModelScope `POST /v1/chat/completions`，model `deepseek-ai/DeepSeek-V4.1-Flash-1017`，temperature 0.7，max_tokens 800，enable_thinking false，key 从 `/opt/life/secrets/modelscope_token.txt` 读取，没有打印）。
- **3 次全部返回 HTTP 429 `{"error":{"message":"insufficient balance"}}`**，也就是账户余额不足，不是限流。request_id 分别是 4179e8d8-…、5ac65b13-…、abf6d6e3-…
- 3 次的失败记录都原样保存在服务器 `/opt/life/videoproj/letter-1107/assets/deepseek/reply.json`，并已 scp 到本地同名路径。`content` 字段为空，**没有编造任何回复**。
- 后续可选：①给魔搭账户充值或换 token 后重跑同一脚本（`C:\Users\正星gj\AppData\Local\Temp\opencode\ds_reply.sh`，直接覆盖 reply.json）；②改用 DeepSeek 官方 API（platform.deepseek.com，需要另外的 key）；③去 chat.deepseek.com 真人提问后截取文字。这条台词本身就在调侃「API 只有 20 元」，余额不足的报错也可以考虑当成彩蛋素材。

---

## 4. Claude Code 终端界面规格（片中当前模型写「Opus 5.5」）

### 4.1 窗口外壳【截图 1920×1035】
- 画布背景 #2F2F2F，终端窗口 x 280–1640（宽 1360），圆角 ≈ 14px
- 标题栏：高 ≈ 50px，底色 #3A3A3A；左侧三个红绿灯圆点（直径 14px，间距 30px）：#FF5F57 / #FEBC2E / #28C840
- 终端正文背景 #1F1F1F（截图约 #1E1E1E–#212121），内边距约 26px

### 4.2 配色【实测：Claude Code dark 主题】
| 角色 | 值 |
|---|---|
| Claude 品牌橙（claude） | **rgb(215,119,87) = #D77757**：用于虚线框、标题、像素吉祥物、Recent activity / What's new 小标题 |
| 正文 text | rgb(255,255,255)，截图里实际呈 #E8E8E8 左右 |
| 次要/暗淡文字 | 灰 #999 系（截图里模型行、路径、`… /resume for more`，约 #A0A0A0）【截图】 |
| success | rgb(78,186,101) #4EBA65（工具调用成功的 ⏺ 绿点） |
| error | rgb(255,107,128) #FF6B80 |
| diff 新增底 / 删除底 | rgb(34,92,43) / rgb(122,41,54) |
| 子代理标识色 | red/blue/green/yellow/purple/orange/pink/cyan 八色（具体 RGB 未查到） |
| 输入分隔线 | #5A5A5A 一类 1–2px 横线【截图】 |
| 光标 | 实心浅灰块 #D0D0D0，宽约 1ch |

### 4.3 字体
截图用的是等宽字体，字形接近 **Fira Code / SF Mono**（官方宣传图实际用的字体未查到）。重建建议 `"Fira Code", "JetBrains Mono", "SF Mono", Menlo, monospace`，字号约 24px（1920 画布），行高 32px，字距略宽（letter-spacing ≈ 0.04em）。

### 4.4 欢迎面板（v2.0 样式）【截图】
- 整个面板用 1.5px 橙色**虚线**边框（dash ≈ 6px、gap ≈ 4px），圆角 ≈ 6px；面板宽约 1020px、高约 425px
- 标题嵌在上边框里：`---- Claude Code v2.0.0 ----`。重建时可改成 `Claude Code v2.x`，标题本身也用橙色
- 左栏（约 47% 宽，居中对齐）：
  - `Welcome back!`（**去掉人名**，可以写 `Welcome back!` 或 `Welcome back UP主!`），白色
  - 像素吉祥物「Clawd」：橙色 #D77757 方块像素小怪，约 120×80px。形状是矩形身体 + 两个黑色竖条眼睛 + 左右两侧小凸起 + 底部 4 条腿。可以用 CSS grid 或 SVG rect 拼（12×8 网格）
  - 模型行（灰色）：截图原文是 `Sonnet 4.5 • Max 20x`，**改成 `Opus 5.5 • Max 20x`**
  - 路径行（灰色）：截图里有人名路径，**改成 `~/videoproj/letter-1107`**
- 右栏用竖向虚线和左栏分开，中间再用一条横向虚线分成上下两格：
  - 上格 `Recent activity`（橙色）+ 四行 `1m ago  Updated project memory` 这类「时间（左列）+ 事件」，末行灰色 `… /resume for more`。片中可以改成与本片相关的假事件，例如 `2m ago  Draft storyboard v3`
  - 下格 `What's new`（橙色）+ `/agents to create subagents`、`/security-review for review agent`、`ctrl+b to background bashes`，末行灰色 `… /help for more`
- 面板下方空约 100px，然后是一条横贯的灰线，再下面是提示符行：`> ` + 光标块 + 灰色占位 `Try "edit <filepath> to ..."`

### 4.5 工作中输出样式（用于「疯狂输出视频方案、启动子代理」）【按官方 CLI 常见表现，字符已核对；细节间距属推断】
```
> 帮我给这期 B 站视频出 10 套方案，并行跑

⏺ 好的，我会先拆解需求，然后启动 3 个子代理并行调研。

⏺ Task(调研 B 站同类爆款选题)
  ⎿  Search(pattern: "**/*.md")
     Read(research/R1.md)
     +12 more tool uses
⏺ Task(撰写分镜脚本)
  ⎿  Done (18 tool uses · 42.1k tokens · 1m 37s)

⏺ Update Todos
  ⎿  ☒ 拆解选题
     ☐ 生成 10 套方案
     ☐ 子代理汇总

✻ Brewing… (128s · ↑ 23.4k tokens · esc to interrupt)
```
- `⏺`：工具调用/消息圆点。工具调用时闪烁，成功后变绿 #4EBA65，普通文本消息用白色；工具名加粗，括号里的参数用正常字重
- `⎿`：工具结果缩进前缀，结果文字用灰色
- 子代理 `Task(...)` 名称会套用子代理标识色；运行中显示 `+N more tool uses`，结束后显示 `Done (N tool uses · X tokens · Ns)`
- Spinner：前缀字符循环 `· ✢ ✳ ✶ ✻ ✽`（橙色），后面跟一个随机动名词（Thinking / Brewing / Cogitating…）+ 计时 + token 数 + `esc to interrupt`（灰）
- 待办：`☐` 未完成、`☒` 已完成（已完成项加删除线、变灰）
- 底部状态行（灰色小字）：`? for shortcuts`；也可以在右侧放模型名 `Opus 5.5`
- **禁止出现**：截图里的人名、`Sonnet` 字样

---

## 5. 三个界面重建的关键难点
1. **HF**：Source Sans Pro + IBM Plex Mono 混排，以及 40px 行高的 24 栏网格要对齐；根目录有 57 行，首屏 50 行后面有个 `Load more files`，要决定是演出点击还是直接全部渲染；红圈逐步加速时要让圈注坐标跟着虚拟滚动同步；最后两个 102 GB 巨型分片的数字要显示对（#45–#48 的页面显示格式是推断的）。
2. **DeepSeek**：中文字体回落（Inter + 苹方/雅黑）要和截图一致；输入框的大圆角和超柔和阴影；两个 pill 按钮激活/未激活两套配色；打字 → 发送键变色 → 回复流式输出 + Markdown 排版。**真实回复目前缺失（余额不足）**，需要补跑。
3. **Claude Code**：等宽字体下虚线框标题要嵌进边框；像素 Clawd 要逐格拼出来；`⏺/⎿/✻` 等特殊字符在所选字体里要有字形（建议字体栈里带 Fira Code，并用 Noto Sans Symbols 2 兜底）；spinner 字符和计时要逐帧动画；全程去掉人名和 Sonnet。
