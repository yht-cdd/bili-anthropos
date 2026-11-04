import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BG_GRAD_BOTTOM, BG_GRAD_TOP } from '../theme';
import { AgentRow, AiLockup } from '../components/EndCard';

// ============================================================================
// 镜17 · 1820–1830 帧 — 合并段尾 10 帧：T（起点20）在本地 0 入场（声跟画 pop_t@1820，
// §8.4-2），本地 5–10（全局1825–1830）五字母停留 + 微妙呼吸。1830 交镜18 上移。
// ============================================================================

export const S17: React.FC = () => {
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
      <AgentRow f={f + 20} breathe />
    </AbsoluteFill>
  );
};
