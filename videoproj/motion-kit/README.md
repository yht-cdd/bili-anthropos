# motion-kit · Opus5.5 水准镜头动效库

> 给组装镜头的人（包括免费小模型）：**照这张表选组件、照默认值用，不要自创曲线。**
> 母本规格在 `SPEC.md`；这里只回答一个问题——「想要什么感觉 → 用哪个 → 参数怎么给」。

## 选型表：想要什么感觉 → 用哪个

| 想要什么感觉 / 场景 | 用哪个 | 默认参数（不传就是合规值） | 备注 |
|---|---|---|---|
| 一张静图放 2 秒以上，别像 PPT | `PushIn` | `from=1 → to=1.06`，expo-out，`durationInFrames=90`（**改成你这段的总帧数**） | 斜推更有味：`panX=±20`。`to` 别超 1.1 |
| 重音落下 / 报错 / ✓ 盖章 | `Shake` | `amplitude=14`、`damping=12`、衰减 3 次，`phase='kick'` 场景用 | `start` 必须和 sfx 的 ding **同一帧**（纪律 3） |
| 大字幕、色块「唰」地进场 | `MaskWipe` | 入场 8-12 帧（默认 10），`direction='left'`，退场 4-6 帧 | 只许 clip-path 擦，别配淡入 |
| 列表 / 终端输出 / 代码行逐条出来 | `Stagger` | `stepInFrames=3`（区间 2-4）、每条 expo-out | 一次 Stagger 算**一个**动效，不是一行一个 |
| 画面要有前后层次 | `Parallax` | 前景 x+18px、背景 x−10px，同帧启动 | 只有两层（纪律 4 上限），第三层必须静止 |
| 场景切入、倒带后「对上焦」定格 | `FocusRack` | blur 10→0，6-10 帧 expo-out（默认 8），配 scale 0.98→1 | 转场缓冲位的两个合法选项之一 |
| 全片胶片质感 | `Grain` | `opacity=0.05`（0.04-0.07）、每 2 帧换 seed | **全片挂一次**，别每段挂 |
| 收视线、压黑边 | `Vignette` | `strength=0.35` 边缘黑 | 同上，全片一次；别超 0.5（那是隧道） |
| 甩镜头 / 硬切前缓冲 | `MotionBlur` | `layers=3`、`opacity=0.3`，位移 >40px/帧 必挂（`needsMotionBlur()` 帮你判） | 只处理 translate；位移函数必须纯函数 |
| 不知道用哪个的入场 | `FocusRack` 或 `MaskWipe` | — | 别用「整屏淡入」，那是禁用清单 |

## 三条硬规矩（违反即返工）

1. **缓动只从 `easings.ts` 拿**：`expoOut` / `expoIn` / `expoInOut` / `springProgress()`。
   禁自写 cubic-bezier、禁 `Easing.inOut` 默认值、禁 linear 做主角动效（呼吸类微动可以用 `breathe` 或 `pulse()`）。
2. **节奏**：入场 8-12 帧、退场 4-6 帧且必须比入场快；两次动效之间停留 ≥20 帧；
   一屏同时运动的独立元素 ≤2；非「刀」位的转场必须有 ≥4 帧缓冲（`FocusRack` / `MotionBlur` 二选一）。
3. **把时间轴写进 `planSegments()`**（`Motion.tsx` 底部）。上面这些数字它会**逐条断言，
   不合规直接抛错**——让本地渲染炸掉，别让带病的片子投稿出去。demo/ 就是这么写的，照抄结构即可。

## 组件之外还有什么

- `progress()` / `tween()` — 自己写库外动效时的唯一合法进度函数（easing 参数只认 `LegalEasing` 名字，写 `"linear"` 编译期报错）。
- `assertCadence(label, enter, exit)` — 手搓动效时的节奏自检。
- `CADENCE` — 合规区间常量表，别在场景里散写魔法数。
- `needsMotionBlur(pxPerFrame)` — 该不该挂拖影的判断。

## 用法

```tsx
import { PushIn, Stagger, Grain, Vignette, planSegments } from '../motion-kit'; // 或 '../../motion-kit'

// 库内所有组件按「本地帧」计时：放进 <Sequence> 后从 0 数，durationInFrames 记得传你这段的总长
<Sequence from={0} durationInFrames={90}>
  <PushIn durationInFrames={90}><img src={...} /></PushIn>
  <Grain />
  <Vignette />
</Sequence>
```

## demo

`npx remotion studio demo/index.ts` 直接看；`npx remotion bundle demo/index.ts` 做 CI 校验。
10 秒 / 300 帧 / 1920×1080@30fps：9 个组件各一段 + 1 段组合镜头（PushIn+Stagger+Grain+Vignette），
时间轴由 `planSegments` 全量断言。

## 禁用清单（一眼假，SPEC 原文）

- ❌ linear / Remotion 默认 `Easing.inOut` 做主角动效
- ❌ 整屏元素同向又缩放（PPT 感）
- ❌ bounce 回弹超过 1 次（`SPRING_PRESETS.one/hard` 已封顶）
- ❌ 中文字号 <28px 无描边/阴影压在复杂背景上
- ❌ 白底纯淡入淡出连续超过两个镜头
