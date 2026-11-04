import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { clamp01, gainStep, prog, sinePulse, springIn, tf } from '../anim';
import {
  BG,
  FONT_MONO,
  FONT_SANS,
  FS_AUX,
  FS_DATA,
  FS_SLOGAN,
  GRAY,
  LEDGER,
  LIME,
  MID,
  PAPER,
} from '../theme';

// ============================================================================
// S2 · 210–330f（7.0–11.0s） [typography] pill-slot-cycle + [data] chart-live-moves
// 标语入场 → 三 pill 依次弹入（间隔 5f）→ 中心 pill 放大 pulse → 成本数字逐个浮现。
// 局部帧 = 全局帧 − 210。★主句「另辟蹊径的opencode，不是dsh大众。」逐字（标点不动）。
// ============================================================================

const SLOGAN = '另辟蹊径的opencode，不是dsh大众。'; // ★ 逐字，标点不动

const PILLS = [
  { name: 'DeepSeek', cost: '¥???', hero: false },
  { name: 'OpenCode', cost: '¥23.36', hero: true }, // 高亮主角（设计稿给定值）
  { name: 'Others', cost: '¥???', hero: false },
];

const PILL_W = 280;
const PILL_H = 80;
const PILL_GAP = 40;

export const S2: React.FC = () => {
  const g = useCurrentFrame() + 210; // 全局帧

  // 210–240f：标语 translateY(-20→0) opacity(0→1) 30f expoOut
  const sloganP = prog(g, 210, 30);

  // 240–270f：三 pill 从下方 spring 弹入，间隔 5f
  // 270–300f：中心 pill scale 1→1.1→1（30f 正弦一次）
  const heroPulse = g >= 270 && g < 300 ? 1 + 0.1 * Math.sin(Math.PI * ((g - 270) / 30)) : 1;

  // 中心 pill 边缘光（270f ding 起持续）
  const heroGlow = sinePulse(g, 270, 60);

  // 300–330f：成本数字逐个浮现（每个 10f，增益阶梯概念→透明度阶梯）
  const costP = (i: number) => prog(g, 300 + i * 10, 10);

  return (
    <AbsoluteFill style={{ backgroundColor: MID }}>
      {/* 标语（960,400 居中） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 400 - 40,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: FS_SLOGAN,
          lineHeight: '80px',
          color: PAPER,
          opacity: sloganP,
          transform: `translateY(${(1 - sloganP) * -20}px)`,
        }}
      >
        {SLOGAN}
      </div>

      {/* 三个对比 pill（中心 960,600） */}
      <div
        style={{
          position: 'absolute',
          left: 960 - (PILL_W * 3 + PILL_GAP * 2) / 2,
          top: 600 - PILL_H / 2,
          display: 'flex',
          gap: PILL_GAP,
        }}
      >
        {PILLS.map((p, i) => {
          const s = clamp01(springIn(g, 240 + i * 5));
          const rise = (1 - s) * 60;
          const scale = p.hero ? heroPulse * (0.9 + 0.1 * s) : 0.9 + 0.1 * s;
          return (
            <div key={p.name} style={{ width: PILL_W, opacity: s, transform: `translateY(${rise}px)` }}>
              <div
                style={{
                  width: PILL_W,
                  height: PILL_H,
                  borderRadius: PILL_H / 2,
                  backgroundColor: p.hero ? LIME : GRAY,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT_SANS,
                  fontSize: FS_DATA,
                  fontWeight: p.hero ? 700 : 400,
                  color: p.hero ? BG : PAPER,
                  transform: `scale(${scale})`,
                  boxShadow: p.hero
                    ? `0 0 ${24 + 16 * heroGlow}px rgba(212,244,62,${0.3 + 0.15 * heroGlow})`
                    : '0 4px 12px rgba(0,0,0,0.4)',
                }}
              >
                {p.name}
              </div>
              {/* 成本标注 */}
              <div
                style={{
                  marginTop: 16,
                  textAlign: 'center',
                  fontFamily: FONT_MONO,
                  fontSize: FS_AUX,
                  color: LEDGER,
                  opacity: costP(i) * gainStep(i, 3, 1, 0.85),
                  transform: `translateY(${(1 - costP(i)) * 10}px)`,
                }}
              >
                {p.cost}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部亮色信息层微光（避免全黑：§五 翻车预防4） */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 700px at 50% 85%, rgba(212,244,62,0.05), rgba(212,244,62,0) 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'absolute', width: 0, height: 0, color: BG }} />
    </AbsoluteFill>
  );
};
