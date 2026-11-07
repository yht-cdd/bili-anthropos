import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { blink, exitFade, prog, lerpF } from '../anim';
import {
  CORAL,
  ERROR,
  FONT_SANS,
  SUB_SAFE_BOTTOM,
  TEXT,
} from '../theme';
import { Terminal } from './Terminal';

// S2 定义（全局帧 120–299，本地帧 = 全局 - 120）· brief v2.1 主人帧级修订
// 0–6     倒带模糊 blur 10→0（sfx rewind @ 全局 120，R3 落音频）
// 6–108   三行大字 120px（v2 的 240px 在 1920 宽放不下单行）。
//         起点 全局 126/160/194 = 本地 6/40/74，每行 8 入场 + 24 停留 + 2 间隔 = 34 帧。
//         行内累积保留：入场后不消失，逐行叠加（全局 228–240 整组退场，衔接下一拍）
// 「困在」删除线：第 2 行入场帧 +18（全局 178 = 本地 58）起，8 帧划出，#E5484D 6px
// 120–180 干净终端重现，光标 2 闪；底部字幕 10 帧上浮「我只需要说人话」
const LINES = ['它不是聊天框。', '聊天框被困在网页里。', '它住在我自己的设备上。'];
const LINE_START = [6, 40, 74]; // 本地帧（全局 126/160/194）
const LINE_PX = 120; // v2.1：字高 120px
const LINE_ENTER = 8; // v2.1：每行 8 帧入场
const STRIKE_START = 58; // 本地：行2 起点 40 + 18
const STRIKE_DUR = 8;

export const S2: React.FC = () => {
  const frame = useCurrentFrame();

  // 倒带模糊：整组容器 0–6 帧 blur 10→0
  const blur = lerpF(frame, [0, 6], [10, 0]);
  const linesOut = frame >= 108 ? exitFade(frame, 108, 12) : {}; // 228→240 退场
  const termIn = frame >= 120;
  const push = prog(frame, 120, 8);
  const curBlink = blink(frame, 132, 3); // 光标 2 闪
  const subStyle = prog(frame, 140, 10); // 底部字幕 10 帧上浮

  // 「困在」删除线宽度 0→100%
  const strike = prog(frame, STRIKE_START, STRIKE_DUR);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: FONT_SANS }}>
      {/* 6–240：三行大字（累积保留） */}
      {frame < 240 ? (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            filter: `blur(${Math.max(0, blur)}px)`,
            ...linesOut,
          }}
        >
          <div style={{ textAlign: 'left' }}>
            {LINES.map((line, i) => {
              const p = prog(frame, LINE_START[i], LINE_ENTER);
              const visible = frame >= LINE_START[i];
              return (
                <div
                  key={line}
                  style={{
                    fontSize: LINE_PX,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    color: TEXT,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 40}px)`,
                    visibility: visible ? 'visible' : 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {i === 1 ? (
                    <>
                      {'聊天框被'}
                      <span style={{ position: 'relative' }}>
                        {'困在'}
                        {/* 删除线：#E5484D 6px，8 帧从左划到右 */}
                        <span
                          style={{
                            position: 'absolute',
                            left: '-2%',
                            top: '54%',
                            height: 6,
                            width: `${strike * 104}%`,
                            backgroundColor: ERROR,
                            borderRadius: 3,
                          }}
                        />
                      </span>
                      {'网页里。'}
                    </>
                  ) : (
                    line
                  )}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* 240–299：干净终端重现 + 底部字幕 */}
      {termIn ? (
        <>
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Terminal style={{ opacity: push, transform: `translateY(${(1 - push) * -40}px)` }}>
              {/* 空命令行：提示符 + 闪烁光标 */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: CORAL }}>anthropos@local</span>
                <span style={{ color: TEXT}}>{' $ '}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 22,
                    height: 44,
                    backgroundColor: curBlink && frame < 150 ? TEXT : 'transparent',
                  }}
                />
              </div>
            </Terminal>
          </AbsoluteFill>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: SUB_SAFE_BOTTOM,
              textAlign: 'center',
              fontSize: 56,
              fontWeight: 700,
              color: TEXT,
              opacity: subStyle,
              transform: `translateY(${(1 - subStyle) * 30}px)`,
            }}
          >
            我只需要说人话
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
