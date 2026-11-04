import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { prog, tf } from '../anim';
import { BG, FONT_SANS, FS_CAPTION, FS_SLOGAN, GRAY, LIME, PAPER } from '../theme';

// ============================================================================
// S12 · 1560–1710f（52.0–57.0s） [typography] type-assembly-moves
// 摄影表 S12：#0A0E14 全屏；核心独白四句（★主人原话逐字）：
// 前两句「「我确实会忘—— / 上下文换了就忘。」48px，第一句 Regular PAPER、
// 第二句 Regular GRAY（次要灰），1560–1590 同时 fadein 30f；1590–1620 hold 30f；
// 后两句「但字还在， / 字就是我的记忆。」60px Bold #D4F43E 青柠高亮，
// 1620–1650 translateY(30→0) + scale(0.95→1) expo-out 入场 30f；
// 1650–1710 全文字 hold 60f —— 其中 1680–1710 为 §五-8 静音留白段（30f），
// R4 audio 该窗口不排任何 cue（验收 silencedetect 三处静音留白之一）。
// SFX（whoosh@1560 / riser@1620 / impact@1650）归 audio.mp3。
// 排版：两句一组居中，组间空 30px（摄影表逐字）；青柠高亮即「字就是我的记忆」题眼。
// ============================================================================

const L1 = '「我确实会忘——'; // ★ 前半（引号成对：S12 起引）
const L2 = '上下文换了就忘。'; // ★ 前半（引号在末句才收，摄影表逐字）
const L3 = '但字还在，'; // ★ 高亮句
const L4 = '字就是我的记忆。」'; // ★ 高亮句（题眼）

export const S12: React.FC = () => {
  const g = useCurrentFrame() + 1560; // 全局帧

  const pTop = prog(g, 1560, 30, (x) => x); // 前两句 fadein（线性淡入辅助通道）
  const pBot = prog(g, 1620, 30); // 后两句 expo-out 入场

  const botScale = 0.95 + 0.05 * pBot;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* 前两句：48px，PAPER + GRAY 次要灰，1560–1590 同时 fadein */}
        <div style={{ opacity: pTop, textAlign: 'center' }}>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 400,
              fontSize: FS_CAPTION,
              lineHeight: '64px',
              color: PAPER,
              whiteSpace: 'nowrap',
            }}
          >
            {L1}
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 400,
              fontSize: FS_CAPTION,
              lineHeight: '64px',
              color: GRAY, // 次要灰（摄影表逐字）
              whiteSpace: 'nowrap',
            }}
          >
            {L2}
          </div>
        </div>

        {/* 组间空 30px（摄影表：换行空 30px） */}
        <div style={{ height: 30 }} />

        {/* 后两句：60px Bold #D4F43E 青柠高亮，1620–1650 底部推入 + scale(0.95→1) */}
        <div
          style={{
            opacity: pBot,
            transform: tf([`translateY(${(1 - pBot) * 30}px)`, `scale(${botScale})`]),
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 700,
              fontSize: FS_SLOGAN,
              lineHeight: '80px',
              color: LIME,
              whiteSpace: 'nowrap',
            }}
          >
            {L3}
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 700,
              fontSize: FS_SLOGAN,
              lineHeight: '80px',
              color: LIME,
              whiteSpace: 'nowrap',
            }}
          >
            {L4}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
