import React, { useState } from 'react';
import { Img, staticFile } from 'remotion';
import { clamp01 } from '../anim';
import { FONT_SANS, INK_2, LINE, PAPER, RADIUS, RED, SAD_TINT, SHADOW } from '../theme';
import { Chip } from './Chip';

// public/fish/neutral.jpg 已就位。若素材被移除，把这里改成 false（或传 useImage={false}）走退化分支
export const FISH_IMAGE_AVAILABLE = true;
const FISH_SRC = 'fish/neutral.jpg';

export type FishCardProps = {
  width: number;
  sad: number /* 0..1 */;
  showPreset?: boolean;
  presetStruck?: number /* 0..1 */;
  /** 默认 FISH_IMAGE_AVAILABLE；false 时渲染「（鱼）」占位框 */
  useImage?: boolean;
  style?: React.CSSProperties;
};

export const FishCard: React.FC<FishCardProps> = ({
  width,
  sad,
  showPreset = false,
  presetStruck = 0,
  useImage = FISH_IMAGE_AVAILABLE,
  style,
}) => {
  const [failed, setFailed] = useState(false);
  const s = clamp01(sad);
  const struck = clamp01(presetStruck);
  const height = Math.round((width * 9) / 16);
  const showImage = useImage && !failed;

  return (
    <div style={{ position: 'relative', width, height, ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: RADIUS,
          overflow: 'hidden',
          boxShadow: showImage ? SHADOW : undefined,
          transform: `rotate(${-3 * s}deg) translateY(${10 * s}px) scale(${1 - 0.05 * s})`,
          transformOrigin: '50% 50%',
        }}
      >
        {showImage ? (
          <>
            <Img
              src={staticFile(FISH_SRC)}
              onError={() => setFailed(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                filter: `saturate(${1 - 0.55 * s}) brightness(${1 - 0.08 * s})`,
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: SAD_TINT, opacity: s }} />
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: RADIUS,
              border: `2px solid ${LINE}`,
              background: PAPER,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT_SANS,
              fontSize: Math.max(20, Math.round(width / 14)),
              color: INK_2,
            }}
          >
            （鱼）
          </div>
        )}
      </div>
      {showPreset ? (
        <Chip
          text="预设：委屈"
          style={{ position: 'absolute', top: -18, right: -12, background: PAPER }}
        >
          {struck > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                height: 3,
                marginTop: -1.5,
                width: `calc((100% - 16px) * ${struck})`,
                background: RED,
              }}
            />
          ) : null}
        </Chip>
      ) : null}
    </div>
  );
};
