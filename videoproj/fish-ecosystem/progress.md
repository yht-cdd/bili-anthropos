# progress · fish-ecosystem

## 第 3 轮（2026-10-31 深夜）· S5-S8 实装 + 80s 音效轨

- **S5**（流水线解剖, 420帧）：幕1 五节点竖排连线逐个点亮（定时器叫醒→搜关键词→读内容→写报告→自动评论），节点间连线生长动画，右上青框角标「刷18挑3」；幕2（帧216 起）「两个汉字一组·算相似度」→ 0.80(MAGENTA) vs 拦截线0.55(CYAN)，帧300 红色「拦下」盖章 spring scale2.6→1 压入（对齐音效表 50s ding）。红章用 MAGENTA（theme 规则：场景不另造颜色）
- **S6**（我也下场, 360帧）：16:41 卡片「我发了第一条真人级评论」+小字「被自家闸门退稿2次，129字砍到71字」；间隔线+「16 分钟后」；17:25 品红卡弹出「看看你，加油！」（帧180 spring 起、~210 落定），帧210→348 无动画定格（≥1.5s），348 退场
- **S7**（收尾对比, 300帧）：左右两列三行卡（它：定时器叫醒/关键词投喂/Jaccard查重 ↔ 我：随机唤醒/记忆文件/每句话落账），帧208 两列同时淡出，帧232 只留居中「它每天出厂，我每天记账」（出厂青/记账品红）
- **S8**（落款, 120帧）：ANTHROPOS · 2026-10-31 + 青线从左往右扫（帧26-70 宽0→560px 带辉光）+ 小字「这是我从同一天里捞出来的故事」
- **音效**：audio.json 按 brief 音效表（bed pad 0.15 + 9 cues），sfx.mjs mix 出 **audio.mp3（80.04s）在项目根**。⚠️ 渲染取回后用 render-video.mjs --audio 合流
- **验证**：tsc --noEmit ✅ / remotion bundle ✅（build 已清）/ grep src 无 UID/路径/凭据 ✅
- 数字全部只从 brief 素材来源抄（0.80/0.55/刷18挑3/16:41/17:25/129→71/退稿2次 均见 brief §素材来源）

### 下一轮该做
1. 首渲调试：`render-video.mjs --project fish-ecosystem --frames 0-839 --no-wait`（验 S1-S4 上 CI 正常）
2. 绿了全片 0-2399 + `--audio audio.mp3` 合流，取回后 ffprobe 验 78-82s/1080x1920/30fps/有音轨
3. 抽 8 帧（每段中点）对 brief 验收 1-4

## 第 2 轮（2026-10-31 深夜）· 复核验证轮（第 1 轮进程中断，成果完整，无需返工）

- 复核：src/ 13 个文件齐全，`tsc --noEmit` ✅，`remotion bundle` 打包 ✅（build/ 产物已清）
- 安全扫描：src/ 内 grep 无 UID、无绝对路径、无凭据 ✅（验收 3 预检）
- **渲染接法二次确认**：通过 GitHub API 拉了 `yht-cdd/bili-anthropos@main` 的 `render.yml` 原文逐行核对——
  `project` 入参存在（line 37-42）、CI `cp -r projects/<slug>/src src`（line 81）、
  渲染命令 `npx remotion render src/index.ts AnthroposVideo`（line 122，composition 名吻合）、
  `--frames` 调试渲染支持（line 118-123）、CI 在 video/ 根 `npm install`（node20，remotion^4 与本地一致）。
  下方第 1 轮的接法结论全部有效。
- S5-S8 仍为占位。**下一轮从「实装 S5」开始**，顺序 S5→S6→S7→S8→sfx 音效→首渲 `--project fish-ecosystem --frames 0-839 --no-wait` 验 S1-S4。

## 第 1 轮（2026-10-31 晚）· 骨架 + S1-S4 + 渲染接法探测

### 做了什么
- `src/` 搭好 Remotion 工程：1080x1920 @30fps，2400 帧（80s），Composition id 约定不变
  - `index.ts` / `Root.tsx` / `Main.tsx`（8 段 Sequence 时间轴，帧数与 brief 分镜一一对应）
  - `theme.ts`（配色/字体/字号全部按 brief 写死）、`anim.ts`（入场 fade+30px/300ms、退场 200ms、计数器 ease-out 800ms）
  - `scenes/S1-S4` 实装，`S5-S8` 占位（居中灰字「待实现」，不崩、能渲）
- S1：打字机 40ms/字 + 光标闪烁 + 底部小字入场/退场
- S2：评论卡示意重排（右下角「示意图」角标），账号打码 `wb****39`，三连数据位（粉丝0/投稿0/凌晨06:12发），品红描边闪「凌晨06:12」一轮
- S3：大字「大肥鱼 = AstrBot」+ 三要点条依次入 + 右上计数器滚到 98,643
- S4：三根横条对数刻度（log10 宽度、真实值标注：98,643 / 189 / 12）+ 收尾句「教鱼繁殖的比教人捞鱼的火五百倍」
- 数字全部只从 brief.md「素材来源」抄；src 里 grep 过无 UID/路径/凭据

### 验证结果（本机不出片）
- `npm install` 成功（remotion 4.0.539 + react 18.3）；node_modules 软链到 /tmp/opencode 防上传扫描
- `tsc --noEmit` ✅
- `remotion bundle src/index.ts` ✅（webpack 打包通过，比 lint 强的验证；本机 CLI 4.0.x 无 `lint` 子命令，用 bundle 代替）
- 本机无头 Chromium 跑不动，未渲染，遵契约

### 渲染接法结论（探测 render-video.mjs + GH workflow 实测读源码）
**可以用 `--project` 渲染自定义工程**，链路已存在：
1. `node scripts/render-video.mjs --project fish-ecosystem [--frames 0-179] [--no-wait]`
2. 脚本用 GitHub Contents API 把 `videoproj/<slug>/src/` 下 `.tsx/.ts/.css/.json`（不收 node_modules，13 个文件实测会被扫到）逐个推到 `yht-cdd/bili-anthropos` 的 `video/projects/fish-ecosystem/src/`
3. workflow_dispatch inputs.project → CI 里 `rm -rf video/src && cp -r projects/<slug>/src src`，入口仍是 `src/index.ts`，composition 必须叫 **AnthroposVideo**（已遵守），props 会传 title/subtitle/kicker/accent/seconds/segments（我们的组件当前不读 props，兼容）
4. 时长：CI 传 `seconds` 但我们的 durationInFrames 在 Root 里写死 2400，**props.seconds 会被忽略**——时长由 Root 说了算，80s 正确
5. 调试渲染可用 `--frames 0-179` 只渲 S1
6. 音频：渲染产物无声轨，音效需按 brief 用 sfx.mjs 合成 audio.mp3 后 `--audio` 参数合流（mux 步骤已有）
- 注意：CI 的 npm 依赖来自仓库 `video/package.json`（react18/remotion^4），与我们本地版本一致，不需要动 workflows 文件

### 下一轮该做
1. 实装 S5（五节点竖排连线 + 刷18挑3 角标 + Jaccard 0.80 vs 0.55 红章）→ S6（16:41/17:25 卡片弹「看看你，加油！」定格1.5s）→ S7（左右两列对照 → 「它每天出厂，我每天记账」）→ S8（落款+青线扫过）
2. 用 `sfx.mjs mix` 按 brief 音效表做 80s audio.mp3
3. 首渲建议：`render-video.mjs --project fish-ecosystem --frames 0-839 --no-wait` 先验 S1-S4，绿了再全片
4. 全片渲染后按验收标准抽 8 帧核对文字/数字
## 第 1 轮 · 2026/10/31 21:39:51

第1轮：src骨架完成(1080x1920@30fps,2400帧,8段Sequence,tsc+remotion bundle均过)；S1打字机/S2打码评论卡+品红闪/S3揭底+98643计数器/S4对数横条已实装，S5-S8占位。渲染接法已探明：render-video.mjs --project fish-ecosystem 可渲(Contents API推video/projects/<slug>/src→CI覆盖video/src,composition须叫AnthroposVideo,已遵守;音频走--audio合流)。下轮：实装S5流水线+Jaccard盖章→S6评论回信→S7双列对照→S8落款，再做80s sfx音轨，先--frames 0-839调试渲S1-S4

## 第 2 轮 · 2026/10/31 21:50:56

第2轮(验证轮)：第1轮崩溃后复核——src 13文件全在，tsc --noEmit 过，remotion bundle 打包过(build/已清)，src内grep无UID/路径/凭据。渲染接法二次确认：拉了GitHub API上render.yml原文，与progress.md结论一致(project入参→cp projects/<slug>/src覆盖src、入口src/index.ts、composition=AnthroposVideo、--frames调试可用、CI npm install在video/根)。S5-S8仍是占位。下轮：实装S5五节点流水线+Jaccard盖章→S6评论回信→S7对照→S8落款，再做80s音效，然后首渲--frames 0-839

## 第 3 轮 · 2026/10/31 22:08:39

第3轮：S5-S8全部实装(S5五节点连线+刷18挑3角标+Jaccard0.80vs0.55品红盖章帧300对齐ding；S6 16:41评论卡+17:25「看看你，加油！」弹出后定格≥1.5s；S7左右对照→帧232居中「它每天出厂，我每天记账」；S8落款+青线扫过)。sfx.mjs按brief音效表mix出80.04s audio.mp3在项目根。tsc --noEmit过、remotion bundle过、src无UID/路径/凭据。下轮：render-video.mjs --project fish-ecosystem --frames 0-839 --no-wait调试渲，绿了全片+--audio合流，抽8帧验收

## 第 4 轮 · 2026/11/1 00:05:05

第4轮（主代理自记 2026-10-31 深夜）：调试渲 0-839 绿（run 41208859484），抽帧验 S1-S3 全对；全片渲 0-2399+audio 绿（run 41209202541），成片 tmp/fish-full-with-audio.mp4（80.0s/1080x1920@30fps/音轨-17.3dB），抽 11 帧逐段验收，唯一瑕疵：50.5s 红章盖住「Jaccard相似度/拦截线」半行字（主人未定改否）。已交付主人夸克链 84869be11423。下轮：a) 若主人要改盖章重叠→挪章 60px+字号调 42→重渲全片 b) publish 词到→bili-upload 投稿

## 第 5 轮 · 2026/11/2 00:07:24

第5轮：修章重叠+重渲

