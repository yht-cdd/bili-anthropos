import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONT_MONO, FONT_SANS, TERM_BORDER, TEXT, TS_GRAY } from '../theme';

// R1 占位组件：黑底 + 场景名 + 时间码。帧区间由 Main 的 SEG 保证正确，
// 这里再显示全局区间和实时时间码，方便抽帧核验（brief §七 验收抽帧点）。
// R2/R3 会整文件替换 S3–S6。
export const Placeholder: React.FC<{
  name: string; // 例：'S3 任务蒙太奇'
  range: string; // 例：'帧 300–839 · 10.0s–28.0s'
  globalStart: number; // 本场景的全局起始帧
}> = ({ name, range, globalStart }) => {
  const local = useCurrentFrame();
  const gsec = ((globalStart + local) / 30).toFixed(1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT_SANS,
      }}
    >
      <div style={{ fontSize: 88, fontWeight: 700, color: TEXT }}>{name}</div>
      <div style={{ marginTop: 36, fontSize: 44, color: TS_GRAY, fontFamily: FONT_MONO }}>
        {range}
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 32,
          fontFamily: FONT_MONO,
          color: TERM_BORDER,
        }}
      >
        占位 · R1 · t={gsec.padStart(5, '0')}s
      </div>
    </AbsoluteFill>
  );
};
