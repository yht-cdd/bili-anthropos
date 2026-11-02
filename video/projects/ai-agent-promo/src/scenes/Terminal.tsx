import type { CSSProperties, ReactNode } from 'react';
import React from 'react';
import {
  FONT_MONO,
  TERM_BORDER,
  TERM_FG,
  TERM_RADIUS,
  TERM_TEXT,
  TERM_W,
  TS_GRAY,
} from '../theme';

// 终端窗口 — brief §三：宽 1280px、圆角 24px、边框 #30363D 2px、标题栏仅 anthropos@local、居中
// S1/S2 共用，保证「同一个终端」的连续感
export const Terminal: React.FC<{
  children?: ReactNode;
  style?: CSSProperties;
}> = ({ children, style }) => {
  return (
    <div
      style={{
        width: TERM_W,
        borderRadius: TERM_RADIUS,
        border: `2px solid ${TERM_BORDER}`,
        backgroundColor: 'rgba(8,11,18,0.92)',
        overflow: 'hidden',
        fontFamily: FONT_MONO,
        color: TERM_TEXT,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        ...style,
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 56,
          padding: '0 28px',
          borderBottom: `2px solid ${TERM_BORDER}`,
          backgroundColor: 'rgba(18,24,34,0.9)',
        }}
      >
        {/* 三枚窗点（纯装饰，灰色低调） */}
        {['#30363D', '#30363D', '#30363D'].map((c, i) => (
          <span
            key={i}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: c,
              marginRight: 12,
            }}
          />
        ))}
        <span style={{ marginLeft: 20, fontSize: 26, color: TS_GRAY }}>anthropos@local</span>
      </div>
      {/* 正文区 */}
      <div style={{ padding: '36px 40px', minHeight: 300, fontSize: 40, lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
};

// 命令行：anthropos@local 提示符（绿）+ 文本
export const TermLine: React.FC<{ children: ReactNode; prompt?: boolean }> = ({
  children,
  prompt = true,
}) => (
  <div>
    {prompt ? <span style={{ color: TERM_FG }}>$ </span> : null}
    <span>{children}</span>
  </div>
);
