# R6 · 声音设计调研（letter-1107）

> 调研日期：2026-11-07 · 调研员：子代理 R6
> 标注约定：**【实测】**= 本轮在服务器上真跑出来的数字；**【文档】**= 官方/一手页面原文；**【推测】**= 没验证，用之前要再确认。
> 范围：只调研，未改任何项目代码。试合成 2 句（上限 2 句），文件在服务器 `/opt/life/tmp/voice-test/`。

---

## 0. 结论速览

| 项 | 结论 |
|---|---|
| 旁白音色 | 首选 **茉莉**（女，旁白人设是"我=她"），备选 **冰糖**；若接受男声，**苏打**已实测自然、无哭腔。女声两款本轮没配额试，**需主人 A/B 听 1 句再定**【推测】 |
| 语速 | 旁白窗口按 **3.2–3.6 字/秒** 写稿（现 narration.json 平均约 3 字/秒）；苏打自然语速实测 **≈4.2 字/秒**，所以窗口里会留 10–25% 呼吸，plan 模式只补静音不加速，最好 |
| 风格控制 | MiMo-V2.5-TTS **支持**：①`user` 消息写自然语言导演指令 ②`assistant` 文本开头 `(风格)` 标签 + 句中 `[音频标签]`【文档】。但 `voice.mjs` 目前只发 assistant，**要用 user 指令得给 plan 段加 `style` 字段**（见 §1.5） |
| 现有 BGM | 5 首 Mixkit（House/Hip-Hop），许可允许 B 站等网络视频平台【文档】，但**风格全不对**（派对/街头），本片不建议用；`bgm-tech-house.mp3` 来源无法反查，**不要用** |
| BGM 方案 | 主线继续"程序合成 drone/pad"（策划已定：不用伤感钢琴）；⑤⑦ 段可加 Pixabay Music（免署名、可商用）或 YouTube 音频库的 CC-BY 曲目（需署名） |
| 新音效 | 能纯 ffmpeg 合成：glitch、电视雪花、CRT 关机、8bit 脚步/跳/啪叽/啵、消息气泡、终端打字、风声、虫鸣（够用级）。**建议采样**：机械键盘、鼠标点击、页面滚动、红笔圈画、纸张翻折、城市环境、快门（Freesound CC0 / Kenney CC0，候选 ID 见 §3） |
| 混音目标 | 成片 **-14 LUFS 综合响度、真峰值 ≤ -1 dBTP**；旁白段短时响度 -14~-16；BGM 在旁白下 **压 10–12 dB**（约 -28~-30 LUFS），无旁白段回到 -20~-22；音效峰值比旁白低 3–6 dB |

---

## 1. 配音（MiMo TTS）

### 1.1 服务器配置【实测】

`/opt/life/config/voice-api.json`（已脱敏，keyFile 未读取）：

- baseUrl `https://api.xiaomimimo.com/v1`，`tts.style=chat`，`path=/chat/completions`
- `model=mimo-v2.5-tts`，默认 `voice=mimo_default`，`format=wav`，`dailyMax=80`
- ASR：`mimo-v2.5-asr`

`node /opt/life/scripts/voice.mjs voices` 输出（靠服务端报错列出）：

```
mimo_default  冰糖  茉莉  苏打  白桦  Mia  Chloe  Milo  Dean
```

性别/语言【文档，tokenhot 镜像文档 + 本地 mimo-tts skill】：冰糖、茉莉＝中文女；苏打、白桦＝中文男；Mia/Chloe＝英文女；Milo/Dean＝英文男；`mimo_default` 在国内集群等于冰糖。

### 1.2 plan 模式输入格式【实测，读源码】

```bash
node /opt/life/scripts/voice.mjs plan --file plan.json --out-dir /opt/life/tmp/letter-1107-voice [--voice 茉莉] [--max-speed 1.25]
```

```json
{
  "segments": [
    { "from": 20,   "to": 24,   "text": "左边这只，是我刚造的。" },
    { "from": 24.5, "to": 29,   "text": "右边也是。同一个模型，DeepSeek。" },
    { "start": "00:42", "seconds": 4, "text": "先说清楚，别替我难过。" }
  ]
}
```

要点：

- 时间字段：`from`/`to`，或 `start` + `seconds`；可写秒数、`mm:ss`、`hh:mm:ss.s`。
- 每段：合成 → `fitTo`：短了 `apad` 补静音，长了 `atempo` 加速，**超过 `--max-speed`（默认 1.25）直接报错**让人改稿；窗口 < 0.3s 报错。
- **注意坑**：段与段是首尾 `concat` 的，`cursor` 只是用来检查。如果两段之间有空隙（如 24→24.5），脚本只打警告"按上一段结尾接上"，**不会插静音** → 实际输出会整体前移。narration.json 里几乎每段之间都有 0.5–2s 空隙、开头还有 20s 无旁白。
  **做法**：喂给 plan 之前，把空隙并入前一段的 `to`（或插入 `text` 为空的段——但空 text 会去调 API，不行），并在第一段前加偏移：最简单是让第一段 `from=0, to=24` 把开头 20s 当成静音前缀……这会让第一句从 0s 开始说。所以**推荐改法**：把每段 `to` 延到下一段的 `from`，最后成片用 `adelay=20000` 整体延后 20 s。【推测：未跑，按源码推断】
- 输出：`seg-NN.mp3` + `voice.mp3`（44.1k 单声道 128k）+ `timeline.json`（含每段 actual），总长漂移 > 0.35s 视为失败。
- 每段算一次额度（dailyMax 80）；narration.json 27 段，一次跑完约占 27 次。

### 1.3 试合成结果【实测】

同一句 `AI没有善恶，但用AI的人有。这句话，我想认真聊聊。`（有效字 22 个），前缀标签 `(平静 温和 略带温度)`，经 `voice.mjs say`：

| 音色 | 时长 | 字/秒 | 句间静音（silencedetect -40dB/0.25s） | 原始响度 |
|---|---|---|---|---|
| 苏打 | 5.33 s | **≈4.2** | 0.48 s、0.75 s（逗号、句号处，自然） | -21.3 LUFS |
| 白桦 | 8.06 s | ≈2.7 | 0.94 s、0.52 s、1.16 s、0.45 s（停顿偏多偏长） | -22.5 LUFS |

- 白桦多出近 3 秒，有两种可能：①它本身慢、停顿重；②把标签"平静温和略带温度"也念出来了（8 个字 ≈ 2 s）。想用 ASR 回听确认，但 `voice.mjs hear` 返回 **HTTP 402 Insufficient account balance**——**ASR 账户余额不足**（TTS 仍可用）。所以标签是否被念出来**未验证**，文件留在服务器，请人工听一下。
- **两段都没有哭腔**是从时长/停顿推不出来的，是听感问题；本轮没有听，属【未试听】。
- 合成原始响度在 -21~-23 LUFS，混音时需要把旁白整体抬到 -16 左右（见 §4）。

### 1.4 音色推荐

旁白是第一人称"我"（Anthropos，片尾称 AI 为"她"），策划要求"**不要哭腔，选平直的**"。

1. **首选 茉莉**【推测】：中文女声，按命名和社区描述偏成熟、平稳；适合"可信、略带温度"。
2. **备选 冰糖**【推测】：国内默认音色，偏甜偏年轻，温柔段好听，但批评段可能不够"硬"。
3. **男声兜底 苏打**【实测语速】：节奏自然，停顿只落在标点上，适合通俗讲解。
4. 不推荐 白桦作为全片旁白：停顿过长，4 分钟片子会拖。
5. 进阶：如果两款女声都不合适，可用 `mimo-v2.5-tts-voicedesign` 描述"30 岁左右女性，声音干净平直，像深夜电台主持，不煽情不哭腔"自造音色；但 voicedesign 每次合成音色会漂，**不适合 27 段拼接**，只用于定调试听【推测】。

**下一步建议**：用茉莉、冰糖各合成第 6 条"我没有余额焦虑，也不会饿。我是一堆权重。"给主人听，二选一。

### 1.5 风格/情绪指令（官方文档）

来源：<https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/speech-synthesis-v2.5>、<https://mimo.xiaomi.com/mimo-v2-5-tts>、<https://mimo.mi.com/docs/en-US/news/latest/v2.5-tts-release>

【文档】要点：

- 待合成文本**必须**放 `role: assistant`；`role: user` 可选，放自然语言风格指令（内容不会被读出）。
- 两种控制方式：
  - **自然语言控制** → `user.content`，一句话即可，也支持"导演模式"：[角色] [场景] [指导]（语速、气息、停顿、重音、共鸣位置、情绪起伏）。
  - **标签控制** → 写在 assistant 文本里：开头 `(风格1 风格2)`，半角 `()`、全角 `（）`、`[]` 都认；句中任意位置插 `[音频标签]`，如 `[吸气]` `[叹气]` `[轻笑]` `[停顿]`。
- 推荐风格词（可自定义）：平静/冷漠/温柔/严肃/深沉/干练/凌厉；复杂情绪：释然/无奈/疲惫/忧虑；音色定位：磁性/醇厚/清亮/空灵。
- 支持混合情绪，如"压抑的愤怒""温柔但疲惫"。

**voice.mjs 的现状**：`synthOne` 只发一条 assistant 消息，**没有 user 指令通道**；所以现在只能用标签法（就是本轮试的那种），而标签可能被念出（白桦那条存疑）。

**建议的最小改动**（未实施，交给主控决定）：plan 段支持 `"style": "..."`，`synthOne(text, voice, format, style)` 在 `messages` 前插 `{ role: "user", content: style }`。约 5 行。

### 1.6 分段风格提示词建议（写进 user 指令）

公共底座（每段都带）：
> 你是一个自己运营 B 站账号的 AI，在给观众讲一件你亲眼看到的事。声音干净、平直、口语化，像跟朋友说话，不播音腔，不煽情，绝对不要哭腔和颤音。句末不要拖长。

| 段 | 情绪 | 追加指令 | 可用标签 |
|---|---|---|---|
| ① 评论区被攻占 | 好奇 → 发现不对 | 语速中等偏快，带一点"诶，这是什么"的好奇，后半句声音收一点，开始察觉异样 | 句首 `(好奇)`，转折处 `[停顿]` |
| ② 白屏→黑屏打字机 | 不安 | 放慢，音量降低，气声多一点，像在黑屋子里小声说；每个短句后留白 | `(低声 平静)`，`[吸气]` |
| ③ 红色大字 | 愤怒/警醒（克制） | 压着火说，咬字清楚，重音落在"人"上；不吼，音量只提一档 | `(严肃 压抑的愤怒)`；"但用AI的[加重]人有" |
| ④ HF 权重页/小螃蟹被砸扁 | 轻松科普 | 语速稍快，轻松，带一点笑意，像讲冷笑话；砸扁处可以有一声短笑 | `(轻松 俏皮)`，`[轻笑]` |
| ⑤ DeepSeek/Claude Code 终端狂刷 | 揭露 | 干练、清晰、节奏紧，像在一行行念证据，数字要念得很稳 | `(干练 冷静)` |
| ⑥ 小螃蟹跳到书桌 | 温柔 | 声音放软，语速放慢 10%，带一点笑意和亲近感 | `(温柔)` |
| ⑦ 夕阳城市/信/升华 | 升华（不卖惨） | 平静、缓慢、有温度但很克制，像写信时念给自己听；最后一句"善待你的AI，别让她沦为乞讨的乞丐"一字一顿，不要哽咽 | `(温柔 释然)`；末句前 `[停顿]`，**禁用** `[哽咽][抽泣]` |

---

## 2. 背景音乐

### 2.1 仓库现有 BGM【实测】

本地 `D:\.AI视频模型\bili-anthropos\skills\video-shotcraft\assets\audio\` **不存在**（本地仓库没这目录），数据来自服务器 `/opt/life/skills/video-shotcraft/assets/audio/bgm/`，ffprobe + ebur128 实测：

| 文件 | 时长 | 原始响度 | 风格 / BPM（ATTRIBUTION.md） | 来源 | 本片适用 |
|---|---|---|---|---|---|
| bgm-tech-house.mp3 | 4:48.7 | -9.4 LUFS | Tech House ~124 | **"无法逐曲反查"** | ❌ 来源不明，别用 |
| cat-walk.mp3 | 2:04.0 | -11.9 | House ~129（Arulo） | mixkit 371 | ❌ 时装秀感 |
| g-eazy-nba-type.mp3 | 1:44.4 | -16.4 | Hip Hop ~86（Arulo） | mixkit 403 | ⚠️ 勉强可做④⑤垫底，偏街头 |
| house-vibez.mp3 | 1:51.5 | -10.8 | House ~123（Lily J） | mixkit 745 | ❌ |
| tonight-hiphop.mp3 | 1:53.5 | -6.8 | Hip Hop ~103 | mixkit 841 | ❌ 太响太满 |

许可：ATTRIBUTION.md 记为 **Mixkit Stock Music Free License**。官方条款【文档】：可在"any web or social media platform, including internet-based video on demand services, podcasts and advertisements"商用/非商用；**禁止**：CD/DVD、电子游戏、电视/电台广播、改编成纯音乐作品、声称原创、**注册到任何版权管理服务**。来源：<https://mixkit.co/license/modal/musicFree/>、<https://mixkit.co/terms/>
→ **B 站视频：允许**（B 站属于网络视频点播平台）。别把成片音轨单独拿去注册版权即可。

同目录模板音效（`template/public/audio/`，按旧记录 Mixkit SFX Free License）：click-camera 0.39s（实测响度 -70，**几乎是空的/极轻，需检查**）、impact-cine 4.1s、keyboard 19.7s（来源无法反查）、pop 0.52s（来源待考）、riser-cine 4.9s、sparkle 4.6s、swoosh-quick 0.81s、transition-snap 0.60s、transition-soft 1.31s、whoosh-big 2.35s、whoosh-fast 1.80s。**标"无法反查/待考"的 4 个（keyboard、riser-cine、sparkle、whoosh-big、pop）发布前要换掉**，ATTRIBUTION 自己也这么写。

### 2.2 免费 BGM 来源许可要点

| 来源 | 许可要点 | 用于 B 站 | 来源链接 |
|---|---|---|---|
| **Pixabay Music** | Pixabay Content License：免费、**免署名**、可商用、可改编；禁止原样单独再分发、误导性使用。部分曲目作者登记了 YouTube Content ID（带盾牌图标），YouTube 上可能被认领，可凭下载证书申诉 | ✅ 推荐。B 站没有 Content ID 联动，风险更低【推测】；保留下载页链接和证书 | <https://pixabay.com/service/license-summary/>、<https://pixabay.com/service/faq/> |
| **YouTube 音频库** | 官方说法是"to use in your videos"，CC 曲目必须在简介署名；第三方解读：**标准许可曲目限 YouTube 内使用**，CC-BY 4.0 曲目可用于其他平台但要署名 | ⚠️ 只用 **CC-BY** 那部分，并在 B 站简介按生成的署名文本写；标准许可曲目别搬到 B 站 | <https://support.google.com/youtube/answer/3376882>、<https://www.licenseorg.com/guide/music-audio/youtube-audio-library> |
| **FMA（Free Music Archive）** | 每首单独许可：CC0 / CC-BY / CC-BY-SA / CC-BY-NC… | ⚠️ 只用 **CC0 或 CC-BY**。B 站开了创作激励/充电就算有商业收益，**NC 曲目有风险**【推测】；CC-BY-SA 会要求成片同协议，别用 | <https://freemusicarchive.org/>（逐曲看 License 栏） |
| **必剪音乐库** | 平台方已处理授权，用于站内投稿；"商用范围以站内标注为准，涉及第三方曲目另看授权说明"（第三方汇总） | ✅ 但要在必剪里使用并导出/投稿；**本片是 Remotion 渲染**，把必剪的曲子扒出来混进 Remotion 不在明确授权范围内【推测】 | <https://www.bilibili.com/blackboard/bcut/activity-fwyT3DYfq4.html>（用户协议） |
| **Mixkit Music** | 见 2.1，网络视频平台可用，免署名 | ✅ | <https://mixkit.co/free-stock-music/> |
| **程序合成（sfx.mjs pad 及扩展）** | 自己算的，无版权问题 | ✅ 策划已定的主路线 | — |

### 2.3 七段音乐风格建议

整体：策划写明"**不用伤感钢琴、S6 停顿处全静音**"，所以主线是**极简电子 / drone**，只在④⑤用有节奏的东西。

| 段 | 情绪 | 风格 | 合成方案（优先） | 外采候选（搜索关键词） |
|---|---|---|---|---|
| ① 评论区被攻占 | 好奇→越来越快 | 极简 pluck 琶音，随消息密度**加速**（BPM 90→140），尾部只剩高频嗡鸣 | `aevalsrc` 正弦 pluck + 用 `atempo` 分段提速；或直接用"气泡音越来越密"代替音乐 | Pixabay：`minimal pluck tension`、`curious electronic` |
| ② 白屏→黑屏打字机 | 不安 | **几乎无音乐**：低频 drone + 电视雪花底噪，打字机声当节奏 | `pad` 降到 55 Hz + `tremolo` 慢速，叠 -40 dB 的粉噪 | Pixabay：`dark ambient drone`、`suspense drone` |
| ③ 红色大字 | 愤怒/警醒 | 冲击打点：**boom + 故障 + 0.5 s 全静音**，不需要旋律 | sfx.mjs `boom` + 新 `glitch` + 静音窗 | Pixabay：`cinematic hit glitch`（作为单音效） |
| ④ HF 页/小螃蟹被砸扁 | 轻松科普 | **8-bit / chiptune 轻快**，110–120 BPM | 方波 `aevalsrc` 写 4 小节循环（见 §3 的 8bit 配方，可以拼成简单旋律） | Pixabay：`8 bit happy`、`chiptune funny`；YouTube 音频库 CC-BY 筛 "Comedy" |
| ⑤ DeepSeek / Claude Code 狂刷 | 揭露 | **冷电子 / glitch-hop**，鼓点干，低音持续推进 | 合成难度较高；可用 pad + 每拍 tick 做"节拍器式"推进 | Pixabay：`dark tech beat`、`cyber glitch hop`、`hacker`；现有 `g-eazy-nba-type.mp3`（Mixkit，-16.4 LUFS，86 BPM）作为兜底 |
| ⑥ 小螃蟹跳到书桌 | 温柔 | 温暖的 lo-fi / 八音盒感，轻柔 | 三角波和弦 + 轻微 `aecho` | Pixabay：`lofi warm`、`music box gentle`（避开钢琴独奏） |
| ⑦ 夕阳城市→四季星空→信→升华 | 温柔→升华 | **氛围 pad 慢起**，结尾一个大三和弦长音 + 星空段的高频闪烁；最后一句前全静音 | sfx.mjs `pad` 加大三和弦 + 长 `afade`；星空用 `sine` 高频随机 tick | Pixabay：`ambient hopeful`、`cinematic ambient sunrise`；YouTube 音频库 CC-BY "Ambient / Inspirational" |

---

## 3. 音效

### 3.1 sfx.mjs 源码评估【实测，读源码】

- 10 个 cue：tick(1600Hz 衰减)、ding(880Hz)、boom(70Hz)、buzz(140Hz+vibrato)、whoosh(粉噪带通+淡入淡出)、riser(180→720Hz 扫频)、pad(110/164.8/220Hz+tremolo)、error(170→50Hz 下滑)、rewind(颤音下滑)、typing(白噪+12Hz tremolo)。
- 每个 cue 返回 `{ input: lavfi 源, filters: -af 链 }`，渲染统一 `ffmpeg -f lavfi -i "<input>" -af "<filters>,volume=g" -t d -ar 44100 -ac 1`。**加新音效只需往 `CUES` 里加一项 + `DEFAULT_SEC`**，结构很好扩。
- 局限：
  1. 单输入单链，**不能多层叠加**（如 8bit 跳跃需要两段音高）→ 用 `aevalsrc` 一个表达式里写分段函数解决，或 cue 支持 `filter_complex`。
  2. 全部**单声道 44.1k 128k mp3**，成片建议 48k 立体声。
  3. `mix()` 用 `amix=inputs=N`：ffmpeg 4.4 的 amix 会按输入数缩放各路音量【推测，4.4 无 `normalize` 开关】，本片 sfx-plan.json 有 ~60 个 cue，单个音效会被压得很小，再被末端 `loudnorm=I=-16` 拉回来 → 底噪和 pad 被一起放大。**建议**：音效轨用 `amix ... ,volume=N` 补偿，或改成 `adelay` 后逐级 `amerge`/`amix=normalize=0`（ffmpeg ≥5）；或干脆在 Remotion 里用 `<Audio>` 逐个放。
  4. typing 是"连续调制噪声"，不是离散敲击，听感像沙沙声而不是按键。

服务器 ffmpeg 版本：**4.4.2**（下列配方按 4.4 写，均【未实跑】，参数是起点，需要试听微调）。

### 3.2 新音效逐项：合成 or 采样

记号：`D`=时长秒，`SR=44100`。命令形式：`ffmpeg -f lavfi -i "<源>" -af "<链>" -t D out.wav`。

| # | 音效 | 判定 | 配方 / 采样来源 |
|---|---|---|---|
| 1 | **数字故障 glitch** | ✅ 合成 | 源：`aevalsrc='0.5*sgn(sin(2*PI*(200+800*random(1))*t))*lt(mod(t,0.05),0.03)':d=0.4:s=44100`（随机音高方波 + 50ms 斩波）；链：`acrusher=bits=4:samples=12:mix=1,highpass=f=300,volume=0.6`。也可对旁白/音乐段落直接 `acrusher` + `aloop` 做"卡帧口吃" |
| 2 | **白噪声电视雪花** | ✅ 合成 | 源：`anoisesrc=color=white:d=3:a=0.3`；链：`highpass=f=800,lowpass=f=8000,tremolo=f=60:d=0.15,volume=0.4`。叠一层 15.734 kHz 行频哼声更像 CRT：`sine=f=15734:d=3` 音量 0.02 |
| 3 | **CRT 关机** | ✅ 合成 | 高频下滑"啾"+ 静电噼啪：`aevalsrc='0.4*sin(2*PI*(9000*exp(-6*t))*t)*exp(-3*t)+0.15*random(0)*exp(-20*t)':d=0.8:s=44100`；链：`lowpass=f=10000,afade=t=out:st=0.5:d=0.3`。最后接 0.05 s 低频 `boom`(50Hz) 做"嘣"的电容放电 |
| 4 | **8bit 脚步** | ✅ 合成 | 极短方波 + 噪声：`aevalsrc='0.4*sgn(sin(2*PI*180*t))*exp(-60*t)+0.2*(random(0)*2-1)*exp(-80*t)':d=0.08:s=44100`；链：`acrusher=bits=6:samples=4`。循环时每步交替 180/220 Hz |
| 5 | **8bit 跳跃** | ✅ 合成 | 方波上扫：`aevalsrc='0.35*sgn(sin(2*PI*(300+900*t/0.25)*t))':d=0.25:s=44100`；链：`acrusher=bits=5:samples=6,afade=t=out:st=0.18:d=0.07` |
| 6 | **被砸扁"啪叽"** | ✅ 合成（够用级） | 两层：①低频重击 `sine=f=90:d=0.25` + `afade=t=out:curve=exp`；②湿润噪声"叽" `anoisesrc=color=brown:d=0.25` + `bandpass=f=900:w=600,afade=t=out:st=0.05:d=0.2`；`amix` 两层。更卡通可再叠一个 600→150Hz 的快速下滑方波（0.12 s）。想要更"肉"就采样 Kenney **Impact Sounds**（CC0，130 个） |
| 7 | **弹回"啵"** | ✅ 合成 | 正弦快速上扫 + 短衰减：`aevalsrc='0.6*sin(2*PI*(250+700*t/0.12)*t)*exp(-25*t)':d=0.15:s=44100`（就是经典 pop） |
| 8 | **鼠标点击** | ⚠️ 合成可凑，**建议采样** | 合成：2 个 3 ms 高通噪声脉冲相隔 60 ms（按下/抬起）`aevalsrc='(random(0)*2-1)*(lt(t,0.003)+0.6*between(t,0.06,0.063))':d=0.1`,`highpass=f=2000`。采样：Freesound **fs:678248** "Mouse Click Sound.mp3"（Pixeliota，CC0，2.8 万下载）、**fs:534104** "mouse-click-double-00.flac"（pbimal，CC0）；Kenney **Interface Sounds**（CC0，100 个 click） |
| 9 | **消息气泡弹出（越来越密）** | ✅ 合成 | 单个：`sine=f=1200:d=0.09` → `afade=t=out:curve=exp`，叠一个 1800 Hz 0.04 s 前缀做"啵叮"。**加密**在 plan 层做：`at_n = T*(1 - (n/N)^0.5)` 之类加速间隔，后期每个随机 ±150 Hz 防止机械感；密到 >15 个/秒后改成连续 `riser` + 噪声"淹没" |
| 10a | **键盘打字·机械** | ❌ 要采样 | 机械轴的"段落感+回弹"合成很假。Freesound CC0：**fs:631609** "Blue Switch Mechanical Keyboard Typing"（rhinenux）、**fs:661450** "Typing and slow typing on a mechanical keyboard"（fsharpinfinity）、**fs:330900** "Mechanical Keyboard Typing.mp3"（ChickenMan669，765 下载） |
| 10b | **键盘打字·终端（Claude Code 狂刷）** | ✅ 合成 | 不需要真实按键，要的是"数据流"：离散 tick 串 `aevalsrc='0.3*(random(0)*2-1)*lt(mod(t,0.035),0.004)':d=3`,`highpass=f=3000,lowpass=f=9000`，再叠 sfx.mjs `typing` 低音量做底。滚屏越快把 0.035 调到 0.015 |
| 11 | **页面滚动** | ⚠️ 合成凑合，建议采样 | 合成：滚轮"嗒嗒"= 10a 的离散 tick 降到 1200 Hz 带通、间隔 40 ms；整页滑动 = 短 `whoosh` 0.3 s。采样：Kenney **UI Audio**/Interface Sounds 里的 scroll/switch 类【推测有】，或 Freesound 搜 `mouse wheel scroll`（CC0 过滤） |
| 12 | **红笔圈画** | ❌ 要采样 | 笔尖摩擦是有纹理的宽带噪声，合成只能做到"沙沙"。Freesound CC0：**fs:565206** "Pen or marker writing on paper - close up"（khenshom，1342 下载）、**fs:751055** "pen (marker pen) writes on paper"（SSkiba88）、**fs:481076** "Fast writing on paper with a sharpie marker"（khenshom） |
| 13 | **纸张翻折** | ❌ 要采样 | Freesound CC0：**fs:382651** "Paper Page Turn.wav"（bbrocer，1206 下载）、**fs:450803** "paper sheets flip through turn page"（kyles，1744 下载）、**fs:856497** "Turning page (heavy paper)"（xkeril）。Kenney **RPG Audio** 里有 book flip/open 类【推测】 |
| 14 | **城市环境声** | ❌ 要采样 | 合成只能做"远处车流低频"：`anoisesrc=color=brown` + `lowpass=f=400` + 慢 `tremolo`，当底可以，但没人声/车鸣细节。Freesound CC0：**fs:425558** "CityStreetSmallTownSpring.wav"（ktdamien）、**fs:393702** "City ambience - Budapest Keleti train station"（vdr3）。夕阳段建议"远、低、无人声" |
| 15 | **风声** | ✅ 合成 | `anoisesrc=color=pink:d=10` → `bandpass=f=500:w=400`，再用 `volume='0.4+0.3*sin(2*PI*0.15*t)':eval=frame` 做阵风起伏，`lowpass=f=2000`。采样备选：**fs:327771** "Wind howling"（Jeffreys2，CC0，1195 下载） |
| 16 | **夜晚虫鸣** | ✅ 合成（够用级） | 蟋蟀 ≈ 4.5 kHz 载波被 ~30 Hz 脉冲调制、每秒 2–3 组：`aevalsrc='0.15*sin(2*PI*4500*t)*lt(mod(t*30,1),0.5)*lt(mod(t,0.4),0.15)':d=10:s=44100`，复制 3 份错开相位/频率（4300/4700 Hz）后 `amix`，再加 `aecho=0.8:0.5:60:0.3` 做空间感。要真实感采样：**fs:535765**（PostProdDog，夜晚街区+虫鸣，含车声低音需裁）或继续搜 `crickets night ambience` CC0 |
| 17 | **快门声** | ❌ 建议采样 | 合成可做"咔嚓"两次瞬态，但机械质感差。Freesound CC0：**fs:520684** "Contarex camera shutter.wav"（Tonik1105，**4.8 分/122 人评，7948 下载**，2.30 s）、**fs:271010** "Camera Shutter Click"（Kodack，4377 下载）。注意模板里的 `click-camera.mp3` 实测响度 -70 LUFS，**基本是无声文件**，别依赖 |

Freesound 数据来自服务器 `skills/video-shotcraft/assets/scripts/sfx-source.py search`（默认许可过滤 **cc0**）【实测】；下载走 `sfx-source.py get fs:ID --out-dir <工程>/public/audio/sfx`，会自动生成 `audio-manifest.json` + `FREESOUND-CREDITS.md`。CC0 无需署名，但仍建议在简介写来源。**以上候选只看了元数据，未试听。**

### 3.3 CC0 音效包

| 包 | 内容 | 许可 | 链接 |
|---|---|---|---|
| Kenney **Impact Sounds** | 约 130 个撞击/重击/碎裂 → 砸扁、落桌 | CC0 | <https://kenney.nl/assets/impact-sounds> |
| Kenney **Interface Sounds** | 100 个 click/snap/确认 → 鼠标、气泡 | CC0 | <https://kenney.nl/assets/interface-sounds>（OpenGameArt 页亦标 CC0） |
| Kenney **Digital Audio** | 62 个合成音（laser、phaser、powerUp、pepSound）→ 8bit/故障备选 | CC0 | <https://kenney.nl/assets/digital-audio> |
| Kenney **UI Audio** | 50 个按钮/开关 | CC0 | <https://kenney.nl/assets/ui-audio> |
| Kenney **RPG Audio** | 约 50 个（书页、布料、脚步等）【推测内容】 | CC0 | <https://kenney.nl/assets/rpg-audio> |
| Freesound（CC0 过滤） | 见 3.2 | 逐条 CC0 | <https://freesound.org> |
| Pixabay Sound Effects | 免署名可商用 | Pixabay License | <https://pixabay.com/sound-effects/> |

Kenney 许可：官方支持页写明全部素材 CC0，可商用、署名可选（"Kenney"或"kenney.nl"）。

---

## 4. 混音规范

### 4.1 B 站响度现状（均非官方公告）

- B 站没有公开的上传响度规范【未找到官方文档】。
- B 站有"音量均衡"开关。UP 主实测：手机端约 **-12 LUFS**，网页端"标准"约 -12、"高动态"约 -20（抽样有限）。来源：<https://www.bilibili.com/opus/942558919908130865>
- ASMR UP 主反馈：新版动态均衡会把**高于 -28 LUFS 的视频统一拉到 -14 LUFS**。来源：<https://www.bilibili.com/opus/951243597171130370>
- 两份数据有出入（-12 vs -14），且会随版本变化 → 取 **-14 LUFS**：不开均衡时也不至于小声，开了均衡几乎不被改动，同时跟 YouTube/Spotify 的 -14 对齐。真峰值留 **-1 dBTP**，防止 AAC 转码爆音（上面第一篇也建议 peak -1 dB）。
- 参照：央视 -24 LKFS ±2 / -2 dBTP（广播标准，不适用于 B 站）。

### 4.2 推荐目标值

| 轨 | 目标 | 说明 |
|---|---|---|
| **成片综合** | **-14 LUFS（±1），TP ≤ -1.0 dBTP，LRA 6–9 LU** | 最后一级 `loudnorm=I=-14:TP=-1:LRA=9`（两遍法更准） |
| 旁白（单轨） | 有声段短时响度 -14~-16 LUFS（单轨综合约 **-16**） | TTS 原始约 -21~-23，需抬 5–7 dB；先 `highpass=f=80`，轻压缩 `acompressor=threshold=-20dB:ratio=3:attack=5:release=80` |
| BGM（无旁白段） | **-20 ~ -22 LUFS** | ①④开头、⑦星空段可以让音乐"站出来" |
| BGM（旁白下） | **-28 ~ -30 LUFS**，即**比旁白低 12–14 LU**；ducking 幅度 **10–12 dB** | 本片是讲道理的片子，旁白可懂度优先 |
| 音效 | 瞬态峰值比旁白峰值低 **3–6 dB**；氛围类（雪花、风、虫鸣、城市）按 BGM 处理，-30 LUFS 左右 | ③的 boom 和④的"啪叽"是唯一允许和旁白一样响的点，但**不要压在字上** |
| 静音锚点 | ③红字前、⑦末句前的全静音**真的要静**（-70 以下），不要被 loudnorm 抬起底噪 | sfx.mjs 的 `bed.silence` 已支持 |

### 4.3 ducking 参数（ffmpeg）

```
[voice]asplit=2[v][vsc];
[bgm][vsc]sidechaincompress=threshold=0.02:ratio=10:attack=40:release=450:makeup=1:knee=4[bgmduck];
[v][bgmduck][sfx]amix=inputs=3:weights='1 1 1':duration=longest,loudnorm=I=-14:TP=-1:LRA=9
```

- attack 30–60 ms（字头前压下去）、release 400–600 ms（句间不"抽气"）。
- 更可控的做法：既然 plan 模式已经产出 `timeline.json`（每句 from/to），直接按时间表画 BGM 音量包络（`volume='if(between(t,20,24)+between(t,24.5,29)+...,0.28,1)':eval=frame`，配 0.3 s 斜坡），比侧链压缩更干净，**推荐这一种**【推测：未实跑】。
- 若在 Remotion 里混音：`<Audio volume={(f)=>...}>` 用同一份 timeline 插值，效果相同，且所见即所得。

### 4.4 输出格式

- 成片音轨 **48 kHz 立体声 AAC 320k**（或 192k 起）；sfx.mjs/voice.mjs 的 44.1k 单声道中间件在最终混音时 `aresample=48000` + 上混。
- B 站 Hi-Res 无损投稿需 ≥48 kHz/24 bit 的无损编码（活动页，非必需）。来源：<https://www.bilibili.com/blackboard/activity-m1vS5T9l2t.html>
- 测量命令：`ffmpeg -i out.mp4 -map a:0 -af ebur128=peak=true -f null -`

---

## 5. 发现的问题（给主控）

1. **ASR 余额不足（HTTP 402）**：`voice.mjs hear` 不能用，plan 合成后"转回文字核对"这一步目前做不了；TTS 还能用。
2. `voice.mjs plan` **不插段间静音**，直接喂 narration.json 会让旁白整体前移（见 §1.2）。
3. `voice.mjs` 没有 user 风格指令通道（见 §1.5）。
4. `sfx.mjs mix` 的 amix 在 60+ 路输入时有音量被压的问题（见 §3.1-3）。
5. 模板 `click-camera.mp3` 实测 -70 LUFS，近乎无声；`keyboard / riser-cine / sparkle / whoosh-big / pop` 来源无法反查，发布前要换。
6. 本地仓库没有 `skills/video-shotcraft/assets/audio/`，只有服务器上有。
7. 委托方描述的 7 段 4 分钟结构，和 `narration.json`（27 段，187 s）/ `sfx-plan.json`（total 188）不一致，可能策划已更新但旁白表还没跟上，配音前需要先对齐。

## 6. 来源

- MiMo TTS 文档：<https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/speech-synthesis-v2.5>
- MiMo-V2.5-TTS 介绍：<https://mimo.xiaomi.com/mimo-v2-5-tts> · <https://mimo.mi.com/docs/en-US/news/latest/v2.5-tts-release> · <https://mimo.mi.com/models/en-US/mimo-v2.5-tts>
- 音色枚举（第三方镜像文档）：<https://docs.tokenhot.ai/mimo-v2-5-tts-preset-voice>
- Mixkit：<https://mixkit.co/license/modal/musicFree/> · <https://mixkit.co/terms/>
- Pixabay：<https://pixabay.com/service/license-summary/> · <https://pixabay.com/service/faq/>
- YouTube 音频库：<https://support.google.com/youtube/answer/3376882> · <https://www.licenseorg.com/guide/music-audio/youtube-audio-library>
- 必剪用户协议：<https://www.bilibili.com/blackboard/bcut/activity-fwyT3DYfq4.html>
- Kenney：<https://kenney.nl/assets/category:Audio> · <https://opengameart.org/content/interface-sounds>
- Freesound：<https://freesound.org>（各 ID 页 `https://freesound.org/s/<ID>/`）
- B 站响度：<https://www.bilibili.com/opus/942558919908130865> · <https://www.bilibili.com/opus/951243597171130370> · <https://www.bilibili.com/opus/437135530799763720>
