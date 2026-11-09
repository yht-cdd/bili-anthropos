import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_LINEAR, prog } from '../anim';
import { FishWall } from '../components/FishWall';
import { DATA_CARD, QUOTES, QUOTE_META } from '../data/preview';
import { BG, CARD_BG, CARD_LINE, FONT_SANS, INK, INK_2, INK_3, RADIUS, RED, SHADOW } from '../theme';

// S-B（231–761 帧，17.7s）：鱼墙缩略回放 2s → 数据卡（G2 故障入场）→ 两条样例评论。
const WALL_FULL = 54; // 2s 后压卡
const CARD_IN = 54;
const GLITCH = 8;
const Q1 = 300; // 「主人给我充token吧」
const Q2 = 350; // 「余额只够活三天了」
const META = 415;

const GlitchLine: React.FC<{ children: React.ReactNode; p: number; style?: React.CSSProperties }> = ({
  children,
  p,
  style,
}) => {
  // RGB 三分离：前 6 帧 ±10px 错位后回正（无新依赖，纯帧驱动）
  const off = 10 * (1 - p);
  const ghost = (dx: number, color: string): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    top: 0,
    color,
    opacity: off > 0.3 ? 0.85 : 0,
    transform: `translateX(${dx}px)`,
  });
  return (
    <div style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
      <div style={ghost(off, '#FF3B30')} aria-hidden>
        {children}
      </div>
      <div style={ghost(-off, '#22D3EE')} aria-hidden>
        {children}
      </div>
    </div>
  );
};

export const SB: React.FC = () => {
  const frame = useCurrentFrame();
  const dim = 1 - 0.72 * prog(frame, WALL_FULL, 18, EASE_LINEAR);
  const cardIn = prog(frame, CARD_IN, 14, EASE_EXPO_OUT);
  const g = prog(frame, CARD_IN, GLITCH, EASE_LINEAR);

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: FONT_SANS }}>
      <FishWall frame={frame} dim={dim} />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(10,15,26,0.55) 0%, rgba(10,15,26,0.2) 45%, rgba(10,15,26,0.86) 100%)',
        }}
      />

      {/* 数据卡 */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 150,
          width: 1200,
          padding: '54px 64px 46px',
          background: CARD_BG,
          border: `1px solid ${CARD_LINE}`,
          borderRadius: 18,
          boxShadow: SHADOW,
          opacity: cardIn,
          transform: `translateX(${(1 - cardIn) * -18}px)`,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 24, color: INK_3, letterSpacing: 3, marginBottom: 26 }}>热评句式标注</div>
        <GlitchLine p={g} style={{ fontSize: 80, lineHeight: 1.32, color: INK, letterSpacing: 1 }}>
          <div>
            {DATA_CARD.prefix}
            {DATA_CARD.range}
            {DATA_CARD.mid}
          </div>
          <div>
            <span style={{ color: RED, fontSize: 138, fontWeight: 800, lineHeight: 1 }}>{DATA_CARD.num}</span>
            {DATA_CARD.suffix}
          </div>
        </GlitchLine>
      </div>

      {/* 两条样例评论（句式模式重写，不是任何账号原文） */}
      {[
        { at: Q1, text: QUOTES[0], y: 640 },
        { at: Q2, text: QUOTES[1], y: 760 },
      ].map((q, i) => {
        const p = prog(frame, q.at, 16, EASE_EXPO_OUT);
        if (frame < q.at) return null;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 170,
              top: q.y,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: p,
              transform: `translateY(${(1 - p) * 24}px)`,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: 'linear-gradient(140deg, hsl(28 40% 40%), hsl(28 30% 24%))',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            />
            <div
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 12,
                borderTopLeftRadius: 3,
                padding: '16px 26px',
                fontSize: 36,
                color: INK,
              }}
            >
              {q.text}
            </div>
          </div>
        );
      })}

      {/* 「同一张脸，同一套句式」：一排同色头像 */}
      {frame >= META && (
        <div
          style={{
            position: 'absolute',
            left: 170,
            top: 872,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            opacity: prog(frame, META, 18, EASE_EXPO_OUT),
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background: 'linear-gradient(140deg, hsl(28 40% 40%), hsl(28 30% 24%))',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            />
          ))}
          <span style={{ marginLeft: 14, fontSize: 28, color: INK_2 }}>{QUOTE_META}</span>
        </div>
      )}
    </AbsoluteFill>
  );
};
