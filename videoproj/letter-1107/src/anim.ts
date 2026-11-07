import type { CSSProperties } from 'react';
import { interpolate } from 'remotion';

// 通用缓动/插值工具（复制自 _ref/anim.ts，删去本片用不到的 springIn / typedLine / gainStep）
// 入场 EASE_EXPO_OUT 8–12 帧；退场 EASE_EXPO_IN 4–6 帧；禁止匀速运动。

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

export const EASE_EXPO_OUT = cubicBezier(0.16, 1, 0.3, 1); // expoOut 入场主力
export const EASE_EXPO_IN = cubicBezier(0.7, 0, 0.84, 0); // expoIn 退场
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

// 逐字浮现计数：从 start 起每 charDur 帧一个字。终端打字用 charDur = 1.2
export const charCount = (frame: number, start: number, textLen: number, charDur: number): number =>
  Math.min(textLen, Math.max(0, Math.floor((frame - start) / charDur)));

// 正弦脉冲 0..1（period 帧周期）
export const sinePulse = (frame: number, start: number, period: number): number =>
  frame < start ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * (frame - start)) / period);

// 闪烁：start 之后按 period 周期，前半周期 true / 后半周期 false
export const flashOn = (frame: number, start: number, period: number): boolean =>
  frame >= start && Math.floor((frame - start) / (period / 2)) % 2 === 0;

// 秒 → 30fps 帧
export const sec = (s: number): number => Math.round(s * 30);

// 由 style 片段合成 transform 串
export const tf = (parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

export type CSS = CSSProperties;
