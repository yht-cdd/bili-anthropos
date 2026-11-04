import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { ShotPlaceholder } from './components/ShotPlaceholder';
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
import { S15 } from './shots/S15';
import { S16 } from './shots/S16';
import { S17 } from './shots/S17';
import { S18 } from './shots/S18';
import { FONT_SANS, TOTAL_FRAMES } from './theme';

// ============================================================================
// 主时间轴 — brief-v3 §一总表（18 镜 · 30fps · 1860 帧）。
// 镜1–18 全实装（R1b + R2b + R3）。镜8 四段在 S8 内部分段，
// 时间轴上仍是一格 150 帧；镜15/16/17 合并段按 §七拆三格 10 帧。
// ============================================================================

type Slot = {
  id: string;
  from: number;
  duration: number;
  comp?: React.FC;
};

export const SEG: Slot[] = [
  { id: '镜1', from: 0, duration: 90, comp: S1 },
  { id: '镜2', from: 90, duration: 120, comp: S2 },
  { id: '镜3', from: 210, duration: 180, comp: S3 },
  { id: '镜4', from: 390, duration: 180, comp: S4 },
  { id: '镜5', from: 570, duration: 180, comp: S5 },
  { id: '镜6', from: 750, duration: 60, comp: S6 },
  { id: '镜7', from: 810, duration: 240, comp: S7 },
  { id: '镜8', from: 1050, duration: 150, comp: S8 },
  { id: '镜9', from: 1200, duration: 60, comp: S9 },
  { id: '镜10', from: 1260, duration: 240, comp: S10 },
  { id: '镜11', from: 1500, duration: 90, comp: S11 },
  { id: '镜12', from: 1590, duration: 90, comp: S12 },
  { id: '镜13', from: 1680, duration: 60, comp: S13 },
  { id: '镜14', from: 1740, duration: 60, comp: S14 },
  // 镜15/16/17：设计稿合并段，按 §七「Composition 按镜拆 Sequence」拆三格 10 帧
  { id: '镜15', from: 1800, duration: 10, comp: S15 },
  { id: '镜16', from: 1810, duration: 10, comp: S16 },
  { id: '镜17', from: 1820, duration: 10, comp: S17 },
  { id: '镜18', from: 1830, duration: 30, comp: S18 },
];

// 时间轴完整性自检：无缝相接且总长 1860（同 v2 Main 的断言）
let cursor = 0;
for (const s of SEG) {
  if (s.from !== cursor) throw new Error(`时间轴断裂：${s.id} 应从 ${cursor} 开始`);
  cursor += s.duration;
}
if (cursor !== TOTAL_FRAMES) throw new Error(`时间轴总长 ${cursor} ≠ ${TOTAL_FRAMES}`);

export const V3Film: React.FC = () => (
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
