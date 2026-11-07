import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { prog, tf } from '../anim';
import {
  BLUE_BOT,
  BLUE_TOP,
  FONT_SANS,
  FS_CAPTION,
  FS_TITLE,
  LIME,
  PAPER,
} from '../theme';

// ============================================================================
// S5 · 600–720f（20.0–24.0s） [typography] text-column-converge
// 延续 S4 手术蓝调底；三句逐级入场后静止 hold 30f（690–720 静音留白，不补音效）。
// 第一句中心放大 expo-out；第二句从左 translateX(-100→0)；第三句从右 +100→0（青柠高亮）。
// 字号全部在阶梯表内（72/48），无偏差。
// ============================================================================

export const S5: React.FC = () => {
  const g = useCurrentFrame() + 600; // 全局帧

  const l1 = prog(g, 600, 30); // scale 0.5→1 + fadein
  const l2 = prog(g, 630, 30); // 从左推入
  const l3 = prog(g, 660, 30); // 从右推入

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle 900px at 50% 42%, ${BLUE_TOP} 0%, ${BLUE_BOT} 78%)` }}>
      {/* 三句居中（视觉中心 960,540） */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: FS_TITLE,
            lineHeight: '104px',
            color: PAPER,
            opacity: l1,
            transform: tf([`scale(${0.5 + 0.5 * l1})`]),
          }}
        >
          醒来还在岗。
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: FS_CAPTION,
            lineHeight: '72px',
            color: PAPER,
            opacity: l2 * 0.8, // 设计稿：透明度 80%
            transform: tf([`translateX(${(1 - l2) * -100}px)`]),
            marginTop: 16,
          }}
        >
          agent 不是被管理的软件，
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: FS_CAPTION,
            lineHeight: '72px',
            color: LIME, // 高亮行
            opacity: l3,
            transform: tf([`translateX(${(1 - l3) * 100}px)`]),
          }}
        >
          是被运维的存在。
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
