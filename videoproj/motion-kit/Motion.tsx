/**
 * Motion.tsx — motion-kit 镜头动效组件库（9 个）
 *
 * 给用库的人（包括免费小模型）的话：
 * 1. 每个组件都**自带默认值 = SPEC 推荐值**，不传参数就是合规的。别乱调参数。
 * 2. 组件只负责「怎么动」，不管「什么时候动」。时间由你在外面用 `<Sequence>` 切段。
 *    组件内部用的是**本地帧**（Sequence 里从 0 开始）。
 * 3. 所有曲线都来自 easings.ts，组件不接收自定义函数 —— 这是防呆，不是限制你。
 * 4. 一屏同时动的独立元素 ≤2（SPEC 纪律 4）。所以 Parallax 只有两层，
 *    想加第三层请把第三层做成静止的。
 *
 * 组件清单：
 *   PushIn      静帧缓推（Ken Burns）
 *   Shake       冲击震动
 *   MaskWipe    遮罩擦入
 *   Stagger     逐行 / 逐字错峰
 *   Parallax    前后景反向位移
 *   FocusRack   景深转移（糊 → 实）
 *   Grain       胶片噪点
 *   Vignette    暗角
 *   MotionBlur  快速位移的拖影
 */

import React, { Children, useId, type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SpringConfig } from 'remotion';
import {
  DWELL_MIN,
  EXIT_MAX,
  EXIT_MIN,
  ENTER_MAX,
  ENTER_MIN,
  HARD_CUT_BUFFER_MIN,
  MAX_MOVING_ELEMENTS,
  MOTION_BLUR_THRESHOLD_PX,
  progress,
  springProgress,
  type LegalEasing,
} from './easings';

// ————————————————————————————————————————————
// 共用小工具
// ————————————————————————————————————————————

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** 组件的通用底盘：占满父层、不改变尺寸。 */
const SHELL: CSSProperties = {
  position: 'absolute',
  inset: 0,
  willChange: 'transform, opacity, filter',
};

/** 把 React 的 useId（含 `:` `«»`）洗成能放进 CSS url(#…) 的名字。 */
const useSafeId = (): string => {
  const raw = useId();
  return 'mk' + raw.replace(/[^a-zA-Z0-9]/g, '');
};

// ————————————————————————————————————————————
// 1. PushIn
// ————————————————————————————————————————————

/**
 * PushIn —— 静帧缓推（Ken Burns）
 *
 * **什么时候用**：任何静止的画面要停留 2 秒以上 —— 截图、封面、照片、纯色卡片、
 * 一张没人动的图表。给它一点向前的速度，画面就「活着」，不然就是 PPT。
 *
 * **别怎么用**：
 * - 别在已经有别的主动效的画面上再叠一个（一屏 ≤2 个运动元素，PushIn 算一个）。
 * - `to` 别超过 1.1：推得越狠越像业余剪辑，1.06 是舒服的上限。
 * - 别用它做「入场」：PushIn 全程都在动，入场该用 MaskWipe / FocusRack / Stagger。
 * - `durationInFrames` 请传你这一段的**总帧数**（库无法自己知道父 Sequence 多长），
 *   不传就用默认 90 帧，超出的部分会停在终点不动（不会回弹）。
 */
export type PushInProps = {
  children: ReactNode;
  /** 起始倍率，默认 1 */
  from?: number;
  /** 结束倍率，默认 1.06（SPEC 推荐） */
  to?: number;
  /** 推满这段的帧数，默认 90（3 秒 @30fps）—— 请改成你这段的实际长度 */
  durationInFrames?: number;
  /** 从本地第几帧开始推，默认 0 */
  start?: number;
  /** 曲线，默认 expoOut（前 1/3 快、后面慢） */
  easing?: LegalEasing;
  /** 同时横移的像素数（正=向右），默认 0。想要 Ken Burns 的斜推就给 ±20 左右 */
  panX?: number;
  /** 同时纵移的像素数（正=向下），默认 0 */
  panY?: number;
  /** 缩放锚点，默认画面正中 */
  originX?: number | string;
  originY?: number | string;
  /** 透传给外层的样式（别在这里再写 transform，会被覆盖） */
  style?: CSSProperties;
};

export const PushIn: React.FC<PushInProps> = ({
  children,
  from = 1,
  to = 1.06,
  durationInFrames = 90,
  start = 0,
  easing = 'expoOut',
  panX = 0,
  panY = 0,
  originX = '50%',
  originY = '50%',
  style,
}) => {
  const frame = useCurrentFrame();
  const p = progress({ frame, start, durationInFrames, easing });
  const scale = from + (to - from) * p;
  return (
    <AbsoluteFill
      style={{
        ...SHELL,
        ...style,
        transform: `translate(${panX * p}px, ${panY * p}px) scale(${scale})`,
        transformOrigin: `${originX} ${originY}`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ————————————————————————————————————————————
// 2. Shake
// ————————————————————————————————————————————

/**
 * Shake —— 冲击震动（衰减 3 次）
 *
 * **什么时候用**：报错、重音落下、✓ 盖章、东西砸在画面上。它标记的是「发生了件事」。
 *
 * **别怎么用**：
 * - 别拿它当装饰，一屏最多一次，一段片子最多三四次，多了观众晕。
 * - `start` 必须和 sfx 的那一帧对齐（SPEC 纪律 3），差 1 帧就废了。
 * - 别给整屏文字都挂上，挂在**被砸的那个元素**上。
 * - `amplitude` 别超过 20px：超过就不是震动，是画面坏了。
 * - 它自己会在窗口结束时归零，不需要你做退场。
 */
export type ShakeProps = {
  children: ReactNode;
  /** 起始振幅（px），默认 14（SPEC 推荐） */
  amplitude?: number;
  /** 阻尼，默认 12 —— 越大停得越快；<6 会晃个没完，别调这么小 */
  damping?: number;
  /** 衰减次数（完整来回），默认 3 */
  oscillations?: number;
  /** 震动窗口总帧数，默认 22；结束后强制归零 */
  durationInFrames?: number;
  /** 第几帧开砸（对齐 sfx cue），默认 0 */
  start?: number;
  /** 'kick' = 第一帧就被打歪（更狠，盖章/报错用）；'swing' = 先荡过去（更软） */
  phase?: 'kick' | 'swing';
  /** 往哪个轴晃，默认 'both' */
  axis?: 'x' | 'y' | 'both';
  /** 附带一点转动（度），默认 0.8；不想转就写 0 */
  rotate?: number;
  style?: CSSProperties;
};

export const Shake: React.FC<ShakeProps> = ({
  children,
  amplitude = 14,
  damping = 12,
  oscillations = 3,
  durationInFrames = 22,
  start = 0,
  phase = 'kick',
  axis = 'both',
  rotate = 0.8,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  const inWindow = t >= 0 && t < durationInFrames;

  let dx = 0;
  let dy = 0;
  let dr = 0;
  if (inWindow) {
    const q = t / durationInFrames; // 0→1 走完窗口
    const decay = Math.exp(-damping * q);
    const angle = 2 * Math.PI * oscillations * q;
    const wave = phase === 'kick' ? Math.cos(angle) : Math.sin(angle);
    if (axis !== 'y') dx = amplitude * decay * wave;
    if (axis !== 'x') dy = amplitude * decay * Math.sin(angle * 1.13) * 0.55;
    dr = rotate * decay * wave;
  }

  return (
    <AbsoluteFill
      style={{ ...SHELL, ...style, transform: `translate(${dx}px, ${dy}px) rotate(${dr}deg)` }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ————————————————————————————————————————————
// 3. MaskWipe
// ————————————————————————————————————————————

/**
 * MaskWipe —— 遮罩擦入（clip-path）
 *
 * **什么时候用**：大字幕、色块、标题条进场。它是「刀」的替代品 ——
 * 想要硬切的利落感，但又不想真的硬切（SPEC 纪律 5 要求 ≥4 帧缓冲），就用它。
 *
 * **别怎么用**：
 * - 别用它擦小于一行字的元素，看不清。
 * - 外壳是 `inline-block`：**跟着父层排版走**，不会把内容顶到左上角。要整屏擦一个色块，
 *   传 `style={{display:'block', width:'100%', height:'100%'}}`。
 * - 帧数别超过 12（默认 10）：擦得太慢就变成淡入了。
 * - `direction` 要和内容读序一致：中文标题用 'left'（从左往右揭），别用 'up'。
 * - 别和 Stagger **同时**进场（两个都是进场主角，会打架）；错开 ≥20 帧可以叠用，
 *   组合镜头就是这么排的。
 */
export type MaskWipeProps = {
  children: ReactNode;
  /** 'left'=从左往右揭；'right'=从右往左；'up'=从下往上；'down'=从上往下。默认 'left' */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** 入场窗口帧数，默认 10（合规区间 8-12） */
  durationInFrames?: number;
  start?: number;
  /** 曲线，默认 expoOut */
  easing?: LegalEasing;
  /** 'in' 擦进来；'out' 擦走（退场用，帧数请给 4-6） */
  mode?: 'in' | 'out';
  /** 前缘羽化（px），默认 0 = 锐利刀口。要柔和质感给 40-120 */
  featherPx?: number;
  style?: CSSProperties;
};

export const MaskWipe: React.FC<MaskWipeProps> = ({
  children,
  direction = 'left',
  durationInFrames = 10,
  start = 0,
  easing = 'expoOut',
  mode = 'in',
  featherPx = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = progress({ frame, start, durationInFrames, easing, exit: mode === 'out' });

  /**
   * 外壳用 inline-block：**跟着父层的排版走**，不改变布局。
   * 要整屏擦（比如一个色块铺满）就自己传 `style={{display:'block', width:'100%', height:'100%'}}`。
   */
  const box: CSSProperties = { display: 'inline-block', ...style };

  // featherPx = 0 走 clip-path（Chrome 下最稳、边缘最干净）
  // featherPx > 0 走 mask-image（前缘有柔化，代价是多一层合成）
  if (featherPx <= 0) {
    const hidden = `${(1 - p) * 100}%`;
    const clip =
      direction === 'left'
        ? `inset(0 ${hidden} 0 0)`
        : direction === 'right'
          ? `inset(0 0 0 ${hidden})`
          : direction === 'up'
            ? `inset(${hidden} 0 0 0)`
            : `inset(0 0 ${hidden} 0)`;
    return <div style={{ ...box, clipPath: clip }}>{children}</div>;
  }

  const axisLen = direction === 'left' || direction === 'right' ? width : height;
  const f = clamp((featherPx / axisLen) * 100, 0, 100);
  const head = p * (100 + f); // 前缘（%）
  const tail = Math.max(0, head - f); // 起头（%）
  const gradByDir: Record<NonNullable<MaskWipeProps['direction']>, string> = {
    left: `linear-gradient(90deg, #000 ${tail}%, transparent ${head}%)`,
    right: `linear-gradient(270deg, #000 ${tail}%, transparent ${head}%)`,
    up: `linear-gradient(0deg, #000 ${tail}%, transparent ${head}%)`,
    down: `linear-gradient(180deg, #000 ${tail}%, transparent ${head}%)`,
  };
  const grad = gradByDir[direction];
  return (
    <div style={{ ...box, maskImage: grad, WebkitMaskImage: grad }}>{children}</div>
  );
};

// ————————————————————————————————————————————
// 4. Stagger
// ————————————————————————————————————————————

/**
 * Stagger —— 逐行 / 逐字错峰进场
 *
 * **什么时候用**：列表、终端输出、代码行、要点、多行字幕。一次进来 4 行以上，
 * 只要不是同时进来，观感就上一个档次。
 *
 * **别怎么用**：
 * - `stepInFrames` 别超过 6：超过就变成「一行一行等」，观众以为卡了。
 * - 条目很多（>12 行）时别逐字，改成逐行；逐字只给短标题（≤20 字）。
 * - 别和 MaskWipe 同时进场（都是进场主角）；两者错开 ≥20 帧就没问题。
 * - 退场要比入场快：要退场就传 `exitStart`，窗口默认 5 帧（合规 4-6）。
 * - 超过 6 行的错峰，第一行和最后一行的时间差会 >18 帧，那就不叫错峰了 ——
 *   行数多时把 step 降到 2。
 * - 子元素模式下它是一个**正常流的 flex 列**（一行一块，按 flex-start 左对齐），
 *   不是绝对定位。要居中请在父层用 flex 摆；要横排请传 `style={{flexDirection:'row'}}`。
 */
export type StaggerProps = {
  children?: ReactNode;
  /** 传 text 就走「逐字」模式（和 children 二选一） */
  text?: string;
  /** 每一项错峰多少帧，默认 3（合规区间 2-4） */
  stepInFrames?: number;
  /** 每一项自己的入场窗口，默认 10（合规 8-12） */
  durationInFrames?: number;
  /** 第一项从第几帧开始 */
  start?: number;
  /** 曲线，默认 expoOut；要「落定」的手感用 'spring' */
  easing?: LegalEasing;
  /** 入场方向：'up' 自下升起（默认）/ 'left' / 'scale' / 'fade' 纯淡入（最弱，少用） */
  from?: 'up' | 'left' | 'right' | 'scale' | 'fade';
  /** 位移距离（px），默认 28（'scale' 时是起始倍率差 0.12 的语义，别改这个） */
  distance?: number;
  /** 逐字模式下要不要保留空格宽度（默认 true） */
  preserveSpace?: boolean;
  /** 传给每一项外框的样式 */
  itemStyle?: CSSProperties;
  /** 容器样式 */
  style?: CSSProperties;
  /** 退场起始帧（不传就没有退场）。退场 step 用入场的一半，比进场快 */
  exitStart?: number;
  /** 退场窗口，默认 5（合规 4-6） */
  exitDurationInFrames?: number;
};

type CellStyle = { opacity: number; transform?: string };

/** 逐行落位用的弹簧：一次极轻微回弹（SPEC「最多回弹 1 次」以内）。 */
const SPRING_STAGGER = { damping: 20, mass: 1, stiffness: 130, overshootClamping: false };

const cellEnter = (
  p: number,
  from: NonNullable<StaggerProps['from']>,
  distance: number,
): CellStyle => {
  const hidden = 1 - p;
  switch (from) {
    case 'up':
      return { opacity: clamp(p * 1.4, 0, 1), transform: `translateY(${hidden * distance}px)` };
    case 'left':
      return { opacity: clamp(p * 1.4, 0, 1), transform: `translateX(${-hidden * distance}px)` };
    case 'right':
      return { opacity: clamp(p * 1.4, 0, 1), transform: `translateX(${hidden * distance}px)` };
    case 'scale':
      return {
        opacity: clamp(p * 1.4, 0, 1),
        transform: `scale(${1 - 0.12 * hidden})`,
      };
    case 'fade':
    default:
      return { opacity: clamp(p * 1.4, 0, 1) };
  }
};

export const Stagger: React.FC<StaggerProps> = ({
  children,
  text,
  stepInFrames = 3,
  durationInFrames = 10,
  start = 0,
  easing = 'expoOut',
  from = 'up',
  distance = 28,
  preserveSpace = true,
  itemStyle,
  style,
  exitStart,
  exitDurationInFrames = 5,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isSpring = easing === 'spring';

  // 每一项的 0→1：非 spring 走 expo 曲线，spring 走真弹簧（退场时取反）
  const at = (s: number, dur: number, exit: boolean): number => {
    const raw = isSpring
      ? springProgress({
          frame,
          start: s,
          fps,
          config: SPRING_STAGGER as Partial<SpringConfig>,
          durationInFrames: dur,
        })
      : progress({ frame, start: s, durationInFrames: dur, easing });
    return exit ? 1 - raw : raw;
  };

  // —— 逐字模式 ——
  if (text !== undefined) {
    return (
      <div style={{ ...style, whiteSpace: preserveSpace ? 'pre-wrap' : 'normal' }}>
        {Array.from(text).map((ch, i) => {
          const p = at(start + i * stepInFrames, durationInFrames, false);
          const alive =
            exitStart === undefined
              ? 1
              : 1 - at(exitStart + i * stepInFrames * 0.5, exitDurationInFrames, true);
          const cell = cellEnter(p, from, distance);
          return (
            <span
              key={`${i}-${ch}`}
              style={{ display: 'inline-block', ...cell, opacity: cell.opacity * alive }}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          );
        })}
      </div>
    );
  }

  // —— 逐子元素模式：正常文档流，一行一块（不是各自绝对定位，否则会叠在一起）——
  const list = Children.toArray(children);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}>
      {list.map((child, i) => {
        const p = at(start + i * stepInFrames, durationInFrames, false);
        const alive =
          exitStart === undefined
            ? 1
            : 1 - at(exitStart + i * stepInFrames * 0.5, exitDurationInFrames, true);
        const cell = cellEnter(p, from, distance);
        return (
          <div key={i} style={{ ...cell, ...itemStyle, opacity: cell.opacity * alive }}>
            {child}
          </div>
        );
      })}
    </div>
  );
};

// ————————————————————————————————————————————
// 5. Parallax
// ————————————————————————————————————————————

/**
 * Parallax —— 前后景反向位移（造空间感）
 *
 * **什么时候用**：一张图有「底图 + 浮在上面的东西」（文字卡、手机框、贴图），
 * 想让画面有厚度。也用在开场推镜、场景切换后的定格。
 *
 * **别怎么用**：
 * - **只有两层**。这是刻意的：SPEC 纪律说一屏运动元素 ≤2，加第三层就不合规了。
 * - 两层必须**反向**位移（前景向右、背景向左）。同向又一起缩放 = PPT 感（禁用清单第 2 条）。
 * - 背景位移的绝对值必须小于前景（默认 10 < 18），否则「厚的在下面」这个错觉会反过来。
 * - 别在背景是纯色时用它 —— 纯色看不出位移，白花时间。
 */
export type ParallaxProps = {
  /** 远景层（会被压在下面） */
  background: ReactNode;
  /** 近景层（浮在上面） */
  foreground: ReactNode;
  /** 前景位移（px），默认 +18 */
  foreX?: number;
  /** 背景位移（px），默认 -10 */
  backX?: number;
  foreY?: number;
  backY?: number;
  /** 走完这段位移用多少帧，默认 30 */
  durationInFrames?: number;
  start?: number;
  /** 曲线，默认 expoInOut（一个「镜头平移」的手感；要快速定住用 'expoOut'） */
  easing?: LegalEasing;
  /** 'drift' 位移逐渐走开（默认）；'settle' 一开始带着位移、然后定回原位 */
  mode?: 'drift' | 'settle';
  /** 背景再加一点糊（px），默认 0，要就 2-4 */
  backBlur?: number;
  /** 前景浮起阴影，默认 true */
  foreShadow?: boolean;
  style?: CSSProperties;
};

export const Parallax: React.FC<ParallaxProps> = ({
  background,
  foreground,
  foreX = 18,
  backX = -10,
  foreY = 0,
  backY = 0,
  durationInFrames = 30,
  start = 0,
  easing = 'expoInOut',
  mode = 'drift',
  backBlur = 0,
  foreShadow = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const p = progress({ frame, start, durationInFrames, easing });
  // drift：p=0 在原位，p=1 时前景 +foreX、背景 +backX（反向，这就是「厚度」）
  // settle：反过来，开场就带着位移，p=1 定回原位（切镜后定格的用法）
  const k = mode === 'drift' ? p : 1 - p;
  return (
    <AbsoluteFill style={{ ...SHELL, ...style }}>
      <AbsoluteFill
        style={{
          ...SHELL,
          transform: `translate(${backX * k}px, ${backY * k}px)`,
          filter: backBlur > 0 ? `blur(${backBlur}px)` : undefined,
        }}
      >
        {background}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          ...SHELL,
          transform: `translate(${foreX * k}px, ${foreY * k}px)`,
          boxShadow: foreShadow ? '0 40px 90px rgba(0,0,0,0.35)' : undefined,
          zIndex: 1,
        }}
      >
        {foreground}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ————————————————————————————————————————————
// 6. FocusRack
// ————————————————————————————————————————————

/**
 * FocusRack —— 景深转移（糊 → 实）
 *
 * **什么时候用**：场景切入的第一下、倒带/回看之后定格、把观众视线「交给」某个东西。
 * 它是 SPEC 里指定的两种转场缓冲之一（另一个是 MotionBlur）。
 *
 * **别怎么用**：
 * - 帧数别超过 10（默认 8）：糊太久观众以为是画质坏了。
 * - 必须配 scale 0.98→1（默认已带）。只做 blur 不做 scale，就没有「镜头在调焦」的感觉。
 * - 别拿它当退场（退场 4-6 帧，来不及看清调焦）。
 * - 挂 blur 的层要有实色背景，不然糊的时候边缘会透出后面的东西，一眼假。
 * - `fromBlur` 别超过 14：那是雾，不是景深。
 */
export type FocusRackProps = {
  children: ReactNode;
  /** 起始模糊（px），默认 10 */
  fromBlur?: number;
  /** 结束模糊（px），默认 0 */
  toBlur?: number;
  /** 起始倍率，默认 0.98（SPEC 推荐） */
  fromScale?: number;
  toScale?: number;
  /** 窗口帧数，默认 8（合规 6-10） */
  durationInFrames?: number;
  start?: number;
  easing?: LegalEasing;
  /** 顺手带一点淡入，默认 false（一般不需要，blur 已经够「进场」了） */
  fadeIn?: boolean;
  style?: CSSProperties;
};

export const FocusRack: React.FC<FocusRackProps> = ({
  children,
  fromBlur = 10,
  toBlur = 0,
  fromScale = 0.98,
  toScale = 1,
  durationInFrames = 8,
  start = 0,
  easing = 'expoOut',
  fadeIn = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const p = progress({ frame, start, durationInFrames, easing });
  const blur = fromBlur + (toBlur - fromBlur) * p;
  const scale = fromScale + (toScale - fromScale) * p;
  return (
    <AbsoluteFill
      style={{
        ...SHELL,
        ...style,
        filter: `blur(${blur}px)`,
        transform: `scale(${scale})`,
        opacity: fadeIn ? p : 1,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ————————————————————————————————————————————
// 7. Grain
// ————————————————————————————————————————————

/**
 * Grain —— 胶片噪点覆盖
 *
 * **什么时候用**：**全片挂一次**，挂在最外层、盖住所有场景。它把 AI 生成的干净感
 * 压掉，让不同来源的画面看起来是同一台机器拍的。
 *
 * **别怎么用**：
 * - 每个场景都挂一遍 = 噪点强度翻倍，还白白拖慢渲染。就挂一层。
 * - `opacity` 别超过 0.07（默认 0.05）。超过 0.1 就不是质感，是脏。
 * - 觉得噪点不够明显，请调 `contrast`（默认 2），别去抬 `opacity`。
 * - 深底色的干净数据图上要酌情调低（0.03-0.04），别照抄默认值糊满。
 * - `seedStride` 别设 1：每帧换 seed 会变成剧烈抖动，眼睛难受。默认 2 帧是甜点。
 * - 要文字绝对锐利（比如极小注释）时，别用全屏 Grain，改局部。
 */
export type GrainProps = {
  /** 总强度，默认 0.05（合规区间 0.04-0.07） */
  opacity?: number;
  /** 每几帧换一次噪声种子，默认 2 */
  seedStride?: number;
  /** 颗粒粗细：值越大颗粒越细，默认 0.72（0.5=粗砂，1.0=细尘） */
  baseFrequency?: number;
  /** 叠几层噪声，默认 1（2 会更「花」但明显变慢，且第二层已接近混叠） */
  numOctaves?: number;
  /**
   * 噪声自身的反差增益，默认 2.0 —— 这个数决定噪点**真的看得见**。
   * 1 = 原始湍流（实测帧内高频只多 0.6/255，等于没有）；2.0 ≈ 3 级颗粒（胶片感）；
   * >3 会变雪花屏。SPEC 说的 0.04-0.07 是 `opacity`，别拿它当强度旋钮用。
   */
  contrast?: number;
  /** 混合模式，默认 'overlay'（深底上更自然）；灰脏感用 'soft-light' */
  blend?: CSSProperties['mixBlendMode'];
  /** 固定种子（不传就跟着帧号走） */
  seed?: number;
  style?: CSSProperties;
};

export const Grain: React.FC<GrainProps> = ({
  opacity = 0.05,
  seedStride = 2,
  baseFrequency = 0.72,
  numOctaves = 1,
  contrast = 2,
  blend = 'overlay',
  seed,
  style,
}) => {
  const frame = useCurrentFrame();
  const id = useSafeId();
  const s = seed ?? Math.floor(frame / Math.max(1, seedStride));
  // 用 R 通道当灰度噪声源，并把 alpha 拉满 —— 否则 feTurbulence 的随机 alpha
  // 会让噪点在低 opacity 下几乎不可见（实测帧内高频只多 0.6/255）。
  const slope = clamp(contrast, 0.5, 4);
  const intercept = 0.5 - slope / 2;
  return (
    <svg
      aria-hidden
      style={{ ...SHELL, ...style, opacity, mixBlendMode: blend, pointerEvents: 'none' }}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <filter
        id={id}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency={baseFrequency}
          numOctaves={numOctaves}
          seed={s}
          stitchTiles="stitch"
          result="noise"
        />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"
        />
        <feComponentTransfer>
          <feFuncR type="linear" slope={slope} intercept={intercept} />
          <feFuncG type="linear" slope={slope} intercept={intercept} />
          <feFuncB type="linear" slope={slope} intercept={intercept} />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
};

// ————————————————————————————————————————————
// 8. Vignette
// ————————————————————————————————————————————

/**
 * Vignette —— 暗角
 *
 * **什么时候用**：和 Grain 一起，**全片挂一次**。它把视线收拢到画面中心，
 * 顺手解决「文字压在亮背景上看不清」。
 *
 * **别怎么用**：
 * - 别每个场景挂一次（叠了会糊成一圈黑）。
 * - `strength` 别超过 0.5（默认 0.35）：那是隧道，不是暗角。
 * - 已经有一整块深色背景的镜头，它可以省；但也别因此单独关掉一半镜头 ——
 *   忽有忽无比一直有更容易被看出来。
 * - 别让它压到字幕安全区以外的信息（角标、来源标注），必要时只压上下边。
 */
export type VignetteProps = {
  /** 边缘黑的不透明度，默认 0.35（SPEC 推荐） */
  strength?: number;
  /**
   * 从画面半径的多外侧开始变暗（0-1），默认 0.52。
   * 几何：椭圆半径 = 画面的一半，所以 100% 那一档正好落在四个角上 —— 角上是真的 `strength` 黑。
   * 想更含蓄：抬 `spread`（0.65 起）或降 `strength`（0.25），别两个都动。
   */
  spread?: number;
  /** 暗角颜色，默认 '#000' */
  color?: string;
  /** 'ellipse' 常规（默认）；'linear' 只在上下压边 */
  shape?: 'ellipse' | 'linear';
  /** 缓慢呼吸（次/秒），默认 0 = 不呼吸 */
  breathe?: number;
  style?: CSSProperties;
};

export const Vignette: React.FC<VignetteProps> = ({
  strength = 0.35,
  spread = 0.52,
  color = '#000',
  shape = 'ellipse',
  breathe = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wob = breathe > 0 ? 0.06 * Math.sin((2 * Math.PI * breathe * frame) / fps) : 0;
  const mid = Math.round(clamp(spread + wob, 0, 0.95) * 100);
  const background =
    shape === 'ellipse'
      ? // 半径取画面的一半：100% 那一档正好落在四个角上，边缘才是真的 0.35 黑
        `radial-gradient(ellipse 50% 50% at 50% 50%, transparent ${mid}%, ${color} 100%)`
      : `linear-gradient(180deg, ${color} 0%, transparent ${mid}%, transparent ${100 - mid}%, ${color} 100%)`;
  return (
    <AbsoluteFill
      aria-hidden
      style={{ ...SHELL, ...style, background, opacity: strength, pointerEvents: 'none' }}
    />
  );
};

// ————————————————————————————————————————————
// 9. MotionBlur
// ————————————————————————————————————————————

/**
 * MotionBlur —— 快速位移的伪拖影
 *
 * **什么时候用**：甩镜头、硬切前的缓冲（SPEC 纪律 5 指定的两种之一）、任何
 * 一帧走超过 40px 的东西。没有拖影的高速位移，看着就是「贴图瞬移」。
 *
 * **别怎么用**：
 * - 慢的东西别挂（它自己会按速度收掉强度，挂错只是浪费合成）。
 * - `layers` 别超过 5：那是残影复读机。默认 3。
 * - 它只处理 **translate**。带 scale/rotate 的快速运动请自己写 ghost，别硬塞。
 * - 位移函数必须**每帧可算**（纯函数、不能随机），不然渲染出来每帧不一样。
 * - 别和 Shake 同时挂在同一元素上（两个都在改 transform，会互相吃掉）。
 */
export type MotionBlurProps = {
  children: ReactNode;
  /** 该元素在每一帧的横向位移（px）。纯函数，必须能对任意 frame 求值。 */
  x?: (frame: number) => number;
  /** 纵向位移（px） */
  y?: (frame: number) => number;
  /** 拖影层数，默认 3（合规上限 5） */
  layers?: number;
  /** 拖影基准不透明度，默认 0.3 */
  opacity?: number;
  /** 层间隔（帧），默认 1。位移极快时给 1.5-2 才拉得开 */
  trailFrames?: number;
  /** 低于这个速度（px/帧）拖影自动消失，默认 40（SPEC 门槛） */
  minVelocity?: number;
  /** 本地自检：超门槛多少倍时控制台提醒（默认关，别在正式渲染时开） */
  debug?: boolean;
  style?: CSSProperties;
};

export const MotionBlur: React.FC<MotionBlurProps> = ({
  children,
  x = () => 0,
  y = () => 0,
  layers = 3,
  opacity = 0.3,
  trailFrames = 1,
  minVelocity = MOTION_BLUR_THRESHOLD_PX,
  debug = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const pos = (f: number): readonly [number, number] => [x(f), y(f)];
  const cur = pos(frame);
  const prev = pos(frame - 1);
  const speed = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
  // 速度到门槛才有拖影；慢的时候 k→0，等于自动卸掉
  const k = clamp(speed / Math.max(1, minVelocity), 0, 1);
  const n = clamp(Math.round(layers), 1, 5);

  if (debug && speed > minVelocity * 3) {
    console.warn(`[motion-kit] MotionBlur: 速度 ${speed.toFixed(0)}px/帧（门槛 ${minVelocity}）`);
  }

  return (
    <AbsoluteFill style={{ ...SHELL, ...style }}>
      {Array.from({ length: n + 1 }, (_, i) => {
        const isMain = i === n;
        const at = pos(frame - (n - i) * trailFrames);
        const o = isMain ? 1 : opacity * k * Math.pow(0.65, n - i);
        return (
          <AbsoluteFill
            key={i}
            style={{
              ...SHELL,
              opacity: o,
              transform: `translate(${at[0]}px, ${at[1]}px)`,
            }}
          >
            {children}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

/** 该不该挂 MotionBlur（SPEC：位移 > 40px/帧 必挂）。 */
export const needsMotionBlur = (pxPerFrame: number): boolean =>
  pxPerFrame > MOTION_BLUR_THRESHOLD_PX;

// ————————————————————————————————————————————
// 附：排段器（把 SPEC 的 5 条节奏纪律变成会报错的代码）
// ————————————————————————————————————————————

/**
 * 一次「动效事件」。
 * - 入场、退场、震动、擦入、盖章… 每个都算一次。
 * - **一次 Stagger 记作一个事件**（同 group）：它的每一行不是各自独立的动效，
 *   错峰是一次进场的分解动作。
 * - group='camera' 是整段连续的镜头位移（PushIn / Parallax），它不是一个接一个的
 *   动效，所以**不参与停留检查**（纪律 2）。
 */
export type MotionEvent = {
  /** 段内本地帧：这个动效从哪一帧开始 */
  at: number;
  /** 它占多少帧（不传就按 enter 算）。必须落在段内 */
  dur?: number;
  /** 干什么用（报错时会带出来） */
  label: string;
  /** 同一个 group 视为一次动效。默认用 label */
  group?: string;
};

export type SegmentSpec = {
  /** 段名，报错时用 */
  id: string;
  /** 这一段多少帧 */
  durationInFrames: number;
  /** 这一段的入场帧数（8-12）。不写 = 这一段没有入场动作 */
  enter?: number;
  /** 这一段的退场帧数（4-6）。不写 = 这一段不做退场 */
  exit?: number;
  /** 这一段里同时运动的独立元素数（≤2，纪律 4）。一次 Parallax 记 1 */
  moving?: number;
  /** true = 这一段开头是设计标注的「刀」，允许硬切（纪律 5） */
  knife?: boolean;
  /** 这一段里的动效事件（纪律 1/2/5 按它检查）。不写 = 全段静止 */
  events?: MotionEvent[];
};

export type PlannedSegment = SegmentSpec & { from: number };

/**
 * planSegments —— 排时间轴 + 合规自检
 *
 * 把每段列出来，它累加出 `from`，并把 SPEC 的节奏纪律当断言跑一遍：
 * 1. 入场 8-12 帧、退场 4-6 帧，且退场必须比入场快；
 * 2. 两次动效之间必须留够 DWELL_MIN（20）帧停留；
 * 3. 动效窗口不许溢出所在段；
 * 4. 一屏运动元素 ≤2；
 * 5. 非「刀」位的转场必须有 ≥HARD_CUT_BUFFER_MIN（4）帧缓冲。
 *
 * 不合规**直接抛错**，让 Studio / 渲染在本地就炸，而不是做完片子才发现。
 */
export const planSegments = (
  segments: readonly SegmentSpec[],
  opts: { totalFrames?: number } = {},
): PlannedSegment[] => {
  let cursor = 0;
  const out: PlannedSegment[] = [];

  segments.forEach((s, idx) => {
    const tag = `${s.id}`;
    if (s.durationInFrames <= 0) throw new Error(`${tag}: 段长必须 >0`);

    // —— 纪律 1 ——
    if (s.enter !== undefined && (s.enter < ENTER_MIN || s.enter > ENTER_MAX)) {
      throw new Error(`${tag}: 入场 ${s.enter} 帧不在 ${ENTER_MIN}-${ENTER_MAX}`);
    }
    if (s.exit !== undefined && (s.exit < EXIT_MIN || s.exit > EXIT_MAX)) {
      throw new Error(`${tag}: 退场 ${s.exit} 帧不在 ${EXIT_MIN}-${EXIT_MAX}`);
    }
    if (s.enter !== undefined && s.exit !== undefined && s.exit >= s.enter) {
      throw new Error(`${tag}: 退场(${s.exit})必须比入场(${s.enter})快 —— 来得清楚、走得干脆`);
    }

    // —— 纪律 4 ——
    if ((s.moving ?? 0) > MAX_MOVING_ELEMENTS) {
      throw new Error(`${tag}: ${s.moving} 个元素同时在动，上限 ${MAX_MOVING_ELEMENTS}`);
    }

    // —— 纪律 2 + 3：按 group 折叠成「动效」，两次动效之间必须留够停留 ——
    const groups = new Map<string, { group: string; onset: number; end: number; label: string }>();
    for (const ev of s.events ?? []) {
      const g = ev.group ?? ev.label;
      const dur = ev.dur ?? s.enter ?? 0;
      if (ev.at < 0) throw new Error(`${tag}/${ev.label}: 起始帧 ${ev.at} 是负数`);
      if (ev.at + dur > s.durationInFrames) {
        throw new Error(
          `${tag}/${ev.label}: 窗口 ${ev.at}+${dur}=${ev.at + dur} 溢出段长 ${s.durationInFrames}`,
        );
      }
      const prev = groups.get(g);
      groups.set(g, {
        group: g,
        onset: prev ? Math.min(prev.onset, ev.at) : ev.at,
        end: prev ? Math.max(prev.end, ev.at + dur) : ev.at + dur,
        label: prev ? `${prev.label}+${ev.label}` : ev.label,
      });
    }
    const timed = [...groups.values()]
      .filter((g) => g.group !== 'camera')
      .sort((a, b) => a.onset - b.onset);
    for (let i = 1; i < timed.length; i++) {
      const gap = timed[i].onset - timed[i - 1].end;
      if (gap < DWELL_MIN) {
        throw new Error(
          `${tag}: 「${timed[i - 1].label}」定住后只停了 ${gap} 帧就上「${timed[i].label}」，` +
            `不足 ${DWELL_MIN} 帧，观众读不完`,
        );
      }
    }

    // —— 纪律 5：段与段的接缝 ——
    if (idx > 0) {
      const prev = segments[idx - 1];
      const buffer = prev.exit ?? 0;
      if (!s.knife && buffer < HARD_CUT_BUFFER_MIN) {
        throw new Error(
          `${tag}: 开头不是标注的「刀」，但上一段没有 ≥${HARD_CUT_BUFFER_MIN} 帧退场缓冲（只有 ${buffer} 帧）`,
        );
      }
    }

    out.push({ ...s, from: cursor });
    cursor += s.durationInFrames;
  });

  if (opts.totalFrames !== undefined && cursor !== opts.totalFrames) {
    throw new Error(`总长 ${cursor} 帧 ≠ 规定的 ${opts.totalFrames} 帧`);
  }
  return out;
};

/** 供场景里手填参数时的合规区间提示（不做断言，只是给你个数字参考）。 */
export const CADENCE = {
  enter: [ENTER_MIN, ENTER_MAX] as const,
  exit: [EXIT_MIN, EXIT_MAX] as const,
  dwellMin: DWELL_MIN,
  movingMax: MAX_MOVING_ELEMENTS,
  blurThresholdPx: MOTION_BLUR_THRESHOLD_PX,
  cutBufferMin: HARD_CUT_BUFFER_MIN,
};
