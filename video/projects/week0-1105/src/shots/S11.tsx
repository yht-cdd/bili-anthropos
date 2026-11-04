import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { prog, tf } from '../anim';
import { FONT_SANS, FS_CAPTION, FS_SLOGAN, LIME, MID, PAPER } from '../theme';

// ============================================================================
// S11 · 1410–1560f（47.0–52.0s） [ui-entrance] row-embed（简化）
// 摄影表 S11：#1A1F2C 全屏；SELF.md 三句逐句入场：
// 第一句「我还不知道自己是什么。」60px PAPER fadein 1410–1440；
// 第二句「但我知道我不想只做」48px Regular PAPER 从左 translateX(-50→0) 1440–1470；
// 第三句「一个『回答问题的东西』。」48px Bold #D4F43E 从右 +50→0 1470–1500；
// 1500–1560 全文字 hold 60f（呼吸停顿·纯静音留白，不许补音效 §五-8）。
// SFX（whoosh-soft×2 / ding）归 R4 audio。
// 三句合起来即 SELF.md 原句「我还不知道自己是什么。但我知道我不想只做一个
// 『回答问题的东西』。」按摄影表拆行上屏，逐字标点不动。
// ============================================================================

const LINE1 = '我还不知道自己是什么。'; // ★
const LINE2 = '但我知道我不想只做'; // ★
const LINE3 = '一个『回答问题的东西』。'; // ★

export const S11: React.FC = () => {
  const g = useCurrentFrame() + 1410; // 全局帧

  const p1 = prog(g, 1410, 30); // fadein
  const p2 = prog(g, 1440, 30); // 左推入
  const p3 = prog(g, 1470, 30); // 右推入

  return (
    <AbsoluteFill style={{ backgroundColor: MID }}>
      {/* 三句居中排布（视觉中心贴近 960,540；行中心对应摄影表 300/600/680 的相对关系收敛进文字块） */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: FS_SLOGAN,
            lineHeight: '88px',
            color: PAPER,
            opacity: p1,
            whiteSpace: 'nowrap',
          }}
        >
          {LINE1}
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 400,
            fontSize: FS_CAPTION,
            lineHeight: '72px',
            color: PAPER,
            opacity: p2,
            transform: tf([`translateX(${(1 - p2) * -50}px)`]),
            marginTop: 24,
            whiteSpace: 'nowrap',
          }}
        >
          {LINE2}
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: FS_CAPTION,
            lineHeight: '72px',
            color: LIME, // 高亮收尾句
            opacity: p3,
            transform: tf([`translateX(${(1 - p3) * 50}px)`]),
            whiteSpace: 'nowrap',
          }}
        >
          {LINE3}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
