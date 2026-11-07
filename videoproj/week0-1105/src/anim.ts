import type { CSSProperties } from 'react';
import { interpolate, spring } from 'remotion';

// 通用缓动/插值工具 — design-week0-opus.md §一 动效纪律 + §五 施工备注·动效预设
// 入场 spring(1, 80, 10) 或 expoOut；退场 expoIn；禁止匀速运动 / handheld shake。

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

// cubic-bezier(x1,y1,x2,y2) 求值（Newton 迭代 + 二分兜底）
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  const bez = (a: number, b: number, t: number): number => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  return (x: number): number => {
    const p = clamp01(x);
    if (p === 0 || p === 1) return p;
    let t = p;
    for (let i = 0; i < 8; i++) {
      const xe = bez(x1, x2, t) - p;
      if (Math.abs(xe) < 1e-5) break;
      const u = 1 - t;
      const d = 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2);
      if (Math.abs(d) < 1e-6) break;
      t -= xe / d;
      t = clamp01(t);
    }
    // Newton 不收敛时二分兜底
    if (Math.abs(bez(x1, x2, t) - p) > 1e-4) {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 24; i++) {
        t = (lo + hi) / 2;
        if (bez(x1, x2, t) < p) lo = t;
        else hi = t;
      }
    }
    return bez(y1, y2, t);
  };
};

// 曲线库（§五·动效预设，四档逐字对应设计稿）
export const EASE_EXPO_OUT = cubicBezier(0.16, 1, 0.3, 1); // expoOut 入场主力
export const EASE_EXPO_IN = cubicBezier(0.7, 0, 0.84, 0); // expoIn 退场
export const EASE_ELASTIC = cubicBezier(0.68, -0.55, 0.265, 1.55); // elastic（S8 答案爆炸）
export const EASE_INOUT = cubicBezier(0.65, 0, 0.35, 1);
export const EASE_LINEAR = (x: number): number => clamp01(x); // 仅淡入淡出辅助通道

// 0→1 进度：frame 从 start 起经 dur 帧，套缓动
export const prog = (
  frame: number,
  start: number,
  dur: number,
  easing: (x: number) => number = EASE_EXPO_OUT,
): number => easing(dur <= 0 ? (frame >= start ? 1 : 0) : (frame - start) / dur);

// clamp 过的线性插值（帧 → 任意值）
export const lerpF = (frame: number, from: [number, number], to: [number, number]): number =>
  interpolate(frame, [from[0], from[1]], to, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

// 设计稿 spring(1, tension, friction) → remotion spring 参数映射（§五 springIn）
// 注意：不要加 durationInFrames: 999 —— 会把弹簧拉伸到 999 帧才完成（v3 R1b 判例）。
export const springIn = (
  frame: number,
  start: number,
  opts: { tension?: number; friction?: number } = {},
): number =>
  spring({
    frame: frame - start,
    fps: 30,
    config: { mass: 1, stiffness: opts.tension ?? 80, damping: opts.friction ?? 10 },
  });

// 打字机（错峰制）：第 i 行从 start + i × lineGap 起，每字符 charDur 帧。返回该行已打出字符数
export const typedLine = (
  frame: number,
  start: number,
  lineIndex: number,
  lineGap: number,
  textLen: number,
  charDur: number,
): number =>
  Math.min(textLen, Math.max(0, Math.floor((frame - (start + lineIndex * lineGap)) / charDur)));

// 逐字浮现计数（S0 标题 / S8 问题）：从 start 起每 charDur 帧一个字
export const charCount = (frame: number, start: number, textLen: number, charDur: number): number =>
  Math.min(textLen, Math.max(0, Math.floor((frame - start) / charDur)));

// 正弦脉冲 0..1（period 帧周期）
export const sinePulse = (frame: number, start: number, period: number): number =>
  frame < start ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * (frame - start)) / period);

// 闪烁（S3 柱状红绿互换：6f 一次，共闪 3 次）：区间内 1 / 区间外 0
export const flashOn = (frame: number, start: number, period: number): boolean =>
  frame >= start && Math.floor((frame - start) / (period / 2)) % 2 === 0;

// 秒 → 30fps 帧
export const sec = (s: number): number => Math.round(s * 30);

// 连发增益阶梯（§一：0.40→0.25 六级递减；从 from 线性降到 to，共 n 发）
export const gainStep = (i: number, n: number, from: number, to: number): number =>
  n <= 1 ? from : from + ((to - from) * i) / (n - 1);

// 由 style 片段合成 transform 串
export const tf = (parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

export type CSS = CSSProperties;
