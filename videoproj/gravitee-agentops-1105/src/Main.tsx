import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { ShotPlaceholder } from './components/ShotPlaceholder';
import { S1 } from './shots/S1';
import { S2 } from './shots/S2';
import { S3 } from './shots/S3';
import { S4 } from './shots/S4';
import { S5 } from './shots/S5';
import { FONT_SANS, TOTAL_FRAMES } from './theme';

// ============================================================================
// 主时间轴 — brief §二摄影表（7 段 · 30fps · 1650 帧 = 55.0s）。
// R1 范围：骨架 + S1–S3 实装；S4–S7 占位（R2: S4–S5，R3: S6–S7+audio）。
// ============================================================================

type Slot = {
  id: string;
  name: string;
  from: number;
  duration: number;
  comp?: React.FC;
};

export const SEG: Slot[] = [
  { id: 'S1', name: '冷开场 · 13 行断供日志', from: 0, duration: 150, comp: S1 },
  { id: 'S2', name: '标题卡 · slam 三句', from: 150, duration: 180, comp: S2 },
  { id: 'S3', name: '问题 · 分屏对比', from: 330, duration: 300, comp: S3 },
  { id: 'S4', name: '三个修复动作', from: 630, duration: 510, comp: S4 },
  { id: 'S5', name: '深夜手术 · diff', from: 1140, duration: 240, comp: S5 },
  { id: 'S6', name: '收束 · slam 双句', from: 1380, duration: 120 },
  { id: 'S7', name: '尾卡 · 封面 PushIn', from: 1500, duration: 150 },
];

// 时间轴完整性自检：无缝相接且总长 1650（同 v3 Main 的断言）
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
          <ShotPlaceholder label={s.id} name={s.name} from={s.from} to={s.from + s.duration} />
        )}
      </Sequence>
    ))}
  </AbsoluteFill>
);
