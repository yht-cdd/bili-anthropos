import React from 'react';
import { FONT_MONO, INK_2, LINE } from '../theme';

export type ChipProps = {
  text: string;
  /** 覆盖默认样式（位置、颜色等） */
  style?: React.CSSProperties;
  /** 叠在 Chip 上的附加层（如删除线），绝对定位相对 Chip */
  children?: React.ReactNode;
};

export const Chip: React.FC<ChipProps> = ({ text, style, children }) => (
  <div
    style={{
      position: 'relative',
      display: 'inline-block',
      borderRadius: 8,
      border: `1.5px solid ${LINE}`,
      fontFamily: FONT_MONO,
      fontSize: 24,
      lineHeight: 1.3,
      color: INK_2,
      padding: '6px 14px',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {text}
    {children}
  </div>
);
