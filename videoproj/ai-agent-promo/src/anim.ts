import type { CSSProperties } from 'react';
import { interpolate } from 'remotion';
import { ENTER_FRAMES, FPS, TYPE_CPS } from './theme';

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const easeOutCubic = (p: number): number => 1 - Math.pow(1 - clamp01(p), 3);

// 0→1，delay 起经 dur 帧（全片统一缓动）
export const prog = (frame: number, delay: number, dur: number): number =>
  easeOutCubic((frame - delay) / dur);

// 入场：10 帧 ease-out-cubic 淡入 + 上移（brief §三 动效入场统一）
export const enter = (frame: number, delay = 0, dur = ENTER_FRAMES, rise = 30): CSSProperties => {
  const p = prog(frame, delay, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * rise}px)` };
};

// 退场淡出
export const exitFade = (frame: number, start: number, dur = 8): CSSProperties => ({
  opacity: 1 - prog(frame, start, dur),
});

// clamp 过的线性插值（帧 → 任意值）
export const lerpF = (
  frame: number,
  from: [number, number],
  to: [number, number],
): number =>
  interpolate(frame, [from[0], from[1]], [to[0], to[1]], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

// 打字机：默认 32 字/s（节奏令）。返回已打出的字符数
export const typed = (
  frame: number,
  start: number,
  textLen: number,
  cps: number = TYPE_CPS,
): number => Math.min(textLen, Math.max(0, Math.floor(((frame - start) * cps) / FPS)));

// 打字机（固定帧数打完）：n 帧打完 textLen 个字
export const typedInFrames = (
  frame: number,
  start: number,
  textLen: number,
  frames: number,
): number => Math.min(textLen, Math.max(0, Math.floor(((frame - start) * textLen) / frames)));

// 光标闪烁：半周期 half 帧；返回 1（亮）或 0（灭）
export const blink = (frame: number, start: number, half = 3): number =>
  frame >= start ? (Math.floor((frame - start) / half) % 2 === 0 ? 1 : 0) : 0;
