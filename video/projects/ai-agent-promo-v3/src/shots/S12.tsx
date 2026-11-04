import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { clamp01, EASE_EXPO_OUT, EASE_LINEAR, prog, springIn } from '../anim';
import { BG, CORAL, FONT_SANS, LIME, SURFACE_CARD, TEXT } from '../theme';
import { OfflineScene } from './S11';

// ============================================================================
// 镜12 · 1590–1680 帧（53.0s–56.0s）修复后引语 — brief-v3 §三【镜头 12】
// 本地帧：0–30 镜11 内容淡出（曲线节只给 opacity linear → 故障字保持原位随
//   整体线性隐去，仍复用 OfflineScene 按 f 播，故障偏移持续到隐没；记裁决）。
// 30 起标题「修复后，它说：」64px Bold #D97757，translateY(40→0) opacity(0→1)
//   spring(1,80,10)（曲线节 1620–1635 窗口，spring 自然收敛即停，余量 hold）。
//   垂直布局 §C 未给 → 裁标题行中心 y=460（容器 top 400/height 120）。
// 60–68 引号卡片 800x120 居中，#1E2636、左竖条 4px #D4F43E，scale(0.95→1.0)
//   opacity(0→1) 8 帧 expo-out（曲线节 1650–1660 窗口；画面节「8 帧」为准）。
//   卡片圆角 §C 未给 → 取 12px（同镜8A 卡片族）；文本 28px Regular italic #ECE9E1
//   居中两行，逐字照 §C。§8.3-Q11（28px）处理同镜10：保 §C 原值留渲染目检。
// ============================================================================

const QUOTE: React.CSSProperties = {
  fontFamily: FONT_SANS,
  fontWeight: 400,
  fontSize: 28,
  fontStyle: 'italic',
  color: TEXT,
  lineHeight: 1.5,
};

export const S12: React.FC = () => {
  const f = useCurrentFrame();
  const outP = prog(f, 0, 30, EASE_LINEAR);
  const s = clamp01(springIn(f, 30, { tension: 80, friction: 10 }));
  const cardP = prog(f, 60, 8, EASE_EXPO_OUT);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 镜11 内容淡出（原位，opacity linear 30 帧） */}
      {outP < 1 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - outP }}>
          <OfflineScene f={f} />
        </div>
      ) : null}

      {/* 标题：spring 弹入 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 400,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: 64,
          color: CORAL,
          transform: `translateY(${(40 * (1 - s)).toFixed(2)}px)`,
          opacity: s,
        }}
      >
        修复后，它说：
      </div>

      {/* 引号卡片 */}
      {f >= 60 ? (
        <div
          style={{
            position: 'absolute',
            left: (1920 - 800) / 2,
            top: 540,
            width: 800,
            height: 120,
            backgroundColor: SURFACE_CARD,
            borderLeft: `4px solid ${LIME}`,
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            transform: `scale(${(0.95 + 0.05 * cardP).toFixed(4)})`,
            opacity: cardP,
          }}
        >
          <div style={QUOTE}>「设计者最容易漏掉的</div>
          <div style={QUOTE}>就是自己的单点。」</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
