import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import {
  BG_BOTTOM,
  BG_TOP,
  FONT_SANS,
  GLOW,
  GLOW_BLUR_PX,
  TOTAL_FRAMES,
} from './theme';
import { S1 } from './scenes/S1';
import { S2 } from './scenes/S2';
import { S3 } from './scenes/S3';
import { S4 } from './scenes/S4';
import { S5 } from './scenes/S5';
import { S6 } from './scenes/S6';
import { S7 } from './scenes/S7';

// 分镜帧表 — brief v2.1 §四，与时间轴一一对应（总 1800 帧 @30fps）
export const SEG: Array<{ id: string; from: number; duration: number }> = [
  { id: 'S1', from: 0, duration: 120 }, // 0–4s 钩子·翻车
  { id: 'S2', from: 120, duration: 180 }, // 4–10s 定义（v2.1 帧参数）
  { id: 'S3', from: 300, duration: 540 }, // 10–28s 任务蒙太奇（R2）
  { id: 'S4', from: 840, duration: 120 }, // 28–32s 回到翻车（R3）
  { id: 'S5', from: 960, duration: 240 }, // 32–40s 爬起来（R3）
  { id: 'S6', from: 1200, duration: 330 }, // 40–51s 夜班纪实（R3）
  { id: 'S7', from: 1530, duration: 270 }, // 51–60s 尾卡
];

// 时间轴完整性自检：段与段必须无缝相接且总长 1800
let cursor = 0;
for (const s of SEG) {
  if (s.from !== cursor) {
    throw new Error(`时间轴断裂：${s.id} 应从 ${cursor} 开始`);
  }
  cursor += s.duration;
}
if (cursor !== TOTAL_FRAMES) {
  throw new Error(`时间轴总长 ${cursor} ≠ ${TOTAL_FRAMES}`);
}

// 全局背景（brief §三）：纵向渐变 + 中央蓝色柔光椭圆
const Background: React.FC = () => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG_TOP}, ${BG_BOTTOM})` }}>
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 1200,
        height: 700,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        backgroundColor: GLOW,
        filter: `blur(${GLOW_BLUR_PX}px)`,
      }}
    />
  </AbsoluteFill>
);

export const AgentPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: FONT_SANS }}>
      <Background />
      {SEG.map((s) => {
        const Scene = [S1, S2, S3, S4, S5, S6, S7][Number(s.id.slice(1)) - 1];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.duration}>
            <Scene />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
