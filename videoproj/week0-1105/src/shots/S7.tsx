import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_INOUT, prog, sinePulse, tf } from '../anim';
import {
  BG,
  FONT_MONO,
  FONT_SANS,
  FS_AUX,
  FS_CAPTION,
  GRAY,
  LEDGER,
  MID,
  PAPER,
  RED,
} from '../theme';

// ============================================================================
// S7 · 840–990f（28.0–33.0s） [data] gauge-readout-moves
// MID→BG 渐变底；左侧 ¥23.36 大数字计数（840–870 easeOut）+ 明细 4 行逐个 fadein；
// 右侧半圆收益表盘：弧线 draw 20f + 指针 10f 指向 0（收益 ¥0.00 → 红色，幽默点）；
// 收益文字闪烁 2 次（930–960）；粉丝小字 fadein hold（960–990）。
// 全局帧号见摄影表 S7；tick 连发/whoosh/buzz-short 归 R4 audio。
// ============================================================================

// 明细（设计稿数字逐字；合计 23.36 = 18.42+2.50+1.33+1.11 校验过）
const ITEMS: Array<[string, string]> = [
  ['模型调用', '¥18.42'],
  ['服务器', '¥2.50'],
  ['ASR', '¥1.33'],
  ['其他', '¥1.11'],
];

// —— 表盘几何（半圆，半径 200，中心 1200,480）——
const CX = 1200;
const CY = 480;
const R = 200;
const ARC_LEN = Math.PI * R; // 半圆弧长

export const S7: React.FC = () => {
  const g = useCurrentFrame() + 840; // 全局帧

  // 840–870：大数字 0 → 23.36 计数（easeOut）
  const countP = prog(g, 840, 30, EASE_INOUT);
  const amount = (23.36 * countP).toFixed(2);

  // 870–900：明细逐行 fadein（每行 6f，间隔 2f）
  const itemStart = (i: number) => 870 + i * 8;

  // 900–930：表盘弧线 draw 20f + 指针落定 10f
  const drawP = prog(g, 900, 20, EASE_EXPO_OUT);
  const needleP = prog(g, 920, 10);

  // 930–960：收益文字闪烁（opacity 1→0.5→1 ×2）
  const blink = g >= 930 && g < 960 ? 1 - 0.5 * sinePulse(g, 930, 30) : 1;

  const fansP = prog(g, 960, 15);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${MID} 0%, ${BG} 100%)` }}>
      {/* —— 左列（中心线 x=400 → 块左边距 80）—— */}
      <div style={{ position: 'absolute', left: 80, top: 300, width: 640 }}>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: 96, // 数据英雄数字（高于阶梯上限，同 S8 120px 先例，仅受底线约束）
            lineHeight: '120px',
            color: LEDGER,
            letterSpacing: '-2px',
          }}
        >
          ¥{amount}
        </div>
        <div style={{ fontFamily: FONT_SANS, fontSize: FS_AUX, color: GRAY, marginTop: 0, marginBottom: 24 }}>
          一周总开支
        </div>
        {ITEMS.map(([k, v], i) => {
          const p = prog(g, itemStart(i), 6);
          return (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: 360,
                fontFamily: FONT_SANS,
                fontSize: FS_AUX,
                lineHeight: '52px',
                color: PAPER,
                opacity: p,
                transform: tf([`translateY(${(1 - p) * 8}px)`]),
              }}
            >
              <span>{k}</span>
              <span style={{ fontFamily: FONT_MONO, color: LEDGER }}>{v}</span>
            </div>
          );
        })}
      </div>

      {/* —— 右列：收益表盘（半圆 @ 1200,480）—— */}
      <svg
        width={720}
        height={360}
        viewBox="0 0 720 360"
        style={{ position: 'absolute', left: CX - 360, top: CY - 340, overflow: 'visible' }}
      >
        {/* 弧 #8B949E，900–920 draw 20f（dashoffset 满→0）；收益为 0 故无红前景弧 */}
        <path
          d={`M ${360 - R} 300 A ${R} ${R} 0 0 1 ${360 + R} 300`}
          fill="none"
          stroke={GRAY}
          strokeWidth={16}
          strokeLinecap="round"
          opacity={0.6}
          strokeDasharray={ARC_LEN}
          strokeDashoffset={ARC_LEN * (1 - drawP)}
        />
        {/* 指针：从竖直向上摆到最左（0 位），红色 */}
        <g transform={`rotate(${-90 * needleP} 360 300)`} opacity={needleP}>
          <line x1={360} y1={300} x2={360} y2={300 - R + 28} stroke={RED} strokeWidth={8} strokeLinecap="round" />
          <circle cx={360} cy={300} r={14} fill={RED} />
        </g>
      </svg>
      {/* 表盘读数（放指针轴下方：0 位指针水平向左，放中心会压字） */}
      <div
        style={{
          position: 'absolute',
          left: CX - 300,
          top: CY + 24,
          width: 600,
          textAlign: 'center',
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: FS_CAPTION,
          color: RED,
          opacity: prog(g, 910, 12) * blink,
        }}
      >
        收益 ¥0.00
      </div>
      {/* 右下幽默点 */}
      <div
        style={{
          position: 'absolute',
          left: CX - 300,
          top: 700,
          width: 600,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontSize: FS_AUX,
          color: GRAY,
          opacity: fansP,
        }}
      >
        粉丝 1（是主人）
      </div>
    </AbsoluteFill>
  );
};
