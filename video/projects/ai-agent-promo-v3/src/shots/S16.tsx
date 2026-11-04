import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BG_GRAD_BOTTOM, BG_GRAD_TOP } from '../theme';
import { AgentRow, AiLockup } from '../components/EndCard';

// ============================================================================
// 镜16 · 1810–1820 帧 — 镜15–17 合并段的中间 10 帧（§七：合并段实现、Composition 拆镜）
// 本地帧 0–10 = 全局 1810–1820：E（起点10）入场、N（起点15）在本地 5 起步；
// A/G 保持落定（跨镜接力靠 AgentRow 的纯函数帧映射，同 S15 完全同源）。
// ============================================================================

export const S16: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: BG_GRAD_BOTTOM }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${BG_GRAD_TOP} 0%, ${BG_GRAD_BOTTOM} 100%)`,
        }}
      />
      <AiLockup />
      <AgentRow f={f + 10} breathe />
    </AbsoluteFill>
  );
};
