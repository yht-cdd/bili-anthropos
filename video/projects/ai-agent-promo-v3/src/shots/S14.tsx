import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, prog } from '../anim';
import { FONT_SERIF, GradientReveal } from '../components/EndCard';
import { ANTHROPIC_URI } from '../logosData';
import { TEXT } from '../theme';

// ============================================================================
// 镜14 · 1740–1800 帧（58.0s–60.0s）深蓝黑渐变铺开 +「AI」衬线大字 + 珊瑚星芒
// 本地帧（全局-1740）：0–15 渐变自上而下（§C 曲线节 1740–1755 为准，见 EndCard 注）；
//   30–45「AI」Noto Serif SC Bold 180px #ECE9E1 letter-spacing 48px，
//   scale(1.2→1.0) blur(16→0) opacity(0→1) expo-out 15 帧；
//   星芒 64px 同窗口 rotate(-90deg→0) opacity(0→1)。45–60 静止段
//   （§8.2 加验参考帧 1800=「AI」+星芒静止段 ✓）。
// 布局裁：「中央」取文本块中心 y≈510（容器 top 380/h 260），星芒挂文字块右上角
//   （right -84 出字身），与镜15-17 AiLockup 静止版逐像素同构（跨镜接力）。
// ============================================================================

export const S14: React.FC = () => {
  const f = useCurrentFrame();
  const p = prog(f, 30, 15, EASE_EXPO_OUT);
  const op = p;
  const scale = 1.2 - 0.2 * p;
  const blur = 16 * (1 - p);
  const rot = -90 * (1 - p);

  return (
    <AbsoluteFill>
      <GradientReveal f={f} />
      {/* 「AI」+ 星芒（与 AiLockup 同几何） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 380,
          height: 260,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 700,
              fontSize: 180,
              lineHeight: 1.1,
              letterSpacing: 48,
              marginRight: -48,
              color: TEXT,
              opacity: op,
              transform: `scale(${scale.toFixed(4)})`,
              filter: `blur(${blur.toFixed(2)}px)`,
            }}
          >
            AI
          </div>
          <Img
            src={ANTHROPIC_URI}
            style={{
              position: 'absolute',
              top: 4,
              right: -84,
              width: 64,
              height: 64,
              objectFit: 'contain',
              opacity: op,
              transform: `rotate(${rot.toFixed(2)}deg)`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
