import React from 'react';
import { useCurrentFrame } from 'remotion';
import { EASE_LINEAR, prog } from '../anim';
import { NARRATION } from '../data/narration';
import { FONT_SANS, FS, INK, RADIUS, SUB_BG, W } from '../theme';

const FADE_IN = 6;
const FADE_OUT = 4;
const CENTER_Y = 990;

// 用全局帧：只能放在 Main.tsx 顶层，不要放进 Sequence
export const Subtitle: React.FC = () => {
  const frame = useCurrentFrame();
  const line = NARRATION.find((l) => frame >= l.from && frame < l.to);
  if (!line) return null;
  const opacity = Math.min(
    prog(frame, line.from, FADE_IN, EASE_LINEAR),
    1 - prog(frame, line.to - FADE_OUT, FADE_OUT, EASE_LINEAR),
  );
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        width: W,
        top: CENTER_Y,
        display: 'flex',
        justifyContent: 'center',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <div
        style={{
          background: SUB_BG,
          borderRadius: RADIUS,
          padding: '10px 32px',
          fontFamily: FONT_SANS,
          fontSize: FS.sub,
          lineHeight: 1.4,
          color: INK,
          maxWidth: W - 160,
          textAlign: 'center',
        }}
      >
        {line.text}
      </div>
    </div>
  );
};
