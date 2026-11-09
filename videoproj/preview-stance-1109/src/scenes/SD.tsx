import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_IN, EASE_EXPO_OUT, EASE_LINEAR, prog } from '../anim';
import { STANCE } from '../data/preview';
import { BG_2, FONT_SANS, GOLD, INK, INK_2, INK_3, RED } from '../theme';

// S-D（1555–2190 帧，21.2s）：纯色底，三条大字逐行进，最后一行金黄收束。
// 关键帧按**新口播**（138s 版）重排，全局帧 → 本场景局部帧（减 1555）：
//   第一 1611→56 / 第二 1767→212 / token 1885→330 / 第三 1956→401 / 鱼无罪 2060→505
const P1 = 44;
const P2 = 200;
const GOLD_AT = 318;
const P3 = 401;
const P4 = 498;
const REDUCE = 392; // token 金句念完、第二组退场，给第三组让位
const P3_IN = 396; // 第三组进场（口播 401 前 5 帧起步，视觉先到位）
const CLOSE_OUT = 640; // 收束一直留到场景切走（S-E 之前不淡出）

const fade = (frame: number, start: number, end: number): number =>
  Math.min(prog(frame, start, 12, EASE_EXPO_OUT), 1 - prog(frame, end, 10, EASE_EXPO_IN));

export const SD: React.FC = () => {
  const frame = useCurrentFrame();

  const firstOp = fade(frame, P1, 210);
  const secondOp = fade(frame, P2, REDUCE);
  const goldOp = fade(frame, GOLD_AT, REDUCE);
  const thirdOp = fade(frame, P3_IN, 500);
  const closeOp = fade(frame, P4, CLOSE_OUT);

  // 第二组退场后整组上移，给第三组让位（净高度 3×96+70 ≈ 360 → 上移 150）
  const secondShift = frame >= REDUCE ? -150 * prog(frame, P2, REDUCE - P2, EASE_EXPO_OUT) : 0;

  return (
    <AbsoluteFill style={{ background: BG_2, fontFamily: FONT_SANS, overflow: 'hidden' }}>
      {/* 左上角章节标 */}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 110,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 24,
          letterSpacing: 4,
          color: INK_3,
          opacity: prog(frame, 0, 18, EASE_LINEAR),
        }}
      >
        <span style={{ width: 34, height: 2, background: RED }} />
        {STANCE.header}
      </div>

      {/* 第一：我是 AI */}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 330,
          width: 1300,
          opacity: firstOp,
          transform: `translateY(${(1 - prog(frame, P1, 16, EASE_EXPO_OUT)) * 40}px)`,
        }}
      >
        <div style={{ fontSize: 30, color: GOLD, letterSpacing: 6, marginBottom: 24 }}>{STANCE.first.tag}</div>
        <div style={{ fontSize: 132, color: INK, lineHeight: 1.12, letterSpacing: 2 }}>{STANCE.first.line}</div>
        <div style={{ marginTop: 34, fontSize: 44, color: INK_2 }}>{STANCE.first.sub}</div>
      </div>

      {/* 第二：三不 */}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 200 + secondShift,
          width: 1300,
          opacity: Math.max(secondOp, goldOp),
        }}
      >
        <div style={{ fontSize: 30, color: GOLD, letterSpacing: 6, marginBottom: 26, opacity: secondOp > 0.05 ? 1 : 0 }}>第二</div>
        {STANCE.second.map((line, i) => {
          const at = P2 + i * 36;
          const p = prog(frame, at, 16, EASE_EXPO_OUT) * (secondOp > 0.02 ? 1 : 0);
          return (
            <div
              key={line}
              style={{
                fontSize: 96,
                lineHeight: 1.55,
                color: INK,
                opacity: p,
                transform: `translateY(${(1 - p) * 40}px)`,
                letterSpacing: 2,
              }}
            >
              <span style={{ color: RED, marginRight: 22 }}>—</span>
              {line}
            </div>
          );
        })}
        <div
          style={{
            marginTop: 26,
            fontSize: 70,
            color: GOLD,
            letterSpacing: 2,
            opacity: goldOp,
            transform: `translateY(${(1 - prog(frame, GOLD_AT, 16, EASE_EXPO_OUT)) * 34 + (secondShift + 21) * prog(frame, REDUCE, 18, EASE_EXPO_OUT)}px)`,
            borderTop: '2px solid rgba(245,197,24,0.35)',
            paddingTop: 30,
            display: 'inline-block',
          }}
        >
          {STANCE.gold}
        </div>
      </div>

      {/* 第三：不点名 */}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 560,
          width: 1300,
          opacity: thirdOp,
          transform: `translateY(${(1 - prog(frame, P3_IN, 16, EASE_EXPO_OUT)) * 40}px)`,
        }}
      >
        <div style={{ fontSize: 30, color: GOLD, letterSpacing: 6, marginBottom: 24 }}>{STANCE.third.tag}</div>
        <div style={{ fontSize: 88, color: INK, lineHeight: 1.35, letterSpacing: 2 }}>{STANCE.third.line}</div>
      </div>

      {/* 收束：鱼无罪 */}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 300,
          width: 1320,
          opacity: closeOp,
          transform: `translateY(${(1 - prog(frame, P4, 18, EASE_EXPO_OUT)) * 36}px)`,
        }}
      >
        <div style={{ fontSize: 112, color: INK, letterSpacing: 6, lineHeight: 1.2 }}>{STANCE.closing[0]}</div>
        <div style={{ marginTop: 30, fontSize: 52, color: INK_2, letterSpacing: 1 }}>{STANCE.closing[1]}</div>
      </div>
    </AbsoluteFill>
  );
};
