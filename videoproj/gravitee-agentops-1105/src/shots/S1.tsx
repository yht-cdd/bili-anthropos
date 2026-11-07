import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { blink, EASE_EXPO_OUT, prog } from '../anim';
import { FAIL_LINES } from '../failLines';
import { BG, FONT_MONO, GRAY, SURFACE, TERM_GRAY } from '../theme';

// ============================================================================
// S1 冷开场 · 全局 0–150（brief §二·S1）
// 0–8 黑场；8 起终端窗入场（1100px 宽，同 v3 窗体规格：表面 #0F131C / radius 12 / 顶栏 16px）；
// 13 行真实断供占位逐行入场，Stagger step 9 帧、每行 6 帧 expo-out 上升（[typography]
// type-assembly-moves A 式 split-text-stagger 的行级用法：overflow 裁切盒内 translateY 升位）；
// 140 起光标停最后一行末尾，4 帧周期快闪（brief「4 帧快闪」→ blink period=4）。
// 退场说明：140–150 无退场动作（brief 未给），由 S2 的 150–158「全场压暗 30%」接管压暗。
// ============================================================================

const WIN_W = 1100;
const LINE_H = 52; // 28px × lineHeight 1.85
const PAD_X = 28;
const HEADER_H = 44;
const CONTENT_TOP = HEADER_H + 20;
const WIN_H = CONTENT_TOP + LINE_H * FAIL_LINES.length + 26;
const WIN_X = (1920 - WIN_W) / 2;
const WIN_Y = Math.round((1080 - WIN_H) / 2);

const START = 10; // 黑场 0–8 + 窗入场 8–14，正文 10 起逐行（保证末行 128–140 落定）
const STEP = 9; // Stagger step 9 帧（brief 给定）

export const S1: React.FC = () => {
  const f = useCurrentFrame();
  const winP = prog(f, 8, 6, EASE_EXPO_OUT); // 窗体入场 8–14，6 帧 expo-out

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
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
          opacity: winP,
          transform: `scale(${0.94 + 0.06 * winP}) translateY(${14 * (1 - winP)}px)`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: HEADER_H,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            fontSize: 18,
            color: GRAY,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          anthropos@local ~ bridge.log
        </div>
        {FAIL_LINES.map((line, i) => {
          const p = prog(f, START + i * STEP, 6, EASE_EXPO_OUT); // 逐行 6 帧 expo-out
          const isLast = i === FAIL_LINES.length - 1;
          const cur = isLast ? blink(f, 140, 4) : 0; // 光标只在末行，140 起 4 帧快闪
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: PAD_X,
                top: CONTENT_TOP + i * LINE_H,
                width: WIN_W - PAD_X * 2,
                height: LINE_H,
                overflow: 'hidden', // 裁切盒：行从下缘升起（裂升式行级用法）
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  lineHeight: `${LINE_H}px`,
                  color: TERM_GRAY,
                  whiteSpace: 'pre',
                  opacity: p,
                  transform: `translateY(${LINE_H * (1 - p)}px)`,
                }}
              >
                {line.ts} {line.text}
                {isLast ? (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 30,
                      marginLeft: 4,
                      backgroundColor: TERM_GRAY,
                      opacity: cur,
                      verticalAlign: '-4px',
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
