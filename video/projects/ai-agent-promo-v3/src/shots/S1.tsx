import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, lerpF, prog, sinePulse, typedLine } from '../anim';
import { BG, FONT_MONO, GRAY, RED, SURFACE, TEXT_DIM } from '../theme';

// ============================================================================
// 镜1 · 0–90 帧（0.0s–3.0s）黑屏重击 — brief-v3 §三【镜头 1】
// 终端窗口 720x420 居中偏下 y=420；ERROR 行 60 帧闪红 + 边框红光脉冲；
// 68–90 帧全屏线性淡出（「18 帧」为派生值，以区间 22 帧为准，附录 A-5）。
// 打字偏差记 progress.md：2 帧/字符时 ERROR 行（第 2 行 42 字符）到 60 帧
// 打不完，与第 60 帧 error_beep 钉帧冲突 → 压到 1 帧/字符，lineGap 4 保留。
// ============================================================================

const LOG_LINES = [
  '[03:14:22] Starting render job...',
  '[03:14:35] ERROR: Concurrency limit exceeded',
  '[03:14:36] Retry 1/3... FAILED',
  '[03:14:50] Retry 2/3... FAILED',
  '[03:15:03] Retry 3/3... FAILED',
];
const TYPE_START = 6; // 窗口入场 0–8 帧，正文从第 6 帧起跑，保证 60 帧前 ERROR 行完整
const LINE_GAP = 4; // 每行延迟 4 帧（原稿节奏帧数，直接沿用）
const CHAR_DUR = 1; // 见文件头偏差说明
const WIN_W = 720;
const WIN_H = 420;
const WIN_X = (1920 - WIN_W) / 2;
const WIN_Y = 420;
const ERR_LINE = 1; // 「ERROR: Concurrency limit exceeded」行号

export const S1: React.FC = () => {
  const f = useCurrentFrame();
  const inP = prog(f, 0, 8, EASE_EXPO_OUT);
  const errOn = f >= 60;
  const errPulse = 0.6 + 0.4 * sinePulse(f, 60, 6); // sine 0.6–1.0，6 帧周期
  const fade = 1 - lerpF(f, [68, 90], [0, 1]); // 68–90 线性淡出到黑

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div style={{ position: 'absolute', inset: 0, opacity: Math.max(0, fade) }}>
        <div
          style={{
            position: 'absolute',
            left: WIN_X,
            top: WIN_Y,
            width: WIN_W,
            height: WIN_H,
            backgroundColor: SURFACE,
            borderRadius: 12,
            fontFamily: FONT_MONO,
            opacity: inP,
            transform: `scale(${0.92 + 0.08 * inP})`,
            boxShadow: errOn
              ? `0 0 8px rgba(239,68,68,${(0.85 * errPulse).toFixed(3)})`
              : '0 20px 60px rgba(0,0,0,0.6)',
            border: errOn ? `1px solid rgba(239,68,68,${(0.7 * errPulse).toFixed(3)})` : '1px solid transparent',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 18px', fontSize: 16, color: GRAY }}>
            anthropos@local ~
          </div>
          <div style={{ padding: '14px 20px', fontSize: 14, lineHeight: 1.9, color: TEXT_DIM }}>
            {LOG_LINES.map((line, i) => {
              const n = typedLine(f, TYPE_START, i, LINE_GAP, line.length, CHAR_DUR);
              const isErr = i === ERR_LINE;
              return (
                <div
                  key={i}
                  style={{
                    whiteSpace: 'pre',
                    color: isErr && errOn ? RED : TEXT_DIM,
                    opacity: isErr && errOn ? errPulse : 1,
                  }}
                >
                  {line.slice(0, n)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
