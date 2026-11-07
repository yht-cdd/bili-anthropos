import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { clamp01, EASE_EXPO_OUT_16, EASE_LINEAR, EASE_TEAR, lerpF, prog, springIn } from '../anim';
import { BG, CORAL, FONT_SANS, TEXT } from '../theme';

// ============================================================================
// 镜2 · 90–210 帧（3.0s–7.0s）倒带 + 「它搞砸过一次。」 — brief-v3 §三【镜头 2】
// 本地帧：0–30 倒带撕裂线（x 1920→-200，EASE_TEAR，本地 30 帧即全局 120 前扫出，
//   对齐 §8.2 检查点2「倒带线已扫出画面」）；30–60 逐字弹入
//   （spring(1,80,10)，每字 2 帧间隔，y+40 blur8）；60–90 hold + 噪点 0.06；
// 90 起退场：画面节「y-60 同时 opacity→0，expo-out，6 帧退场」与曲线节
//   「180-210 全程 30 帧」冲突 → 裁决取 6 帧（§8.1-2 验收：退场 ≤6 帧）。
// ============================================================================

const TEXT_STR = '它搞砸过一次。';
const TEAR_W = [620, 900, 480, 760, 560]; // 5 条撕裂线宽（设计稿只给「随机 y」，取定值保确定性）
const TEAR_Y = [170, 350, 505, 690, 860];

export const S2: React.FC = () => {
  const f = useCurrentFrame();
  const exitP = prog(f, 90, 6, EASE_EXPO_OUT_16);
  const grain = 0.06 * prog(f, 60, 6, EASE_LINEAR) * (1 - lerpF(f, [108, 120], [0, 1])) * (1 - exitP);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 倒带纹理：960→-200 右向左扫，2px 珊瑚线 */}
      {TEAR_Y.map((y, i) => {
        const p = prog(f, i, 24, EASE_TEAR); // 最后一条 t=28 扫出，<30（检查点2 @120 要求已离场）
        const out = 1 - prog(f, 26, 4, EASE_LINEAR);
        const x = 1920 - (1920 + 200) * p;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: y,
              left: x,
              width: TEAR_W[i],
              height: 2,
              backgroundColor: CORAL,
              opacity: out,
            }}
          />
        );
      })}

      {/* 噪点暗纹（feTurbulence 种子固定，确定性渲染） */}
      {grain > 0.001 ? (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: grain }}>
          <filter id="s2grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="1920" height="1080" filter="url(#s2grain)" />
        </svg>
      ) : null}

      {/* 主文字：逐字弹入 → 上移淡出 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${-60 * exitP}px)`,
          opacity: Math.max(0, 1 - exitP),
        }}
      >
        <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: 64, color: TEXT }}>
          {Array.from(TEXT_STR).map((ch, i) => {
            const s = springIn(f, 30 + i * 2, { tension: 80, friction: 10 });
            const c = clamp01(s);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  transform: `translateY(${40 * (1 - s)}px)`,
                  filter: `blur(${(8 * (1 - c)).toFixed(2)}px)`,
                  opacity: c,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
