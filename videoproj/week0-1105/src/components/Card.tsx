import React from 'react';
import type { CSS } from '../anim';
import { RADIUS, SHADOW } from '../theme';

// §五·组件复用建议 1：卡片基础组件 <Card>
// 统一规格 480×270 / 320×180，border-radius 8px + overflow hidden（Q4：光不溢出圆角），
// 投影 0 4px 12px rgba(0,0,0,0.4)，左边框可选 4px #D4F43E。
export const Card: React.FC<{
  w: number;
  h: number;
  bg?: string;
  limeBorder?: boolean;
  shadow?: string;
  style?: CSS;
  children?: React.ReactNode;
}> = ({ w, h, bg = '#1A1F2C', limeBorder = false, shadow = SHADOW, style, children }) => (
  <div
    style={{
      width: w,
      height: h,
      backgroundColor: bg,
      borderRadius: RADIUS,
      overflow: 'hidden',
      boxShadow: shadow,
      borderLeft: limeBorder ? '4px solid #D4F43E' : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);
