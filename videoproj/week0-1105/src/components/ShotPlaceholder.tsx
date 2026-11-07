import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BG, FONT_MONO, FS_DATA, FS_SLOGAN, GRAY } from '../theme';

// 占位镜（S4–S14，R1 施工范围外）— 黑底 + 镜号 + 全局帧区间，供粗剪看节奏。
// 帧区间由 Main.tsx 的 SEG 表决定，占位镜不动时间轴，实装时只替换 comp 引用。
export const ShotPlaceholder: React.FC<{
  label: string;
  from: number;
  to: number;
}> = ({ label, from, to }) => (
  <AbsoluteFill style={{ backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: FS_SLOGAN, color: GRAY }}>{label}</div>
    <div style={{ fontFamily: FONT_MONO, fontSize: FS_DATA, color: GRAY, marginTop: 20, opacity: 0.7 }}>
      frames {from}–{to} · placeholder（R2–R4 实装）
    </div>
  </AbsoluteFill>
);
