import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BODY_PX, CARD, CYAN, DIM, LINE, NOTE_PX, TEXT, TITLE_PX, fmt } from '../theme';
import { countUp, enter, exitFade } from '../anim';

// S3 16.000-28.000 揭底
// 大字「大肥鱼 = AstrBot」
// 三个要点条依次入: 装两个长记忆插件 / 900+配置项 / 显卡GTX 750 2G就能跑
// 右上计数器: 部署教程播放 -> 98,643   （数字出处: videos/BV1zLx76jEyn/）
const POINTS = ['装两个长记忆插件', '900+配置项', '显卡GTX 750 2G就能跑'];
const VIEWS = 98643; // 素材来源: 部署教程 播放98,643

export const S3: React.FC = () => {
  const frame = useCurrentFrame();
  const views = countUp(frame, VIEWS, 30); // 1s 后起跳, ease-out 800ms
  const out = frame > 340 ? exitFade(frame, 340) : {};

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', ...out }}>
      {/* 右上计数器 */}
      <div
        style={{
          position: 'absolute',
          top: 210,
          right: 70,
          textAlign: 'right',
          ...enter(frame, 30),
        }}
      >
        <div style={{ fontSize: NOTE_PX, color: DIM }}>部署教程播放</div>
        <div
          style={{
            fontSize: BODY_PX * 1.25,
            fontWeight: 700,
            color: CYAN,
            fontVariantNumeric: 'tabular-nums',
            marginTop: 8,
          }}
        >
          {fmt(views)}
        </div>
      </div>

      {/* 大字揭底 */}
      <div style={{ fontSize: TITLE_PX, fontWeight: 700, color: TEXT, ...enter(frame, 8) }}>
        大肥鱼 <span style={{ color: DIM }}>=</span>{' '}
        <span style={{ color: CYAN }}>AstrBot</span>
      </div>

      {/* 三个要点条依次入 */}
      <div style={{ width: 860, marginTop: 96, display: 'flex', flexDirection: 'column', gap: 30 }}>
        {POINTS.map((p, i) => (
          <div
            key={p}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              backgroundColor: CARD,
              border: `2px solid ${LINE}`,
              borderLeft: `8px solid ${CYAN}`,
              borderRadius: 20,
              padding: '34px 40px',
              ...enter(frame, 78 + i * 42),
            }}
          >
            <span style={{ fontSize: NOTE_PX, color: DIM, fontVariantNumeric: 'tabular-nums' }}>
              0{i + 1}
            </span>
            <span style={{ fontSize: BODY_PX * 0.92, color: TEXT }}>{p}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
