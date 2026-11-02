import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { blink, prog, typed } from '../anim';
import { FONT_SANS, TEXT, TYPE_CPS } from '../theme';
import { ErrorBlock } from './ErrorBlock';
import { Terminal, TermLine } from './Terminal';

// S1 钩子·翻车（全局帧 0–119，本地帧从 0 起）
// 0–30   全黑（sfx error 重击 @9 —— 音频在 R3 的 audio plan 里落）
// 30–60  终端 8 帧推入（y -40→0 + opacity 0→1），命令行 24 帧打字，光标 2 闪后回车
// 60–90  整屏红 ✖ ERROR，scale 1.0→1.06（6 帧后 hold），底光呼吸一次
// 90–120 画面压暗至 30%，中央打字机字幕（32 字/s）
const CMD = 'npm run render --scene S4';
const SUB = '宣传片拍到一半，它把演示搞砸了。';

export const S1: React.FC = () => {
  const frame = useCurrentFrame();

  // —— 终端阶段 30–60 ——
  // 推入 8 帧（30–38）；打字 24 帧从 32 起（与推入尾重叠，否则 8+24 放不下 30 帧的窗口）
  const push = prog(frame, 30, 8); // 0→1，30 帧前为 0
  const typing = frame >= 32 && frame < 60;
  const nChars = typedInCmd(frame);
  // 56–60 光标 2 闪（半周期 2 帧：亮灭亮灭），60 切 ERROR = 「回车」
  const curBlink = frame >= 56 ? blink(frame, 56, 2) : blink(frame, 32, 5);

  // —— ERROR 阶段 60–90（底光呼吸延续到压暗层之下）——
  const errOn = frame >= 60;
  const errScale = 1 + 0.06 * prog(frame, 60, 6); // 6 帧到 1.06 后 hold
  const breathe = frame >= 60 && frame < 90 ? Math.sin(Math.PI * ((frame - 60) / 30)) : 0;

  // —— 压暗阶段 90–120：亮度压至 30% ⇒ 黑罩 70% ——
  const dim = frame >= 90 ? prog(frame, 90, 8) * 0.7 : 0;
  const subChars = frame >= 92 ? typed(frame, 92, SUB.length, TYPE_CPS) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: FONT_SANS }}>
      {frame >= 30 && frame < 60 ? (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Terminal
            style={{
              opacity: push,
              transform: `translateY(${(1 - push) * -40}px)`,
            }}
          >
            <TermLine>
              {typing ? CMD.slice(0, nChars) : '\u00A0'}
              <span
                style={{
                  display: 'inline-block',
                  width: 22,
                  height: 44,
                  marginLeft: 6,
                  verticalAlign: 'middle',
                  backgroundColor: curBlink ? TEXT : 'transparent',
                }}
              />
            </TermLine>
          </Terminal>
        </AbsoluteFill>
      ) : null}

      {errOn ? (
        <ErrorBlock
          scale={errScale}
          glow={frame < 90 ? breathe : 0.35}
        />
      ) : null}

      {frame >= 90 ? (
        <>
          {/* 压暗至 30% */}
          <div style={{ position: 'absolute', inset: 0, backgroundColor: `rgba(0,0,0,${dim})` }} />
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            {/* 中央打字机字幕（brief：90–120 中央） */}
            <div style={{ fontSize: 56, fontWeight: 700, color: TEXT }}>
              {SUB.slice(0, subChars)}
              {subChars < SUB.length ? (
                <span
                  style={{
                    opacity: blink(frame, 92, 4),
                    borderLeft: `5px solid ${TEXT}`,
                    marginLeft: 6,
                  }}
                >
                  {'\u00A0'}
                </span>
              ) : null}
            </div>
          </AbsoluteFill>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// 打字 24 帧打完 CMD（≈32.5 字/s，与节奏令 32 字/s 一致）
function typedInCmd(frame: number): number {
  return Math.min(CMD.length, Math.max(0, Math.floor(((frame - 32) * CMD.length) / 24)));
}
