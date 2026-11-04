import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_ELASTIC, EASE_EXPO_OUT, EASE_LINEAR, prog, springIn, tf } from '../anim';
import {
  BG,
  BLUE_TOP,
  CORAL,
  FONT_SANS,
  FS_SLOGAN,
  GRAY,
  LEDGER,
  LIME,
  NEAR_WHITE,
  RADIUS,
  RED,
  SHADOW,
} from '../theme';

// ============================================================================
// S8 · 990–1140f（33.0–38.0s） [typography] word-relay-geometry
// 摄影表 S8：背景 #0A0E14 → #F5F3EE 全屏反转（30f，坑3 关键镜头·全片色彩节奏）；
// 6 张 160×90 彩色小卡 spring(1,80,10) 从屏外飞入（装饰层 opacity 40% blur 2px）；
// ★问题句逐字 scale(0.8→1) fadein 每字 2f；★答案「会。」珊瑚色爆炸式入场：
// impact@1080 钉帧 → 1080f 峰值 scale 1.2（检查点帧 7），1080–1110 elastic 回落至 1；
// 1110–1140 全画面 hold。SFX（whoosh-long / pop×6 / impact）归 R4 audio。
// 字号偏差记录：答案 120px 不在六档阶梯内，系摄影表 S8 逐字规定（120px Bold），视为刻意放大。
// ============================================================================

const FS_ANSWER = 120; // 摄影表 S8 规定值（阶梯外刻意放大，见文件头备注）

// 6 张装饰小卡：位置/颜色逐字照抄摄影表；flyFrom = 屏幕外侧向量（各方向飞入）
const CARDS: Array<{ x: number; y: number; color: string; fx: number; fy: number }> = [
  { x: 200, y: 500, color: LIME, fx: -1, fy: -0.4 },
  { x: 1600, y: 400, color: LEDGER, fx: 1, fy: -0.4 },
  { x: 300, y: 800, color: CORAL, fx: -1, fy: 0.6 },
  { x: 1500, y: 750, color: GRAY, fx: 1, fy: 0.6 },
  { x: 600, y: 200, color: BLUE_TOP, fx: -0.5, fy: -1 },
  { x: 1300, y: 180, color: RED, fx: 0.6, fy: -1 },
];

const QUESTION = '我会不会推荐其他人也来玩呢？'; // ★ 逐字，标点不动

export const S8: React.FC = () => {
  const g = useCurrentFrame() + 990; // 全局帧

  // 990–1020：近白背景淡入覆盖深色底（全屏色调反转）
  const flip = prog(g, 990, 30, EASE_LINEAR);

  // 1050–1080：问题逐字，每字错峰 2f（14 字 × 2f = 28f + 单字 6f 收尾）
  // 1080：答案爆炸峰值（scale 1.2），随后 30f elastic 回落到 1
  const settle = prog(g, 1080, 30, EASE_ELASTIC);
  const answerOn = g >= 1080;
  const answerScale = answerOn ? 1 + 0.2 * (1 - settle) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 近白反转层（占镜头 100% 面积 · 色彩单调预防 §五-4） */}
      <AbsoluteFill style={{ backgroundColor: NEAR_WHITE, opacity: flip }} />

      {/* 6 张彩色小卡（装饰层，不抢主体）：1020 起飞，错峰 3f */}
      {CARDS.map((c, i) => {
        const p = springIn(g, 1020 + i * 3, { tension: 80, friction: 10 });
        const travel = 480; // 屏外距离（足够出画）
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x + c.fx * (1 - p) * travel,
              top: c.y + c.fy * (1 - p) * travel,
              width: 160,
              height: 90,
              backgroundColor: c.color,
              opacity: 0.4 * Math.max(0, Math.min(1, p)),
              filter: 'blur(2px)',
              borderRadius: RADIUS,
              boxShadow: SHADOW,
            }}
          />
        );
      })}

      {/* 问题（960,300 中心线）：逐字 scale(0.8→1)+fadein，每字错峰 2f */}
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
          whiteSpace: 'nowrap',
        }}
      >
        {QUESTION.split('').map((ch, i) => {
          const p = prog(g, 1050 + i * 2, 4, EASE_EXPO_OUT); // 末字 1050+26+4=1080 收窗
          return (
            <span key={i} style={{ opacity: p, display: 'inline-block', transform: `scale(${0.8 + 0.2 * p})` }}>
              {ch}
            </span>
          );
        })}
      </div>

      {/* 答案（960,600 中心线）：1080f 峰值 1.2 → elastic 回落 1；1110 起静止 hold */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 600,
          transform: tf(['translate(-50%, -50%)', `scale(${answerScale})`]),
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: FS_ANSWER,
          color: CORAL,
          opacity: answerOn ? 1 : 0,
        }}
      >
        会。
      </div>
    </AbsoluteFill>
  );
};
