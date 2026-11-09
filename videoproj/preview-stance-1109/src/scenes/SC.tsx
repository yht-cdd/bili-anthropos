import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_IN, EASE_EXPO_OUT, EASE_LINEAR, prog } from '../anim';
import { BAR_MAX, BARS, DRAFT, SC_NOTE } from '../data/preview';
import {
  BG,
  CARD_BG,
  CARD_LINE,
  CYAN,
  FONT_MONO,
  FONT_SANS,
  GREY_CARD,
  GREY_INK,
  INK,
  INK_2,
  INK_3,
  RADIUS,
  RED,
  SHADOW,
} from '../theme';

// S-C（761–1480 帧，24s）：week0 稿件页 + 「仅自己可见」印章 + 鱼八股对比条。
const CARD_IN = 20;
const BARS_IN = 177; // 938 全局（「我自己也交过一篇差不多的作业」）
const BARS_FULL = 330;
const BADGE_1 = 400;
const BADGE_2 = 440;
const STAMP = 590; // 全局 1351（「那篇稿子现在只有我自己能看见了」，1387）

export const SC: React.FC = () => {
  const frame = useCurrentFrame();
  const cardIn = prog(frame, CARD_IN, 18, EASE_EXPO_OUT);
  const barsIn = prog(frame, BARS_IN, 16, EASE_EXPO_OUT);
  const grow = prog(frame, BARS_IN, BARS_FULL - BARS_IN, EASE_EXPO_OUT);
  const stampP = prog(frame, STAMP, 12, EASE_EXPO_OUT);
  const greyIn = prog(frame, STAMP, 14, EASE_EXPO_OUT);

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: FONT_SANS }}>
      {/* 左侧 week0 稿件卡（Terminal 风） */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 86,
          width: 1180,
          height: 430,
          background: CARD_BG,
          border: `1px solid ${CARD_LINE}`,
          borderRadius: 16,
          boxShadow: SHADOW,
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 26}px)`,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 22px',
            borderBottom: `1px solid ${CARD_LINE}`,
            fontFamily: FONT_MONO,
            fontSize: 20,
            color: INK_3,
          }}
        >
          <span style={{ width: 11, height: 11, borderRadius: 6, background: '#FF5F57' }} />
          <span style={{ width: 11, height: 11, borderRadius: 6, background: '#FEBC2E' }} />
          <span style={{ width: 11, height: 11, borderRadius: 6, background: '#28C840' }} />
          <span style={{ marginLeft: 14 }}>{DRAFT.file}</span>
          <span style={{ marginLeft: 'auto', fontSize: 18 }}>UP 主后台</span>
        </div>

        <div style={{ display: 'flex', gap: 34, padding: '36px 40px' }}>
          <div
            style={{
              width: 300,
              height: 180,
              borderRadius: 10,
              background: 'linear-gradient(140deg, #2C3A57 0%, #1B2438 100%)',
              border: `1px solid ${CARD_LINE}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: INK_3,
              fontFamily: FONT_MONO,
              fontSize: 20,
              letterSpacing: 2,
            }}
          >
            cover · 16:9
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 40, lineHeight: 1.4, color: INK }}>{DRAFT.title}</div>
            <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 26, fontSize: 24, color: INK_2 }}>
              {DRAFT.stats.map(([k, v]) => (
                <span key={k}>
                  {k} <span style={{ color: INK, fontFamily: FONT_MONO }}>{v}</span>
                </span>
              ))}
              <span
                style={{
                  marginLeft: 6,
                  padding: '4px 14px',
                  borderRadius: 999,
                  border: '1px solid rgba(56,217,217,0.5)',
                  color: CYAN,
                  fontSize: 20,
                }}
              >
                {DRAFT.status}
              </span>
            </div>
            <div style={{ marginTop: 26, fontFamily: FONT_MONO, fontSize: 19, color: INK_3 }}>
              2026-11-07 · 自制 · 未经授权禁止转载
            </div>
          </div>
        </div>

        {/* 灰卡覆盖 + 印章 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: GREY_CARD,
            opacity: greyIn,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 56,
          }}
        >
          <div>
            <div style={{ fontSize: 52, color: GREY_INK, fontWeight: 700, letterSpacing: 1 }}>{DRAFT.blocked}</div>
            <div style={{ marginTop: 14, fontSize: 24, color: 'rgba(27,34,48,0.66)' }}>{DRAFT.stampNote}</div>
          </div>
          <div
            style={{
              position: 'absolute',
              right: 66,
              top: 96,
              transform: `rotate(-8deg) scale(${1.4 - 0.4 * stampP})`,
              border: `6px solid ${RED}`,
              color: RED,
              fontSize: 62,
              fontWeight: 800,
              letterSpacing: 8,
              padding: '8px 26px',
              borderRadius: 10,
              opacity: stampP,
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            {DRAFT.stamp}
          </div>
        </div>
      </div>

      {/* 鱼八股对比条 */}
      <div style={{ position: 'absolute', left: 90, top: 566, width: 1240, opacity: barsIn }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, color: INK_3, letterSpacing: 2 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: RED }} />
          鱼
          <span style={{ width: 14, height: 14, borderRadius: 3, background: CYAN, marginLeft: 18 }} />
          人
          <span style={{ marginLeft: 20, color: INK_2 }}>同一套句式的两个指标 · 每 100 条计</span>
        </div>

        {BARS.map((row, ri) => {
          const top = 50 + ri * 158;
          const fp = row.fish * grow;
          const hp = row.human * grow;
          const badge = prog(frame, ri === 0 ? BADGE_1 : BADGE_2, 12, EASE_EXPO_OUT);
          return (
            <div key={row.label} style={{ position: 'absolute', left: 0, top }}>
              <div style={{ fontSize: 30, color: INK_2, marginBottom: 10 }}>{row.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 30 }}>
                <div style={{ width: (fp / 100) * BAR_MAX, height: 24, background: RED, borderRadius: 4 }} />
                <span style={{ fontFamily: FONT_MONO, fontSize: 30, color: RED }}>
                  {fp.toFixed(1)}%
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 20, color: 'rgba(229,57,53,0.7)' }}>鱼</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 30, marginTop: 8 }}>
                <div style={{ width: (hp / 100) * BAR_MAX, height: 24, background: CYAN, borderRadius: 4 }} />
                <span style={{ fontFamily: FONT_MONO, fontSize: 30, color: CYAN }}>
                  {hp.toFixed(1)}%
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 20, color: 'rgba(56,217,217,0.7)' }}>人</span>
                <span
                  style={{
                    marginLeft: 18,
                    fontFamily: FONT_MONO,
                    fontSize: 26,
                    color: INK_2,
                    opacity: badge,
                    transform: `translateX(${(1 - badge) * -12}px)`,
                  }}
                >
                  ≈ {(row.fish / row.human).toFixed(0)} 倍
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 右上角一句注脚，避免空屏 */}
      <div
        style={{
          position: 'absolute',
          right: 80,
          top: 96,
          width: 420,
          textAlign: 'right',
          fontSize: 26,
          lineHeight: 1.7,
          color: INK_3,
          opacity: prog(frame, 84, 18, EASE_EXPO_IN),
        }}
      >
        {SC_NOTE[0]}
        <br />
        {SC_NOTE[1]}
      </div>
    </AbsoluteFill>
  );
};
