import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { clamp01, prog, springIn } from '../anim';
import {
  BG,
  CARD_H,
  CARD_W,
  CORAL,
  FONT_SANS,
  FS_SLOGAN,
  LIME,
  RADIUS,
  SPOTLIGHT,
} from '../theme';

// ============================================================================
// S0 · 0–90f（0.0–3.0s） [opening] spotlight-hero-card + [typography] marker-underline-title
// 聚光底 + 单张主卡片（commit 截图 blur8/60% 纹理）悬浮落定 → 荧光笔划线 → 标题逐字。
// Q4：边缘光被 border-radius 8px + overflow hidden 裁剪。★标题 "<week0>" 逐字（设计稿画面栏照抄）。
// ============================================================================

const TITLE = '<week0>'; // ★ 逐字，标点/尖括号不动

const TitleChar: React.FC<{ ch: string; start: number; frame: number }> = ({ ch, start, frame }) => {
  const p = prog(frame, start, 4);
  return (
    <span style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
      {ch}
    </span>
  );
};

export const S0: React.FC = () => {
  const frame = useCurrentFrame(); // 0–90（Sequence 内局部帧 = 全局帧）

  // 0–60f：卡片 spring(1,80,10) 从 scale(0.8)/opacity0 落定
  const cardSpring = springIn(frame, 0);
  const cardScale = 0.8 + 0.2 * clamp01(cardSpring);
  const cardOpacity = clamp01(cardSpring * 1.4); // 提前于弹簧到位，避免慢尾

  // 60–75f：划线 scaleX(0→1) from center，expoOut 15f
  const lineP = prog(frame, 60, 15);

  // 75–90f：标题逐字 translateY(20→0) opacity(0→1)。设计稿「3f/字 共15f」按 5 字估，
  // 实际 "<week0>" 8 字 ×3f = 24f 会顶出 90f 段尾（R1 复核修正）：改 2f/字从 72f 起，
  // 末字 86f 起入场、90f 前完成，整句在切换帧前完整可读。

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 聚光锥：MID 20% opacity，半径 600px */}
      <AbsoluteFill style={{ background: SPOTLIGHT }} />

      {/* 主卡片（960,540 居中）：commit 截图模糊纹理 + 青柠边缘光 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - CARD_W / 2,
          top: 540 - CARD_H / 2,
          width: CARD_W,
          height: CARD_H,
          borderRadius: RADIUS,
          overflow: 'hidden', // Q4：光不溢出圆角
          opacity: cardOpacity,
          transform: `scale(${cardScale})`,
          border: `2px solid ${LIME}`,
          boxShadow: `0 0 28px rgba(212,244,62,0.28), inset 0 0 18px rgba(212,244,62,0.10), 0 4px 12px rgba(0,0,0,0.4)`,
        }}
      >
        <Img
          src={staticFile('assets/s0-commit-blur.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(8px)',
            opacity: 0.6,
          }}
        />
      </div>

      {/* 标题 + 荧光笔划线（卡片下方） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 675,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: FS_SLOGAN,
            color: CORAL,
            height: FS_SLOGAN + 8,
            lineHeight: `${FS_SLOGAN + 8}px`,
          }}
        >
          {TITLE.split('').map((ch, i) => (
            <TitleChar key={i} ch={ch} frame={frame} start={72 + i * 2} />
          ))}
        </div>
        <div
          style={{
            width: 400,
            height: 4,
            marginTop: 4,
            backgroundColor: LIME,
            borderRadius: 2,
            transform: `scaleX(${lineP})`,
            boxShadow: `0 0 12px rgba(212,244,62,0.45)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
