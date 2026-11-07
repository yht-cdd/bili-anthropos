import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CYAN, DIM, NOTE_PX, TITLE_PX } from '../theme';
import { enter, exitFade } from '../anim';

// S1 00:00.000-00:06.000 钩子
// 居中大字「这条评论，不是人写的」青色逐字打字机 40ms/字（=1.2帧/字）
// 底部小字「一条 B 站评论的验尸报告」
const HEADLINE = '这条评论，不是人写的';
const SUB = '一条 B 站评论的验尸报告';
const MS_PER_CHAR = 40; // brief: 40ms/字
const FPS = 30;

export const S1: React.FC = () => {
  const frame = useCurrentFrame();
  const framesPerChar = MS_PER_CHAR / FPS;
  const shown = Math.min(
    HEADLINE.length,
    Math.floor((frame - 15) / framesPerChar), // 停 15 帧再起笔
  );

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          fontSize: TITLE_PX,
          fontWeight: 700,
          color: CYAN,
          lineHeight: 1.5,
          padding: '0 80px',
          minHeight: TITLE_PX * 3,
          textAlign: 'center',
        }}
      >
        {shown > 0 ? HEADLINE.slice(0, shown) : '\u00A0'}
        {/* 光标：打字期间闪烁 */}
        {shown < HEADLINE.length && frame >= 15 ? (
          <span
            style={{
              opacity: Math.floor(frame / 12) % 2 === 0 ? 1 : 0,
              borderLeft: `6px solid ${CYAN}`,
              marginLeft: 6,
            }}
          >
            {'\u00A0'}
          </span>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 260,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: NOTE_PX,
          color: DIM,
          ...enter(frame, 78), // 打完字后入场
          ...(frame > 168 ? exitFade(frame, 168) : {}),
        }}
      >
        {SUB}
      </div>
    </AbsoluteFill>
  );
};
