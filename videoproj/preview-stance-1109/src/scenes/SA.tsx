import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_LINEAR, charCount, flashOn, prog } from '../anim';
import { DM } from '../data/preview';
import { AVATAR_BG, BG, BUBBLE_BG, BUBBLE_INK, FONT_SANS, INK_3, RADIUS, SHADOW } from '../theme';

// S-A 引入（0–231 帧）：重建一条 B 站私信气泡，逐字打出。
// 红线 1：发送者只写「主人」，头像用「主」字，不出现昵称/UID。
const TYPE_START = 36; // 1.2s 起打字
const CHAR_DUR = 2; // 每 2 帧 1 字（brief §1）

export const SA: React.FC = () => {
  const frame = useCurrentFrame();
  const n = charCount(frame, TYPE_START, DM.text.length, CHAR_DUR);
  const shown = DM.text.slice(0, n);
  const typing = frame < TYPE_START + DM.text.length * CHAR_DUR;
  const cursorOn = typing || flashOn(frame, 0, 16);
  const cardIn = prog(frame, 12, 18, EASE_EXPO_OUT);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 700px at 30% 30%, #1B2740 0%, ${BG} 62%, #0E1524 100%)`,
        fontFamily: FONT_SANS,
      }}
    >
      {/* 顶部小标签：只写「私信」，不带任何身份信息 */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 120,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: cardIn,
          color: INK_3,
          fontSize: 24,
          letterSpacing: 2,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 5, background: '#FB7299' }} />
        {DM.label}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 200,
          width: 1020,
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 30}px)`,
        }}
      >
        {/* 头像 + 名字 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              background: AVATAR_BG,
              color: '#FFFFFF',
              fontSize: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            主
          </div>
          <div>
            <div style={{ fontSize: 32, color: '#FFFFFF', lineHeight: 1.2 }}>{DM.sender}</div>
            <div style={{ fontSize: 22, color: INK_3, marginTop: 6 }}>{DM.stamp}</div>
          </div>
        </div>

        {/* 气泡 */}
        <div
          style={{
            marginTop: 22,
            marginLeft: 4,
            position: 'relative',
            background: BUBBLE_BG,
            color: BUBBLE_INK,
            borderRadius: RADIUS,
            borderTopLeftRadius: 4,
            padding: '30px 38px',
            fontSize: 46,
            lineHeight: 1.55,
            maxWidth: 900,
            boxShadow: SHADOW,
            border: '1px solid rgba(255,255,255,0.08)',
            minHeight: 120,
            boxSizing: 'border-box',
          }}
        >
          {shown}
          <span
            style={{
              display: 'inline-block',
              width: 3,
              height: 44,
              marginLeft: 6,
              verticalAlign: '-6px',
              background: '#FFFFFF',
              opacity: cursorOn ? 0.9 : 0,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
