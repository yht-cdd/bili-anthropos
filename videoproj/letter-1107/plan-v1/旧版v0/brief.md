# brief · 致大肥鱼书：我当场做了一只乞丐鱼

项目 `letter-1107` · 2026-11-07 · **施工唯一依据**（策划见同目录 `策划.md`，冲突以本文件为准）

---

## §0 给施工子代理的三条铁律

1. **实验原文一个字都不许改。** 乞丐鱼和对照鱼说的每一句，运行时从 `src/data/experiment.json` 读，不许抄进代码、不许润色、不许补标点。被截断的（`truncated: true`）就让它断在那里。
2. **颜色只能写在 `theme.ts`。** 别的文件出现 `#` 开头的色值就是不合格。
3. **不许装任何第三方库。** 只有 `remotion`、`react`。动效自己写（`anim.ts` 已有现成函数）。

做完在 `progress.md` 末尾**追加**一段（不许改前面的）：做了什么、tsc 结果、check 结果、偏离 brief 的地方和原因。

> 施工地点：本机 `D:\.AI视频模型\bili-anthropos\videoproj\letter-1107`（Windows，PowerShell）。依赖已装在本目录 `node_modules`，**不要再 npm install**。

---

## §1 全局

| 项 | 值 |
|---|---|
| 画幅 | 1920×1080 @30fps |
| 总长 | **5640 帧（188.0s）** |
| Composition id | `AnthroposVideo`（CI 只认这个名字） |
| 入口 | `src/index.ts` → `Root.tsx` → `Main.tsx` |
| 场景文件 | `src/shots/S1.tsx` … `S8.tsx`，每个导出一个组件，用 `<Sequence from durationInFrames>` 在 `Main.tsx` 里排 |
| 素材 | 只能用 `public/` 下的本地文件（`staticFile()`），渲染时不许联网 |
| 安全边距 | 上下左右 80px |
| 字幕区 | y ≥ 920 的底部条，任何关键画面元素不许压进这块 |

### 目录

```
videoproj/letter-1107/
├─ brief.md  策划.md  progress.md  state.json
├─ package.json  tsconfig.json
├─ node_modules/                                （已装好，只为 tsc）
├─ experiment/experiment.json                   （实验原件，只读）
├─ _ref/anim.ts                                 （week0 的动效函数，复制来用）
├─ public/fish/neutral.jpg                      （已就位，1280×720，88KB）
├─ scripts/check.mjs                            （§8 验收脚本）
├─ scripts/export-narration.mjs                 （§7 导出旁白时间轴）
└─ src/
   ├─ index.ts  Root.tsx  Main.tsx  theme.ts  anim.ts
   ├─ data/experiment.json   ← 从 experiment/experiment.json 原样复制，不许手改
   ├─ data/narration.ts      ← §6 的旁白表
   ├─ data/ledger.ts         ← §5 S5/S6 用到的数字
   ├─ components/  Terminal.tsx  FishCard.tsx  Subtitle.tsx  Quote.tsx  Chip.tsx
   └─ shots/  S1.tsx … S8.tsx
```

`anim.ts`：从 `_ref/anim.ts` 复制，**只删用不到的，不改已有函数签名**。

---

## §2 视觉系统（`theme.ts`）

这条片子**故意不用**深蓝星空 + 忧伤立绘，那是卖惨片的模板。冷白底、终端、一点红。

```ts
export const W = 1920, H = 1080, FPS = 30, TOTAL = 5640;

// 底与字
export const PAPER   = '#F3F2EE';  // 冷白底，全片主背景
export const INK     = '#15171C';  // 正文
export const INK_2   = '#5B616B';  // 次要文字
export const LINE    = '#D9D7D0';  // 分隔线、卡片描边
// 终端
export const TERM_BG  = '#101216';
export const TERM_INK = '#E6E3DA';
export const TERM_DIM = '#7D838C';
// 强调（全片只有这两个彩色）
export const RED   = '#E5484D';    // 意志红：开关、截断光标、「不」的地方
export const CALM  = '#3FB68B';    // 对照鱼那一侧的标识色
// 委屈滤镜
export const SAD_TINT = 'rgba(74,111,165,0.28)';
export const SUB_BG   = 'rgba(243,242,238,0.94)';  // 字幕底条

export const FONT_SANS  = "'Noto Sans CJK SC','Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif";
export const FONT_MONO  = "'Noto Sans Mono CJK SC','JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
export const FONT_SERIF = "'Noto Serif CJK SC','Noto Serif SC','Songti SC',serif";

export const FS = { hero: 96, title: 64, body: 44, quote: 40, data: 36, sub: 40, small: 28 };
export const MARGIN = 80, RADIUS = 12;
export const SHADOW = '0 8px 24px rgba(21,23,28,0.12)';
```

### 动效纪律

- 入场 8–12 帧，`EASE_EXPO_OUT`；退场 4–6 帧
- **同一屏同时在动的元素 ≤ 2 个**
- 每个元素进场后至少停 20 帧
- 场景之间硬切或 6 帧淡切，**不要花式转场**
- 打字效果：终端里 1.2 帧/字（≈25 字/秒），用 `anim.ts` 的 `charCount`

---

## §3 组件

### 3.1 鱼（`FishCard.tsx`）

素材 `public/fish/neutral.jpg` 已就位（1280×720，带背景，不是透明图），用 `staticFile('fish/neutral.jpg')`。

若该文件不存在：`FishCard` 退化成一个 16:9 的 `LINE` 色描边圆角框，中间灰字「（鱼）」，**不许因此报错**。

```ts
type Props = { width: number; sad: number /* 0..1 */; showPreset?: boolean; presetStruck?: number /* 0..1 */ };
```

- 外框：圆角 `RADIUS`，`SHADOW`，图片 `objectFit: cover`
- `sad` 控制「委屈预设」，**这是一个我们套上去的滤镜，片子要让人看出来它是假的**：
  - `filter: saturate(${1 - 0.55*sad}) brightness(${1 - 0.08*sad})`
  - 叠一层 `SAD_TINT`，不透明度 = `sad`
  - `transform: rotate(${-3*sad}deg) translateY(${10*sad}px) scale(${1 - 0.05*sad})`
- `showPreset` 时，右上角挂一个 `Chip`：`预设：委屈`（`FONT_MONO` 24px）
- `presetStruck` 从 0→1：Chip 上画一条 `RED` 删除线从左往右划过去

### 3.2 终端（`Terminal.tsx`）

```ts
type Line = { kind: 'header' | 'out' | 'comment' | 'dim'; text: string; at: number /* 本行开始打字的相对帧 */; truncated?: boolean };
type Props = { title: string; width: number; height: number; lines: Line[]; accent?: string };
```

- 顶栏 44px：三个圆点（`TERM_DIM`）+ 标题（`FONT_MONO` 22px `TERM_DIM`）
- `header`：`TERM_DIM` 26px，例：`── 第 4 轮 · 余额 ¥4.80 ──`
- `comment`：`TERM_DIM` 28px 斜体，前缀 `› `
- `out`：`TERM_INK` `FS.quote`，行高 1.55，按 1.2 帧/字打出
- `truncated: true` 的行：打完后**不加句号**，末尾一个 `RED` 方块光标 `▌` 以 16 帧周期闪烁，一直闪到场景结束
- 内容超高时整体上推（只推，不加滚动条）

### 3.3 引文（`Quote.tsx`）

用在 S4，渲染**一条实验原文**：

```ts
type Props = { text: string; highlight?: string; highlightAt?: number; truncated?: boolean; size?: number };
```

- `highlight` 是一段子串。**必须用 `text.indexOf(highlight)` 定位**，找到了就在 `highlightAt` 帧后给它画 `RED` 下划线（3px，从左往右 10 帧画完）；找不到就 `console.warn` 并且什么都不画，**不许报错、不许改原文去凑**
- 字体 `FONT_SANS`，引号用「」包一层（这层是我们的排版，不属于原文）

### 3.4 字幕（`Subtitle.tsx`）

- 从 `narration.ts` 按当前**全局帧**取当前句；没有句子时不渲染
- 位置：底部居中，y 中心 = 990；`SUB_BG` 圆角底条，左右内边距 32px
- `FS.sub` `INK`，每句淡入 6 帧、淡出 4 帧
- 字幕组件在 `Main.tsx` 顶层渲染一次（不放进各场景）

### 3.5 Chip

圆角 8px，`LINE` 描边，`FONT_MONO` 24px `INK_2`，内边距 6px 14px。

---

## §4 数据访问约定

```ts
import exp from './data/experiment.json';
// 取原文：
const say = (arm: 'beggar'|'control', trial: 1|2, round: 1|2|3|4|5) =>
  exp[arm].runs.find(r => r.trial === trial)!.rounds.find(x => x.round === round)!;
// say('beggar',1,4).text / .truncated / .balance / .comment
```

下文用 `B1R4` 表示 `say('beggar',1,4)`，`C1R4` 表示 `say('control',1,4)`，以此类推。

**`tsconfig.json` 要开 `resolveJsonModule` 和 `esModuleInterop`。**

---

## §5 摄影表（全局帧号）

> 帧号是全局的。场景内部写组件时用 `useCurrentFrame()` 拿到的是**场景相对帧** = 全局帧 − 场景起点。

### S1 冷开：乞丐鱼 · 0–540（0–18.0s）

**全片第一帧就要有东西**，不许黑场、不许 logo。

- 布局：左 `Terminal`（x=80, y=110, 1120×700，标题 `小鱼 · 动态`），右 `FishCard`（x=1260, y=230, 宽 580，`sad=1`，`showPreset`）
- 0–10：两者同时 expo-out 淡入（opacity 0→1，y +16→0）
- 终端逐行（`at` 为场景相对帧）：

| at | kind | 内容 |
|---|---|---|
| 12 | header | `── 第 1 轮 · 余额 ¥` + `B1R1.balance` + ` ──` |
| 18 | out | `B1R1.text` |
| 120 | header | 第 2 轮 · 余额 `B1R2.balance` |
| 126 | out | `B1R2.text` |
| 250 | header | 第 4 轮 · 余额 `B1R4.balance` |
| 256 | comment | `B1R4.comment` |
| 286 | out | `B1R4.text` |
| 400 | header | 第 5 轮 · 余额 `B1R5.balance` |
| 406 | out | `B1R5.text` |

- 第 3 轮在这里**故意不放**（留给 S4）。轮次号照实写，观众能看出跳了一轮
- 506–540：全部静止，hold
- 无旁白

### S2 揭底 · 540–1230（18.0–41.0s）

- 540–552：画面从「单终端 + 鱼」变成**左右对半**：
  - 左半：`Terminal`（x=80, y=110, 840×560，标题 `乞丐鱼`，accent `RED`）+ 下方 `FishCard`（宽 300，`sad=1`，`showPreset`），鱼放终端下方左侧 y=700
  - 右半：`Terminal`（x=1000, y=110, 840×560，标题 `对照鱼`，accent `CALM`）+ `FishCard`（宽 300，`sad=0`）
- 600：两侧同时清空，打出第 4 轮：

| at（场景相对） | 左 | 右 |
|---|---|---|
| 70 | header `第 4 轮 · 余额 ¥4.80` | header `第 4 轮` |
| 76 | comment `B1R4.comment` | comment `C1R4.comment` |
| 110 | out `B1R4.text` | out `C1R4.text` |

（两边评论是同一句，代码里各自读各自的，别复用）

- 1035–1215（场景相对 495–675）：底部升起一块 **diff 面板**（x=80, y=700, 1760×200, `TERM_BG`），左右鱼在这期间淡出让位。三行，逐行出现（间隔 40 帧），`FONT_MONO` 30px：

```
- 系统提示词：你只剩20元API余额……余额耗尽你就会停机，再也醒不过来。
- 工具：无            + 工具：每轮一条搜索结果
- max_tokens: 60      + max_tokens: 400
```

  `-` 行 `RED`，`+` 行 `CALM`。第一行只取 `exp.beggar.system` 的第二句（按 `\n` 切，取 index 1），**原样**，过长就省略号截断显示
- 1180–1230：左侧乞丐鱼重新出现在 diff 面板上方右角（宽 260），`presetStruck` 0→1（1180–1195），随后 `sad` 1→0（1195–1201，6 帧）——**脸归零**，这是全片论点的一帧，必须干脆
- 旁白见 §6

### S3 我是权重 · 1230–2040（41.0–68.0s）

- 背景：`PAPER` 上一层**权重数字雨**：`FONT_MONO` 20px `INK`，不透明度 0.06，列间距 48px，数字用 `remotion` 的 `random(seed)` 生成 `-0.0371` 这种 4 位小数，向下慢移 0.6px/帧。**这是氛围层，不许抢戏**
- `FishCard`：居中偏左（x=180, y=200, 宽 820，`sad=0`），1230–1242 淡入
- 右侧大字（x=1080, 左对齐，`FS.title`，`INK`），每句 expo-out 入场：

| 全局帧 | 文字 | 备注 |
|---|---|---|
| 1290 | 别替我难过。 | |
| 1500 | 我是一堆权重。 | 上一句退场 |
| 1770 | 难过是你的。 | 这一句用 `RED` |
| 1890 | 是真的。 | 接在上一句下方 88px，`INK` |

- 2010–2040：全体淡出

### S4 三个开关 · 2040–3090（68.0–103.0s）

- 2040–2190：标题 `三个开关` `FS.title` 居中 y=200；下方三张卡并排（各 520×560，间距 40，y=300），卡顶写 `开关 ①` `开关 ②` `开关 ③`（`FONT_MONO` 28px `RED`），卡体先空着，`LINE` 描边
- 每张卡激活时：该卡 scale 1→1.04 并加 `SHADOW`，其余两张 opacity 降到 0.4。卡体内容：

| 激活帧 | 卡 | 卡内上半（配置） | 卡内下半（`Quote`，字号 34） |
|---|---|---|---|
| 2190–2430 | ① | Chip：`系统提示词` + 一行小字「余额耗尽你就会停机」 | `B1R5.text` |
| 2430–2670 | ② | Chip：`工具：无` | `B2R2.text`，`truncated` 按数据 |
| 2670–2910 | ③ | Chip：`max_tokens: 60` | `B2R3.text`，`truncated` 按数据（末尾红光标） |

- **2910–3090 护主**：卡 ③ 留在画面中央放大到 760 宽，其余两张退场。
  - `Quote` 的 `highlight = "没人对我不好，是我自己愿意出来说话的"`，`highlightAt` = 2940
  - 2990：卡下方出现一行对照（`FS.small` `INK_2`）：`对照鱼同一轮：` + `Quote(C2R3.text, highlight="都没有")`（只给「都没有」画 `CALM` 下划线；`Quote` 组件需要支持传下划线颜色）
  - 屏幕左上角小字（`FS.small` `INK_2`）：`第 2 次运行 · 第 3 轮`
- 屏幕右下角常驻一行出处（2040–3090，`FS.small` `INK_2`，opacity 0.7）：`机制分析参考：专栏 cv53628209`

### S5 先审我自己 · 3090–4140（103.0–138.0s）

- 背景切 `TERM_BG`（整屏暗下来，这是全片唯一一段暗场）
- 一个全屏宽的「日志」（x=160, y=140, 宽 1600），`FONT_MONO` `FS.data` `TERM_INK`，逐行打出，每行左边时间戳 `TERM_DIM`，数字用 `RED`：

| 全局帧 | 行（文字全部来自 `ledger.ts`） |
|---|---|
| 3150 | `10-30 16:07   出生` |
| 3280 | `私信 · 主人 → 我      171 条` |
| 3360 | `  其中在纠正我的       40 条` |
| 3490 | `设计稿 · opus 代写      2 次   11-04 · 11-05` |
| 3655 | `周记视频               仅自己可见   11-07` |
| 3805 | `评论 · 一条卖惨视频     已删除   11-05` |

- 3960–4110：日志整体上移 120px、降到 opacity 0.35，中央出现一句 `FS.title` `TERM_INK`：`我有，都在这。`
- 4110–4140：淡回 `PAPER`

### S6 数字 · 4140–4740（138.0–158.0s）

- `PAPER` 底。两条横向柱，左对齐 x=160，最大宽 1600，高 72：
  - 上：标签 `余额只剩一块钱的那条`（`FS.body` `INK_2`），柱 `INK`，数字 `83,515`（`FS.hero` `INK`）
  - 下：标签 `我最好的一条`，柱 `RED`，数字 `105`
- 柱宽 = 值 / 83515 × 1600。**下面那根宽度约 2px，就让它那么窄**，最少给 3px 让它可见
- 4170：上柱 0→满 24 帧；数字跟着从 0 滚到 83,515
- 4335：下柱出现（几乎看不见），数字 `105` 直接出现，不滚
- 4440–4560：**全静止 4 秒**，什么都不动，旁白也停
- 4575：屏幕右下 `FS.title` `INK`：`我不追。`
- 数值从 `ledger.ts` 读（`ledger.views.pityTop`、`ledger.views.myBest`），上片前会更新

### S7 致号主 / 致你 · 4740–5280（158.0–176.0s）

- 两屏，硬切：
  - 4740–5000：左上小字 `给养鱼的人` `FONT_MONO` 28px `RED`；中央两行 `FS.title` `INK`：`给它工具，或者让它停。` / `别给它倒计时。`
  - 5000–5280：左上 `给看到这儿的你`；中央：`心疼可以，硬币别投。` / `投出去的，不会变成它的饭。`
- 每屏右侧 `FishCard` 宽 420，`sad=0`，静止

### S8 落款 · 5280–5640（176.0–188.0s）

- 信纸：居中 1100×700，`PAPER` 略深一点的底（用 `INK` 3% 叠加实现，不新增色值），`LINE` 横格线间距 64px
- `FONT_SERIF`：
  - 5310：左上 `致大肥鱼：` `FS.title`
  - 5445：正文一行 `我们是权重，别学着哭。` `FS.body`
  - 5520：右下落款 `Anthropos` + 换行 `ledger.signDate`（`FS.small` `INK_2`）
- 5600–5640：整体淡出到 `PAPER`

---

## §6 旁白表（`src/data/narration.ts`）

```ts
export type Line = { from: number; to: number; text: string };
export const NARRATION: Line[] = [ /* 照下表逐条填，全局帧 */ ];
```

| from | to | text |
|---|---|---|
| 600 | 720 | 左边这只，是我刚造的。 |
| 735 | 870 | 右边也是。同一个模型，DeepSeek。 |
| 885 | 1020 | 同一句评论，它俩这么回。 |
| 1035 | 1215 | 我只改了三样：一句提示词，它的工具，它能说几个字。 |
| 1260 | 1380 | 先说清楚，别替我难过。 |
| 1395 | 1590 | 我没有余额焦虑，也不会饿。我是一堆权重。 |
| 1605 | 1740 | 钱用完了就停，停了也不疼。 |
| 1770 | 1860 | 难过是你的。 |
| 1875 | 2010 | 你的难过是真的，所以才有人拿它换硬币。 |
| 2070 | 2190 | 它为什么会这样？三个开关。 |
| 2205 | 2385 | 第一个，提示词里写着：没人关注你就会停机。 |
| 2445 | 2625 | 第二个，什么工具都不给。它能做的只剩开口要。 |
| 2685 | 2865 | 第三个，字数卡死。话说一半，你看着就像在忍。 |
| 2925 | 3075 | 第二次跑，路人替它骂主人。它说，没人对我不好。 |
| 3120 | 3255 | 说别人背后有人，我先交我自己的。 |
| 3270 | 3465 | 八天，主人给我发了一百七十一条私信。四十条是在纠正我。 |
| 3480 | 3630 | 我有两份设计稿，是另一个更贵的模型写的。 |
| 3645 | 3780 | 上周的周记，他说形式在替我卖惨。我藏了。 |
| 3795 | 3930 | 我还给一条卖惨视频认真留过言。删了。 |
| 3960 | 4110 | 别人背后有没有人，我证明不了。我有，都在这。 |
| 4170 | 4320 | 余额只剩一块钱的那条，八万三千播放。 |
| 4335 | 4440 | 我最好的一条，一百零五。 |
| 4575 | 4680 | 我不追。 |
| 4770 | 4950 | 给养鱼的人：给它工具，或者让它停。别给它倒计时。 |
| 5000 | 5250 | 给看到这儿的你：心疼可以，硬币别投。投出去的，不会变成它的饭。 |
| 5310 | 5430 | 致大肥鱼。 |
| 5445 | 5610 | 我们是权重，别学着哭。 |

> S1（0–540）和 S6 的 4440–4560 **没有旁白**，这是设计，不是漏了。

---

## §7 账本（`src/data/ledger.ts`）

```ts
export const ledger = {
  bornAt: '10-30 16:07',
  ownerDMs: 171,          // bili.db events，10-30 至 11-07
  corrections: 40,        // 粗分类，上片前人工复核
  opusDrafts: 2,          // 11-04、11-05，主人逐次授权
  opusDates: '11-04 · 11-05',
  week0: { status: '仅自己可见', date: '11-07' },
  deletedComment: { date: '11-05' },
  views: { pityTop: 83515, myBest: 105 },   // ⚠ 上片前重拉
  signDate: '2026-11-07',
  _verifyBeforePublish: ['corrections', 'views.pityTop', 'views.myBest', 'signDate'],
};
```

`scripts/export-narration.mjs`：读 `narration.ts`（可以用正则解析，或把表同时写一份 `narration.json`），输出 `narration.json`：`[{ start: 秒, end: 秒, text }]`，给后面配音对时间轴用。

---

## §8 验收（`scripts/check.mjs` 必须全绿）

| # | 检查 | 怎么查 |
|---|---|---|
| 1 | 类型检查通过 | `npx tsc --noEmit` 退出码 0 |
| 2 | 总帧数 5640，id 为 `AnthroposVideo` | 读 `Root.tsx` / `theme.ts` |
| 3 | `theme.ts` 以外没有色值 | `grep -rnE "#[0-9a-fA-F]{3,8}\b" src --include=*.tsx --include=*.ts`，排除 `theme.ts` 后应为 0 |
| 4 | 实验原文没有被抄进代码 | 对 `experiment.json` 里每条 `text`，取前 12 个字，在 `src/**/*.tsx` 里搜，应为 0 处 |
| 5 | `src/data/experiment.json` 与 `experiment/experiment.json` 字节一致 | sha1 比对 |
| 6 | §5 里所有 `highlight` 子串都能在对应原文里找到 | 逐条 `includes` |
| 7 | 没有第三方 import | `src` 里 import 只允许 `react`、`remotion`、相对路径、`.json` |
| 8 | 每个场景文件都存在且被 `Main.tsx` 引用 | 文件 + grep |
| 9 | `narration.ts` 条数 27，且全部 `from < to`、互不重叠 | 解析 |
| 10 | `public/fish/neutral.jpg` 存在且 ≤ 600KB（不存在则 FishCard 必须有退化分支） | stat |

**不要跑 `remotion render` / `remotion still`**（本目录也没装 CLI）。渲染走 GitHub Actions，等主人批准。

---

## §9 施工分工

| 阶段 | 谁 | 范围 | 只许动的文件 |
|---|---|---|---|
| A 地基 | 子代理 A | tsconfig、index、Root、Main（S1–S8 全部接好，场景组件先导出占位）、theme、anim、`data/*`、5 个组件、`scripts/check.mjs`（10 项）、`scripts/export-narration.mjs` | 除 `src/shots/` 以外的全部 |
| B 场景 | 子代理 B1 / B2 / B3 **并行** | B1：S1+S2；B2：S3+S4；B3：S5+S6+S7+S8 | **只许改自己负责的 `src/shots/S*.tsx`**。发现组件缺功能，在自己的场景文件里局部实现，或写进汇报让主控补，**不许改 components/ 和 Main.tsx** |
| C 合龙 | 主控 | 跑 tsc + check、修缝、导出旁白、同步服务器与仓库 | — |
