import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ERROR, ERROR_GLOW, FONT_MONO, TEXT } from '../theme';

// 红色报错块 — brief v2.1 §四：S4（帧 840 起）要「同机位重现 S1 红 ERROR」，
// 观众必须认出「就是开头那个」。所以 S1 与 S4 共用这一个组件，构图逐像素同源：
// 底光 radial(ellipse 70% 60% at 50% 62%) + 84px 等宽红字 + scale 1→1.06 + 红晕 textShadow。
// invert：S4 帧 900–930 的「反色高亮」（白底黑字 6 帧）——白块盖住红字、黑字副本浮在上面。
export const ERR_TEXT = '✖ ERROR: task failed after 3 retries';

export const ErrorBlock: React.FC<{
  scale: number; // 1.0 → 1.06
  glow: number; // 底光 opacity（呼吸 / hold 值由场景算）
  invert?: number; // 0–1 反色高亮进度
  opacity?: number; // 整层淡出用
}> = ({ scale, glow, invert = 0, opacity = 1 }) => (
  <AbsoluteFill
    style={{ justifyContent: 'center', alignItems: 'center', opacity }}
  >
    {/* 底光呼吸（rgba(229,72,77,0.18)，与 S1 完全一致） */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse 70% 60% at 50% 62%, ${ERROR_GLOW}, transparent 75%)`,
        opacity: glow,
      }}
    />
    <div
      style={{
        position: 'relative',
        fontFamily: FONT_MONO,
        fontSize: 84,
        fontWeight: 700,
        color: ERROR,
        transform: `scale(${scale})`,
        textShadow: '0 0 60px rgba(229,72,77,0.45)',
        whiteSpace: 'nowrap',
      }}
    >
      {ERR_TEXT}
      {invert > 0.004 ? (
        <>
          {/* 白底块盖住红字（左右出头，像终端里被选中的文本块） */}
          <span
            style={{
              position: 'absolute',
              left: -36,
              right: -36,
              top: -12,
              bottom: -12,
              backgroundColor: TEXT,
              borderRadius: 10,
              opacity: invert,
            }}
          />
          {/* 黑字副本压在最上层 */}
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              color: '#080B12',
              opacity: invert,
            }}
          >
            {ERR_TEXT}
          </span>
        </>
      ) : null}
    </div>
  </AbsoluteFill>
);
