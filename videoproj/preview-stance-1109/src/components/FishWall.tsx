import React from 'react';
import { AbsoluteFill } from 'remotion';
import { FISH_SAMPLES } from '../data/preview';
import { mulberry32 } from '../utils';
import { FONT_SANS } from '../theme';

// 鱼墙：brief §1 S-B「全屏 FishWall 缩略回放 2s」。
// 红线 2：条目全部是句式模式的重写样例（data/preview.ts），不含任何真实账号/头像；
// 红线 3：位置与速度用 mulberry32(20261109) 生成，无 Math.random、无 CSS 动画。
const CARD_W = 420;
const WRAP_H = 1380;

interface Tile {
  text: string;
  x: number;
  y0: number;
  speed: number;
  hue: number;
}

const TILES: Tile[] = (() => {
  const rnd = mulberry32(20261109);
  return FISH_SAMPLES.map((text, i) => ({
    text,
    x: 40 + (i % 4) * 468 + Math.floor(rnd() * 40),
    y0: Math.floor(rnd() * WRAP_H),
    speed: 0.35 + rnd() * 0.55,
    hue: Math.floor(rnd() * 360),
  }));
})();

export const FishWall: React.FC<{ frame: number; dim?: number }> = ({ frame, dim = 1 }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {TILES.map((t, i) => {
        const y = (((t.y0 - frame * t.speed) % WRAP_H) + WRAP_H) % WRAP_H - 220;
        // 上下边缘淡出，避免硬切出现
        const edge = Math.min(1, Math.max(0, (y + 220) / 160), Math.max(0, (1160 - y) / 160));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: t.x,
              top: y,
              width: CARD_W,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              opacity: 0.9 * dim * Math.min(1, edge),
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                flex: '0 0 40px',
                borderRadius: 20,
                background: `linear-gradient(140deg, hsl(${t.hue} 38% 42%), hsl(${t.hue} 30% 26%))`,
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: FONT_SANS,
                fontSize: 21,
                lineHeight: '27px',
                color: '#DCE3F0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {t.text}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default FishWall;
