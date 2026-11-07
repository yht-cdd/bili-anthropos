import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BG, FONT_MONO, GRAY, TEXT_DIM } from '../theme';

// 占位镜（镜9–18，R1c 施工）— 黑底 + 镜号 + 全局帧区间，供粗剪看节奏。
// 帧号一律取 brief-v3 §一总表 30fps 核算值。
export const ShotPlaceholder: React.FC<{
  label: string;
  from: number;
  to: number;
}> = ({ label, from, to }) => (
  <AbsoluteFill style={{ backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ fontFamily: FONT_MONO, fontSize: 96, color: TEXT_DIM, fontWeight: 700 }}>{label}</div>
    <div style={{ fontFamily: FONT_MONO, fontSize: 28, color: GRAY, marginTop: 24 }}>
      frames {from}–{to} · placeholder
    </div>
  </AbsoluteFill>
);
