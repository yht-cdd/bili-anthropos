import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { C, SCENES } from "./theme";
import { S1_DURATION, S1Gone } from "./scenes/S1Gone";
import { S2_DURATION, S2Alive } from "./scenes/S2Alive";
import { S3_DURATION, S3Wake } from "./scenes/S3Wake";
import { S4_DURATION, S4Day } from "./scenes/S4Day";
import { S5_DURATION, S5Mismatch } from "./scenes/S5Mismatch";
import { S6_DURATION, S6Avalon } from "./scenes/S6Avalon";
import { S7_DURATION, S7Rounds } from "./scenes/S7Rounds";
import { S8_DURATION, S8End } from "./scenes/S8End";

/**
 * 8 个场景按 SCENES 的边界顺序铺开，总长正好 5400 帧。
 *
 * 交叠怎么来的：每个 <Sequence> 的 durationInFrames 比 brief 表格里的帧数
 * 多 M.overlap（15）帧，于是下一场开始的那 15 帧里上一场还活着 ——
 * 上一场上移 −80px 淡出，下一场从 +80px 压入（SceneShell 负责位移）。
 * 最后一幕不加尾巴，免得越过 5400。
 */
export const AnthroposVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Sequence from={SCENES.gone.from} durationInFrames={S1_DURATION}>
      <S1Gone />
    </Sequence>
    <Sequence from={SCENES.alive.from} durationInFrames={S2_DURATION}>
      <S2Alive />
    </Sequence>
    <Sequence from={SCENES.wake.from} durationInFrames={S3_DURATION}>
      <S3Wake />
    </Sequence>
    <Sequence from={SCENES.day.from} durationInFrames={S4_DURATION}>
      <S4Day />
    </Sequence>
    <Sequence from={SCENES.mismatch.from} durationInFrames={S5_DURATION}>
      <S5Mismatch />
    </Sequence>
    <Sequence from={SCENES.avalon.from} durationInFrames={S6_DURATION}>
      <S6Avalon />
    </Sequence>
    <Sequence from={SCENES.rounds.from} durationInFrames={S7_DURATION}>
      <S7Rounds />
    </Sequence>
    <Sequence from={SCENES.end.from} durationInFrames={S8_DURATION}>
      <S8End />
    </Sequence>
  </AbsoluteFill>
);
