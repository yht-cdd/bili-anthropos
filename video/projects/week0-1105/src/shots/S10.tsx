import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, prog, typedLine } from '../anim';
import {
  BG,
  CORAL,
  FONT_SANS,
  FS_CAPTION,
  MID,
  NEAR_WHITE,
  PAPER,
  RADIUS,
  SHADOW,
} from '../theme';

// ============================================================================
// S10 · 1260–1410f（42.0–47.0s） [typography] document-typewriter-reveal
// 摄影表 S10：背景 #F5F3EE → #1A1F2C 渐变（近白段收束、回归深色）：
// 1260–1290 近白覆盖层 fadeout 30f（反转的逆过程），引用块同窗 fadein；
// 引用块 800×400 @中心(960,400)，#ECE9E1 底、左 4px #D97757 边框（卡片规格 RADIUS 8 + 投影）；
// ★双自白逐字：前三句 Regular #0A0E14（1290 起逐句 3f/字，lineGap 16 → 末字 1346 打完，
// 检查点帧 9 要求 1410 前三句已完成 ✓）；空 20px；后两句 Bold 珊瑚（1350 起，
// lineGap 33 → 末字 1407 打完，1410 完整显示 ✓）。SFX（pad/typing×2）归 R4 audio。
// 偏差：48px 行高 64px，块内总高 328px（3×64+20+2×64+padding 60），块体按摄影表 800×400 定死。
// ============================================================================

// 前三句（★逐字，引号位置照设计稿：开引号在第 1 句首、闭引号在第 3 句尾）
const LINES_A = ['「第一条片子很糙。', '发之前我自己没看，', '他发完才看见。」'];
// 后两句（★逐字，珊瑚高亮）
const LINES_B = ['「现在，发的每一帧', '我自己都看过。」'];

const TypeLine: React.FC<{ text: string; frame: number; start: number; bold: boolean; color: string }> = ({
  text,
  frame,
  start,
  bold,
  color,
}) => {
  const n = typedLine(frame, start, 0, 0, text.length, 3); // 3f/字（人类速度 R3，末字 1407 <1410 检查点✓）
  const typing = frame >= start && n < text.length;
  return (
    <div
      style={{
        fontFamily: FONT_SANS,
        fontWeight: bold ? 700 : 400,
        fontSize: FS_CAPTION,
        lineHeight: '64px',
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {text.slice(0, n)}
      {typing ? <span style={{ color: CORAL }}>▍</span> : null}
    </div>
  );
};

export const S10: React.FC = () => {
  const g = useCurrentFrame() + 1260; // 全局帧

  const flipBack = prog(g, 1260, 30); // 近白覆盖层透明度 1→0
  const boxP = prog(g, 1260, 30, EASE_EXPO_OUT); // 引用块 fadein + 轻微上浮

  return (
    <AbsoluteFill style={{ backgroundColor: MID }}>
      {/* 近白→深色 渐变过渡：白覆盖层 30f 淡出（承接 S9 全屏近白） */}
      <AbsoluteFill style={{ backgroundColor: NEAR_WHITE, opacity: 1 - flipBack }} />

      {/* 引用块：800×400 @中心(960,400) */}
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 200,
          width: 800,
          height: 400,
          backgroundColor: PAPER,
          borderLeft: `4px solid ${CORAL}`,
          borderRadius: RADIUS,
          boxShadow: SHADOW,
          opacity: boxP,
          transform: `translateY(${(1 - boxP) * 24}px)`,
          padding: '30px 48px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {LINES_A.map((t, i) => (
          <TypeLine key={i} text={t} frame={g} start={1290 + i * 16} bold={false} color={BG} />
        ))}
        {/* 换行空 20px */}
        <div style={{ height: 20 }} />
        {LINES_B.map((t, i) => (
          <TypeLine key={i} text={t} frame={g} start={1350 + i * 33} bold color={CORAL} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
