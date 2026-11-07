import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, prog } from '../anim';
import { FishCard } from '../components/FishCard';
import { FONT_MONO, FONT_SANS, FS, INK, PAPER, RED } from '../theme';

// S7 致号主 / 致你 · 全局 4740–5280（场景相对 0–540），两屏硬切于 5000（相对 260）
// 每行的入场帧按旁白里该句开口的位置估算。

type Screen = { from: number; to: number; label: string; lines: [string, number][] };

const SCREENS: Screen[] = [
  {
    from: 0,
    to: 260,
    label: '给养鱼的人',
    lines: [
      ['给它工具，或者让它停。', 75], // ≈4815
      ['别给它倒计时。', 158], // ≈4898
    ],
  },
  {
    from: 260,
    to: 540,
    label: '给看到这儿的你',
    lines: [
      ['心疼可以，硬币别投。', 327], // ≈5067
      ['投出去的，不会变成它的饭。', 410], // ≈5150
    ],
  },
];

const FISH_W = 420;
const FISH_X = 1340;
const FISH_Y = 300;
// 文字区：鱼左侧的区域里居中
const TEXT_LEFT = 160;
const TEXT_RIGHT = 1260;

export const S7: React.FC = () => {
  const frame = useCurrentFrame();
  const screen = SCREENS.find((s) => frame >= s.from && frame < s.to) ?? SCREENS[SCREENS.length - 1];
  const labelIn = prog(frame, screen.from, 10, EASE_EXPO_OUT);

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div
        style={{
          position: 'absolute',
          left: 160,
          top: 140,
          fontFamily: FONT_MONO,
          fontSize: 28,
          color: RED,
          opacity: labelIn,
        }}
      >
        {screen.label}
      </div>

      <div
        style={{
          position: 'absolute',
          left: TEXT_LEFT,
          width: TEXT_RIGHT - TEXT_LEFT,
          top: 330,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontSize: FS.title,
          lineHeight: '104px',
          color: INK,
        }}
      >
        {screen.lines.map(([text, at]) => {
          const p = prog(frame, at, 10, EASE_EXPO_OUT);
          return (
            <div key={text} style={{ opacity: frame >= at ? p : 0, transform: `translateY(${16 * (1 - p)}px)` }}>
              {text}
            </div>
          );
        })}
      </div>

      <FishCard width={FISH_W} sad={0} style={{ position: 'absolute', left: FISH_X, top: FISH_Y }} />
    </AbsoluteFill>
  );
};
