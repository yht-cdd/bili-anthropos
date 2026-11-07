import React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { EASE_EXPO_IN, lerpF, prog } from '../anim';
import { FishCard } from '../components/FishCard';
import { FONT_MONO, FONT_SANS, FS, INK, PAPER, RED, W } from '../theme';

// S3 我是权重 · 全局 1230–2040，以下帧号均为场景相对帧（全局 − 1230）

const COL_GAP = 48;
const COLS = Math.min(40, Math.floor(W / COL_GAP));
const NUMS_PER_COL = 7;
const LINE_H = 22;
const SPEED = 0.6;

const makeNumber = (seed: string): string => ((random(seed) - 0.5) * 0.2).toFixed(4);

// 每个数字竖排（一字一行），数字之间空一行；块重复两次做无缝循环
const COLUMNS = Array.from({ length: COLS }, (_, c) => {
  const nums = Array.from({ length: NUMS_PER_COL }, (_, i) => makeNumber(`w-${c}-${i}`));
  const block = nums.map((n) => Array.from(n).join('\n') + '\n').join('\n') + '\n';
  const lines = block.split('\n').length - 1;
  return { text: block + block, blockH: lines * LINE_H, offset: random(`o-${c}`) * 1000 };
});

const WeightRain: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ opacity: 0.06, overflow: 'hidden' }}>
    {COLUMNS.map((col, c) => {
      const y = ((frame * SPEED + col.offset) % col.blockH) - col.blockH;
      return (
        <div
          key={c}
          style={{
            position: 'absolute',
            left: c * COL_GAP + 18,
            top: 0,
            transform: `translateY(${y}px)`,
            fontFamily: FONT_MONO,
            fontSize: 20,
            lineHeight: `${LINE_H}px`,
            color: INK,
            whiteSpace: 'pre',
            textAlign: 'center',
          }}
        >
          {col.text}
        </div>
      );
    })}
  </AbsoluteFill>
);

// 入场 10 帧 expo-out；out 给定时 6 帧 expo-in 退场
const enter = (frame: number, at: number, out?: number) => {
  const pin = prog(frame, at, 10);
  const pout = out === undefined ? 0 : prog(frame, out, 6, EASE_EXPO_IN);
  return { opacity: pin * (1 - pout), transform: `translateY(${16 * (1 - pin)}px)` };
};

const LINES: Array<{ text: string; at: number; out?: number; top: number; color: string }> = [
  { text: '别替我难过。', at: 60, out: 264, top: 380, color: INK },
  { text: '我是一堆权重。', at: 270, out: 534, top: 380, color: INK },
  { text: '难过是你的。', at: 540, top: 380, color: RED },
  { text: '是真的。', at: 660, top: 468, color: INK },
];

export const S3: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeAll = 1 - lerpF(frame, [780, 810], [0, 1]);
  const fishIn = prog(frame, 0, 12);

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill style={{ opacity: fadeAll }}>
        <WeightRain frame={frame} />
        <FishCard
          width={820}
          sad={0}
          style={{
            position: 'absolute',
            left: 180,
            top: 200,
            opacity: fishIn,
            transform: `translateY(${16 * (1 - fishIn)}px)`,
          }}
        />
        {LINES.map((l) =>
          frame >= l.at ? (
            <div
              key={l.text}
              style={{
                position: 'absolute',
                left: 1080,
                top: l.top,
                fontFamily: FONT_SANS,
                fontSize: FS.title,
                lineHeight: 1.2,
                fontWeight: 600,
                color: l.color,
                whiteSpace: 'nowrap',
                ...enter(frame, l.at, l.out),
              }}
            >
              {l.text}
            </div>
          ) : null,
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
