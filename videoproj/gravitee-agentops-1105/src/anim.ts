import type { CSSProperties } from 'react';
import { interpolate, spring } from 'remotion';

// 通用缓动/插值工具 — 与 v3 anim.ts 同一实现层（brief §一：动效纪律沿用 shotcraft，
// 入场 8-12 帧 expo-out、退场 4-6 帧、禁 linear 主动效）。

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

// 曲线库（同 v3；linear 仅允许用于淡暗/淡出类辅助通道，主动效禁用）
export const EASE_EXPO_OUT = cubicBezier(0.19, 1.0, 0.22, 1.0); // 主力 expo-out
export const EASE_EXPO_OUT_16 = cubicBezier(0.16, 1, 0.3, 1); // 文字入场变体
export const EASE_INOUT = cubicBezier(0.65, 0, 0.35, 1);
export const EASE_SWEEP = cubicBezier(0.33, 0, 0.15, 1); // 左→右擦除/推入
export const EASE_LINEAR = (x: number): number => clamp01(x);

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

// 设计稿 spring(1, tension, friction) → remotion spring 参数映射
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

// slam 震屏（brief §二·S2「Shake amplitude 10」的实现）：
// 指数衰减阻尼振荡，dur 帧收干；slam-entrance-moves 卡的「啪」在回弹那一下。
export const shakeX = (frame: number, hit: number, amp = 10, dur = 8): number => {
  const t = frame - hit;
  if (t < 0 || t >= dur) return 0;
  return amp * Math.exp(-t / 2.2) * Math.cos(t * 1.9);
};

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

// 光标闪烁：period 帧全周期，半亮半灭（period=4 即 brief S1 的「4 帧快闪」）
export const blink = (frame: number, start: number, period = 12): number =>
  frame >= start ? (Math.floor(((frame - start) % period) / (period / 2)) === 0 ? 1 : 0) : 0;

// 正弦脉冲 0..1（period 帧周期）
export const sinePulse = (frame: number, start: number, period: number): number =>
  frame < start ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * (frame - start)) / period);

// 秒 → 30fps 帧
export const sec = (s: number): number => Math.round(s * 30);

// 由 style 片段合成 transform 串
export const tf = (parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

export type CSS = CSSProperties;
