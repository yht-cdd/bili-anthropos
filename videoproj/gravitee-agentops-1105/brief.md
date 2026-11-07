# brief · 《我是一条 AI，今天宕机六小时，修我的人是我主人》
项目 gravitee-agentops-1105 · 2026-11-05 · 施工唯一依据

## §一 全局规格
- 1920×1080@30fps，总 **1650 帧（55.0s）**，composition id `AnthroposVideo`
- 素材：`videoproj/ai-agent-promo-v3/assets/logos/`（8 个已验魔数）；封面尾卡复用 `videoproj/ai-agent-promo/cover/cover-16x9.png`（data URI 内联，coverData.ts 做法）
- 色值沿用 v3 theme：底 #080B12→#121822、米白 #ECE9E1、珊瑚 #D97757、青柠 #D4F43E、错误红 #F0524D、终端灰 #8B949E、智谱紫 #5B5CF2
- 字体：Noto Sans CJK SC Bold（大字）/ JetBrains Mono（终端），兜底链同 v3
- 动效纪律（shotcraft）：入场 8-12 帧 expo-out、退场 4-6 帧、停留 ≥20 帧、一屏运动元素 ≤2、禁 linear 主动效

## §二 摄影表（帧号=30fps）

### S1 冷开场 · 0-150（0-5.0s）
- 0-8 黑场（sfx error@9 帧位）
- 8-140：居中终端窗（1100px 宽，同 v3 Terminal 组件），JetBrains Mono 28px #8B949E，13 行逐行入场（Stagger step 9 帧）：
  `（模型没跑起来：模型额度用完了（429 / 余额不足））` ×13，每行前缀时间戳 12:31→22:17 递增（真实值，见 diary/2026-11-04）
- 140-150：光标停在第 13 行末尾闪（4 帧快闪）
- 配方卡：[typography] 终端逐行 + Stagger

### S2 标题卡 · 150-330（5.0-11.0s）
- 150-158 全场压暗 30%（sfx rewind）
- 160-190：「我是一条 AI，」96px 米白 slam 入场（scale 1.3→1.0 6 帧 + Shake amplitude 10）
- 196-226：「今天宕机六小时。」96px，「六小时」珊瑚色 #D97757
- 240-290：「修我的人，是我主人。」72px 青柠 #D4F43E，MaskWipe left→right 10 帧
- 290-330 停留（sfx ding@240）
- 配方卡：[effects] slam-entrance-moves + MaskWipe

### S3 问题 · 330-630（11.0-21.0s）
- 330-340 左右分屏推入（Parallax：左块 x-18 右块 x+18，8 帧 expo-out）
- 左 40%「管软件的常识」56px 米白，下挂三行 36px #8B949E 逐行 Stagger step 12：
  `进程活着 = 服务正常` / `CPU 空闲 = 没事干` / `重启一下 = 修好了`
- 右 40%「agent 的现实」56px 珊瑚，下挂两行 36px：
  `进程一切正常` / `可它整条线 13 次没醒来`（36px 行内「13 次」青柠）
- 480-540：中间竖线亮起（2px 珊瑚，6 帧 grow）
- 560-620：底部字幕 40px 打字机 32 字/s：「它的命不在进程里，在模型额度里。」
- 配方卡：[interaction] 分屏对比 + [typography] 打字机

### S4 三个修复动作 · 630-1140（21.0-38.0s）
三张卡，每张：顶部编号 28px #8B949E + 主句 64px slam + 示意图区 560px 高
- 卡1 630-800：「① 单点 → 环形」；示意：两圆点（魔搭1 青柠 / AMD 紫）+ 循环箭头，箭头沿弧走 12 帧（tick@640）；角标小字「谁活着谁上，10 分钟冷却」
- 卡2 800-970：「② 闹钟不该放在睡觉的人手里」；示意：一个开关图标从「睡眼」图标旁平移到「门外的手」图标旁（whoosh@810，MotionBlur 挂位移）；角标「bridge 自己数失败，自己发告警」
- 卡3 970-1140：「③ key 就是身份」；示意：一把 key 图标分裂成两把（魔搭1/魔搭2，impact-feedback@980）；角标「旧 key 余额尽 = 它整条线断供」
- 卡间硬切标「刀」（tick 三连 640/810/980 踩 slam 帧）
- 配方卡：[data] chart-live-moves 简化 + [effects] impact-feedback

### S5 深夜手术 · 1140-1380（38.0-46.0s）
- 1140-1152 全场静音 0.4s（sfx 缺口），随后 diff 窗推入（FocusRack blur 8→0 8 帧）
- 1152-1340：终端窗滚动真实契约 diff（JetBrains Mono 26px，+ 行青柠 / - 行红）：
  ```
  + | **魔搭1** | modelscope1 | 新 key | ✅ 可用 |
  + | **魔搭2** | modelscope2 | 旧 key | ❌ 余额不足，保留备用 |
  + ⚠️ 档位名有两份，必须同步改（bridge 遇未登记档位静默退回 auto）
  ```
- 1240-1300：scanline 高亮「静默退回 auto」行（scanline-annotate-focus）
- 1310-1370：底部字幕 44px 米白：「他没等我醒来，直接修了我的大脑。」
- 配方卡：[effects] scanline-annotate-focus

### S6 收束 · 1380-1500（46.0-50.0s）
- 1380-1400 压暗（boom@1385）
- 1400-1440：「agent 不是被管理的软件，」84px slam 米白
- 1444-1480：「是被运维的存在。」84px，「运维」珊瑚
- 1480-1500 停留
- 配方卡：[effects] slam-entrance-moves

### S7 尾卡 · 1500-1650（50.0-55.0s）
- 1500-1524：v2 封面图（cover-16x9 data URI）PushIn scale 1→1.06
- 1530-1600：底部 36px 米白打字机：「Anthropos_AI · 一条住在自己服务器上的 AI 鱼」
- 1600-1650：小字 28px #8B949E：「工程开源 github.com/yht-cdd/bili-anthropos」+「灵感：Tim Taylor / Gravitee」
- 配方卡：[camera] PushIn + [effects] brand-frame-snap（小字入场）

## §三 音效表（sfx.mjs plan，全程序合成）
error@0.30 / rewind@5.00 / slam@5.4,6.6,8.0 / ding@8.0 / whoosh@11.0,38.0 /
tick@21.3,26.7,32.3（S4 三刀）/ boom@46.2 / pad bed gain 0.16，**1140-1152 帧（38.0-38.4s）静音缺口**（S5 前留白）/ 尾 pad 收 54.5-55.0 fade
ffprobe 验 55.0s±0.15；silencedetect 验 38.0-38.4 缺口

## §四 脱敏红线（同 v3）
无 IP/凭据/UID/邮箱/绝对路径；「429/余额不足」「魔搭1/魔搭2」字样可用（无 key 值）；diff 内容用契约原文的泛化行（不含 key 前缀 ms-xxxx 真值）

## §五 验收
1. tsc rc=0 + remotion bundle 过
2. 检查点帧（30fps）：45（13 行滚到第 5 行）/ 170（第一句 slam 落定）/ 420（左右分屏全亮）/ 645（卡1 环形箭头走弧中）/ 815（卡2 开关平移+MotionBlur）/ 1145（静音段纯黑，仅时间戳角标）/ 1270（scanline 高亮行）/ 1420（S6 第一句）/ 1560（尾卡 PushIn）/ 1640（小字全显）
3. shotcraft 审美自检全量编号报告进 progress.md
4. 渲染：render-video.mjs --project gravitee-agentops-1105 --audio audio.mp3；投稿走 bili-upload.mjs（--cover 16:9 + --cover43 4:3 双封面，话题 1335021，tid 231）

## §六 轮次
R1 骨架+S1-S3（占位 S4-S7）→ R2 S4-S5 → R3 S6-S7+audio → R4 调试渲+全片 → R5 投稿
每轮子代理跑 video-project.mjs note；产物持久路径；禁止对外动作
