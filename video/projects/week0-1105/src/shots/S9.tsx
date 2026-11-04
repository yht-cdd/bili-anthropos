import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, lerpF, prog, tf } from '../anim';
import { BG, FONT_SANS, FS_SLOGAN, NEAR_WHITE, RED } from '../theme';

// ============================================================================
// S9 · 1140–1260f（38.0–42.0s） [typography] word-relay-geometry
// 摄影表 S9：背景延续 #F5F3EE（近白两连镜，坑3 色彩节奏）；
// ★问题句「要不要消费AI形象？」60px #0A0E14 fadein 1140–1170；
// ★答案「不。」120px 意志红 #F0524D（红色唯一合法用途之一 §七-4）：
// 1170–1200 translateY(100→0)+scale(0.8→1) expo-out；
// 1200–1230 pulse 2 次（检查点帧 8：1200f scale=1.05），1230 起完全静止；
// 1230–1260 hold。SFX（whoosh-soft / impact / ding）归 R4 audio。
// 字号偏差记录：答案 120px 阶梯外，摄影表逐字规定（同 S8 判例）。
// 注：设计稿文案「要不要消费 AI 形象？」含空格；★问答句按任务口径逐字为
// 「要不要消费AI形象？」——以任务★原文为准，空格去除。
// ============================================================================

const FS_ANSWER = 120; // 摄影表规定值（阶梯外刻意放大）

const QUESTION = '要不要消费AI形象？'; // ★ 逐字，标点不动

export const S9: React.FC = () => {
  const g = useCurrentFrame() + 1140; // 全局帧

  const qP = prog(g, 1140, 30); // 问题 fadein
  const aP = prog(g, 1170, 30, EASE_EXPO_OUT); // 答案 bottom 推入

  // pulse：1200–1230 两次，峰值钉 1200f/1215f = 1.05（检查点帧 8）；1222–1230 摆幅收敛归零，
  // 1230 起完全静止进 hold（避免 1.05→1 的跳变）
  const inPulse = g >= 1200 && g < 1230;
  const ph = (2 * Math.PI * (g - 1200)) / 15;
  const damp = lerpF(g, [1222, 1230], [1, 0]);
  const pulse = inPulse ? 1 + 0.05 * Math.cos(ph) * Math.cos(ph) * damp : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: NEAR_WHITE }}>
      {/* 问题（960,300 中心线） */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 300,
          transform: 'translate(-50%, -50%)',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: FS_SLOGAN,
          color: BG,
          opacity: qP,
          whiteSpace: 'nowrap',
        }}
      >
        {QUESTION}
      </div>

      {/* 答案（960,600 中心线）：意志红 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 600,
          transform: tf(['translate(-50%, -50%)', `translateY(${(1 - aP) * 100}px)`, `scale(${(0.8 + 0.2 * aP) * pulse})`]),
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: FS_ANSWER,
          color: RED,
          opacity: g >= 1170 ? 1 : 0,
        }}
      >
        不。
      </div>
    </AbsoluteFill>
  );
};
