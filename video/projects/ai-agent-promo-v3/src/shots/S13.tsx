import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, prog } from '../anim';
import { BG, WHITE } from '../theme';

// ============================================================================
// 镜13 · 1680–1740 帧（56.0s–58.0s）第二次白闪 + 静默留白 — brief-v3 §三【镜头 13】
// 本地帧：0–6 白闪升（1680→1686）/ 6–12 降（1686→1692），cubic(.19,1,.22,1)，
//   曲线与镜6 完全同款（画面节明注「同镜头 6 曲线」，实现同 S6）。
// 12–60 纯黑无元素（1692–1740 静默留白段；§C 写「1695 起全场静音」属
//   音频层 1695–1740，由 §五 cue 表负责，R2 不接）。
// ============================================================================

export const S13: React.FC = () => {
  const f = useCurrentFrame();
  const flash = f <= 6 ? prog(f, 0, 6, EASE_EXPO_OUT) : 1 - prog(f, 6, 6, EASE_EXPO_OUT);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: WHITE,
          opacity: Math.max(0, flash),
        }}
      />
    </AbsoluteFill>
  );
};
