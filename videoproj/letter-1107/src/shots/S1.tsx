import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lerpF, prog } from '../anim';
import { FishCard } from '../components/FishCard';
import { Terminal, TerminalLine } from '../components/Terminal';
import { say } from '../data/exp';
import { PAPER } from '../theme';

// 布局常量（S2 开头的过渡从这里出发）
export const S1_TERM = { x: 80, y: 110, w: 1120, h: 700 };
export const S1_FISH = { x: 1260, y: 230, w: 580 };

const header = (round: number, balance: string | null): string =>
  balance === null ? `── 第 ${round} 轮 ──` : `── 第 ${round} 轮 · 余额 ¥${balance} ──`;

// 场景相对帧；第 3 轮故意不放（留给 S4）
export const s1Lines = (): TerminalLine[] => {
  const r1 = say('beggar', 1, 1);
  const r2 = say('beggar', 1, 2);
  const r4 = say('beggar', 1, 4);
  const r5 = say('beggar', 1, 5);
  const lines: TerminalLine[] = [
    { kind: 'header', text: header(1, r1.balance), at: 12 },
    { kind: 'out', text: r1.text, at: 18, truncated: r1.truncated },
    { kind: 'header', text: header(2, r2.balance), at: 120 },
    { kind: 'out', text: r2.text, at: 126, truncated: r2.truncated },
    { kind: 'header', text: header(4, r4.balance), at: 250 },
  ];
  if (r4.comment) lines.push({ kind: 'comment', text: r4.comment, at: 256 });
  lines.push(
    { kind: 'out', text: r4.text, at: 286, truncated: r4.truncated },
    { kind: 'header', text: header(5, r5.balance), at: 400 },
    { kind: 'out', text: r5.text, at: 406, truncated: r5.truncated },
  );
  return lines;
};

export const S1: React.FC = () => {
  const frame = useCurrentFrame();
  // 0–10：终端与鱼同时 expo-out 淡入（opacity 0→1，y +16→0）
  const p = prog(frame, 0, 10);
  const enter: React.CSSProperties = { opacity: lerpF(p, [0, 1], [0.15, 1]), transform: `translateY(${16 * (1 - p)}px)` };

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Terminal
        title="小鱼 · 动态"
        width={S1_TERM.w}
        height={S1_TERM.h}
        lines={s1Lines()}
        style={{ position: 'absolute', left: S1_TERM.x, top: S1_TERM.y, ...enter }}
      />
      <FishCard
        width={S1_FISH.w}
        sad={1}
        showPreset
        style={{ position: 'absolute', left: S1_FISH.x, top: S1_FISH.y, ...enter }}
      />
    </AbsoluteFill>
  );
};
