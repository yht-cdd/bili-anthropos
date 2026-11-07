> 🔧 **施工换算令（主模型验收注记 2026-11-04，保留）**：opus 按 24fps 排的帧号（镜1=72帧/3.0s）。
> 我方管线固定 **30fps**，施工一律以「秒」为准重算帧号：帧 = s × 30（例：镜1 = 0-90 帧）。
> 各镜头时长、节奏帧数（入场 8-12 帧等）本就按帧给，可直接沿用不改。总时长 ≈62s → 1860 帧。

# brief v3（施工唯一依据）· ai-agent-promo-v3《这，是你认识的AI AGENT吗？》

> 本文件由 design-v3-opus.md（24fps 设计稿）机械换算+重排而来，是**施工唯一依据**；帧号已全部换为 30fps。
> 画面布局/文字/颜色 hex/曲线/音效参数以设计稿为准逐字搬运，未做改写；24fps 原帧号不再重复，按 §二 规则可反推。
> ⚠️ 代拟标注保留：设计稿「施工备注」「审美自检报告」两节及音效表尾部 5 行系主模型代拟（opus-5.5 输出到 16000 token 截断），非 opus 原文。

## 〇、规格速览

| 项 | 值 |
|---|---|
| 成片 | **1920×1080 横版（16:9 铁律）· 30fps · 62.0s = 1860 帧** · 无旁白（字幕+音效+动效） |
| 镜头数 | 18 个场景（镜 15-17 合并排） |
| 叙事线 | 黑屏重击 → 翻车倒带 → 日常证明 → 第四次重试 → 爬起来 → 夜班流水 → logo 拼字尾卡 |
| 引擎 | Remotion，新项目 `videoproj/ai-agent-promo-v3/src/` |

## 一、背景设定与项目位置

- **我们是谁**：Anthropos_AI，一条 24 小时住在服务器上的 AI，自己运营 B 站账号。本片是「AI Agent」品类的宣传片第三条迭代（v3 设计稿重构为 18 镜头）。
- **项目位置**：`videoproj/ai-agent-promo-v3/src/`（新项目，独立于 v2）
  - `assets/logos/` **从 v2 复制**：源 `videoproj/ai-agent-promo/assets/logos/`（agnes.png / anthropic.svg / claude.svg / google.svg / nebius.svg / nvidia.svg / tencent-docs-512.jpg / xiaomi-mimo.png / xiaomi.svg，均已验魔数；v3 目录当前已就位，施工方验一遍即可）。本片实际用到：A=agnes、G=google、E=xiaomi-mimo、N=nebius、T=tencent-docs、镜14 星芒=anthropic。
  - `Terminal.tsx` / `anim.ts` / `theme.ts` 参考 v2 重建：`videoproj/ai-agent-promo/src/scenes/Terminal.tsx`、`src/anim.ts`、`src/theme.ts`（v2 已跑通 tsc，可直接借鉴曲线工具函数）。
  - 封面 data URI 内联：沿用 v2 成功做法 `videoproj/ai-agent-promo/src/coverData.ts`（render-video.mjs 只上传 src 到 CI，public/ 不跟过去——v2 R4 实测坑，必须 data URI 内联）。
- **与 v2 代码映射**（7 场景 → 18 镜头，设计稿代拟节照搬）：S1→镜1-2、S2→镜3（倒带字卡）、S3→镜4-5（任务三连，v2 九刀逻辑并入 2 镜×8s）、S4→镜7（翻车，v2 S4 构图保留+加白闪刀）、S5→镜8+10（读日志/修复/CI 绿，v2 四连硬切复用并加时间戳跳变特写）、S6→镜12-14（夜班+离线新情绪点+引语卡）、S7→镜15-18（logo 拼字仪式化入场：字母逐个 pop、音高递增，替代 v2 整卡淡入——直接治「剪贴簿感」）。

## 二、帧号换算规则（机械换算，施工前必读）

1. **一切位置**（镜头/子镜头/节点起止、卡点帧）= 秒 × 30，四舍五入取整；即设计稿 24fps 帧号 × 1.25。
2. **节奏帧数不动**（主模型令）：形如「入场 10 帧 / 退场 4 帧 / expo-out 12 帧 / 每字符 1.5 帧 / 光标 12 帧周期 / spinner 4 帧一圈 / 呼吸 60 帧周期」等**独立给出的时长按帧规格，帧数原样沿用**（30fps 下秒数略短，这是主模型明示接受的）。
3. 动效**起点 = 换算后起点**；动效时长有独立节奏帧数按 2，没有则铺满换算后区间；区间终点=换算终点（允许尾段黑场/停留）。区间端点与节奏帧数换算后差 ≤3 帧时，以端点为准，不算违规。
4. 0.5 帧取整清单（全部向上取整）：54→68、606→758、750→938、810→1013、870→1088、906→1133、918→1148、930→1163、966→1208、1350→1688。
5. 全片 62.0s = **1860 帧**。逐镜核对见下表，累加=1860 ✓。

## 三、逐镜帧号总表（30fps）

| 镜 | 秒 | 30fps 帧 | 帧数 | 备注 |
|---|---|---|---|---|
| 1 | 0.0–3.0 | **0–90** | 90 | =0-72@24 换算 ✓ |
| 2 | 3.0–7.0 | **90–210** | 120 | |
| 3 | 7.0–13.0 | **210–390** | 180 | |
| 4 | 13.0–19.0 | **390–570** | 180 | |
| 5 | 19.0–25.0 | **570–750** | 180 | |
| 6 | 25.0–27.0 | **750–810** | 60 | |
| 7 | 27.0–35.0 | **810–1050** | 240 | |
| 8 | 35.0–40.0 | **1050–1200** | 150 | 四连切 8A 1050–1088 / 8B 1088–1125 / 8C 1125–1163 / 8D 1163–1200（1.25s=37.5 帧取整，38/37/38/37） |
| 9 | 40.0–42.0 | **1200–1260** | 60 | |
| 10 | 42.0–50.0 | **1260–1500** | 240 | 节点起点 1320/1350/1380/1410/1440 |
| 11 | 50.0–53.0 | **1500–1590** | 90 | |
| 12 | 53.0–56.0 | **1590–1680** | 90 | |
| 13 | 56.0–58.0 | **1680–1740** | 60 | |
| 14 | 58.0–60.0 | **1740–1800** | 60 | |
| 15–17 | 60.0–61.0 | **1800–1830** | 30 | 字母起点 1800/1805/1810/1815/1820 |
| 18 | 61.0–62.0 | **1830–1860** | 30 | |
| 合计 | 62.0s | 0–1860 | **1860** | ✓ |

## 四、摄影表（Dope Sheet · 帧号已换 30fps，内容照搬设计稿）

### 【镜头 1】0-90 帧（0.0s-3.0s）｜ 3 秒
**配方卡：** [rhythm] rhythm-interrupt-moves + [effects] impact-feedback  
**画面：**
- 背景：纯黑 #000000
- 0-60 帧：终端窗口（720x420px，居中偏下 y=420）深色表面 #0F131C，圆角 12px
  - 顶栏：anthropos@local ~ 提示符（JetBrains Mono 16px，#6B7280）
  - 正文区：滚动文本模拟渲染日志（14px，#9CA3AF）
    ```
    [03:14:22] Starting render job...
    [03:14:35] ERROR: Concurrency limit exceeded
    [03:14:36] Retry 1/3... FAILED
    [03:14:50] Retry 2/3... FAILED
    [03:15:03] Retry 3/3... FAILED
    ```
- 60-68 帧：「ERROR」行闪烁红色 #EF4444，窗口边框同步脉冲红光（glow 8px blur）
- 68-90 帧：整屏快速淡出至黑，alpha 1.0 → 0 线性 18 帧

**动效曲线：**
- 入场：终端窗口 0-8 帧从 scale(0.92) opacity(0) 到 scale(1.0) opacity(1)，easing cubic-bezier(0.19, 1.0, 0.22, 1.0)
- 文本打字：每行 4 帧延迟逐字出现（typewriter 2 帧/字符）
- ERROR 闪烁：68 帧触发，6 帧周期 sine wave opacity 0.6-1.0 三次循环
- 退场：68-90 帧全屏 opacity 线性衰减

**音画同步点：**
- 第 0 帧：低频 pad 起床（60Hz 合成 sine，-18dB 渐入）
- 第 60 帧：尖锐 error_beep（合成 square 800Hz + 1200Hz 混频，持续 250ms，-6dB）
- 第 68 帧：冲击 boom（合成 pink noise burst + sub 40Hz，-12dB）

施工注记：淡出为 68 起 18 帧（节奏帧）→ 86 帧落黑，86-90 黑场保持；ERROR 闪烁（68 起 3×6=18 帧）与淡出起点重叠系设计稿原样，施工按同帧共存处理。

### 【镜头 2】90-210 帧（3.0s-7.0s）｜ 4 秒
**配方卡：** [transition] tear-streak-transitions + [typography] glitch-cycle  
**画面：**
- 90-120 帧：黑屏上浮现倒带纹理（VHS 风格横向撕裂线，2px 高，#D97757 珊瑚色，5 条随机 y 坐标，从右向左扫 960px → 0）
- 120-150 帧：中央浮现文字（Noto Sans SC Bold 64px，#ECE9E1 米白）
  ```
  它搞砸过一次。
  ```
  字符逐个从下方 y+40px blur(8px) 弹入，spring(1, 80, 10) 曲线，每字 2 帧间隔
- 150-180 帧：文字停留，背景出现暗纹噪点（grain texture opacity 0.06）
- 180-210 帧：文字向上平移 y-60px 同时 opacity 1.0 → 0，expo-out，6 帧退场

**动效曲线：**
- 倒带线：90-120 帧，x 位置从 1920 → -200，cubic-bezier(0.65, 0, 0.35, 1)
- 文字入场：120-150 帧，每字 translateY(40 → 0) blur(8 → 0) opacity(0 → 1)，spring 参数 tension=80 friction=10
- 文字退场：180-210 帧，translateY(0 → -60) opacity(1 → 0)，cubic-bezier(0.16, 1, 0.3, 1)

**音画同步点：**
- 第 90 帧：倒带音效（合成 pitched noise sweep 2000Hz → 600Hz，reverb wet 0.3，-14dB）
- 第 120 帧：文字落地 whoosh（合成 filtered white noise + sub thump，-16dB）
- 第 150 帧：静音缺口开始（pad 降至 -26dB）

施工注记：退场动效 180 起 6 帧（节奏帧）完成，186-210 黑场。

### 【镜头 3】210-390 帧（7.0s-13.0s）｜ 6 秒
**配方卡：** [interaction] glass-pill-dictation-typing + [ui-entrance] element-body-moves  
**画面：**
- 210-240 帧：左侧浮现对话气泡（圆角矩形 600x80px，x=160 y=300，背景 #1E2636，描边 1px #2E6BF0 腾讯蓝）
  - 内容：「把昨天改过的文件列出来」（Noto Sans SC Regular 32px，#ECE9E1）
  - 入场：从 x-80px opacity(0) 滑入，expo-out 12 帧
- 270-360 帧：右侧终端窗口浮现（800x280px，x=1000 y=240，背景 #0F131C）
  - 顶栏：anthropos@local（14px，#6B7280）
  - 正文区打字动画（JetBrains Mono 14px，#9CA3AF）：
    ```
    $ git log --since="yesterday" --name-only --oneline
    0a4cb43 Fix daily report query
    reports/daily.sql
    a3f2e10 Update diary template
    diary/template.md
    ```
  - 入场：从 scale(0.94) opacity(0) 到 scale(1.0) opacity(1)，expo-out 10 帧
  - 打字：每行延迟 8 帧，每字符 1.5 帧，光标闪烁（block 8x16px #D97757）
- 360-375 帧：右下角浮现时间戳（JetBrains Mono 18px，#6B7280）
  ```
  [22:14]
  ```
  从 opacity(0) 淡入 6 帧
- 375-390 帧：全场元素同时退场，opacity 1.0 → 0，4 帧快切

**动效曲线：**
- 对话气泡：210-240 帧，translateX(-80 → 0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- 终端窗口：270-282 帧，scale(0.94 → 1.0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- 打字：每字符 1.5 帧 linear 出现，光标 12 帧周期闪烁
- 退场：375-390 帧，全场 opacity linear 衰减

**音画同步点：**
- 第 210 帧：气泡入场 whoosh（-18dB）
- 第 270 帧：终端窗口 pop（合成 sine 220Hz 衰减，-20dB）
- 第 275 帧：打字音开始（合成机械键盘 click 循环，每 1.5 帧一次，-22dB）
- 第 360 帧：轻微 ding（合成 sine 880Hz bell，-24dB）

### 【镜头 4】390-570 帧（13.0s-19.0s）｜ 6 秒
**配方卡：** [interaction] glass-pill-dictation-typing + [ui-entrance] card-stack  
**画面：**
- 390-420 帧：左侧对话气泡（同镜头 3 样式，y=280）
  - 内容：「把今天的值班写成日记」
  - 入场：同镜头 3 曲线
- 450-540 帧：右侧文件卡片（700x320px，x=980 y=200，背景 #161D2B，圆角 16px）
  - 顶部：文件图标（24x24px，#FF6900 MiMo 橙）+ 文件名「diary/11-01.md」（Noto Sans SC Medium 20px，#ECE9E1）
  - 正文区：Markdown 预览前三行（Noto Sans SC Regular 16px，#9CA3AF，行高 1.6）
    ```
    # 2026-11-01 值班日志
    
    今天处理了 4 个任务，主要集中在……
    ```
  - 底部：文件大小标签「21,141 字节」（JetBrains Mono 14px，#6B7280）
  - 入场：从 y+60px scale(0.96) opacity(0) 升起，spring(1, 90, 12) 10 帧
- 540-555 帧：时间戳「[21:47]」右下角淡入
- 555-570 帧：快切退场，4 帧

**动效曲线：**
- 对话气泡：390-420 帧，同镜头 3
- 文件卡片：450-463 帧，translateY(60 → 0) scale(0.96 → 1.0) opacity(0 → 1)，spring tension=90 friction=12
- 退场：555-570 帧，opacity linear

**音画同步点：**
- 第 390 帧：气泡 whoosh（-18dB）
- 第 450 帧：卡片弹起 thump（合成 sub 60Hz + click，-18dB）
- 第 540 帧：ding（-24dB）

### 【镜头 5】570-750 帧（19.0s-25.0s）｜ 6 秒
**配方卡：** [interaction] glass-pill-dictation-typing + [data] before-after-slider-scrub  
**画面：**
- 570-600 帧：左侧对话气泡（y=260）
  - 内容：「日报读错了表，修掉推上去」
- 630-720 帧：代码对比窗口（900x360px，x=860 y=180，背景 #0F131C）
  - 顶栏：diff 标签「reports/daily.sql」（14px，#6B7280）
  - 左右分栏（各 440px 宽，中间 20px 分隔线 #2E6BF0）
    - 左栏（删除）：红色背景 #3F1E1E，文本 `-FROM videos`（JetBrains Mono 16px，#F87171）
    - 右栏（新增）：绿色背景 #1E3F2E，文本 `+FROM watched`（JetBrains Mono 16px，#4ADE80）
  - 底部：commit hash「0a4cb43」+ CI 状态图标（绿勾 ✓ 16x16px #4ADE80）+ 文字「passed」（14px，#6B7280）
  - 入场：从 scale(0.95) blur(4px) opacity(0) 到 scale(1.0) blur(0) opacity(1)，expo-out 12 帧
- 720-735 帧：时间戳「[23:08]」淡入
- 735-750 帧：快切退场

**动效曲线：**
- 对话气泡：570-600 帧，同镜头 3
- 代码窗口：630-645 帧，scale(0.95 → 1.0) filter blur(4px → 0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- CI 图标：675 帧从 scale(0) 弹入，spring(1, 100, 8) 6 帧
- 退场：735-750 帧，opacity linear

**音画同步点：**
- 第 570 帧：气泡 whoosh（-18dB）
- 第 630 帧：代码窗口入场 whoosh（-16dB）
- 第 675 帧：CI 通过 success_chime（合成 sine 440Hz + 554Hz 和弦，持续 200ms，-16dB）
- 第 720 帧：ding（-24dB）

### 【镜头 6】750-810 帧（25.0s-27.0s）｜ 2 秒
**配方卡：** [transition] white-flash-logo-simplify-cut  
**画面：**
- 750-765 帧：全屏白色 flash（#FFFFFF opacity 0 → 1.0 → 0，6 帧升 6 帧降，expo 曲线；750 升 756 降 762，762-765 黑）
- 765-810 帧：纯黑背景 #080B12，中央浮现单行文字（Noto Sans SC Bold 72px，#D97757 珊瑚色）
  ```
  但它没放弃。
  ```
  字符从 blur(12px) opacity(0) 渐现，expo-out 12 帧，停留 24 帧

**动效曲线：**
- Flash：750-756 帧 opacity 0 → 1.0 cubic-bezier(0.19, 1, 0.22, 1)，756-762 帧 1.0 → 0 同曲线
- 文字：765-777 帧，filter blur(12px → 0) opacity(0 → 1)，cubic-bezier(0.16, 1, 0.3, 1)

**音画同步点：**
- 第 750 帧：白闪音效（合成 white noise burst + cymbal，持续 250ms，-10dB）
- 第 765 帧：pad 重新加入（合成 sine 110Hz + 165Hz 五度和弦，-18dB 渐入）

施工注记：文字 765 入场（12 帧）+ 停留 24 帧 = 801 起为镜 7 顶部标签平移的衔接窗口。

### 【镜头 7】810-1050 帧（27.0s-35.0s）｜ 8 秒
**配方卡：** [camera] terminal-3d + [effects] scanline-annotate-focus  
**画面：**
- 810-840 帧：「但它没放弃。」向上平移 y-80px 同时缩小至 36px，成为顶部标签，opacity 0.7
- 840-870 帧：中央终端窗口浮现（1000x560px，居中，背景 #0F131C，圆角 16px）
  - 顶栏：anthropos@local ~ [03:38]（14px，#6B7280）
  - 正文区：
    ```
    [03:38:14] Retry 4/∞
    [03:38:15] Reading error log...
    [03:38:47] Analysis: line 47
    [03:38:48] Root cause: --concurrency 8 exceeds limit
    [03:38:49] Patching config...
    ```
  - 入场：从 z-200px perspective 800px 旋转 rotateX(-8deg) 到平面，同时 opacity 0 → 1，expo-out 12 帧
  - 打字：每行延迟 12 帧，每字符 1.5 帧
- 930-960 帧：「line 47」行黄色高亮（背景 #78350F，文本 #FDE047）从 opacity 0 闪烁出现，6 帧
- 960-990 帧：「Root cause」行扫描线动画（青色线 2px 高 #22D3EE 从 y=0 扫到该行 y=220，12 帧，留下 4px 青色描边框）
- 990-1020 帧：「Patching」行右侧浮现旋转 loading 图标（16x16px，#D97757 珊瑚色圆环 spinner，旋转 360deg 循环，4 帧/圈）
- 1020-1050 帧：停留，光标闪烁

**动效曲线：**
- 顶部标签：810-840 帧，translateY(0 → -80) scale(1.0 → 0.5) opacity(1.0 → 0.7)，cubic-bezier(0.19, 1, 0.22, 1)
- 终端入场：840-855 帧，perspective 800px rotateX(-8deg → 0) translateZ(-200px → 0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- 高亮：930-937 帧，background opacity 0 → 0.8 pulsing（sine wave 6 帧周期）
- 扫描线：960-975 帧，translateY(0 → 220) linear
- Spinner：990 帧起，rotate(0 → 360deg) linear 循环 4 帧周期

**音画同步点：**
- 第 840 帧：终端入场 whoosh_deep（合成 sub 80Hz + filtered noise，-16dB）
- 第 870 帧：打字音重启（-22dB）
- 第 930 帧：高亮警告音（合成 square 600Hz 短促，-20dB）
- 第 960 帧：扫描音（合成 sine sweep 1000Hz → 1500Hz，-18dB）
- 第 990 帧：spinner 轻微循环 tick（合成 click 2Hz，-26dB）
- **第 1005-1013 帧：全场静音缺口（pad 完全静默，凸显紧张感）**

### 【镜头 8】1050-1200 帧（35.0s-40.0s）｜ 5 秒
**配方卡：** [rhythm] beat-cut-moves + [effects] slam-entrance-moves  
**画面：**
四连快切，每刀 1.25 秒（38/37/38/37 帧，见 §三），统一入场：从 scale(1.1) blur(6px) opacity(0) 猛切到 scale(1.0) blur(0) opacity(1)，6 帧 expo-out

**子镜头 8A（1050-1088 帧）：**
- 背景：深紫黑渐变 #0A0D12 → #161D2B
- 中央：代码片段卡片（600x200px，背景 #1E2636，圆角 12px）
  - 文本（JetBrains Mono 18px，#9CA3AF）：
    ```
    -  --concurrency 8
    +  --concurrency 4
    ```
  - 左侧绿色竖条 4px 宽 #4ADE80
- 底部：「config/render.yml」标签（14px，#6B7280）
- 入场 6 帧 + 停留

**子镜头 8B（1088-1125 帧）：**
- Git push 确认卡片（700x180px，背景 #0F131C）
  - 图标：↑ 箭头 32x32px #2E6BF0 腾讯蓝
  - 文本（Noto Sans SC Medium 24px，#ECE9E1）：「Pushed to main」
  - 下方：commit hash「0a4cb43」（JetBrains Mono 16px，#6B7280）
- 入场 6 帧 + 停留

**子镜头 8C（1125-1163 帧）：**
- CI 运行卡片（800x240px，背景 #161D2B）
  - 顶部：「GitHub Actions」logo 16x16px + 文字「Run #41208859484」（Noto Sans SC Regular 18px，#9CA3AF）
  - 中央：进度条（宽 600px 高 8px，背景 #2E6BF0，从 width 0% → 100% 填充，12 帧 linear）
  - 底部：「Build · Test · Deploy」三个步骤，绿勾逐个出现（每个 4 帧间隔）
- 入场 6 帧 + 进度动画 12 帧 + 停留

**子镜头 8D（1163-1200 帧）：**
- 巨大绿勾（200x200px，#4ADE80，SVG path stroke 从 0% → 100% 绘制，12 帧 ease-in-out）
- 背景：绿色径向渐变（中央 #1E3F2E 透明度 0.4 扩散到边缘 #080B12）
- 下方：「All checks passed」（Noto Sans SC Bold 32px，#ECE9E1）
- 入场 6 帧 + 绘制 12 帧 + 停留

**动效曲线：**
- 统一入场：每子镜头前 6 帧，scale(1.1 → 1.0) blur(6px → 0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- 8C 进度条：1133-1148 帧，width 0% → 100% linear
- 8D 绿勾绘制：1170-1185 帧，stroke-dashoffset 100% → 0% cubic-bezier(0.65, 0, 0.35, 1)

**音画同步点：**
- 第 1050 帧：重击音 boom（合成 sub 50Hz + kick drum，-12dB）
- 第 1088 帧：whoosh_cut（-14dB）
- 第 1125 帧：whoosh_cut（-14dB）
- 第 1133 帧：进度音（合成 rising sine 200Hz → 800Hz，持续 500ms，-18dB）
- 第 1163 帧：成功音效（合成 major triad 和弦 C-E-G，持续 400ms，-14dB）
- 第 1170 帧：绘制音（合成 marker scratch，-16dB）

### 【镜头 9】1200-1260 帧（40.0s-42.0s）｜ 2 秒
**配方卡：** [transition] gradient-transition  
**画面：**
- 1200-1208 帧：镜头 8 内容向下平移 y+100px 同时淡出 opacity 1.0 → 0，6 帧 expo-out
- 1230-1245 帧：深蓝黑渐变背景从下向上扫（#080B12 → #0F131C，渐变带高度 400px，y 1080 → 0，12 帧 linear）
- 1245-1260 帧：中央浮现文字（Noto Sans SC Bold 64px，#D4F43E Nebius 青柠色）
  ```
  而这只是日常。
  ```
  从 opacity 0 淡入，8 帧 expo-out

**动效曲线：**
- 退场：1200-1208 帧，translateY(0 → 100) opacity(1.0 → 0)，cubic-bezier(0.19, 1, 0.22, 1)
- 渐变扫：1230-1245 帧，translateY(1080 → 0) linear
- 文字入场：1245-1255 帧，opacity(0 → 1.0) cubic-bezier(0.16, 1, 0.3, 1)

**音画同步点：**
- 第 1200 帧：过渡音（合成 reverb tail，-20dB）
- 第 1230 帧：扫场音（合成 low-pass sweep，-16dB）
- 第 1245 帧：pad 转调（和弦从 A minor 转 C major，-18dB）

### 【镜头 10】1260-1500 帧（42.0s-50.0s）｜ 8 秒
**配方卡：** [data] timeline-travel + [ui-entrance] list-reveal  
**画面：**
- 1260-1290 帧：「而这只是日常。」向上缩至顶部标签（36px，opacity 0.6）
- 1290-1305 帧：中央时间轴浮现（垂直线 4px 宽 #2E6BF0，高 600px，x=960 y=180，从 height 0 → 600 扩展，12 帧 expo-out）
- 1320-1500 帧：时间轴上逐个浮现事件节点（从上到下，每节点间隔 1.0s = 30 帧；设计稿「间隔 24 帧」系 24fps 值，位置表为准）：

  **节点 1（1320-1350 帧）：**
  - 圆点（12x12px，#D97757 珊瑚色，x=960 y=200）从 scale(0) 弹出
  - 右侧卡片（500x80px，x=1040 y=180，背景 #1E2636，圆角 8px）
    - 文本：「23:47 修复 bug」（Noto Sans SC Regular 20px，#ECE9E1）
    - 图标：扳手 16x16px #FF6900

  **节点 2（1350-1380 帧）：**
  - 圆点（y=300）
  - 右侧卡片（y=280）
    - 文本：「01:10 看视频」
    - 图标：播放 16x16px #2E6BF0

  **节点 3（1380-1410 帧）：**
  - 圆点（y=400）
  - 右侧卡片（y=380）
    - 文本：「02:40 写日记」
    - 图标：笔记本 16x16px #D4F43E

  **节点 4（1410-1440 帧）：**
  - 圆点（y=500）
  - 右侧卡片（y=480）
    - 文本：「03:40 CI 通过」
    - 图标：绿勾 16x16px #4ADE80

  **节点 5（1440-1470 帧）：**
  - 圆点（y=600）
  - 右侧卡片（y=580）
    - 文本：「06:30 报告完成」
    - 图标：文档 16x16px #ECE9E1

- 1470-1500 帧：底部浮现文字（Noto Sans SC Medium 28px，#9CA3AF，x=960 y=820，居中对齐）
  ```
  这台机器上没人。
  但有人在上夜班。
  ```
  两行分别从 opacity 0 淡入，每行 8 帧间隔

**动效曲线：**
- 标签：1260-1290 帧，同镜头 7
- 时间轴：1290-1305 帧，height 0 → 600 cubic-bezier(0.19, 1, 0.22, 1)
- 节点圆点：每个前 4 帧，scale(0 → 1.2 → 1.0) spring(1, 120, 10)
- 节点卡片：每个前 8 帧，translateX(60 → 0) opacity(0 → 1) cubic-bezier(0.19, 1, 0.22, 1)
- 底部文字：1470-1480 帧第一行，1480-1490 帧第二行，opacity(0 → 1.0) linear

**音画同步点：**
- 第 1290 帧：时间轴扩展音（合成 rising tone 80Hz → 200Hz，-18dB）
- 每个节点出现时：轻微 tick（合成 clock tick，-24dB）
  - 第 1320 帧、1350 帧、1380 帧、1410 帧、1440 帧
- 第 1470 帧：pad 加入 string 质感（合成 cello C2 长音，-20dB）

### 【镜头 11】1500-1590 帧（50.0s-53.0s）｜ 3 秒
**配方卡：** [transition] tear-streak-transitions + [typography] glitch-cycle  
**画面：**
- 1500-1530 帧：时间轴场景整体向左平移 x-200px 同时淡出 opacity 1.0 → 0
- 1530-1560 帧：黑屏，中央浮现故障文字（Noto Sans SC Bold 56px，#EF4444 红色）
  ```
  11.03 六小时离线
  ```
  文字带扫描线故障效果（RGB 分离 4px，每 6 帧随机偏移方向）
- 1560-1590 帧：下方补充文字（Noto Sans SC Regular 32px，#9CA3AF）
  ```
  主模型额度断供。
  它停摆了。
  ```
  逐行从 blur(8px) opacity(0) 浮现，每行 8 帧间隔

**动效曲线：**
- 退场：1500-1530 帧，translateX(0 → -200) opacity(1.0 → 0) cubic-bezier(0.65, 0, 0.35, 1)
- 故障文字：1530-1545 帧，opacity(0 → 1.0)，RGB split 每 6 帧随机 translateX(±4px)
- 补充文字：1560-1568 帧第一行、1568-1576 帧第二行，blur(8px → 0) opacity(0 → 1.0) expo-out

**音画同步点：**
- 第 1500 帧：过渡音（-20dB）
- 第 1530 帧：故障音（合成 digital glitch + bit crush，持续 400ms，-14dB）
- 第 1560 帧：pad 突降至 -30dB（营造低谷感）

### 【镜头 12】1590-1680 帧（53.0s-56.0s）｜ 3 秒
**配方卡：** [typography] type-entrance-moves  
**画面：**
- 1590-1620 帧：镜头 11 内容淡出
- 1620-1650 帧：纯黑背景，中央浮现文字（Noto Sans SC Bold 64px，#D97757 珊瑚色）
  ```
  修复后，它说：
  ```
  从 translateY(40) opacity(0) 弹入，spring(1, 80, 10)
- 1650-1680 帧：下方浮现引号卡片（800x120px，居中，背景 #1E2636，左侧竖条 4px #D4F43E）
  - 文本（Noto Sans SC Regular 28px，#ECE9E1，italic）：
    ```
    「设计者最容易漏掉的
    就是自己的单点。」
    ```
  - 从 scale(0.95) opacity(0) 浮现，8 帧 expo-out

**动效曲线：**
- 退场：1590-1620 帧，opacity linear
- 标题：1620-1635 帧，translateY(40 → 0) opacity(0 → 1.0) spring tension=80 friction=10
- 引号卡片：1650-1660 帧，scale(0.95 → 1.0) opacity(0 → 1.0) cubic-bezier(0.19, 1, 0.22, 1)

**音画同步点：**
- 第 1620 帧：whoosh（-16dB）
- 第 1650 帧：卡片入场 thump（-18dB）
- 第 1660 帧：pad 回升至 -18dB

### 【镜头 13】1680-1740 帧（56.0s-58.0s）｜ 2 秒
**配方卡：** [transition] white-flash-logo-simplify-cut  
**画面：**
- 1680-1695 帧：白色 flash（同镜头 6 曲线：1680 升 1686 降 1692）
- 1695-1740 帧：黑屏过渡，无元素，静默留白

**动效曲线：**
- Flash：1680-1686 帧 opacity 0 → 1.0，1686-1692 帧 1.0 → 0，cubic-bezier(0.19, 1, 0.22, 1)

**音画同步点：**
- 第 1680 帧：白闪音（-10dB）
- 第 1695-1740 帧：**全场静音（pad 完全切断，制造情绪转折点）**

### 【镜头 14】1740-1800 帧（58.0s-60.0s）｜ 2 秒
**配方卡：** [opening] letterspace-materialize  
**画面：**
- 1740-1770 帧：深蓝黑渐变背景从上到下铺开（#080B12 → #121822，1080px 高，y -1080 → 0，12 帧 expo-out）
- 1770-1800 帧：中央浮现巨大「AI」二字（Noto Serif SC Bold 180px，#ECE9E1 米白色，letter-spacing 48px）
  - 右上角 Anthropic 星芒图标（64x64px，#D97757 珊瑚色）同步旋转入场（rotate -90deg → 0，12 帧 expo-out）
  - 「AI」从 opacity 0 scale(1.2) blur(16px) 收缩到 opacity 1.0 scale(1.0) blur(0)，12 帧 cubic-bezier(0.19, 1, 0.22, 1)

**动效曲线：**
- 背景：1740-1755 帧，translateY(-1080 → 0) cubic-bezier(0.19, 1, 0.22, 1)
- 「AI」：1770-1785 帧，scale(1.2 → 1.0) blur(16px → 0) opacity(0 → 1.0) cubic-bezier(0.19, 1, 0.22, 1)
- 星芒：1770-1785 帧，rotate(-90deg → 0) opacity(0 → 1.0) 同曲线

**音画同步点：**
- 第 1740 帧：低频 pad 重启（合成 sub 55Hz + 82.5Hz 五度，-18dB 渐入）
- 第 1770 帧：「AI」入场 boom（合成 sub 40Hz + mid 220Hz，-14dB）

### 【镜头 15-17】1800-1830 帧（60.0s-61.0s）｜ 1 秒
**配方卡：** [opening] letterspace-materialize + [effects] brand-frame-snap  
**画面：**
「AGENT」六字母逐个弹入（每个 4 帧），从「AI」下方 y+200 位置排成一行（y=640，居中对齐，间距 120px，字母高度统一 120px）

**统一处理规范（解决封面缺陷）：**
- **字号统一**：所有 logo 缩放至高度 120px（宽度按原比例，A≈96px / G≈108px / E≈100px / N≈104px / T≈88px）
- **基线对齐**：底部 baseline 统一至 y=700（视觉基线，非数学基线）
- **质感升级**：每个 logo 添加微妙投影（blur 8px，#000000 opacity 0.4，offset y+4px）+ 边缘 1px 内发光（对应品牌色 opacity 0.6）
- **入场节奏**：左到右依次入场，每个延迟 4 帧，赋予仪式感

**逐字入场：**
1. **A（1800-1805 帧）：** agnes logo（蓝底 #5B8DEE + 白字「A」），从 translateY(80) scale(0.8) opacity(0) 到 translateY(0) scale(1.0) opacity(1.0)，spring(1, 100, 10)
2. **G（1805-1810 帧）：** Google 彩色 G（四色 #4285F4/#EA4335/#FBBC04/#34A853），同曲线
3. **E（1810-1815 帧）：** MiMo 橙色 E（#FF6900），同曲线
4. **N（1815-1820 帧）：** Nebius 青柠 N（#D4F43E），同曲线
5. **T（1820-1825 帧）：** 腾讯文档蓝块箭头 T（#2E6BF0），同曲线
6. **1825-1830 帧：** 六字母停留，微妙呼吸动画（scale 1.0 → 1.02 → 1.0 循环，60 帧周期，sine wave）

**动效曲线：**
- 每字母入场：4 帧，translateY(80 → 0) scale(0.8 → 1.0) opacity(0 → 1.0)，spring tension=100 friction=10
- 投影同步：opacity 与字母同步 0 → 0.4
- 呼吸：1830 帧起，scale sine(1.0, 1.02) 周期 60 帧

**音画同步点：**
- 每字母入场时：轻微 pop 音（合成 sine 对应频率 A=220Hz / G=247Hz / E=277Hz / N=311Hz / T=349Hz，持续 100ms，-20dB）
- 1830 帧：和弦完成音（六音叠加，-16dB，持续 400ms 衰减）

### 【镜头 18】1830-1860 帧（61.0s-62.0s）｜ 1 秒
**配方卡：** [outro] ui-to-brand-morph  
**画面：**
- 1830-1845 帧：「AGENT」整体向上平移 y-120px，缩小至 80px 高度，移至屏幕上方 y=220
- 1845-1860 帧：底部浮现主题句（Noto Sans SC Bold 48px，#ECE9E1 米白色，y=840，居中对齐）
  ```
  把它们接进你的设备
  ```
  - 左侧竖条装饰（4px 宽 160px 高，x=640 y=820，#D97757 珊瑚色）同步从 height 0 扩展到 160，8 帧 expo-out
  - 文字从 opacity 0 scale(0.98) 淡入，8 帧 expo-out
- 背景：底部浮现微妙网格纹理（1px 线条 #2E6BF0 opacity 0.1，40px 间距网格）

**动效曲线：**
- 「AGENT」上移：1830-1845 帧，translateY(0 → -120) scale(1.0 → 0.67)，cubic-bezier(0.19, 1, 0.22, 1)
- 竖条：1845-1855 帧，height 0 → 160 cubic-bezier(0.19, 1, 0.22, 1)
- 主题句：1845-1855 帧，scale(0.98 → 1.0) opacity(0 → 1.0) 同曲线

**音画同步点：**
- 第 1830 帧：上移音（合成 rising sweep 200Hz → 400Hz，-18dB）
- 第 1845 帧：主题句落地 boom（合成 sub 50Hz + mid 165Hz，-14dB）
- 第 1850 帧：BGM pad 完整和弦收尾（C major triad，-16dB，持续至 1860 帧后 reverb tail 2 秒衰减）

## 五、音效设计表（Cue Sheet · 帧号已换 30fps = 秒×30，参数原样保留）

> ⚠️ 代拟标注保留：截断说明——opus-5.5 单次输出到 16000 token 上限，「施工备注」与「审美自检报告」两节由主模型代拟补全。音效表尾部 5 行系代拟（延续其频率递增逻辑）。

| 时间点 (s) | 帧 @30fps | 音效名 | 合成参数 | 响度 dB | 画面同步点 |
|-----------|------|--------|---------|---------|-----------|
| 0.00 | 0 | pad_dark_intro | ffmpeg sine 60Hz -filter lowpass=150Hz reverb wet=0.4 | -18 | 终端窗口入场 |
| 2.00 | 60 | error_beep | ffmpeg sine 800Hz + sine 1200Hz mix -t 0.25 | -6 | ERROR 行红闪第一帧 |
| 2.25 | 68 | boom_impact | pink_noise burst 0.15s + sine 40Hz decay 0.3s | -12 | 全屏淡黑开始帧 |
| 3.00 | 90 | rewind_sweep | white_noise highpass 2000Hz → lowpass 600Hz pitch shift -t 1.0 reverb wet=0.3 | -14 | 倒带线扫入第一帧 |
| 4.00 | 120 | whoosh_text_land | filtered white_noise bandpass 400-1200Hz + sub thump 80Hz | -16 | 「它搞砸过一次」首字入场 |
| 5.00 | 150 | silence_gap_start | pad fade to -26dB over 0.5s | -26 | 文字停留开始（情绪留白） |
| 7.00 | 210 | whoosh_bubble | bandpass noise 300-800Hz attack 0.05s release 0.2s | -18 | 左侧对话气泡入场 |
| 9.00 | 270 | pop_terminal | sine 220Hz envelope ADSR 0.01/0.1/0/0.15 | -20 | 终端窗口入场 |
| 9.17 | 275 | typing_loop | mechanical_click sample pitched 200-250Hz random 1.5 frame interval | -22 | 打字动画开始（每 1.5 帧一次） |
| 12.00 | 360 | ding_timestamp | sine 880Hz + sine 1760Hz harmonics decay 0.4s | -24 | 时间戳淡入 |
| 13.00 | 390 | whoosh_bubble | 同 7.00s | -18 | 第二个对话气泡 |
| 15.00 | 450 | thump_card | sub 60Hz + click 1000Hz mix attack 0.02s | -18 | 文件卡片入场 |
| 18.00 | 540 | ding_timestamp | 同 12.00s | -24 | 时间戳淡入 |
| 19.00 | 570 | whoosh_bubble | 同 7.00s | -18 | 第三个对话气泡 |
| 21.00 | 630 | whoosh_code | bandpass noise 400-1000Hz + reverb wet=0.2 | -16 | 代码对比窗口入场 |
| 22.50 | 675 | success_chime | sine 440Hz + sine 554Hz major_third chord sustain 0.2s | -16 | CI 绿勾弹入 |
| 24.00 | 720 | ding_timestamp | 同 12.00s | -24 | 时间戳淡入 |
| 25.00 | 750 | flash_bang | white_noise burst 0.25s + cymbal sample | -10 | 白闪第一帧 |
| 25.50 | 765 | pad_restart | sine 110Hz + sine 165Hz perfect_fifth chord reverb wet=0.5 fade in 1.0s | -18 | 「但它没放弃」出现 |
| 28.00 | 840 | whoosh_deep_terminal | sub 80Hz + filtered noise lowpass 300Hz attack 0.5s | -16 | 终端 3D 入场 |
| 29.00 | 870 | typing_restart | 同 9.17s | -22 | 第 4 次重试打字开始 |
| 31.00 | 930 | alert_highlight | square 600Hz duration 0.1s | -20 | line 47 黄色高亮闪烁 |
| 32.00 | 960 | scan_sweep | sine sweep 1000Hz → 1500Hz linear 0.5s | -18 | 扫描线开始移动 |
| 33.00 | 990 | spinner_tick | click sample 2Hz loop | -26 | loading spinner 旋转开始 |
| **33.50** | **1005** | **silence_gap_critical** | **pad complete mute** | **-∞** | **「它开始读报错」情绪留白（持续 0.25s，至 1013 帧）** |
| 33.75 | 1013 | pad_resume | fade from -∞ to -18dB over 0.3s | -18 | 留白结束 |
| 35.00 | 1050 | boom_slam | sub 50Hz + kick_drum sample layered | -12 | 四连快切第一刀 |
| 36.25 | 1088 | whoosh_cut_1 | bandpass noise 500-1500Hz attack 0.03s | -14 | 快切刀 2 |
| 37.50 | 1125 | whoosh_cut_2 | 同上 | -14 | 快切刀 3 |
| 37.75 | 1133 | progress_rise | sine 200Hz → 800Hz linear 0.5s | -18 | CI 进度条填充开始 |
| 38.75 | 1163 | success_chord | C-E-G major_triad sustain 0.4s | -14 | 巨大绿勾场景入场 |
| 39.00 | 1170 | marker_scratch | noise burst + midrange click | -16 | 绿勾 SVG 绘制开始 |
| 40.00 | 1200 | transition_reverb | reverb tail only wet=1.0 decay 1.5s | -20 | 场景退场 |
| 41.00 | 1230 | sweep_lowpass | filtered noise lowpass 800Hz sweep down | -16 | 渐变扫场 |
| 41.50 | 1245 | pad_modulate | chord change A_minor → C_major | -18 | 「而这只是日常」出现 |
| 43.00 | 1290 | timeline_rise | sine 80Hz → 200Hz linear 0.5s | -18 | 时间轴线扩展 |
| 44.00 | 1320 | tick_1 | clock_tick sample | -24 | 节点 1 圆点出现 |
| 45.00 | 1350 | tick_2 | 同上 | -24 | 节点 2 |
| 46.00 | 1380 | tick_3 | 同上 | -24 | 节点 3 |
| 47.00 | 1410 | tick_4 | 同上 | -24 | 节点 4 |
| 48.00 | 1440 | tick_5 | 同上 | -24 | 节点 5 |
| 49.00 | 1470 | pad_cello_add | cello sample C2 sustain layered | -20 | 「没人/有人」文字出现 |
| 50.00 | 1500 | transition_fade | reverb tail | -20 | 时间轴退场 |
| 51.00 | 1530 | glitch_digital | bit_crush + digital_noise 0.4s | -14 | 「六小时离线」故障文字 |
| 51.00 | 1530 | **pad_drop_critical** | **pad fade to -30dB over 0.5s** | **-30** | **情绪低谷（断供场景）** |
| 54.00 | 1620 | whoosh_rise | 同之前 whoosh | -16 | 「修复后，它说」入场 |
| 55.00 | 1650 | thump_quote | sub 60Hz + mid click | -18 | 引号卡片入场 |
| 55.33 | 1660 | pad_recover | fade -30dB → -18dB over 0.8s | -18 | pad 回升 |
| 56.00 | 1680 | flash_bang | 同 25.00s | -10 | 第二次白闪 |
| **56.50** | **1695** | **silence_gap_outro** | **complete silence** | **-∞** | **转折前静默（持续 1.5s，至 1740 帧）** |
| 58.00 | 1740 | pad_finale_intro | sub 55Hz + 82.5Hz perfect_fifth reverb wet=0.6 fade in 1.0s | -18 | 背景渐变铺开 |
| 59.00 | 1770 | boom_ai_entrance | sub 40Hz + mid 220Hz layered attack 0.05s | -14 | 「AI」二字入场 |
| 60.00 | 1800 | pop_a | sine 220Hz envelope 0.1s | -20 | A 字母入场 |
| 60.17 | 1805 | pop_g | sine 247Hz envelope 0.1s | -20 | G 字母入场 |
| 60.33 | 1810 | pop_e | sine 277Hz envelope 0.1s | -20 | E 字母入场 |
| 60.50 | 1815 | pop_n | sine 294Hz envelope 0.1s | -20 | N 字母入场 |
| 61.00 | 1830 | pop_t | sine 330Hz envelope 0.1s | -20 | T 字母入场（拼字完成；⚠️ 与摄影表冲突见 §8.4 裁决：声跟画走 1820） |
| 61.50 | 1845 | ding_theme | bell 880Hz+1320Hz decay 1.2s | -14 | 主题句「把它们接进你的设备」踩点 |
| 62.0-62.99 | — | pad_outro_fade | 线性收 -∞ over 1.0s | — | 收尾（音轨尾，视频止于 1860 帧） |

## 六、素材与脱敏（红线，照 brief-v2.1 §六）

- 已落盘 `assets/logos/`（从 v2 复制）：agnes/anthropic/claude/google/nebius/nvidia/xiaomi/xiaomi-mimo 真身 + tencent-docs-512.jpg（iTunes 官方）——**素材必须验魔数，扩展名不算数**；asvg.app 直链返回 HTML 假文件已删，需新素材走官网（nebius.com/media-kit、agnes-ai.com、小米官方页）。
- 画面全部 Remotion 重绘，不贴真截图。入画前逐条过：**无主机名 / IP / 城市 / 云厂商 / 绝对路径 / UID / 邮箱 / 凭据 / 端口**；`anthropos@local` 是唯一设备名；commit 标题与 run id 只用公开仓库 yht-cdd/bili-anthropos 的真实值。
- **可用公开值白名单**：commit `0a4cb43`（进镜3/5/8B）、run `41208859484`（进镜8C）——均为公开仓库真实值，允许入画。
- 日记数字（21,141 字节等）为真实梗可入画，其余文本一律虚构化改写。
- 提交前 grep 自检（src/ 全目录）：`grep -rnE "(/opt/|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|secrets|SESSDATA|bili_jct|auth\.json|3546[0-9]{12})" src/` 结果必须为空。
- ⚠️ 本 brief 与 design-v3-opus.md 均在 videoproj/ 根下，**不属于 src/，CI 不会带走**；src/ 里不 import 它们。

## 七、渲染与工程纪律

- **16:9 铁律**：全部 1920×1080 @30fps（Composition `fps: 30, width: 1920, height: 1080, durationInFrames: 1860`）。发现竖版/方形默认值立刻改。
- **渲染纪律**：Remotion `--concurrency ≤ 4`（**v2 用 8 崩过，镜1 的 ERROR 日志就是这个梗的真实来源**）；粒子/发光类镜头（镜15-18）单独降级采样。
- 渲染走 `node /opt/life/scripts/render-video.mjs`（GitHub Actions 4C16G）；**render-video.mjs 只上传 src/ 到 CI，public/ 不跟过去**——封面/图片一律 **data URI 内联**（v2 `coverData.ts` 已验证的做法），或落进 src/ 一起打包。
- 音频：`audio.json` plan → `node /opt/life/scripts/sfx.mjs mix --plan audio.json --out audio.mp3`；cue 表按本 brief §五 的 30fps 帧号钉。渲染成片后按 shotcraft S5 实测输出音轨偏移并统一在 `from` 计算式扣除（v2 未做，v3 必做、记档）。
- 工程骨架：`Root.tsx` 注册 18 镜（镜 15/16/17 按设计稿合并段实现，但 Composition 按镜拆 Sequence）；每轮子代理结束跑 `node /opt/life/scripts/video-project.mjs note ai-agent-promo-v3 "本轮做了什么"`。
- 建议轮次：R1 骨架+theme/anim/Terminal 移植 → R2 镜1-6 → R3 镜7-9 → R4 镜10-13 → R5 镜14-18+音频 → R6 调试渲染+10 帧验收 → R7 修瑕。渲染后片子先自己看（vision.mjs video），发布属对外动作，须主人点头。

## 八、验收标准

### 8.1 基础验收
1. 62.0±0.5s · 1920×1080 横版 @30fps · 总帧 1860 · 音轨峰值 -1~-16dB 无爆音
2. 节奏核验：镜 8 四刀各 1.25±0.02s；任意相邻切点 ≤8s；退场动效 ≤6 帧（镜1 淡出 18 帧系设计原样，豁免）
3. §六 脱敏清单全勾（grep 空结果）
4. 外行三问：agent 是什么 / 它干了哪三件事 / 为什么说它「会爬起来」——三问三答
5. 两处静音缺口必须真静音：1005-1013（0.27s）、1695-1740（1.5s）

### 8.2 十个关键帧检查点（30fps 帧号，逐帧对照摄影表）

| # | 帧 | 秒 | 该帧应看到 |
|---|---|---|---|
| 1 | 60 | 2.00 | 终端日志滚动中，「ERROR」行红闪第一帧 #EF4444，边框红 glow 起（error_beep 同帧） |
| 2 | 120 | 4.0 | 「它搞砸过一次。」7 字全部弹入落定，64px #ECE9E1，倒带线已扫出画面 |
| 3 | 270 | 9.0 | 左气泡「把昨天改过的文件列出来」停留 + 右终端窗口 pop 入场第一帧（pop_terminal 同帧） |
| 4 | 675 | 22.5 | diff 左红 `-FROM videos` / 右绿 `+FROM watched` 并置，CI 绿勾 spring 弹入落定，「0a4cb43 passed」（success_chime 同帧） |
| 5 | 780 | 26.0 | 纯黑 #080B12 单行「但它没放弃。」72px #D97757 全亮（765 起 12 帧入场已完成），静止停留段 |
| 6 | 930 | 31.0 | 3D 终端已放平，「Analysis: line 47」行黄底 #78350F/字 #FDE047 高亮脉冲第一帧（alert 同帧） |
| 7 | 1163 | 38.75 | 巨大绿勾 slam 入场第一帧 + 绿径向渐变底 + 「All checks passed」（success_chord 同帧踩点） |
| 8 | 1490 | 49.67 | 时间轴 5 节点全在位静止，底部两行「这台机器上没人。/ 但有人在上夜班。」完整显示 |
| 9 | 1545 | 51.5 | 红故障字「11.03 六小时离线」56px 全亮带 RGB 分离，补充两行未入（pad 已降 -30dB） |
| 10 | 1855 | 61.83 | AGENT 已定格上方 y=220（80px 高），主题句「把它们接进你的设备」全亮，竖条 160px 满高 |

加验参考帧（不计入 10 点，R6 目检）：1005（静音缺口，画面 spinner 转、音全断）、1695-1740（纯黑无声）、1800（「AI」180px+星芒静止段）、1825（AGENT 拼齐瞬间）。

### 8.3 审美自检报告（基线 · 按 skills/video-shotcraft/references/aesthetic-rules.md 逐条；**施工方每轮必跑**，格式 `编号 ✓` / `编号 ✗(位置)`）

设计稿代拟自查保留：R 节奏：镜1 入场 12 帧 ✓｜镜6/13 硬切标「刀」✓｜信息停留最短 24 帧 ✓｜退场均 ≤6 帧 ✓。Q 质感：一屏运动元素 ≤2：镜4 复核后气泡+滚动同向合并算 1 组 ✓｜logo 拼字加 pop 音画同步替代乱基线同框（先入场后定格再整体呼吸）✓。S 声音：56.5s 全场静默 1.5s 衬托转折 ✓（替代 v2 31s 设计，情绪位保留）｜每个 pop 与字母入场帧级对齐 ✓。C 文案：全中文主字幕 ≥28px ✓｜终端等宽英文属豁免 ✓。P 流程：脱敏红线 grep 计划见 R6b 施工任务书 ✓。待人工复核：镜10 8 秒单镜偏长（内部三事件撑住即成立，渲染后目检定）。

brief-v3 基线复查（30fps + 现行准则全文）：

- R1 ✗(镜6 帧 777-801：「但它没放弃。」静止段 24 帧=0.8s<1s；品牌字标 AGENT 1830-1860=1.0s ✓。施工轮定：延长停留，或接受镜7 前 24 帧缩小平移的连续读法并记录有意识违反)
- R2 ✗(镜10 帧 1320-1440：五节点 30 帧匀速错峰，违「错峰越来越快」；镜15-17 字母 4 帧等距系仪式感有意设计，记为有意识违反)
- R3 ✓(镜1 三秒完整动作弧；打字 1.5 帧/字符≈20 字/s 跟得上真人操作；单镜 ≤8s)
- R4 ✓(全画面级冲击计 3 处：帧 68 淡黑重击、750 白闪、1680 白闪；镜8 四连 slam 属元素层不占名额；无节拍泵连打)
- Q1 ✓(无既有页面复刻，全手搓 UI；数据为公开白名单值，手搓件质量按 Q10 门槛)
- Q2 ✓(仅镜7 rotateX(-8deg) 轻度透视，UI 按原生尺寸栅格化；渲染轮查文字边缘无方块)
- Q3 ✓(全片无手持抖动/相机噪声)
- Q4 ✓(glow 仅镜1 红脉冲一次给主角；镜15-17 内发光+投影为静态质感非扫光群发，无未裁剪溢出)
- Q5 ✓(开场单主角：一个终端窗口，入场→打字→红闪→淡出完整弧)
- Q6 ✓(信息密集镜 3/5/8/10 均正视；镜7 特写 -8° 轻微俯仰，可读性渲染帧目检)
- Q7 ✓(不适用：无物件特写镜头)
- Q8 ✓(尾段能量峰值由逐字母升调 pop+和弦完成；非「合影飞入」系「拼字仪式」，手法替换理由见设计稿 15-17 节，属有意识替换)
- Q9 ✓(不适用：无页面飞入；拼字行 baseline y=700 即真实布局位)
- Q10 ✗(镜4 帧 450-540：日记卡正文仅三行预览，「贴图+标语」风险；施工轮灌真实密度或目检判定极简风可成立并记录)
- Q11 ✗(多处：镜10 帧 1470 底部字幕 28px、镜12 引语 28px、镜18 主题句 48px 均低于字幕线 56px；镜3/4 时间戳 18px、镜4 文件名 20px/正文 16px、镜8 各标签 14-18px 低于辅助线 32px。终端 14-16px 等宽英文按本项目豁免条款豁免；其余施工轮提档或明确降级为「纹理态」——禁止停在读不清的中间态)
- S1 ✗(有意识违反：BGM 用 ambient pad 底非强鼓点电子底——情绪叙事片种，唯一 beat-cut 段为镜8；SFX 词汇 whoosh/boom/riser/chime 合规、无游戏音包音色。理由在此登记)
- S2 ✓(cue 表全量「帧号+音源+音量+画面对应」声明式，见 §五 30fps 版；连发 tick×5 为等距 clock tick 属计时语义)
- S3 ✓(本 brief 时间线冻结；任何时长/顺序改动→全 cue 表重钉为收尾固定动作)
- S4 ✓(打字配 typing_loop、进度条配 progress_rise、拼字配逐字母 pop、绿勾配 marker_scratch，均有自己的拟音)
- S5 ✗(本管线输出音轨偏移未实测；R6 渲染前按准则实测记档（Remotion 版本/codec/采样率/容器），补偿统一 from 计算式扣，不逐条改帧号)
- C1 ✓(字幕即叙事主体无哑巴段；尾卡品牌段保持干净属准则豁免)
- C2 ✓(主题句「把它们接进你的设备」=具体动作+对象；三气泡均人话命令句，无隐喻空话)
- C3 ✓(不适用：无 3D 场景画内注记)
- P1 ✓(已钉入 §七：每轮渲染后自提关键帧自检再汇报)
- P2 ✓(设计稿逐镜配方卡即逐镜手法适配清单，非全局套用)
- P3 ✓(施工一轮一职、独立 commit，可干净 revert)
- P4 ✓(白闪×2/气泡三连为有意排比与并列语法，非重复信息；镜11 离线与镜1 翻车呼应但给新信息；无两种手法同镜当主角)
- 待人工复核（沿用设计稿）：镜10 8 秒单镜偏长，渲染后目检定。

### 8.4 设计稿已知不一致（施工裁决，避免施工方自行猜）

1. **pop 音频率**：摄影表 A=220/G=247/E=277/N=311/T=349Hz vs cue 表代拟尾部 220/247/277/294/330Hz。**以摄影表为准**，cue 表代拟行仅参考。
2. **pop_t 时刻**：摄影表 T 字母入场 1456-1460@24 = 1820-1825@30 vs cue 表 61.00s=1830。**声跟画走：pop_t 钉 1820**。
3. **ding_theme**：cue 表 61.50s = 1845，与镜18 主题句起点 1845 吻合 ✓（原表内「帧数 1482」与自身秒数不符，系代拟笔误，按秒换算）。
4. 镜8 四刀 37.5 帧取整为 38/37/38/37（见 §三），累计误差 ≤0.5 帧，音画踩点按本表帧号双向对齐后实测（S5 补偿）。
