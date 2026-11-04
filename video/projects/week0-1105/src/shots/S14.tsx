import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_LINEAR, prog } from '../anim';
import { BG, FONT_MONO, FONT_SANS, FS_AUX, GRAY, LIME } from '../theme';
import { GroupStill } from './S13';

// ============================================================================
// S14 · 1890–1980f（63.0–66.0s） [outro] grain-dissolve
// 摄影表 S14：#0A0E14 全屏；(960,480) URL "github.com/yht-cdd/bili-anthropos"
// 40px Mono #D4F43E（C1 §11：收尾行动号召 ≥40px，检查点帧 12@1950 清晰可读）；
// (960,600) 小字「开源 · 自主 · 真实」32px Regular #8B949E。
// 1890–1920：S13 合影整体 opacity 1→0 渐隐（GroupStill 零运动快照），URL fadein；
// 1920–1950：URL hold；1950–1980：小字 fadein 30f。
// SFX（pad@1890 3s gain0.12 / tick@1920 0.15）归 audio.mp3。
// 字号偏差记录：URL 40px 为摄影表规定值（介于 FS_AUX32 与 FS_DATA36 之上），阶梯外刻意放大，达标 ≥40px。
// ============================================================================

const URL_TEXT = 'github.com/yht-cdd/bili-anthropos'; // ★ 逐字
const FS_URL = 40; // 摄影表规定（收尾行动号召 ≥40px，C1 §11）
const TAGLINE = '开源 · 自主 · 真实'; // ★ 逐字

export const S14: React.FC = () => {
  const g = useCurrentFrame() + 1890; // 全局帧

  const fade = prog(g, 1890, 30, EASE_LINEAR); // S13 合影淡出（1→0 用 1-fade）
  const urlOn = prog(g, 1890, 30, EASE_LINEAR); // URL 与合影交叉渐显
  const tagOn = prog(g, 1950, 30, EASE_LINEAR); // 小字最后 30f 渐显

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 前 30f：S13 定格合影渐隐（零运动快照，R1 定格不复活） */}
      {fade < 1 && <GroupStill opacity={1 - fade} />}

      {/* (960,480) URL：40px Mono #D4F43E */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 480 - 30,
          width: 1920,
          textAlign: 'center',
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: FS_URL,
          color: LIME,
          opacity: urlOn,
        }}
      >
        {URL_TEXT}
      </div>

      {/* (960,600) 小字：32px Regular #8B949E */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 600 - 24,
          width: 1920,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 400,
          fontSize: FS_AUX,
          color: GRAY,
          opacity: tagOn,
        }}
      >
        {TAGLINE}
      </div>
    </AbsoluteFill>
  );
};
