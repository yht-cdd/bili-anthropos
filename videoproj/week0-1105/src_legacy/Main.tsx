import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { S1 } from './shots/S1';
import { S2 } from './shots/S2';
import { S3 } from './shots/S3';
import { S4 } from './shots/S4';
import { S5 } from './shots/S5';
import { S6 } from './shots/S6';
import { S7 } from './shots/S7';
import { S8 } from './shots/S8';
import { FONT_SANS, TOTAL_FRAMES } from './theme';

// ============================================================================
// 主时间轴 — brief §二摄影表 + §八补丁（8 段 · 30fps · 1800 帧 = 60.0s）。
// §八：S6 延至 150 帧（自白段 1380–1470），S7/S8 整体 +30；
//      「总长仍 1800」⇒ S8 压缩为 90 帧（1710–1800）。
// ⚠️ 本文件属 brief.md 线（week0 R2/R3 交付）。src/ 已由 design-week0-opus.md 线重建（1980 帧），
//    两线并存，取舍归主模型/主人（见 progress.md R2-6 事故记）。
// ============================================================================

type Slot = {
  id: string;
  name: string;
  from: number;
  duration: number;
  comp: React.FC;
};

export const SEG: Slot[] = [
  { id: 'S1', name: '账单开场', from: 0, duration: 210, comp: S1 },
  { id: 'S2', name: '不是宠物 · 双时间线', from: 210, duration: 270, comp: S2 },
  { id: 'S3', name: '另辟蹊径 · 生态位', from: 480, duration: 240, comp: S3 },
  { id: 'S4', name: '人工介入 ×2', from: 720, duration: 300, comp: S4 },
  { id: 'S5', name: '两个问答', from: 1020, duration: 300, comp: S5 },
  { id: 'S6', name: '主人的问题 · 诚实自白', from: 1320, duration: 150, comp: S6 },
  { id: 'S7', name: '意义的答案 · SELF.md', from: 1470, duration: 240, comp: S7 },
  { id: 'S8', name: '尾卡 · 封面 PushIn', from: 1710, duration: 90, comp: S8 },
];

// 时间轴完整性自检：无缝相接且总长 1800
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
        <s.comp />
      </Sequence>
    ))}
  </AbsoluteFill>
);
