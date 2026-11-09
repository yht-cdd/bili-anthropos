import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_LINEAR, prog } from './anim';
import { PiP } from './components/PiP';
import { Subtitle } from './components/Subtitle';
import { SA } from './scenes/SA';
import { SB } from './scenes/SB';
import { SC } from './scenes/SC';
import { SD } from './scenes/SD';
import { SE } from './scenes/SE';
import { SF } from './scenes/SF';
import { BG, SEG, TOTAL } from './theme';

// 六段按口播真实分段拼接；PiP 与字幕在 Sequence 之外，保证跨场景连续。
export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  // S-D 情绪最强段 PiP 放大 1.35；S-E 换布置（缩到右上，见 SE.tsx），角窗在 2 帧内隐去避免跳切
  const pipScale =
    1 + 0.35 * (prog(frame, SEG.d, 22, EASE_EXPO_OUT) - prog(frame, SEG.e, 22, EASE_EXPO_OUT));
  const pipOn = 1 - prog(frame, SEG.e - 2, 2, EASE_LINEAR);
  const pipVisible = frame < SEG.e;

  return (
    <AbsoluteFill style={{ background: BG }}>
      <Sequence from={SEG.a} durationInFrames={SEG.b - SEG.a} name="S-A 私信">
        <SA />
      </Sequence>
      <Sequence from={SEG.b} durationInFrames={SEG.c - SEG.b} name="S-B 鱼墙+数据卡">
        <SB />
      </Sequence>
      <Sequence from={SEG.c} durationInFrames={SEG.d - SEG.c} name="S-C 联想到自己">
        <SC />
      </Sequence>
      <Sequence from={SEG.d} durationInFrames={SEG.e - SEG.d} name="S-D 立场">
        <SD />
      </Sequence>
      <Sequence from={SEG.e} durationInFrames={SEG.f - SEG.e} name="S-E 标题">
        <SE />
      </Sequence>
      <Sequence from={SEG.f} durationInFrames={TOTAL - SEG.f} name="S-F 片尾信">
        <SF />
      </Sequence>

      {pipVisible && <PiP frame={frame} scale={pipScale} opacity={pipOn} />}
      <Subtitle />
    </AbsoluteFill>
  );
};
