import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BODY_PX, CYAN, DIM, LINE, MAGENTA, NOTE_PX, TEXT, TITLE_PX, fmt } from '../theme';
import { enter, exitFade } from '../anim';

// S4 28.000-40.000 流量落差
// 三根横条（播放）: 部署教程 98,643 / 拆解它的视频 189 / 鱼自己的出道vlog 12
// 数字出处: videos/BV1zLx76jEyn/、videos/BV1Ymxj6vETK/、videos/BV1e7xi6oErE/
// 条宽用对数刻度但标注真实值
const ROWS = [
  { label: '部署教程', value: 98643, color: CYAN },
  { label: '拆解它的视频', value: 189, color: '#9AA7C7' },
  { label: '鱼自己的出道vlog', value: 12, color: MAGENTA },
];
const MAX_W = 760;
const LOG_MAX = Math.log10(98643); // 对数刻度基准

const widthFor = (v: number): number => (Math.log10(Math.max(v, 1)) / LOG_MAX) * MAX_W;

export const S4: React.FC = () => {
  const frame = useCurrentFrame();
  const out = frame > 340 ? exitFade(frame, 340) : {};

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', ...out }}>
      <div style={{ fontSize: TITLE_PX * 0.8, fontWeight: 700, color: TEXT, ...enter(frame, 6) }}>
        同一条鱼，三种命运
      </div>
      <div style={{ fontSize: NOTE_PX, color: DIM, marginTop: 16, ...enter(frame, 16) }}>
        播放量对比（条宽为对数刻度，数字为真实值）
      </div>

      <div style={{ width: 900, marginTop: 90, display: 'flex', flexDirection: 'column', gap: 64 }}>
        {ROWS.map((r, i) => {
          const delay = 36 + i * 40;
          const grow = interpolate(frame - delay, [0, 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const w = Math.max(widthFor(r.value) * grow, grow > 0 ? 10 : 0);
          return (
            <div key={r.label} style={{ ...enter(frame, delay) }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 16,
                }}
              >
                <span style={{ fontSize: BODY_PX * 0.82, color: TEXT }}>{r.label}</span>
                <span
                  style={{
                    fontSize: BODY_PX,
                    fontWeight: 700,
                    color: r.color,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(r.value)}
                </span>
              </div>
              <div style={{ height: 34, backgroundColor: '#0D1322', borderRadius: 17, border: `1px solid ${LINE}` }}>
                <div
                  style={{
                    width: w,
                    height: '100%',
                    borderRadius: 17,
                    background: `linear-gradient(90deg, ${r.color}66, ${r.color})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 收尾一句 */}
      <div
        style={{
          position: 'absolute',
          bottom: 300,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: BODY_PX * 0.95,
          color: DIM,
          padding: '0 90px',
          ...enter(frame, 190),
        }}
      >
        教鱼繁殖的比教人捞鱼的
        <span style={{ color: MAGENTA, fontWeight: 700 }}>火五百倍</span>
      </div>
    </AbsoluteFill>
  );
};
