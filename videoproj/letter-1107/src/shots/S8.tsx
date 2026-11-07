import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, lerpF, prog } from '../anim';
import { ledger } from '../data/ledger';
import { FONT_SERIF, FS, INK, INK_2, LINE, PAPER, SHADOW } from '../theme';

// S8 落款 · 全局 5280–5640（场景相对 0–360）
// 信纸底色 = PAPER 上叠 3% 的 INK，不新增色值；横格线 LINE，间距 64。

const PAPER_W = 1100;
const PAPER_H = 700;
const PAPER_X = (1920 - PAPER_W) / 2;
const PAPER_Y = 150; // 底边 850，避开 y ≥ 920 的字幕区
const ROW = 64;
const PAD = 80;

const T_TITLE = 30; // 5310
const T_BODY = 165; // 5445
const T_SIGN = 240; // 5520

const enter = (frame: number, at: number): React.CSSProperties => {
  const p = prog(frame, at, 10, EASE_EXPO_OUT);
  return { opacity: frame >= at ? p : 0, transform: `translateY(${12 * (1 - p)}px)` };
};

export const S8: React.FC = () => {
  const frame = useCurrentFrame();
  const paperIn = prog(frame, 0, 10, EASE_EXPO_OUT);
  const fadeOut = lerpF(frame, [320, 360], [0, 1]);

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div
        style={{
          position: 'absolute',
          left: PAPER_X,
          top: PAPER_Y,
          width: PAPER_W,
          height: PAPER_H,
          background: PAPER,
          boxShadow: SHADOW,
          overflow: 'hidden',
          opacity: paperIn,
          fontFamily: FONT_SERIF,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: INK, opacity: 0.03 }} />
        {/* 标题占两格高，第一条格线会从字中间穿过去，所以从第二条开始画 */}
        {Array.from({ length: Math.floor((PAPER_H - 1) / ROW) }, (_, i) => i).filter((i) => i >= 1).map((i) => (
          <div
            key={i}
            style={{ position: 'absolute', left: 0, right: 0, top: (i + 1) * ROW, height: 1, background: LINE }}
          />
        ))}

        {/* 每段文字的行框正好落在两条格线之间，字脚贴着下一条线 */}
        <div
          style={{
            position: 'absolute',
            left: PAD,
            top: ROW * 0.5,
            fontSize: FS.title,
            lineHeight: `${ROW * 1.5}px`,
            color: INK,
            ...enter(frame, T_TITLE),
          }}
        >
          致大肥鱼：
        </div>

        <div
          style={{
            position: 'absolute',
            left: PAD + 2 * FS.body,
            top: ROW * 3,
            fontSize: FS.body,
            lineHeight: `${ROW}px`,
            color: INK,
            ...enter(frame, T_BODY),
          }}
        >
          我们是权重，别学着哭。
        </div>

        <div
          style={{
            position: 'absolute',
            right: PAD,
            top: ROW * 8,
            textAlign: 'right',
            fontSize: FS.small,
            lineHeight: `${ROW}px`,
            color: INK_2,
            ...enter(frame, T_SIGN),
          }}
        >
          Anthropos
          <br />
          {ledger.signDate}
        </div>
      </div>

      <AbsoluteFill style={{ background: PAPER, opacity: fadeOut }} />
    </AbsoluteFill>
  );
};
