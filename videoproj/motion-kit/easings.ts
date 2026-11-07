/**
 * easings.ts — motion-kit 的唯一合法缓动来源
 *
 * 规矩很简单：**所有动效的曲线只能从这里拿**，不要自己写 cubic-bezier，
 * 不要用 Remotion 默认的 `Easing.inOut`（那是「PPT 味」的主要来源），
 * 也不要用 `Easing.linear` 做主角动效（只许做呼吸类微动）。
 *
 * 这里只有两类曲线，够覆盖 9 个组件的全部需求：
 * - `expo*`：指数曲线。前面冲得快、后面慢慢贴到位 —— 高级感的来源。
 * - `spring*`：物理弹簧。有轻微过冲，适合「东西落定」的手感。
 *
 * 用法（最常见的两种）：
 *   const p = progress(frame, 0, 10);                    // 0→1，10 帧 expo-out
 *   const x = interpolate(frame, [0, 10], [0, 600], { easing: expoOut, ... });
 */

import { Easing } from 'remotion';
import type { EasingFunction } from 'remotion';
import { spring as remotionSpring } from 'remotion';
import type { SpringConfig } from 'remotion';

// ————————————————————————————————————————————
// 一、曲线本体（expo 家族）
// ————————————————————————————————————————————

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * 指数缓出：冲出去、然后贴到位。入场首选。
 * 和 Remotion 的 `Easing.out(Easing.exp)` 几乎一样，差别只在终点严格等于 1
 * （原生那个终点是 0.99902，用在 scale 上会差一丝，最后一帧永远不「落定」）。
 */
export const expoOut: EasingFunction = (t: number): number => {
  const x = clamp01(t);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

/** 指数缓入：起步慢、越走越猛。退场 / 甩出去用这个。 */
export const expoIn: EasingFunction = (t: number): number => {
  const x = clamp01(t);
  return x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
};

/** 指数缓入缓出：只在「一个东西从 A 移到 B」时用，入场退场别用。 */
export const expoInOut: EasingFunction = (t: number): number => {
  const x = clamp01(t);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x < 0.5
    ? 0.5 * Math.pow(2, 20 * x - 10)
    : 1 - 0.5 * Math.pow(2, -20 * x + 10);
};

/** 呼吸类微动的合法曲线：比 linear 软一点，又不会显得在「播进度条」。 */
export const breathe: EasingFunction = Easing.sin;

// ————————————————————————————————————————————
// 二、曲线名字表（类型层面把 linear / bezier 挡在外面）
// ————————————————————————————————————————————

/**
 * 组件的 `easing` 参数只认这几个名字。
 * 写成 `easing="linear"` 会在编译期就报错 —— 这是故意的。
 * 真要 linear（比如呼吸、进度条走秒），请直接用 `interpolate` 自己写，
 * 那样一眼能看出「这里越界了」。
 */
export type LegalEasing = 'expoOut' | 'expoIn' | 'expoInOut' | 'spring';

const CURVES: Record<Exclude<LegalEasing, 'spring'>, EasingFunction> = {
  expoOut,
  expoIn,
  expoInOut,
};

/** 名字 → 函数。`spring` 不是 0→1 的单函数，走 `springProgress()`。 */
export const curve = (name: LegalEasing): EasingFunction =>
  name === 'spring' ? SPRING_DEFAULT_CURVE : CURVES[name];

// ————————————————————————————————————————————
// 三、spring 封装
// ————————————————————————————————————————————

/**
 * 三档预设，别自己凑参数。
 * 节奏纪律规定「弹跳最多回弹 1 次」，所以能选过冲的就只有 soft/one。
 * hard 用于落定手感极强的场合（盖章、卡位）。
 */
export const SPRING_PRESETS = {
  /** 不过冲，稳稳贴到位。默认档，用在 PushIn / FocusRack / 字幕入场。 */
  soft: { damping: 200, mass: 1, stiffness: 120, overshootClamping: true } as const,
  /** 一次轻微回弹（约 3%）。用在 Stagger 的列表行、卡片落位。 */
  one: { damping: 16, mass: 1, stiffness: 120, overshootClamping: false } as const,
  /** 一次明显回弹（约 8%）。用在盖章、✓ 落定这类「有重量」的东西。 */
  hard: { damping: 11, mass: 1, stiffness: 160, overshootClamping: false } as const,
};

/** 默认弹簧参数 = soft 档。 */
export const SPRING_DEFAULT: Partial<SpringConfig> = SPRING_PRESETS.soft;

// 一个「长得像弹簧」的 0→1 曲线，供 interpolate 的 easing 位使用。
// 只在确实需要 easing 函数形式时用它；能算进度就用 springProgress()。
const SPRING_DEFAULT_CURVE: EasingFunction = Easing.spring({
  damping: SPRING_PRESETS.soft.damping,
  mass: SPRING_PRESETS.soft.mass,
  stiffness: SPRING_PRESETS.soft.stiffness,
  overshootClamping: SPRING_PRESETS.soft.overshootClamping,
});

export type SpringProgressOptions = {
  /** 当前帧（useCurrentFrame()） */
  frame: number;
  /** 第几帧开始动，默认 0 */
  start?: number;
  /** 帧率，默认 30（motion-kit 全片 30fps） */
  fps?: number;
  /** 弹簧参数，默认 soft 档 */
  config?: Partial<SpringConfig>;
  /** 传了就把结果限制在这个窗口内（超窗口后按最后一帧 hold），不传就一直演化 */
  durationInFrames?: number;
};

/**
 * 弹簧进度：返回 0→1（可能短暂超过 1，那是真实的过冲，不是 bug）。
 * 这是首选写法 —— 比 `interpolate + easing=spring` 更准，因为它不受窗口截断。
 *
 *   const p = springProgress({ frame, start: 12 });
 *   style={{ transform: `translateY(${(1 - p) * 30}px)`, opacity: Math.min(1, p) }}
 */
export const springProgress = ({
  frame,
  start = 0,
  fps = 30,
  config = SPRING_DEFAULT,
  durationInFrames,
}: SpringProgressOptions): number => {
  const t = frame - start;
  if (t < 0) return 0;
  const capped = durationInFrames === undefined ? t : Math.min(t, durationInFrames);
  return remotionSpring({ frame: capped, fps, config, from: 0, to: 1 });
};

/** 任意两值之间的弹簧插值（0→1 之外还要别的数值时用这个）。 */
export const springValue = ({
  from = 0,
  to = 1,
  ...opts
}: SpringProgressOptions & { from?: number; to?: number }): number =>
  from + (to - from) * springProgress(opts);

// ————————————————————————————————————————————
// 四、进度助手（推荐入口，99% 的场景用它就够）
// ————————————————————————————————————————————

export type ProgressOptions = {
  /** 当前帧 */
  frame: number;
  /** 起始帧 */
  start?: number;
  /** 持续帧数（入场 8-12，退场 4-6） */
  durationInFrames?: number;
  /** 曲线，默认 expoOut；不许传别的函数 */
  easing?: LegalEasing;
  /** true = 退场：从 1 走到 0 */
  exit?: boolean;
};

/**
 * 0→1 进度。组件内部全靠它，你在外面自己写动效也应该用它。
 *
 *   const p = progress({ frame, start: 10, durationInFrames: 10 });
 *   // frame<10 → 0；frame>=20 → 1；中间 expo-out，前 1/3 走得最快
 */
export const progress = ({
  frame,
  start = 0,
  durationInFrames = 10,
  easing = 'expoOut',
  exit = false,
}: ProgressOptions): number => {
  const dur = Math.max(1, durationInFrames);
  const raw = (frame - start) / dur;
  const p = curve(easing)(raw);
  return exit ? 1 - p : p;
};

/**
 * 带起止值的插值（等价于 interpolate，但 easing 只认合法名字、默认 clamp）。
 * 这样写出来的东西不会偷偷用上 linear / 默认 inOut。
 */
export const tween = (
  frame: number,
  from: number,
  to: number,
  opts: Omit<ProgressOptions, 'frame'> = {},
): number => from + (to - from) * progress({ frame, ...opts });

/**
 * 单帧正弦摆动（呼吸、微抖）。返回 0→1→0，`cycles` 次一整圈。
 * 这是全片唯一允许「不是 expo/spring」的运动，因为它做的是微动，不是主角动效。
 */
export const pulse = (frame: number, cyclesPerSecond = 0.5, fps = 30): number =>
  0.5 - 0.5 * Math.cos((2 * Math.PI * cyclesPerSecond * frame) / fps);

/** 速度（px/帧）：给 MotionBlur 的门槛判断用。 */
export const velocity = (
  pos: (frame: number) => number,
  frame: number,
  eps = 1,
): number => Math.abs(pos(frame) - pos(frame - eps)) / eps;

// ————————————————————————————————————————————
// 五、节奏纪律常量（写进验收用的数字，别在场景里散着写魔法数）
// ————————————————————————————————————————————

/** 入场最短 / 最长（帧） */
export const ENTER_MIN = 8;
export const ENTER_MAX = 12;
/** 退场最短 / 最长（帧）—— 必须比入场快 */
export const EXIT_MIN = 4;
export const EXIT_MAX = 6;
/** 一个动效结束后，至少停留这么多帧才许下一个 */
export const DWELL_MIN = 20;
/** 一屏同时运动的独立元素上限 */
export const MAX_MOVING_ELEMENTS = 2;
/** 位移超过这个值（px/帧）必须挂 MotionBlur */
export const MOTION_BLUR_THRESHOLD_PX = 40;
/** 非「刀」位置的转场最少缓冲帧 */
export const HARD_CUT_BUFFER_MIN = 4;

/** 断言用：不合规直接抛错，让 render 在本地就炸掉，不要带病投稿。 */
export const assertCadence = (label: string, enter: number, exit: number): void => {
  if (enter < ENTER_MIN || enter > ENTER_MAX) {
    throw new Error(`${label}: 入场 ${enter} 帧，必须在 ${ENTER_MIN}-${ENTER_MAX} 帧之间`);
  }
  if (exit < EXIT_MIN || exit > EXIT_MAX) {
    throw new Error(`${label}: 退场 ${exit} 帧，必须在 ${EXIT_MIN}-${EXIT_MAX} 帧之间`);
  }
  if (exit >= enter) {
    throw new Error(`${label}: 退场(${exit})必须比入场(${enter})快 —— 来得清楚、走得干脆`);
  }
};
