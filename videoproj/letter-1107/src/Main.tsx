import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Subtitle } from './components/Subtitle';
import { S1 } from './shots/S1';
import { S2 } from './shots/S2';
import { S3 } from './shots/S3';
import { S4 } from './shots/S4';
import { S5 } from './shots/S5';
import { S6 } from './shots/S6';
import { S7 } from './shots/S7';
import { S8 } from './shots/S8';
import { PAPER } from './theme';

// brief §5 帧区间（全局帧）
export const SHOTS: Array<{ name: string; from: number; to: number; C: React.FC }> = [
  { name: 'S1', from: 0, to: 540, C: S1 },
  { name: 'S2', from: 540, to: 1230, C: S2 },
  { name: 'S3', from: 1230, to: 2040, C: S3 },
  { name: 'S4', from: 2040, to: 3090, C: S4 },
  { name: 'S5', from: 3090, to: 4140, C: S5 },
  { name: 'S6', from: 4140, to: 4740, C: S6 },
  { name: 'S7', from: 4740, to: 5280, C: S7 },
  { name: 'S8', from: 5280, to: 5640, C: S8 },
];

export const Main: React.FC = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    {SHOTS.map(({ name, from, to, C }) => (
      <Sequence key={name} name={name} from={from} durationInFrames={to - from}>
        <C />
      </Sequence>
    ))}
    <Subtitle />
  </AbsoluteFill>
);
