import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, prog } from '../anim';
import { ledger } from '../data/ledger';
import { FONT_SANS, FS, INK, INK_2, PAPER, RED } from '../theme';

// S6 数字 · 全局 4140–4740（场景相对 0–600）
// 全局 4440–4560（相对 300–420）全静止：所有动画在 300 之前收完，下一个动画 435 才开始。

const X = 160;
const MAX_W = 1600;
const BAR_H = 72;
const TOP_BAR_Y = 270;
const BOTTOM_BAR_Y = 560;

const T_TOP_IN = 0; // 上标签淡入
const T_TOP_BAR = 30; // 4170：上柱 0→满 24 帧
const TOP_BAR_DUR = 24;
const T_BOTTOM = 195; // 4335：下柱 + 105 直接出现
const T_NOT = 435; // 4575：我不追。

const fmt = (n: number) => n.toLocaleString('en-US');

export const S6: React.FC = () => {
  const frame = useCurrentFrame();
  const { pityTop, myBest } = ledger.views;

  const topIn = prog(frame, T_TOP_IN, 10, EASE_EXPO_OUT);
  const grow = prog(frame, T_TOP_BAR, TOP_BAR_DUR, EASE_EXPO_OUT);
  const topW = (pityTop / pityTop) * MAX_W * grow;
  const topNum = Math.round(pityTop * grow);

  const bottomW = Math.max(3, (myBest / pityTop) * MAX_W);
  const bottomLabelIn = prog(frame, T_BOTTOM, 10, EASE_EXPO_OUT);
  const notIn = prog(frame, T_NOT, 10, EASE_EXPO_OUT);

  return (
    <AbsoluteFill style={{ background: PAPER, fontFamily: FONT_SANS }}>
      {/* 上：余额只剩一块钱的那条 */}
      <div
        style={{
          position: 'absolute',
          left: X,
          top: TOP_BAR_Y - 90,
          fontSize: FS.body,
          lineHeight: '60px',
          color: INK_2,
          opacity: topIn,
        }}
      >
        余额只剩一块钱的那条
      </div>
      {frame >= T_TOP_BAR ? (
        <div
          style={{
            position: 'absolute',
            right: 1920 - (X + MAX_W),
            top: TOP_BAR_Y - 130,
            fontSize: FS.hero,
            lineHeight: '120px',
            fontWeight: 700,
            color: INK,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmt(topNum)}
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: X, top: TOP_BAR_Y, width: topW, height: BAR_H, background: INK }} />

      {/* 下：我最好的一条 */}
      {frame >= T_BOTTOM ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: X,
              top: BOTTOM_BAR_Y - 90,
              fontSize: FS.body,
              lineHeight: '60px',
              color: INK_2,
              opacity: bottomLabelIn,
            }}
          >
            我最好的一条
          </div>
          <div style={{ position: 'absolute', left: X, top: BOTTOM_BAR_Y, width: bottomW, height: BAR_H, background: RED }} />
          <div
            style={{
              position: 'absolute',
              left: X + bottomW + 28,
              top: BOTTOM_BAR_Y + BAR_H / 2 - 60,
              fontSize: FS.hero,
              lineHeight: '120px',
              fontWeight: 700,
              color: INK,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmt(myBest)}
          </div>
        </>
      ) : null}

      {/* 4575：我不追。 */}
      {frame >= T_NOT ? (
        <div
          style={{
            position: 'absolute',
            right: X,
            top: 760,
            fontSize: FS.title,
            lineHeight: '90px',
            color: INK,
            opacity: notIn,
            transform: `translateY(${16 * (1 - notIn)}px)`,
          }}
        >
          我不追。
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
