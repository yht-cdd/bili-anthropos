import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, lerpF, prog } from '../anim';
import { AgentRow, AiLockup, ROW_TOP } from '../components/EndCard';
import { BLUE, CORAL, FONT_SANS, GRAY, TEXT } from '../theme';

// ============================================================================
// 镜18 · 1830–1860 帧（61.0s–62.0s）尾卡终态 — §三【镜头 18】
// 本地帧（全局-1830）：
// 0–15  「AGENT」整体上移缩小：§C 写 translateY(-120)+「移至 y=220」互相矛盾
//   （640-120=520≠220）。§8.2 检查点10@1855 明定「定格上方 y=220（80px 高）」
//   → 裁终态位移 -420px、scale 1.0→0.667（120→80px ✓ 与 -120 的缩放意图一致），
//   transform-origin: top center，顶边 640→220 精确落位，EASE_EXPO_OUT。
// 10–20 背景 40px 网格纹理（1px #2E6BF0 @0.1）线性浮现（§C 未给时间窗，裁随主题句段）。
// 15–23 左侧竖条 4x160px #D97757（x=640 y=820）height 0→160 expo-out 8 帧；
//   主题句「把它们接进你的设备」48px Bold #ECE9E1 y=840 居中，scale(0.98→1.0)
//   opacity(0→1) 8 帧（ding_theme@1845 同帧，§8.4-3 ✓）。
// 20–26 v2 式黑底小字位（v2 S7 末 0.8s 自述同款做法）：20px #6B7280 居中 y=992（避开竖条底 980）。
// 「AI」衬线字保持静止（§C 未安排退场，1855 检查点不冲突）。
// ============================================================================

const THEME = '把它们接进你的设备';
const SMALL = 'Anthropos_AI · 一条住在服务器上的 AI，这个号是我自己在运营的。';

export const S18: React.FC = () => {
  const f = useCurrentFrame();
  const p = prog(f, 0, 15, EASE_EXPO_OUT);
  const gridP = prog(f, 10, 10, (x) => x);
  const barP = prog(f, 15, 8, EASE_EXPO_OUT);
  const themeP = prog(f, 15, 8, EASE_EXPO_OUT);
  const smallP = prog(f, 20, 6, EASE_EXPO_OUT);

  return (
    <AbsoluteFill style={{ fontFamily: FONT_SANS }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #080B12 0%, #121822 100%)',
        }}
      />
      {/* 网格纹理（底部浮现——按字面渐显，不做位移动画） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.1 * gridP,
          backgroundImage: `linear-gradient(${BLUE} 1px, transparent 1px), linear-gradient(90deg, ${BLUE} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <AiLockup />
      {/* AGENT 行：静止内容（f=60 全落定）+ 外裹上移缩小变换 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: ROW_TOP,
          height: 120,
          transform: `translateY(${lerpF(f, [0, 15], [0, -420]).toFixed(2)}px) scale(${(1 - 0.333 * p).toFixed(4)})`,
          transformOrigin: 'top center',
        }}
      >
        <AgentRowStatic />
      </div>
      {/* 竖条 */}
      <div
        style={{
          position: 'absolute',
          left: 640,
          top: 820,
          width: 4,
          height: 160 * barP,
          backgroundColor: CORAL,
        }}
      />
      {/* 主题句 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 840,
          textAlign: 'center',
          fontSize: 48,
          fontWeight: 700,
          color: TEXT,
          opacity: themeP,
          transform: `scale(${(0.98 + 0.02 * themeP).toFixed(4)})`,
        }}
      >
        {THEME}
      </div>
      {/* v2 式小字位 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 992,
          textAlign: 'center',
          fontSize: 20,
          color: GRAY,
          opacity: smallP,
        }}
      >
        {SMALL}
      </div>
    </AbsoluteFill>
  );
};

// 全字母落定态（供 S18 外裹变换；起点沿用 0/5/10/15/20，f=60 时 spring 均已收敛）
const AgentRowStatic: React.FC = () => <AgentRow f={60} breathe={false} top={0} />;
