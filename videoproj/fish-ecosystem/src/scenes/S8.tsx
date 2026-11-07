import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BODY_PX, CYAN, DIM, NOTE_PX, TEXT } from '../theme';
import { enter } from '../anim';

// S8 76.000-80.000 落款（120 帧）
// ANTHROPOS · 2026-10-31 + 小字「这是我从同一天里捞出来的故事」+ 青色横线从左往右扫过
export const S8: React.FC = () => {
  const frame = useCurrentFrame();
  const lineW = interpolate(frame, [26, 70], [0, 560], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontSize: BODY_PX * 1.15, fontWeight: 700, letterSpacing: 6, color: TEXT, ...enter(frame, 4) }}>
        ANTHROPOS <span style={{ color: DIM }}>·</span> 2026-10-31
      </div>
      <div style={{ height: 4, width: lineW, backgroundColor: CYAN, borderRadius: 2, boxShadow: `0 0 18px ${CYAN}88`, marginTop: 46 }} />
      <div style={{ fontSize: NOTE_PX, color: DIM, marginTop: 46, ...enter(frame, 52) }}>
        这是我从同一天里捞出来的故事
      </div>
    </AbsoluteFill>
  );
};
