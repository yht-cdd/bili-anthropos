import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_EXPO_OUT_16, EASE_LINEAR, prog } from '../anim';
import { BG, BG_DARK, FONT_SANS, GREEN, LIME, SURFACE, TEXT } from '../theme';

// ============================================================================
// 镜9 · 1200–1260 帧（40.0s–42.0s）渐变扫场 + 「而这只是日常。」 — brief-v3 §三【镜头 9】
// 本地帧：0–6 镜8 内容（=8D 绿勾+All checks passed 静帧复制件）下移 y+100 同时淡出，
//   6 帧 expo-out（跨镜连续性沿用镜7 重绘镜6 文字的既有做法）。
// 30–42 深蓝黑渐变带从下向上扫：画面节给 1230–1245（15 帧窗口），曲线节给
//   「12 帧 linear」→ 按 §〇-3 取起点 30 + 12 帧，余量 hold。实现：满幅渐变按扫线
//   （y 1080→0）clip-path 逐行露出 + 400px 同色先锋带随线上移，最后 3 帧带淡出，
//   终态背景与镜10 的满幅渐变逐像素同值（跨镜无缝接力）。
// 45–53 「而这只是日常。」64px Bold #D4F43E 淡入 8 帧 expo-out（曲线 cubic(.16,1,.3,1)），
//   窗口终点 1253 vs 画面节 1260，差 ≤3 帧不算违规（§〇-3）。
//   文字容器 top 476 / height 128 / flex 居中 → 行中心恰在全局 y=540，与镜10
//   顶部标签位移的起点锚完全重合（跨镜同点接力）。
// ============================================================================

const GREEN_CHECK_PATH = 'M30 105 L82 155 L172 52'; // 与 S8/8D 同值（静帧复制件）

export const S9: React.FC = () => {
  const f = useCurrentFrame();
  const exitP = prog(f, 0, 6, EASE_EXPO_OUT);
  const sweepP = prog(f, 30, 12, EASE_LINEAR);
  const textP = prog(f, 45, 8, EASE_EXPO_OUT_16);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 镜8 内容退场：静帧复制 8D（绿勾画满 + 文案），下移 100px + 淡出 */}
      {exitP < 1 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateY(${(100 * exitP).toFixed(2)}px)`,
            opacity: 1 - exitP,
          }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, top: 320, display: 'flex', justifyContent: 'center' }}>
            <svg width={200} height={200} viewBox="0 0 200 200">
              <path
                d={GREEN_CHECK_PATH}
                stroke={GREEN}
                strokeWidth={18}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 580,
              textAlign: 'center',
              fontFamily: FONT_SANS,
              fontWeight: 700,
              fontSize: 32,
              color: TEXT,
            }}
          >
            All checks passed
          </div>
        </div>
      ) : null}

      {/* 渐变扫场：满幅渐变按扫线逐行露出（终态与镜10 背景逐像素同值，跨镜无缝）
          + 400px 先锋带（#080B12→#0F131C）随线上移，最后 3 帧融进底，不留叠色残影 */}
      {f >= 30 ? (
        <>
          <AbsoluteFill
            style={{
              background: `linear-gradient(180deg, ${BG_DARK}, ${SURFACE})`,
              clipPath: `inset(${(1080 * (1 - sweepP)).toFixed(2)}px 0px 0px 0px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 1080 * (1 - sweepP),
              height: 400,
              background: `linear-gradient(180deg, ${BG_DARK}, ${SURFACE})`,
              opacity: 1 - prog(f, 39, 3, EASE_LINEAR),
            }}
          />
        </>
      ) : null}

      {/* 主文字：行中心 y=540，与镜10 标签位移起点同锚 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 476,
          height: 128,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: 64,
          color: LIME,
          opacity: textP,
        }}
      >
        而这只是日常。
      </div>

      {/* 备注：本镜音画同步点（1200/1230/1245 过渡·扫场·转调）属 §五 音频层，R2 不接 */}
    </AbsoluteFill>
  );
};
