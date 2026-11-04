import React from 'react';
import { BLUE, FONT_SANS, SURFACE_CARD, TEXT } from '../theme';

// 对话气泡 — brief-v3 镜3 §C：圆角矩形 600x80，背景 #1E2636，描边 1px 腾讯蓝。
// 镜4/5 同款式，只换文案与 y。入场变换由镜文件包一层 div 负责。
export const ChatBubble: React.FC<{
  text: string;
  x: number;
  y: number;
}> = ({ text, x, y }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 600,
      height: 80,
      backgroundColor: SURFACE_CARD,
      border: `1px solid ${BLUE}`,
      borderRadius: 16,
      display: 'flex',
      alignItems: 'center',
      padding: '0 28px',
      fontFamily: FONT_SANS,
      fontWeight: 400,
      fontSize: 32,
      color: TEXT,
      boxSizing: 'border-box',
    }}
  >
    {text}
  </div>
);
