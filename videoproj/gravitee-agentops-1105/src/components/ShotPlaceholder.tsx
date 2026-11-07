import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BG, FONT_MONO, GRAY, TERM_GRAY } from '../theme';

// 占位镜（S4–S7，R1 施工）— 黑底 + 镜号 + 全局帧区间 + brief 段名，供粗剪看节奏。
export const ShotPlaceholder: React.FC<{
  label: string;
  name: string;
  from: number;
  to: number;
}> = ({ label, name, from, to }) => (
  <AbsoluteFill style={{ backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ fontFamily: FONT_MONO, fontSize: 96, color: TERM_GRAY, fontWeight: 700 }}>{label}</div>
    <div style={{ fontFamily: FONT_MONO, fontSize: 30, color: GRAY, marginTop: 20 }}>{name}</div>
    <div style={{ fontFamily: FONT_MONO, fontSize: 24, color: GRAY, marginTop: 12 }}>
      frames {from}–{to} · placeholder（R2/R3 实装）
    </div>
  </AbsoluteFill>
);
