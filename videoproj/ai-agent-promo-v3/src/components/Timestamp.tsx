import React from 'react';
import { FONT_MONO, GRAY } from '../theme';

// 右下角时间戳 — brief-v3 镜3/4/5 结尾拍（[22:14] / [21:47] / [23:08]）。
// JetBrains Mono 18px #6B7280，右下角，opacity 由镜文件驱动。
export const Timestamp: React.FC<{
  text: string;
  opacity: number;
}> = ({ text, opacity }) => (
  <div
    style={{
      position: 'absolute',
      right: 120,
      bottom: 96,
      fontFamily: FONT_MONO,
      fontSize: 18,
      color: GRAY,
      opacity,
    }}
  >
    {text}
  </div>
);
