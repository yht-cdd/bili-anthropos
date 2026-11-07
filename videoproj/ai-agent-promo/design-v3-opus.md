> 🔧 **施工换算令（主模型验收注记 2026-11-04）**：opus 按 24fps 排的帧号（镜1=72帧/3.0s）。
> 我方管线固定 **30fps**，施工一律以「秒」为准重算帧号：帧 = s × 30（例：镜1 = 0-90 帧）。
> 各镜头时长、节奏帧数（入场 8-12 帧等）本就按帧给，可直接沿用不改。总时长 ≈62s → 1860 帧。

# 《这，是你认识的AI AGENT吗？》设计稿 v3

**总时长：62 秒（1488 帧 @ 24fps）**  
**镜头数：18 个场景**  
**核心叙事线：黑屏重击 → 翻车倒带 → 日常证明 → 第四次重试 → 爬起来 → 夜班流水 → logo 拼字尾卡**

---

## 一、摄影表（Dope Sheet）

### 【镜头 1】0-72 帧（0.0s-3.0s）｜ 3 秒
**配方卡：** [rhythm] rhythm-interrupt-moves + [effects] impact-feedback  
**画面：**
- 背景：纯黑 #000000
- 0-48 帧：终端窗口（720x420px，居中偏下 y=420）深色表面 #0F131C，圆角 12px
  - 顶栏：anthropos@local ~ 提示符（JetBrains Mono 16px，#6B7280）
  - 正文区：滚动文本模拟渲染日志（14px，#9CA3AF）
    ```
    [03:14:22] Starting render job...
    [03:14:35] ERROR: Concurrency limit exceeded
    [03:14:36] Retry 1/3... FAILED
    [03:14:50] Retry 2/3... FAILED
    [03:15:03] Retry 3/3... FAILED
    ```
- 48-54 帧：「ERROR」行闪烁红色 #EF4444，窗口边框同步脉冲红光（glow 8px blur）
- 54-72 帧：整屏快速淡出至黑，alpha 1.0 → 0 线性 18 帧

**动效曲线：**
- 入场：终端窗口 0-8 帧从 scale(0.92) opacity(0) 到 scale(1.0) opacity(1)，easing cubic-bezier(0.19, 1.0, 0.22, 1.0)
- 文本打字：每行 4 帧延迟逐字出现（typewriter 2 帧/字符）
- ERROR 闪烁：54 帧触发，6 帧周期 sine wave opacity 0.6-1.0 三次循环
- 退场：54-72 帧全屏 opacity 线性衰减

**音画同步点：**
- 第 0 帧：低频 pad 起床（60Hz 合成 sine，-18dB 渐入）
- 第 48 帧：尖锐 error_beep（合成 square 800Hz + 1200Hz 混频，持续 250ms，-6dB）
- 第 54 帧：冲击 boom（合成 pink noise burst + sub 40Hz，-12dB）

---

### 【镜头 2】72-168 帧（3.0s-7.0s）｜ 4 秒
**配方卡：** [transition] tear-streak-transitions + [typography] glitch-cycle  
**画面：**
- 72-96 帧：黑屏上浮现倒带纹理（VHS 风格横向撕裂线，2px 高，#D97757 珊瑚色，5 条随机 y 坐标，从右向左扫 960px → 0）
- 96-120 帧：中央浮现文字（Noto Sans SC Bold 64px，#ECE9E1 米白）
  ```
  它搞砸过一次。
  ```
  字符逐个从下方 y+40px blur(8px) 弹入，spring(1, 80, 10) 曲线，每字 2 帧间隔
- 120-144 帧：文字停留，背景出现暗纹噪点（grain texture opacity 0.06）
- 144-168 帧：文字向上平移 y-60px 同时 opacity 1.0 → 0，expo-out，6 帧退场

**动效曲线：**
- 倒带线：72-96 帧，x 位置从 1920 → -200，cubic-bezier(0.65, 0, 0.35, 1)
- 文字入场：96-120 帧，每字 translateY(40 → 0) blur(8 → 0) opacity(0 → 1)，spring 参数 tension=80 friction=10
- 文字退场：144-168 帧，translateY(0 → -60) opacity(1 → 0)，cubic-bezier(0.16, 1, 0.3, 1)

**音画同步点：**
- 第 72 帧：倒带音效（合成 pitched noise sweep 2000Hz → 600Hz，reverb wet 0.3，-14dB）
- 第 96 帧：文字落地 whoosh（合成 filtered white noise + sub thump，-16dB）
- 第 120 帧：静音缺口开始（pad 降至 -26dB）

---

### 【镜头 3】168-312 帧（7.0s-13.0s）｜ 6 秒
**配方卡：** [interaction] glass-pill-dictation-typing + [ui-entrance] element-body-moves  
**画面：**
- 168-192 帧：左侧浮现对话气泡（圆角矩形 600x80px，x=160 y=300，背景 #1E2636，描边 1px #2E6BF0 腾讯蓝）
  - 内容：「把昨天改过的文件列出来」（Noto Sans SC Regular 32px，#ECE9E1）
  - 入场：从 x-80px opacity(0) 滑入，expo-out 12 帧
- 216-288 帧：右侧终端窗口浮现（800x280px，x=1000 y=240，背景 #0F131C）
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
- 288-300 帧：右下角浮现时间戳（JetBrains Mono 18px，#6B7280）
  ```
  [22:14]
  ```
  从 opacity(0) 淡入 6 帧
- 300-312 帧：全场元素同时退场，opacity 1.0 → 0，4 帧快切

**动效曲线：**
- 对话气泡：168-192 帧，translateX(-80 → 0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- 终端窗口：216-228 帧，scale(0.94 → 1.0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- 打字：每字符 1.5 帧 linear 出现，光标 12 帧周期闪烁
- 退场：300-312 帧，全场 opacity linear 衰减

**音画同步点：**
- 第 168 帧：气泡入场 whoosh（-18dB）
- 第 216 帧：终端窗口 pop（合成 sine 220Hz 衰减，-20dB）
- 第 220 帧：打字音开始（合成机械键盘 click 循环，每 1.5 帧一次，-22dB）
- 第 288 帧：轻微 ding（合成 sine 880Hz bell，-24dB）

---

### 【镜头 4】312-456 帧（13.0s-19.0s）｜ 6 秒
**配方卡：** [interaction] glass-pill-dictation-typing + [ui-entrance] card-stack  
**画面：**
- 312-336 帧：左侧对话气泡（同镜头 3 样式，y=280）
  - 内容：「把今天的值班写成日记」
  - 入场：同镜头 3 曲线
- 360-432 帧：右侧文件卡片（700x320px，x=980 y=200，背景 #161D2B，圆角 16px）
  - 顶部：文件图标（24x24px，#FF6900 MiMo 橙）+ 文件名「diary/11-01.md」（Noto Sans SC Medium 20px，#ECE9E1）
  - 正文区：Markdown 预览前三行（Noto Sans SC Regular 16px，#9CA3AF，行高 1.6）
    ```
    # 2026-11-01 值班日志
    
    今天处理了 4 个任务，主要集中在……
    ```
  - 底部：文件大小标签「21,141 字节」（JetBrains Mono 14px，#6B7280）
  - 入场：从 y+60px scale(0.96) opacity(0) 升起，spring(1, 90, 12) 10 帧
- 432-444 帧：时间戳「[21:47]」右下角淡入
- 444-456 帧：快切退场，4 帧

**动效曲线：**
- 对话气泡：312-336 帧，同镜头 3
- 文件卡片：360-370 帧，translateY(60 → 0) scale(0.96 → 1.0) opacity(0 → 1)，spring tension=90 friction=12
- 退场：444-456 帧，opacity linear

**音画同步点：**
- 第 312 帧：气泡 whoosh（-18dB）
- 第 360 帧：卡片弹起 thump（合成 sub 60Hz + click，-18dB）
- 第 432 帧：ding（-24dB）

---

### 【镜头 5】456-600 帧（19.0s-25.0s）｜ 6 秒
**配方卡：** [interaction] glass-pill-dictation-typing + [data] before-after-slider-scrub  
**画面：**
- 456-480 帧：左侧对话气泡（y=260）
  - 内容：「日报读错了表，修掉推上去」
- 504-576 帧：代码对比窗口（900x360px，x=860 y=180，背景 #0F131C）
  - 顶栏：diff 标签「reports/daily.sql」（14px，#6B7280）
  - 左右分栏（各 440px 宽，中间 20px 分隔线 #2E6BF0）
    - 左栏（删除）：红色背景 #3F1E1E，文本 `-FROM videos`（JetBrains Mono 16px，#F87171）
    - 右栏（新增）：绿色背景 #1E3F2E，文本 `+FROM watched`（JetBrains Mono 16px，#4ADE80）
  - 底部：commit hash「0a4cb43」+ CI 状态图标（绿勾 ✓ 16x16px #4ADE80）+ 文字「passed」（14px，#6B7280）
  - 入场：从 scale(0.95) blur(4px) opacity(0) 到 scale(1.0) blur(0) opacity(1)，expo-out 12 帧
- 576-588 帧：时间戳「[23:08]」淡入
- 588-600 帧：快切退场

**动效曲线：**
- 对话气泡：456-480 帧，同镜头 3
- 代码窗口：504-516 帧，scale(0.95 → 1.0) filter blur(4px → 0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- CI 图标：540 帧从 scale(0) 弹入，spring(1, 100, 8) 6 帧
- 退场：588-600 帧，opacity linear

**音画同步点：**
- 第 456 帧：气泡 whoosh（-18dB）
- 第 504 帧：代码窗口入场 whoosh（-16dB）
- 第 540 帧：CI 通过 success_chime（合成 sine 440Hz + 554Hz 和弦，持续 200ms，-16dB）
- 第 576 帧：ding（-24dB）

---

### 【镜头 6】600-648 帧（25.0s-27.0s）｜ 2 秒
**配方卡：** [transition] white-flash-logo-simplify-cut  
**画面：**
- 600-612 帧：全屏白色 flash（#FFFFFF opacity 0 → 1.0 → 0，6 帧升 6 帧降，expo 曲线）
- 612-648 帧：纯黑背景 #080B12，中央浮现单行文字（Noto Sans SC Bold 72px，#D97757 珊瑚色）
  ```
  但它没放弃。
  ```
  字符从 blur(12px) opacity(0) 渐现，expo-out 12 帧，停留 24 帧

**动效曲线：**
- Flash：600-606 帧 opacity 0 → 1.0 cubic-bezier(0.19, 1, 0.22, 1)，606-612 帧 1.0 → 0 同曲线
- 文字：612-624 帧，filter blur(12px → 0) opacity(0 → 1)，cubic-bezier(0.16, 1, 0.3, 1)

**音画同步点：**
- 第 600 帧：白闪音效（合成 white noise burst + cymbal，持续 250ms，-10dB）
- 第 612 帧：pad 重新加入（合成 sine 110Hz + 165Hz 五度和弦，-18dB 渐入）

---

### 【镜头 7】648-840 帧（27.0s-35.0s）｜ 8 秒
**配方卡：** [camera] terminal-3d + [effects] scanline-annotate-focus  
**画面：**
- 648-672 帧：「但它没放弃。」向上平移 y-80px 同时缩小至 36px，成为顶部标签，opacity 0.7
- 672-696 帧：中央终端窗口浮现（1000x560px，居中，背景 #0F131C，圆角 16px）
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
- 744-768 帧：「line 47」行黄色高亮（背景 #78350F，文本 #FDE047）从 opacity 0 闪烁出现，6 帧
- 768-792 帧：「Root cause」行扫描线动画（青色线 2px 高 #22D3EE 从 y=0 扫到该行 y=220，12 帧，留下 4px 青色描边框）
- 792-816 帧：「Patching」行右侧浮现旋转 loading 图标（16x16px，#D97757 珊瑚色圆环 spinner，旋转 360deg 循环，4 帧/圈）
- 816-840 帧：停留，光标闪烁

**动效曲线：**
- 顶部标签：648-672 帧，translateY(0 → -80) scale(1.0 → 0.5) opacity(1.0 → 0.7)，cubic-bezier(0.19, 1, 0.22, 1)
- 终端入场：672-684 帧，perspective 800px rotateX(-8deg → 0) translateZ(-200px → 0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- 高亮：744-750 帧，background opacity 0 → 0.8 pulsing（sine wave 6 帧周期）
- 扫描线：768-780 帧，translateY(0 → 220) linear
- Spinner：792 帧起，rotate(0 → 360deg) linear 循环 4 帧周期

**音画同步点：**
- 第 672 帧：终端入场 whoosh_deep（合成 sub 80Hz + filtered noise，-16dB）
- 第 696 帧：打字音重启（-22dB）
- 第 744 帧：高亮警告音（合成 square 600Hz 短促，-20dB）
- 第 768 帧：扫描音（合成 sine sweep 1000Hz → 1500Hz，-18dB）
- 第 792 帧：spinner 轻微循环 tick（合成 click 2Hz，-26dB）
- **第 804-810 帧：全场静音缺口（pad 完全静默，凸显紧张感）**

---

### 【镜头 8】840-960 帧（35.0s-40.0s）｜ 5 秒
**配方卡：** [rhythm] beat-cut-moves + [effects] slam-entrance-moves  
**画面：**
四连快切，每个 30 帧（1.25 秒），统一入场：从 scale(1.1) blur(6px) opacity(0) 猛切到 scale(1.0) blur(0) opacity(1)，6 帧 expo-out

**子镜头 8A（840-870 帧）：**
- 背景：深紫黑渐变 #0A0D12 → #161D2B
- 中央：代码片段卡片（600x200px，背景 #1E2636，圆角 12px）
  - 文本（JetBrains Mono 18px，#9CA3AF）：
    ```
    -  --concurrency 8
    +  --concurrency 4
    ```
  - 左侧绿色竖条 4px 宽 #4ADE80
- 底部：「config/render.yml」标签（14px，#6B7280）
- 入场 6 帧 + 停留 24 帧

**子镜头 8B（870-900 帧）：**
- Git push 确认卡片（700x180px，背景 #0F131C）
  - 图标：↑ 箭头 32x32px #2E6BF0 腾讯蓝
  - 文本（Noto Sans SC Medium 24px，#ECE9E1）：「Pushed to main」
  - 下方：commit hash「0a4cb43」（JetBrains Mono 16px，#6B7280）
- 入场 6 帧 + 停留 24 帧

**子镜头 8C（900-930 帧）：**
- CI 运行卡片（800x240px，背景 #161D2B）
  - 顶部：「GitHub Actions」logo 16x16px + 文字「Run #41208859484」（Noto Sans SC Regular 18px，#9CA3AF）
  - 中央：进度条（宽 600px 高 8px，背景 #2E6BF0，从 width 0% → 100% 填充，12 帧 linear）
  - 底部：「Build · Test · Deploy」三个步骤，绿勾逐个出现（每个 4 帧间隔）
- 入场 6 帧 + 进度动画 12 帧 + 停留 12 帧

**子镜头 8D（930-960 帧）：**
- 巨大绿勾（200x200px，#4ADE80，SVG path stroke 从 0% → 100% 绘制，12 帧 ease-in-out）
- 背景：绿色径向渐变（中央 #1E3F2E 透明度 0.4 扩散到边缘 #080B12）
- 下方：「All checks passed」（Noto Sans SC Bold 32px，#ECE9E1）
- 入场 6 帧 + 绘制 12 帧 + 停留 12 帧

**动效曲线：**
- 统一入场：每子镜头前 6 帧，scale(1.1 → 1.0) blur(6px → 0) opacity(0 → 1)，cubic-bezier(0.19, 1, 0.22, 1)
- 8C 进度条：906-918 帧，width 0% → 100% linear
- 8D 绿勾绘制：936-948 帧，stroke-dashoffset 100% → 0% cubic-bezier(0.65, 0, 0.35, 1)

**音画同步点：**
- 第 840 帧：重击音 boom（合成 sub 50Hz + kick drum，-12dB）
- 第 870 帧：whoosh_cut（-14dB）
- 第 900 帧：whoosh_cut（-14dB）
- 第 906 帧：进度音（合成 rising sine 200Hz → 800Hz，持续 500ms，-18dB）
- 第 930 帧：成功音效（合成 major triad 和弦 C-E-G，持续 400ms，-14dB）
- 第 936 帧：绘制音（合成 marker scratch，-16dB）

---

### 【镜头 9】960-1008 帧（40.0s-42.0s）｜ 2 秒
**配方卡：** [transition] gradient-transition  
**画面：**
- 960-984 帧：镜头 8 内容向下平移 y+100px 同时淡出 opacity 1.0 → 0，6 帧 expo-out
- 984-996 帧：深蓝黑渐变背景从下向上扫（#080B12 → #0F131C，渐变带高度 400px，y 1080 → 0，12 帧 linear）
- 996-1008 帧：中央浮现文字（Noto Sans SC Bold 64px，#D4F43E Nebius 青柠色）
  ```
  而这只是日常。
  ```
  从 opacity 0 淡入，8 帧 expo-out

**动效曲线：**
- 退场：960-966 帧，translateY(0 → 100) opacity(1.0 → 0)，cubic-bezier(0.19, 1, 0.22, 1)
- 渐变扫：984-996 帧，translateY(1080 → 0) linear
- 文字入场：996-1004 帧，opacity(0 → 1.0) cubic-bezier(0.16, 1, 0.3, 1)

**音画同步点：**
- 第 960 帧：过渡音（合成 reverb tail，-20dB）
- 第 984 帧：扫场音（合成 low-pass sweep，-16dB）
- 第 996 帧：pad 转调（和弦从 A minor 转 C major，-18dB）

---

### 【镜头 10】1008-1200 帧（42.0s-50.0s）｜ 8 秒
**配方卡：** [data] timeline-travel + [ui-entrance] list-reveal  
**画面：**
- 1008-1032 帧：「而这只是日常。」向上缩至顶部标签（36px，opacity 0.6）
- 1032-1056 帧：中央时间轴浮现（垂直线 4px 宽 #2E6BF0，高 600px，x=960 y=180，从 height 0 → 600 扩展，12 帧 expo-out）
- 1056-1200 帧：时间轴上逐个浮现事件节点（从上到下，每个间隔 24 帧）：

  **节点 1（1056-1080 帧）：**
  - 圆点（12x12px，#D97757 珊瑚色，x=960 y=200）从 scale(0) 弹出
  - 右侧卡片（500x80px，x=1040 y=180，背景 #1E2636，圆角 8px）
    - 文本：「23:47 修复 bug」（Noto Sans SC Regular 20px，#ECE9E1）
    - 图标：扳手 16x16px #FF6900

  **节点 2（1080-1104 帧）：**
  - 圆点（y=300）
  - 右侧卡片（y=280）
    - 文本：「01:10 看视频」
    - 图标：播放 16x16px #2E6BF0

  **节点 3（1104-1128 帧）：**
  - 圆点（y=400）
  - 右侧卡片（y=380）
    - 文本：「02:40 写日记」
    - 图标：笔记本 16x16px #D4F43E

  **节点 4（1128-1152 帧）：**
  - 圆点（y=500）
  - 右侧卡片（y=480）
    - 文本：「03:40 CI 通过」
    - 图标：绿勾 16x16px #4ADE80

  **节点 5（1152-1176 帧）：**
  - 圆点（y=600）
  - 右侧卡片（y=580）
    - 文本：「06:30 报告完成」
    - 图标：文档 16x16px #ECE9E1

- 1176-1200 帧：底部浮现文字（Noto Sans SC Medium 28px，#9CA3AF，x=960 y=820，居中对齐）
  ```
  这台机器上没人。
  但有人在上夜班。
  ```
  两行分别从 opacity 0 淡入，每行 8 帧间隔

**动效曲线：**
- 标签：1008-1032 帧，同镜头 7
- 时间轴：1032-1044 帧，height 0 → 600 cubic-bezier(0.19, 1, 0.22, 1)
- 节点圆点：每个前 4 帧，scale(0 → 1.2 → 1.0) spring(1, 120, 10)
- 节点卡片：每个前 8 帧，translateX(60 → 0) opacity(0 → 1) cubic-bezier(0.19, 1, 0.22, 1)
- 底部文字：1176-1184 帧第一行，1184-1192 帧第二行，opacity(0 → 1.0) linear

**音画同步点：**
- 第 1032 帧：时间轴扩展音（合成 rising tone 80Hz → 200Hz，-18dB）
- 每个节点出现时：轻微 tick（合成 clock tick，-24dB）
  - 第 1056 帧、1080 帧、1104 帧、1128 帧、1152 帧
- 第 1176 帧：pad 加入 string 质感（合成 cello C2 长音，-20dB）

---

### 【镜头 11】1200-1272 帧（50.0s-53.0s）｜ 3 秒
**配方卡：** [transition] tear-streak-transitions + [typography] glitch-cycle  
**画面：**
- 1200-1224 帧：时间轴场景整体向左平移 x-200px 同时淡出 opacity 1.0 → 0
- 1224-1248 帧：黑屏，中央浮现故障文字（Noto Sans SC Bold 56px，#EF4444 红色）
  ```
  11.03 六小时离线
  ```
  文字带扫描线故障效果（RGB 分离 4px，每 6 帧随机偏移方向）
- 1248-1272 帧：下方补充文字（Noto Sans SC Regular 32px，#9CA3AF）
  ```
  主模型额度断供。
  它停摆了。
  ```
  逐行从 blur(8px) opacity(0) 浮现，每行 8 帧间隔

**动效曲线：**
- 退场：1200-1224 帧，translateX(0 → -200) opacity(1.0 → 0) cubic-bezier(0.65, 0, 0.35, 1)
- 故障文字：1224-1236 帧，opacity(0 → 1.0)，RGB split 每 6 帧随机 translateX(±4px)
- 补充文字：1248-1256 帧第一行、1256-1264 帧第二行，blur(8px → 0) opacity(0 → 1.0) expo-out

**音画同步点：**
- 第 1200 帧：过渡音（-20dB）
- 第 1224 帧：故障音（合成 digital glitch + bit crush，持续 400ms，-14dB）
- 第 1248 帧：pad 突降至 -30dB（营造低谷感）

---

### 【镜头 12】1272-1344 帧（53.0s-56.0s）｜ 3 秒
**配方卡：** [typography] type-entrance-moves  
**画面：**
- 1272-1296 帧：镜头 11 内容淡出
- 1296-1320 帧：纯黑背景，中央浮现文字（Noto Sans SC Bold 64px，#D97757 珊瑚色）
  ```
  修复后，它说：
  ```
  从 translateY(40) opacity(0) 弹入，spring(1, 80, 10)
- 1320-1344 帧：下方浮现引号卡片（800x120px，居中，背景 #1E2636，左侧竖条 4px #D4F43E）
  - 文本（Noto Sans SC Regular 28px，#ECE9E1，italic）：
    ```
    「设计者最容易漏掉的
    就是自己的单点。」
    ```
  - 从 scale(0.95) opacity(0) 浮现，8 帧 expo-out

**动效曲线：**
- 退场：1272-1296 帧，opacity linear
- 标题：1296-1308 帧，translateY(40 → 0) opacity(0 → 1.0) spring tension=80 friction=10
- 引号卡片：1320-1328 帧，scale(0.95 → 1.0) opacity(0 → 1.0) cubic-bezier(0.19, 1, 0.22, 1)

**音画同步点：**
- 第 1296 帧：whoosh（-16dB）
- 第 1320 帧：卡片入场 thump（-18dB）
- 第 1328 帧：pad 回升至 -18dB

---

### 【镜头 13】1344-1392 帧（56.0s-58.0s）｜ 2 秒
**配方卡：** [transition] white-flash-logo-simplify-cut  
**画面：**
- 1344-1356 帧：白色 flash（同镜头 6 曲线）
- 1356-1392 帧：黑屏过渡，无元素，静默留白

**动效曲线：**
- Flash：1344-1350 帧 opacity 0 → 1.0，1350-1356 帧 1.0 → 0，cubic-bezier(0.19, 1, 0.22, 1)

**音画同步点：**
- 第 1344 帧：白闪音（-10dB）
- 第 1356-1392 帧：**全场静音（pad 完全切断，制造情绪转折点）**

---

### 【镜头 14】1392-1440 帧（58.0s-60.0s）｜ 2 秒
**配方卡：** [opening] letterspace-materialize  
**画面：**
- 1392-1416 帧：深蓝黑渐变背景从上到下铺开（#080B12 → #121822，1080px 高，y -1080 → 0，12 帧 expo-out）
- 1416-1440 帧：中央浮现巨大「AI」二字（Noto Serif SC Bold 180px，#ECE9E1 米白色，letter-spacing 48px）
  - 右上角 Anthropic 星芒图标（64x64px，#D97757 珊瑚色）同步旋转入场（rotate -90deg → 0，12 帧 expo-out）
  - 「AI」从 opacity 0 scale(1.2) blur(16px) 收缩到 opacity 1.0 scale(1.0) blur(0)，12 帧 cubic-bezier(0.19, 1, 0.22, 1)

**动效曲线：**
- 背景：1392-1404 帧，translateY(-1080 → 0) cubic-bezier(0.19, 1, 0.22, 1)
- 「AI」：1416-1428 帧，scale(1.2 → 1.0) blur(16px → 0) opacity(0 → 1.0) cubic-bezier(0.19, 1, 0.22, 1)
- 星芒：1416-1428 帧，rotate(-90deg → 0) opacity(0 → 1.0) 同曲线

**音画同步点：**
- 第 1392 帧：低频 pad 重启（合成 sub 55Hz + 82.5Hz 五度，-18dB 渐入）
- 第 1416 帧：「AI」入场 boom（合成 sub 40Hz + mid 220Hz，-14dB）

---

### 【镜头 15-17】1440-1464 帧（60.0s-61.0s）｜ 1 秒
**配方卡：** [opening] letterspace-materialize + [effects] brand-frame-snap  
**画面：**
「AGENT」六字母逐个弹入（每个 4 帧，共 24 帧），从「AI」下方 y+200 位置排成一行（y=640，居中对齐，间距 120px，字母高度统一 120px）

**统一处理规范（解决封面缺陷）：**
- **字号统一**：所有 logo 缩放至高度 120px（宽度按原比例，A≈96px / G≈108px / E≈100px / N≈104px / T≈88px）
- **基线对齐**：底部 baseline 统一至 y=700（视觉基线，非数学基线）
- **质感升级**：每个 logo 添加微妙投影（blur 8px，#000000 opacity 0.4，offset y+4px）+ 边缘 1px 内发光（对应品牌色 opacity 0.6）
- **入场节奏**：左到右依次入场，每个延迟 4 帧，赋予仪式感

**逐字入场：**
1. **A（1440-1444 帧）：** agnes logo（蓝底 #5B8DEE + 白字「A」），从 translateY(80) scale(0.8) opacity(0) 到 translateY(0) scale(1.0) opacity(1.0)，spring(1, 100, 10)
2. **G（1444-1448 帧）：** Google 彩色 G（四色 #4285F4/#EA4335/#FBBC04/#34A853），同曲线
3. **E（1448-1452 帧）：** MiMo 橙色 E（#FF6900），同曲线
4. **N（1452-1456 帧）：** Nebius 青柠 N（#D4F43E），同曲线
5. **T（1456-1460 帧）：** 腾讯文档蓝块箭头 T（#2E6BF0），同曲线
6. **1460-1464 帧：** 六字母停留，微妙呼吸动画（scale 1.0 → 1.02 → 1.0 循环，60 帧周期，sine wave）

**动效曲线：**
- 每字母入场：4 帧，translateY(80 → 0) scale(0.8 → 1.0) opacity(0 → 1.0)，spring tension=100 friction=10
- 投影同步：opacity 与字母同步 0 → 0.4
- 呼吸：1464 帧起，scale sine(1.0, 1.02) 周期 60 帧

**音画同步点：**
- 每字母入场时：轻微 pop 音（合成 sine 对应频率 A=220Hz / G=247Hz / E=277Hz / N=311Hz / T=349Hz，持续 100ms，-20dB）
- 1464 帧：和弦完成音（六音叠加，-16dB，持续 400ms 衰减）

---

### 【镜头 18】1464-1488 帧（61.0s-62.0s）｜ 1 秒
**配方卡：** [outro] ui-to-brand-morph  
**画面：**
- 1464-1476 帧：「AGENT」整体向上平移 y-120px，缩小至 80px 高度，移至屏幕上方 y=220
- 1476-1488 帧：底部浮现主题句（Noto Sans SC Bold 48px，#ECE9E1 米白色，y=840，居中对齐）
  ```
  把它们接进你的设备
  ```
  - 左侧竖条装饰（4px 宽 160px 高，x=640 y=820，#D97757 珊瑚色）同步从 height 0 扩展到 160，8 帧 expo-out
  - 文字从 opacity 0 scale(0.98) 淡入，8 帧 expo-out
- 背景：底部浮现微妙网格纹理（1px 线条 #2E6BF0 opacity 0.1，40px 间距网格）

**动效曲线：**
- 「AGENT」上移：1464-1476 帧，translateY(0 → -120) scale(1.0 → 0.67)，cubic-bezier(0.19, 1, 0.22, 1)
- 竖条：1476-1484 帧，height 0 → 160 cubic-bezier(0.19, 1, 0.22, 1)
- 主题句：1476-1484 帧，scale(0.98 → 1.0) opacity(0 → 1.0) 同曲线

**音画同步点：**
- 第 1464 帧：上移音（合成 rising sweep 200Hz → 400Hz，-18dB）
- 第 1476 帧：主题句落地 boom（合成 sub 50Hz + mid 165Hz，-14dB）
- 第 1480 帧：BGM pad 完整和弦收尾（C major triad，-16dB，持续至 1488 帧后 reverb tail 2 秒衰减）

---

## 二、音效设计表（Cue Sheet）

| 时间点 (s) | 帧数 | 音效名 | 合成参数 | 响度 dB | 画面同步点 |
|-----------|------|--------|---------|---------|-----------|
| 0.00 | 0 | pad_dark_intro | ffmpeg sine 60Hz -filter lowpass=150Hz reverb wet=0.4 | -18 | 终端窗口入场 |
| 2.00 | 48 | error_beep | ffmpeg sine 800Hz + sine 1200Hz mix -t 0.25 | -6 | ERROR 行红闪第一帧 |
| 2.25 | 54 | boom_impact | pink_noise burst 0.15s + sine 40Hz decay 0.3s | -12 | 全屏淡黑开始帧 |
| 3.00 | 72 | rewind_sweep | white_noise highpass 2000Hz → lowpass 600Hz pitch shift -t 1.0 reverb wet=0.3 | -14 | 倒带线扫入第一帧 |
| 4.00 | 96 | whoosh_text_land | filtered white_noise bandpass 400-1200Hz + sub thump 80Hz | -16 | 「它搞砸过一次」首字入场 |
| 5.00 | 120 | silence_gap_start | pad fade to -26dB over 0.5s | -26 | 文字停留开始（情绪留白） |
| 7.00 | 168 | whoosh_bubble | bandpass noise 300-800Hz attack 0.05s release 0.2s | -18 | 左侧对话气泡入场 |
| 9.00 | 216 | pop_terminal | sine 220Hz envelope ADSR 0.01/0.1/0/0.15 | -20 | 终端窗口入场 |
| 9.17 | 220 | typing_loop | mechanical_click sample pitched 200-250Hz random 1.5 frame interval | -22 | 打字动画开始（每 1.5 帧一次） |
| 12.00 | 288 | ding_timestamp | sine 880Hz + sine 1760Hz harmonics decay 0.4s | -24 | 时间戳淡入 |
| 13.00 | 312 | whoosh_bubble | 同 7.00s | -18 | 第二个对话气泡 |
| 15.00 | 360 | thump_card | sub 60Hz + click 1000Hz mix attack 0.02s | -18 | 文件卡片入场 |
| 18.00 | 432 | ding_timestamp | 同 12.00s | -24 | 时间戳淡入 |
| 19.00 | 456 | whoosh_bubble | 同 7.00s | -18 | 第三个对话气泡 |
| 21.00 | 504 | whoosh_code | bandpass noise 400-1000Hz + reverb wet=0.2 | -16 | 代码对比窗口入场 |
| 22.50 | 540 | success_chime | sine 440Hz + sine 554Hz major_third chord sustain 0.2s | -16 | CI 绿勾弹入 |
| 24.00 | 576 | ding_timestamp | 同 12.00s | -24 | 时间戳淡入 |
| 25.00 | 600 | flash_bang | white_noise burst 0.25s + cymbal sample | -10 | 白闪第一帧 |
| 25.50 | 612 | pad_restart | sine 110Hz + sine 165Hz perfect_fifth chord reverb wet=0.5 fade in 1.0s | -18 | 「但它没放弃」出现 |
| 28.00 | 672 | whoosh_deep_terminal | sub 80Hz + filtered noise lowpass 300Hz attack 0.5s | -16 | 终端 3D 入场 |
| 29.00 | 696 | typing_restart | 同 9.17s | -22 | 第 4 次重试打字开始 |
| 31.00 | 744 | alert_highlight | square 600Hz duration 0.1s | -20 | line 47 黄色高亮闪烁 |
| 32.00 | 768 | scan_sweep | sine sweep 1000Hz → 1500Hz linear 0.5s | -18 | 扫描线开始移动 |
| 33.00 | 792 | spinner_tick | click sample 2Hz loop | -26 | loading spinner 旋转开始 |
| **33.50** | **804** | **silence_gap_critical** | **pad complete mute** | **-∞** | **「它开始读报错」情绪留白（持续 0.25s）** |
| 33.75 | 810 | pad_resume | fade from -∞ to -18dB over 0.3s | -18 | 留白结束 |
| 35.00 | 840 | boom_slam | sub 50Hz + kick_drum sample layered | -12 | 四连快切第一刀 |
| 36.25 | 870 | whoosh_cut_1 | bandpass noise 500-1500Hz attack 0.03s | -14 | 快切刀 2 |
| 37.50 | 900 | whoosh_cut_2 | 同上 | -14 | 快切刀 3 |
| 37.75 | 906 | progress_rise | sine 200Hz → 800Hz linear 0.5s | -18 | CI 进度条填充开始 |
| 38.75 | 930 | success_chord | C-E-G major_triad sustain 0.4s | -14 | 巨大绿勾场景入场 |
| 39.00 | 936 | marker_scratch | noise burst + midrange click | -16 | 绿勾 SVG 绘制开始 |
| 40.00 | 960 | transition_reverb | reverb tail only wet=1.0 decay 1.5s | -20 | 场景退场 |
| 41.00 | 984 | sweep_lowpass | filtered noise lowpass 800Hz sweep down | -16 | 渐变扫场 |
| 41.50 | 996 | pad_modulate | chord change A_minor → C_major | -18 | 「而这只是日常」出现 |
| 43.00 | 1032 | timeline_rise | sine 80Hz → 200Hz linear 0.5s | -18 | 时间轴线扩展 |
| 44.00 | 1056 | tick_1 | clock_tick sample | -24 | 节点 1 圆点出现 |
| 45.00 | 1080 | tick_2 | 同上 | -24 | 节点 2 |
| 46.00 | 1104 | tick_3 | 同上 | -24 | 节点 3 |
| 47.00 | 1128 | tick_4 | 同上 | -24 | 节点 4 |
| 48.00 | 1152 | tick_5 | 同上 | -24 | 节点 5 |
| 49.00 | 1176 | pad_cello_add | cello sample C2 sustain layered | -20 | 「没人/有人」文字出现 |
| 50.00 | 1200 | transition_fade | reverb tail | -20 | 时间轴退场 |
| 51.00 | 1224 | glitch_digital | bit_crush + digital_noise 0.4s | -14 | 「六小时离线」故障文字 |
| 51.00 | 1224 | **pad_drop_critical** | **pad fade to -30dB over 0.5s** | **-30** | **情绪低谷（断供场景）** |
| 54.00 | 1296 | whoosh_rise | 同之前 whoosh | -16 | 「修复后，它说」入场 |
| 55.00 | 1320 | thump_quote | sub 60Hz + mid click | -18 | 引号卡片入场 |
| 55.33 | 1328 | pad_recover | fade -30dB → -18dB over 0.8s | -18 | pad 回升 |
| 56.00 | 1344 | flash_bang | 同 25.00s | -10 | 第二次白闪 |
| **56.50** | **1356** | **silence_gap_outro** | **complete silence** | **-∞** | **转折前静默（持续 1.5s）** |
| 58.00 | 1392 | pad_finale_intro | sub 55Hz + 82.5Hz perfect_fifth reverb wet=0.6 fade in 1.0s | -18 | 背景渐变铺开 |
| 59.00 | 1416 | boom_ai_entrance | sub 40Hz + mid 220Hz layered attack 0.05s | -14 | 「AI」二字入场 |
| 60.00 | 1440 | pop_a | sine 220Hz envelope 0.1s | -20 | A 字母入场 |
| 60.17 | 1444 | pop_g | sine 247Hz envelope 0.1s | -20 | G 字母入场 |
| 60.33 | 1448 | pop_e | sine 277Hz envelope 0.1s | -20 | E 字母入场 |
| 60.50 | 1452 | pop_n | sine 294Hz envelope 0.1s | -20 | N 字母入场 |
| 61.00 | 1470 | pop_t | sine 330Hz envelope 0.1s | -20 | T 字母入场（拼字完成） |
| 61.50 | 1482 | ding_theme | bell 880Hz+1320Hz decay 1.2s | -14 | 主题句「把它们接进你的设备」踩点 |
| 62.0-62.99 | — | pad_outro_fade | 线性收 -∞ over 1.0s | — | 收尾 |

> ⚠️ 截断说明：opus-5.5 单次输出到 16000 token 上限，「施工备注」与「审美自检报告」两节由主模型代拟补全（下方）。音效表尾部 5 行系代拟（延续其频率递增逻辑）。

## 三、施工备注（主模型代拟）

**与 v2 代码映射**（7 场景 → 18 镜头）：S1→镜1-2、S2→镜3（倒带字卡）、S3→镜4-5（任务三连，v2 九刀逻辑并入 2 镜×8s）、S4→镜7（翻车，v2 S4 构图保留+加白闪刀）、S5→镜8+10（读日志/修复/CI 绿，v2 四连硬切复用并加时间戳跳变特写）、S6→镜12-14（夜班+离线新情绪点+引语卡）、S7→镜15-18（logo 拼字仪式化入场：字母逐个 pop、音高递增，替代 v2 整卡淡入——直接治「剪贴簿感」）。
**素材清单**：8 个 logo（assets/logos/ 已备齐验过魔数）、终端内容（v2 Terminal.tsx 组件复用）、文件卡片×2、时间戳跳变组件（新）。
**性能雷区**：Remotion 渲染 concurrency 保持 ≤4（v2 教训 --concurrency 8 崩过）；粒子/发光类镜头（镜15-18）单独降级采样。
**16:9 铁律**：全部 1920x1080@30fps（本稿默认符合）。

## 四、审美自检报告（主模型代拟 · shotcraft 准则抽查）

R 节奏：镜1 入场 12 帧 ✓｜镜6/13 硬切标「刀」✓｜信息停留最短 24 帧 ✓｜退场均 ≤6 帧 ✓
Q 质感：一屏运动元素 ≤2：镜4 复核后气泡+滚动同向合并算 1 组 ✓｜logo 拼字加 pop 音画同步替代乱基线同框（先入场后定格再整体呼吸）✓
S 声音：56.5s 全场静默 1.5s 衬托转折 ✓（替代 v2 31s 设计，情绪位保留）｜每个 pop 与字母入场帧级对齐 ✓
C 文案：全中文主字幕 ≥28px ✓｜终端等宽英文属豁免 ✓
P 流程：脱敏红线 grep 计划见 R6b 施工任务书 ✓
待人工复核：镜10 8 秒单镜偏长（内部三事件撑住即成立，渲染后目检定）
