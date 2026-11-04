import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_LINEAR, prog, springIn } from '../anim';
import {
  BG_DARK,
  BLUE,
  CORAL,
  FONT_SANS,
  GREEN,
  LIME,
  ORANGE,
  SURFACE,
  SURFACE_CARD,
  TEXT,
  TEXT_DIM,
} from '../theme';

// ============================================================================
// 镜10 · 1260–1500 帧（42.0s–50.0s）夜班时间轴 — brief-v3 §三【镜头 10】
// 本地帧：0–30 「而这只是日常。」向上缩至顶部标签（36px = scale 0.5625，opacity 0.6），
//   机制同镜7（起点锚 top 476/height 128 flex 居中 = 行中心 y=540，与镜9 文字同点）。
// 30–42 时间轴：x=960 y=180 起 4px 宽 #2E6BF0，height 0→600，12 帧 expo-out
//   （画面节 1290–1305 窗口 vs 曲线节 12 帧 → §〇-3 取 12 帧 + 余量 hold）。
// 60/90/120/150/180（全局 1320/1350/1380/1410/1440，间隔 30 帧）逐个节点：
//   圆点 12px #D97757 前 4 帧 spring(1,120,10) scale 0→1.2→1（stiffness120/damping10
//   欠阻尼 ζ≈0.456 过冲≈20%，天然落在 1.2）。「前 4 帧」裁为弹簧自然时长（同 R1b
//   对 durationInFrames 的修复注记与歧义清单 9：强行压进 4 帧会毁掉 1.2 过冲，
//   检查点8 @1490 要求静止——自然时长 ≤25 帧，远早于节点 5 完成点，成立）。
//   卡片 500x80 #1E2636 圆角 8 前 8 帧 translateX(60→0) opacity(0→1) expo-out。
//   图标 16x16 颜色照 §C；§C 未给图标与
//   文本的相对位置 → 裁图标在文本左侧 gap 14，记歧义。
// 210–230 底部两行（28px Medium #9CA3AF，中心 x=960 y=820）：画面节「每行 8 帧间隔」
//   vs 曲线节逐行 1470–1480 / 1480–1490 → 裁曲线节端点（各 10 帧 linear，差 ≤3 帧）。
//   检查点8 @全局1490（本地230）：五节点静止 + 两行完整显示 ✓。
// Scene 抽出为 (f)=>… 纯函数组件并导出：镜11 需要「整体左移淡出」的静帧复制件，
//   传终态 f=240 即全量定格（沿用镜9 复制镜8 的跨镜接力做法）。
// §8.3-Q11（28px 低于字幕线）：本轮按任务令逐字保 §C 原值，提档与否留给渲染目检轮。
// ============================================================================

export type IconKind = 'wrench' | 'play' | 'note' | 'check' | 'doc';

export type TNode = {
  start: number;
  dotY: number;
  cardY: number;
  text: string;
  icon: IconKind;
  iconColor: string;
};

export const NODES: TNode[] = [
  { start: 60, dotY: 200, cardY: 180, text: '23:47 修复 bug', icon: 'wrench', iconColor: ORANGE },
  { start: 90, dotY: 300, cardY: 280, text: '01:10 看视频', icon: 'play', iconColor: BLUE },
  { start: 120, dotY: 400, cardY: 380, text: '02:40 写日记', icon: 'note', iconColor: LIME },
  { start: 150, dotY: 500, cardY: 480, text: '03:40 CI 通过', icon: 'check', iconColor: GREEN },
  { start: 180, dotY: 600, cardY: 580, text: '06:30 报告完成', icon: 'doc', iconColor: TEXT },
];

// 16x16 线性图标（通用 feather 风格笔画，无第三方资产）
export const NodeGlyph: React.FC<{ icon: IconKind; color: string }> = ({ icon, color }) => {
  const svgStyle = { width: 16, height: 16, display: 'block', flexShrink: 0 } as const;
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (icon) {
    case 'wrench':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24">
          <path
            d="M14.7 6.3 a1 1 0 0 0 0 1.4 l1.6 1.6 a1 1 0 0 0 1.4 0 l3.77 -3.77 a6 6 0 0 1 -7.94 7.94 l-6.91 6.91 a2.12 2.12 0 0 1 -3 -3 l6.91 -6.91 a6 6 0 0 1 7.94 -7.94 z"
            {...stroke}
          />
        </svg>
      );
    case 'play':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24">
          <polygon points="6,4 20,12 6,20" fill={color} />
        </svg>
      );
    case 'note':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24">
          <path d="M4 19.5 A2.5 2.5 0 0 1 6.5 17 H20" {...stroke} />
          <path d="M6.5 2 H20 v20 H6.5 A2.5 2.5 0 0 1 4 19.5 v-15 A2.5 2.5 0 0 1 6.5 2 z" {...stroke} />
        </svg>
      );
    case 'check':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12" {...stroke} />
        </svg>
      );
    case 'doc':
      return (
        <svg style={svgStyle} viewBox="0 0 24 24">
          <path d="M13 2 H6 a2 2 0 0 0 -2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 V9 z" {...stroke} />
          <polyline points="13 2 13 9 20 9" {...stroke} />
        </svg>
      );
  }
};

// 单个节点（圆点 + 卡片），入场由 (f − start) 驱动
const NodeRow: React.FC<{ n: TNode; f: number }> = ({ n, f }) => {
  if (f < n.start) return null;
  const scale = Math.max(0, springIn(f, n.start, { tension: 120, friction: 10 }));
  const p = prog(f, n.start, 8, EASE_EXPO_OUT);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 960 - 6,
          top: n.dotY - 6,
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: CORAL,
          transform: `scale(${scale.toFixed(3)})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1040,
          top: n.cardY,
          width: 500,
          height: 80,
          backgroundColor: SURFACE_CARD,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 24px',
          boxSizing: 'border-box',
          transform: `translateX(${(60 * (1 - p)).toFixed(2)}px)`,
          opacity: p,
        }}
      >
        <NodeGlyph icon={n.icon} color={n.iconColor} />
        <span style={{ fontFamily: FONT_SANS, fontWeight: 400, fontSize: 20, color: TEXT, whiteSpace: 'pre' }}>
          {n.text}
        </span>
      </div>
    </>
  );
};

// 时间轴整场（镜11 退场复制件传终态 f 定格用）；背景留给调用方
export const Scene: React.FC<{ f: number }> = ({ f }) => {
  const labelP = prog(f, 0, 30, EASE_EXPO_OUT);
  const lineP = prog(f, 30, 12, EASE_EXPO_OUT);
  const b1 = prog(f, 210, 10, EASE_LINEAR);
  const b2 = prog(f, 220, 10, EASE_LINEAR);
  return (
    <>
      {/* 顶部标签 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 80 + (476 - 80) * (1 - labelP),
          height: 128,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: 64,
          color: LIME,
          transform: `scale(${(1 - 0.4375 * labelP).toFixed(4)})`,
          opacity: 1 - 0.4 * labelP,
        }}
      >
        而这只是日常。
      </div>
      {/* 时间轴主线：y=180 起向下长到 600 */}
      <div
        style={{
          position: 'absolute',
          left: 958,
          top: 180,
          width: 4,
          height: 600 * lineP,
          borderRadius: 2,
          backgroundColor: BLUE,
        }}
      />
      {NODES.map((n) => (
        <NodeRow key={n.text} n={n} f={f} />
      ))}
      {/* 底部两行 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 820,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 500,
          fontSize: 28,
          lineHeight: 1.5,
          color: TEXT_DIM,
        }}
      >
        <div style={{ opacity: b1 }}>这台机器上没人。</div>
        <div style={{ opacity: b2 }}>但有人在上夜班。</div>
      </div>
    </>
  );
};

export const S10: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG_DARK}, ${SURFACE})` }}>
      <Scene f={f} />
    </AbsoluteFill>
  );
};
