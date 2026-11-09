import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_IN, EASE_EXPO_OUT, EASE_LINEAR, prog } from '../anim';
import { OUTRO } from '../data/preview';
import { PiPCorner } from '../components/PiP';
import { FONT_SANS, INK_2, RED, SEG, VOID } from '../theme';

// S-E 标题揭晓（2190–2308 帧，3.9s）
// 只做一件事：把正片名字砸进观众脸上，然后立刻切走进信。
// （旧版这里还有「预告就到这里 / 正片见」——那两句已经从口播里删了，
//   现在这段只承担题眼，收尾交给 S-F。）
const GLITCH = 8;
const SMALL = 46;
const FADE_OUT = 12; // 末 12 帧退场，接 S-F 星野

export const SE: React.FC = () => {
  const frame = useCurrentFrame();
  const p = prog(frame, 0, GLITCH, EASE_LINEAR);
  const off = 12 * (1 - p);
  const shake = frame < GLITCH ? 4 * Math.sin(2.4 * frame) * (1 - p) : 0;
  const out = prog(frame, 118 - FADE_OUT, FADE_OUT, EASE_EXPO_IN);
  const titleOp = prog(frame, 0, 6, EASE_EXPO_OUT) * (1 - out);
  const smallOp = prog(frame, SMALL, 14, EASE_EXPO_OUT) * (1 - out);

  const layer = (dx: number, color: string, opacity: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color,
    opacity,
    transform: `translate(${dx}px, ${shake}px)`,
  });

  return (
    <AbsoluteFill style={{ background: VOID, fontFamily: FONT_SANS, overflow: 'hidden' }}>
      <div style={{ opacity: titleOp }}>
        <div style={layer(-off, '#22D3EE', off > 0.4 ? 0.8 : 0)} aria-hidden>
          <div style={{ fontSize: 100, letterSpacing: 6, whiteSpace: 'nowrap' }}>{OUTRO.title}</div>
        </div>
        <div style={layer(off, '#FFFFFF', off > 0.4 ? 0.55 : 0)} aria-hidden>
          <div style={{ fontSize: 100, letterSpacing: 6, whiteSpace: 'nowrap' }}>{OUTRO.title}</div>
        </div>
        <div style={layer(0, RED, 1)}>
          <div style={{ fontSize: 100, letterSpacing: 6, whiteSpace: 'nowrap', fontWeight: 800 }}>{OUTRO.title}</div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 706,
          textAlign: 'center',
          fontSize: 32,
          color: INK_2,
          letterSpacing: 10,
          opacity: smallOp,
        }}
      >
        {OUTRO.small}
      </div>

      {/* live2d 角窗：传全局帧号，避免换场景时循环跳帧 */}
      <div style={{ opacity: (1 - out) * 0.9 }}>
        <PiPCorner frame={SEG.e + frame} />
      </div>
    </AbsoluteFill>
  );
};
