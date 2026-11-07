import type { CSSProperties } from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';

// 入场: fade + 上移 30px / 300ms (brief 动效基线)
// frame 用场景内的本地帧, delay 是入场起始的本地帧
export const enter = (frame: number, delay = 0): CSSProperties => {
  const p = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 200, overshootClamping: true },
  });
  return {
    opacity: Math.max(0, Math.min(1, p)),
    transform: `translateY(${(1 - Math.max(0, Math.min(1, p))) * 30}px)`,
  };
};

// 退场: 200ms fade (startFrame 为场景本地帧)
export const exitFade = (frame: number, startFrame: number): CSSProperties => ({
  opacity: interpolate(frame, [startFrame, startFrame + 6], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }),
});

// 数字滚动计数器: ease-out 800ms = 24 帧 @30fps
export const countUp = (frame: number, target: number, delay = 0): number => {
  const p = interpolate(frame - delay, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.round(target * (1 - Math.pow(1 - p, 3))); // ease-out cubic
};

export const useFps = (): number => useVideoConfig().fps;
