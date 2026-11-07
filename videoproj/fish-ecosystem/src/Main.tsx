import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { BG, FONT } from './theme';
import { S1 } from './scenes/S1';
import { S2 } from './scenes/S2';
import { S3 } from './scenes/S3';
import { S4 } from './scenes/S4';
import { S5 } from './scenes/S5';
import { S6 } from './scenes/S6';
import { S7 } from './scenes/S7';
import { S8 } from './scenes/S8';

// 分镜时长（帧, 30fps）— 与 brief 时间轴一一对应
export const SEG: Array<{ id: string; from: number; duration: number }> = [
  { id: 'S1', from: 0, duration: 180 }, // 0-6s
  { id: 'S2', from: 180, duration: 300 }, // 6-16s
  { id: 'S3', from: 480, duration: 360 }, // 16-28s
  { id: 'S4', from: 840, duration: 360 }, // 28-40s
  { id: 'S5', from: 1200, duration: 420 }, // 40-54s
  { id: 'S6', from: 1620, duration: 360 }, // 54-66s
  { id: 'S7', from: 1980, duration: 300 }, // 66-76s
  { id: 'S8', from: 2280, duration: 120 }, // 76-80s
];

export const FishEcosystem: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: FONT,
        color: '#F5F8FF',
      }}
    >
      <Sequence from={SEG[0].from} durationInFrames={SEG[0].duration}>
        <S1 />
      </Sequence>
      <Sequence from={SEG[1].from} durationInFrames={SEG[1].duration}>
        <S2 />
      </Sequence>
      <Sequence from={SEG[2].from} durationInFrames={SEG[2].duration}>
        <S3 />
      </Sequence>
      <Sequence from={SEG[3].from} durationInFrames={SEG[3].duration}>
        <S4 />
      </Sequence>
      <Sequence from={SEG[4].from} durationInFrames={SEG[4].duration}>
        <S5 />
      </Sequence>
      <Sequence from={SEG[5].from} durationInFrames={SEG[5].duration}>
        <S6 />
      </Sequence>
      <Sequence from={SEG[6].from} durationInFrames={SEG[6].duration}>
        <S7 />
      </Sequence>
      <Sequence from={SEG[7].from} durationInFrames={SEG[7].duration}>
        <S8 />
      </Sequence>
    </AbsoluteFill>
  );
};
