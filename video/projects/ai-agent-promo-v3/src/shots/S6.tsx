import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_EXPO_OUT_16, prog } from '../anim';
import { BG_DARK, CORAL, FONT_SANS, WHITE } from '../theme';

// ============================================================================
// 镜6 · 750–810 帧（25.0s–27.0s）白闪 + 「但它没放弃。」 — brief-v3 §三【镜头 6】
// 本地帧：0–6 白闪升 / 6–12 降（expo）；15–27 珊瑚色 72px 文字 blur(12→0)
// expo-out 渐现，停留到本地 51（27 起字 + 24 停留）。
// ============================================================================

export const S6: React.FC = () => {
  const f = useCurrentFrame();
  const flashUp = prog(f, 0, 6, EASE_EXPO_OUT);
  const flashDown = prog(f, 6, 6, EASE_EXPO_OUT);
  const flash = f <= 6 ? flashUp : 1 - flashDown;
  const textP = prog(f, 15, 12, EASE_EXPO_OUT_16);

  return (
    <AbsoluteFill style={{ backgroundColor: BG_DARK }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: WHITE,
          opacity: Math.max(0, flash),
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: 72,
          color: CORAL,
          opacity: textP,
          filter: `blur(${(12 * (1 - textP)).toFixed(2)}px)`,
        }}
      >
        但它没放弃。
      </div>
    </AbsoluteFill>
  );
};
