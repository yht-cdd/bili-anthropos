import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, prog, tf, typedLine } from '../anim';
import {
  BG,
  BG_GRAD,
  FONT_MONO,
  FONT_SANS,
  FS_CODE,
  FS_SLOGAN,
  LEDGER,
  MID,
  PAPER,
  RADIUS,
  SHADOW,
} from '../theme';

// ============================================================================
// S1 · 90–210f（3.0–7.0s） [typography] typewriter-moves + [effects] scanline-annotate-focus
// 上暗下亮渐变底；左侧两句 ★ 标语逐字打出（3f/字）；右侧进程状态终端窗 fadein。
// 局部帧 = 全局帧 − 90（下文注释里的帧号均为全局，见摄影表 S1）。
// ============================================================================

const LINE1 = '24小时自主工作，'; // ★ 逐字，标点不动
const LINE2 = '不是关电脑就睡觉的宠物。'; // ★ 逐字，标点不动

// 终端 mock（640×360 @ (1200,300)，28px Mono=装饰层底线字号；
// 设计稿 36px 放不进 640 宽，按 §一「代码 28px 底线仅终端装饰层」降级，见 progress 偏差记录）
const TERM_LINES: Array<{ text: string; dim?: boolean }> = [
  { text: 'anthropos-agent    RUNNING' },
  { text: 'pid 1847, uptime 7d 2h 14m', dim: true },
  { text: '├─ scheduler       active' },
  { text: '│    next: 23:00 daily_report', dim: true },
  { text: '├─ inbox_monitor   polling' },
  { text: '│    interval: 5min', dim: true },
  { text: '└─ model_client    idle' },
  { text: '     last_call: 2m ago', dim: true },
];

const TypeLine: React.FC<{ text: string; frame: number; start: number }> = ({ text, frame, start }) => {
  const n = typedLine(frame, start, 0, 0, text.length, 3);
  return (
    <span>
      {text.slice(0, n)}
      {/* 光标：打字期间常亮，打完快闪 4f 周期 */}
      {frame >= start && frame - start < text.length * 3 + 12 ? (
        <span style={{ opacity: n < text.length ? 1 : Math.floor(((frame - start) % 8) / 4) === 0 ? 1 : 0, color: '#D4F43E' }}>
          ▍
        </span>
      ) : null}
    </span>
  );
};

export const S1: React.FC = () => {
  const g = useCurrentFrame() + 90; // 全局帧

  // 190–210f：终端窗 opacity 0→1 fadein 20f
  const termP = prog(g, 190, 20, EASE_EXPO_OUT);

  return (
    <AbsoluteFill style={{ background: BG_GRAD }}>
      {/* 左侧两句标语（160,200）（160,280） */}
      <div style={{ position: 'absolute', left: 160, top: 200, width: 1000 }}>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: FS_SLOGAN,
            lineHeight: '80px',
            height: 80,
            color: PAPER,
            whiteSpace: 'nowrap',
          }}
        >
          <TypeLine text={LINE1} frame={g} start={90} />
        </div>
        <div
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: FS_SLOGAN,
            lineHeight: '80px',
            height: 80,
            marginTop: 0,
            color: PAPER,
            whiteSpace: 'nowrap',
          }}
        >
          <TypeLine text={LINE2} frame={g} start={150} />
        </div>
      </div>

      {/* 右侧进程状态终端窗（1200,300）640×360 */}
      <div
        style={{
          position: 'absolute',
          left: 1200,
          top: 300,
          width: 640,
          height: 360,
          backgroundColor: MID,
          borderRadius: RADIUS,
          border: '1px solid rgba(63,182,139,0.25)',
          boxShadow: SHADOW,
          padding: '20px 28px',
          boxSizing: 'border-box',
          opacity: termP,
          transform: tf([termP < 1 ? `translateY(${(1 - termP) * 16}px)` : null]),
        }}
      >
        {/* 终端顶栏三点 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['#F0524D', '#D97757', '#3FB68B'].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c, opacity: 0.7 }} />
          ))}
        </div>
        {TERM_LINES.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: FONT_MONO,
              fontSize: FS_CODE,
              lineHeight: '36px',
              color: l.dim ? '#8B949E' : LEDGER,
              whiteSpace: 'pre',
            }}
          >
            {l.text}
          </div>
        ))}
      </div>

      {/* 底部氛围：下亮区渐变已在 BG_GRAD，聚光锥辅助 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 800px at 30% 30%, rgba(26,31,44,0.12), rgba(26,31,44,0) 70%)`,
          backgroundColor: 'transparent',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'absolute', width: 0, height: 0, color: BG }} />
    </AbsoluteFill>
  );
};
