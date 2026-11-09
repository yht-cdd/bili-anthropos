import React from 'react';
import { useCurrentFrame } from 'remotion';
import { EASE_LINEAR, prog } from '../anim';
import { NARRATION } from '../data/preview';
import { AUDIO_END, FONT_SANS, INK, LETTER_START, RADIUS, SEG } from '../theme';

const FADE_IN = 6;
const FADE_OUT = 4;

// 底字幕：左下角（给右下 PiP 让位），逐行跟口播；行与行之间不黑屏，直接切换
export const Subtitle: React.FC = () => {
  const frame = useCurrentFrame();

  let idx = -1;
  for (let i = 0; i < NARRATION.length; i++) {
    if (frame >= NARRATION[i].from) idx = i;
  }
  if (idx < 0) return null;
  // S-E 题眼本身就是口播原文，字幕会重复，直接让位给大字
  if (frame >= SEG.e && frame < SEG.f) return null;
  // S-F 从信正文起不再走底字幕（信自己排版，见 SF.tsx）；
  // 但 S-F 开头那句「但在那之前…」仍要底字幕，所以不能一刀切到 SEG.e
  if (frame >= LETTER_START) return null;

  const line = NARRATION[idx];
  const end = idx + 1 < NARRATION.length ? NARRATION[idx + 1].from - 2 : AUDIO_END + 2;
  if (frame >= end) return null;

  const opacity = Math.min(
    prog(frame, line.from, FADE_IN, EASE_LINEAR),
    1 - prog(frame, end - FADE_OUT, FADE_OUT, EASE_LINEAR),
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: 80,
        top: 940,
        width: 1240,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          background: 'rgba(8,13,24,0.78)',
          borderLeft: '4px solid rgba(255,255,255,0.35)',
          borderRadius: RADIUS,
          padding: '12px 26px',
          fontFamily: FONT_SANS,
          fontSize: 34,
          lineHeight: 1.45,
          color: INK,
          maxWidth: 1240,
          boxSizing: 'border-box',
        }}
      >
        {line.text}
      </div>
    </div>
  );
};
