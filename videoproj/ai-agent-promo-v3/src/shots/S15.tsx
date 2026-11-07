import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BG_GRAD_BOTTOM, BG_GRAD_TOP } from '../theme';
import { AgentRow, AiLockup } from '../components/EndCard';

// ============================================================================
// 镜15–17 · 1800–1830 帧（60.0s–61.0s）「AGENT」五字母逐个 pop 拼字 — §三【镜头 15-17】
// 本地帧（全局-1800）= 字母起点：A 0 / G 5 / E 10 / N 15 / T 20。
// 裁决（§8.4-1 同源问题的帧表版）：画面节「每个 4 帧」与逐字节律 1800/1805/1810/1815/1820
//   （=58/60/62/64/66.67s，每字母 5 帧）不符；以帧表起点 + 4 帧动效窗口为准，
//   spring(1,100,10) 自然收敛（≈24 帧）会轻微越过下一字母起点——pop 手感本就错峰，成立。
// 25–30 六字母停留 + 微妙呼吸（scale 1.0→1.02 60帧 sine 原样实装，幅度 ≤0.012）。
// 「AI」+星芒静止段由 AiLockup 跨镜接力复制件承担（同 S11→S12 OfflineScene 手法）。
// ============================================================================

export const S15: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: BG_GRAD_BOTTOM }}>
      {/* 镜14 终态渐变底（BG 顶→底同值衔接，同镜9/10 扫场终态裁决口径） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${BG_GRAD_TOP} 0%, ${BG_GRAD_BOTTOM} 100%)`,
        }}
      />
      <AiLockup />
      <AgentRow f={f} breathe />
    </AbsoluteFill>
  );
};
