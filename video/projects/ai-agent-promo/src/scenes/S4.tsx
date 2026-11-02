import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { enter, prog, typed } from '../anim';
import { FONT_SANS, SUB_SAFE_BOTTOM, TEXT, TYPE_CPS } from '../theme';
import { ErrorBlock } from './ErrorBlock';

// ============================================================================
// S4 回到翻车（全局帧 840–959 = 本地 0–119，28.0s–32.0s）· brief v2.1 §四 S4
// 0–60    （全局 840–900）同机位重现 S1 红 ERROR —— 共用 ErrorBlock 组件，
//         构图与 S1 帧 60–90 逐像素同源（观众认出「就是开头那个」）；
//         底部字幕「第 4 次重试，还是失败。」（打字机 32 字/s，本地 8 起）
// 60–90   （全局 900–930）压暗至 15%（黑罩 0.85，6 帧）+ 报错块反色高亮
//         （白底黑字，6 帧翻转）
// 90–119  （全局 930–959）音频全场静默 0.35s（bed 缺口 31.0–31.35s，见 audio.json）；
//         画面近全黑，一行小字「它开始读报错。」淡入（本地 88 起 12 帧，
//         保证验收抽帧点 31.0s=本地 90 上「近全黑+单行小字」已成立）
// 字幕在本地 60 起 8 帧退场 —— 31.0s 帧上只允许那一行小字。
// ============================================================================
const SUB = '第 4 次重试，还是失败。';
const WHISPER = '它开始读报错。';

export const S4: React.FC = () => {
  const frame = useCurrentFrame();

  // ERROR 重现：scale 6 帧到 1.06 后 hold（同 S1），底光一次完整呼吸（60 帧正弦单峰）
  const errScale = 1 + 0.06 * prog(frame, 0, 6);
  const glow = frame < 60 ? Math.sin(Math.PI * (frame / 60)) : 0.35;

  // 反色段：压暗 6 帧 → 白底黑字再 6 帧
  const dim = prog(frame, 60, 6) * 0.85; // 压暗至 15%
  const invert = prog(frame, 66, 6);

  // 收尾：报错层淡出（86–92 共 6 帧，31.0s=本地 90 时已近全黑），只留小字
  const blockOut = 1 - prog(frame, 86, 6);
  const subOut = 1 - prog(frame, 60, 8);

  const nChars = typed(frame, 8, SUB.length, TYPE_CPS);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: FONT_SANS }}>
      <ErrorBlock scale={errScale} glow={glow} invert={invert} opacity={blockOut} />

      {/* 底部字幕（本地 8–68，60 起退场，31.0s 帧不残留） */}
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
          opacity: subOut,
        }}
      >
        {SUB.slice(0, nChars)}
      </div>

      {/* 静默处的小字（本地 86 起 8 帧淡入；31.0s=本地 90 时已清晰可读） */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ ...enter(frame, 86, 8, 16), fontSize: 36, color: TEXT }}>
          {WHISPER}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
