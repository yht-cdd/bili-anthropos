import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { ShotPlaceholder } from './components/ShotPlaceholder';
import { S0 } from './shots/S0';
import { S1 } from './shots/S1';
import { S2 } from './shots/S2';
import { S3 } from './shots/S3';
import { S4 } from './shots/S4';
import { S5 } from './shots/S5';
import { S6 } from './shots/S6';
import { S7 } from './shots/S7';
import { S8 } from './shots/S8';
import { S9 } from './shots/S9';
import { S10 } from './shots/S10';
import { S11 } from './shots/S11';
import { S12 } from './shots/S12';
import { S13 } from './shots/S13';
import { S14 } from './shots/S14';
import { FONT_SANS, TOTAL_FRAMES } from './theme';

// ============================================================================
// 主时间轴 — design-week0-opus.md §二 摄影表（S0–S14 · 30fps · 1980 帧 = 66.0s）。
// R4 范围：S0–S14 全量实装（S12–S14 于 R4 收官施工）。
// ============================================================================

type Slot = {
  id: string;
  from: number;
  duration: number;
  comp?: React.FC;
};

export const SEG: Slot[] = [
  { id: 'S0', from: 0, duration: 90, comp: S0 },
  { id: 'S1', from: 90, duration: 120, comp: S1 },
  { id: 'S2', from: 210, duration: 120, comp: S2 },
  { id: 'S3', from: 330, duration: 150, comp: S3 },
  { id: 'S4', from: 480, duration: 120, comp: S4 },
  { id: 'S5', from: 600, duration: 120, comp: S5 },
  { id: 'S6', from: 720, duration: 120, comp: S6 },
  { id: 'S7', from: 840, duration: 150, comp: S7 },
  { id: 'S8', from: 990, duration: 150, comp: S8 },
  { id: 'S9', from: 1140, duration: 120, comp: S9 },
  { id: 'S10', from: 1260, duration: 150, comp: S10 },
  { id: 'S11', from: 1410, duration: 150, comp: S11 },
  { id: 'S12', from: 1560, duration: 150, comp: S12 },
  { id: 'S13', from: 1710, duration: 180, comp: S13 },
  { id: 'S14', from: 1890, duration: 90, comp: S14 },
];

// 时间轴完整性自检：无缝相接且总长 1980（同 v3/gravitee Main 的断言）
let cursor = 0;
for (const s of SEG) {
  if (s.from !== cursor) throw new Error(`时间轴断裂：${s.id} 应从 ${cursor} 开始`);
  cursor += s.duration;
}
if (cursor !== TOTAL_FRAMES) throw new Error(`时间轴总长 ${cursor} ≠ ${TOTAL_FRAMES}`);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: FONT_SANS }}>
    {SEG.map((s) => (
      <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}>
        {s.comp ? (
          <s.comp />
        ) : (
          <ShotPlaceholder label={s.id} from={s.from} to={s.from + s.duration} />
        )}
      </Sequence>
    ))}
  </AbsoluteFill>
);
