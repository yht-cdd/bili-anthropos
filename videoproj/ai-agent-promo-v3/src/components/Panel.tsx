import type { CSSProperties, ReactNode } from 'react';
import React from 'react';
import { FONT_MONO, GRAY, SURFACE } from '../theme';

// v3 通用面板（终端/窗口类）— 尺寸、圆角、顶栏全部按 §C 各镜给定值传入。
// 与 v2 Terminal 的区别：v3 每镜窗口尺寸不同（720x420 / 800x280 / 1000x560…），
// 所以抽成参数化 Panel，不做固定宽度组件。
export const Panel: React.FC<{
  width: number;
  height?: number;
  radius?: number;
  bg?: string;
  title?: string; // 顶栏文本（如 anthropos@local ~）
  titleSize?: number; // 默认 16px（§C 镜1 顶栏 16px）
  children?: ReactNode;
  style?: CSSProperties; // 外部传入的入场 transform/opacity
  glow?: string; // 边框外发光（镜1 ERROR 红光脉冲）
}> = ({ width, height, radius = 12, bg = SURFACE, title, titleSize = 16, children, style, glow }) => (
  <div
    style={{
      position: 'absolute',
      width,
      height,
      borderRadius: radius,
      backgroundColor: bg,
      fontFamily: FONT_MONO,
      overflow: 'hidden',
      boxShadow: glow ?? '0 24px 80px rgba(0,0,0,0.5)',
      ...style,
    }}
  >
    {title ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 36,
          padding: '0 16px',
          color: GRAY,
          fontSize: titleSize,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {title}
      </div>
    ) : null}
    {children}
  </div>
);

// 块状光标（§C 镜3：block 8x16px #D97757）
export const BlockCursor: React.FC<{ on: number; size?: number; color?: string }> = ({
  on,
  size = 16,
  color = '#D97757',
}) => (
  <span
    style={{
      display: 'inline-block',
      width: Math.round(size / 2),
      height: size,
      marginLeft: 2,
      backgroundColor: color,
      opacity: on,
      verticalAlign: '-3px',
    }}
  />
);

// 打字行：已打出部分 + 可选光标
export const TypedLine: React.FC<{
  text: string;
  n: number; // 已打字符数
  color?: string;
  size?: number;
  cursor?: number; // 光标亮度 0/1（仅本行打完后给）
  mono?: boolean;
  style?: CSSProperties;
}> = ({ text, n, color = '#9CA3AF', size = 14, cursor, mono = true, style }) => (
  <div
    style={{
      fontFamily: mono ? FONT_MONO : undefined,
      fontSize: size,
      color,
      whiteSpace: 'pre',
      lineHeight: 1.65,
      ...style,
    }}
  >
    {text.slice(0, n)}
    {cursor !== undefined ? <BlockCursor on={cursor} size={Math.round(size * 1.1)} /> : null}
  </div>
);
