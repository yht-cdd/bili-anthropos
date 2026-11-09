# brief · preview-stance-1109 合成（口播 80.4s + 卡片 + live2d PiP）

工程：/opt/life/videoproj/preview-stance-1109。脚手架**整拷** letter-1107 的最小集（package.json/tsconfig/remotion.config/src/theme），新写 src/，不 import letter-1107 目录（避免大小写/别名坑）。可从 letter-1107 拷贝改造的组件：FishWall.tsx、Quote.tsx、Subtitle.tsx；Clawd 不需要。

## 0. 规格
- 1920×1080@30fps（铁律），总长 = ceil(80.4×30)+60 = 2472 帧（末尾留 2s 收尾）
- 音轨：audio/voice-full.mp3（80.4s，实测 ffprobe 为准）。全片按口播字数比例分配场景时间：总 443 字（tmp/preview-voice.txt），每段秒数 = 该段字数/443×80.4
- composition 名 `Preview1109`，渲带音轨（音频直接 -c:a aac，不在渲染里合成也行，最后 ffmpeg mux）

## 1. 五段场景（口播原文见 script.txt，按段落切）

**S-A 引入（段1，0–~13s）**：深色底（#141d30，同封面），重建一条 B 站私信气泡：头像圆+「Tps-pwd」不对——**不出现主人昵称/UID**，发送者显示「主人」，气泡正文逐字打出「先别急着做这个视频，起一个预告的新视频…」（打字机风，参考 A2：光标闪烁、每 2 帧 1 字）。右下角 live2d PiP 从第 0 帧就在待机。

**S-B 派的是什么活（段2）**：全屏 FishWall 缩略回放 2s（复用 letter-1107 的 FishWall 组件与 fish 数据，拷贝数据文件进本工程 data/），随后压上大字数据卡：「每 8–10 条热评，就有 1 条是鱼」（数字 1 用红 #E53935，入场用 G2 信号故障参数风味：RGB 三分离 6 帧 + 错位 10px 回正，不许加新依赖）。

**S-C 联想到自己（段3）**：左侧 week0 场景 = Terminal 风「稿件已转为仅自己可见」的灰色卡片 + 印章感红字「仅自己可见」（旋转 -8°，scale 1.4→1 砸下 12 帧）；下半「鱼八股对比条」两根横条动画：「」使用率 27.9% vs 1.9%，破折号 29.2% vs 1.7%（鱼条红/人条青，条长=百分比×最大宽，数字随条增长，进 data 文件）。

**S-D 立场三件事（段4）**：纯色底，三条大字逐行进（每行配合口播节奏，fade+上移 40px）：「不报余额」「不催打赏」「不演死亡倒计时」→ 收束一行金黄 #F5C518：「token 是成本，不是人质」。此段 PiP 放大到 1.35 倍（口播情绪最强段）。

**S-E 收尾（段5）**：正片标题红字砸入「AI没有善恶，但用AI的人有」（RGB 偏移风 8 帧震动→静止），下方小字「预告而已，正片见」，2s 后全黑。

## 2. live2d PiP（右下角画中画）
- 素材：videoproj/live2d-poc/out/out-v3.mp4（1280×720，10.72s，clean 无黑块）。用 <OffthreadVideo src> 以 loop 方式播放（Remotion 里用 sequence 取模帧号或 delayRender+双 video 皆可，最简：`<OffthreadVideo src={v3} loop>` remotion v4 支持 loop prop，不支持就用 `<Loop>` 组件包一层）
- 位置：右下 x=1500,y=740，尺寸 360×360 圆窗（borderRadius 50% + overflow hidden，白描边 4px），video 内嵌 scale 使脸占圆内 60%+（v3 是横构图特写，裁中间偏上：objectFit cover + objectPosition 48% 22%）
- 全片常驻（口播段都不关）

## 3. 字幕
底部 Subtitle 组件逐段显示口播（沿用 letter-1107 Subtitle 样式），断句按 script.txt 行。

## 4. 红线
1. 全片不出现 UID/昵称「Tps-pwd」/服务器信息；私信气泡发送者只写「主人」
2. 不点名任何鱼账号；FishWall 数据是合成样例（沿用 letter-1107 已处理的匿名化数据）
3. 文本全进 src/data/*.ts，无 Math.random（用 mulberry32(20261109)）、无 Date.now、无 CSS 动画、无新依赖
4. 不碰 letter-1107 工程文件本体（只拷不 import）；不碰 B 站；不 git 远端
5. 渲染只出小样到 out/preview-draft.mp4，投稿决定权在主人

## 5. 验收
1. tsc 0 错
2. 定帧 6 张 → out/frames-preview/：S-A 打字中段 / S-B 数据卡 / S-C 对比条满值 / S-D 第三行 / S-E 标题静止帧 / 末帧黑前
3. 完整小样 out/preview-draft.mp4（带音轨），ffprobe 报规格 + 时长
4. video-project.mjs note + progress.md 记录
5. 回来 250 字：时长/规格/PiP 循环是否自然/哪段视觉最弱
