import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT_16, EASE_INOUT, EASE_LINEAR, prog } from '../anim';
import { BG, BG_DARK, CYAN, FONT_SANS, RED, SURFACE, TEXT_DIM } from '../theme';
import { Scene } from './S10';

// ============================================================================
// 镜11 · 1500–1590 帧（50.0s–53.0s）六小时离线 — brief-v3 §三【镜头 11】
// 本地帧：0–30 时间轴场景整体左移 x−200 同时淡出（in-out cubic(.65,0,.35,1)）；
//   复制件直接复用 S10/Scene 传终态 f=240 定格（跨镜接力同镜9）。渐变底另铺一层
//   同步淡出至纯黑——「场景」退场，背景归黑（§C 只给「整体平移淡出」，
//   背景处理记歧义裁决：随场景同曲线淡出）。
// 30–45 故障文字「11.03 六小时离线」56px Bold #EF4444，opacity 0→1（曲线节
//   1530–1545 未给缓动 → linear）；RGB 分离 4px，每 6 帧换一次偏移方向——
//   用 k=floor((f−30)/6) 的确定性伪随机（sin 哈希），保证逐帧渲染可复现。
//   检查点9 @1545（本地45）：全亮带分离、补充两行未入 ✓。
// 60/68 补充两行 32px Regular #9CA3AF，各行 8 帧 blur(8→0) opacity(0→1) expo-out。
//   垂直位置 §C 未给 → 裁故障字行中心保持 y=540，补充块自 y=640 起（记歧义）。
// ============================================================================

const GLITCH_TXT = '11.03 六小时离线';

// 确定性伪随机 [0,1)：每 6 帧一个 k，偏移方向/幅度由 k 决定（渲染可复现）
const prank = (k: number, salt: number): number => {
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// 故障文字 + 补充两行（镜12 退场复制件按 f 复用）
export const OfflineScene: React.FC<{ f: number }> = ({ f }) => {
  const inP = prog(f, 30, 15, EASE_LINEAR);
  const k = Math.floor(Math.max(0, f - 30) / 6);
  const dxa = inP > 0 ? (prank(k, 1) > 0.5 ? 4 : -4) : 0;
  const dxb = inP > 0 ? (prank(k + 3, 2) > 0.5 ? 4 : -4) : 0;
  const s1 = prog(f, 60, 8, EASE_EXPO_OUT_16);
  const s2 = prog(f, 68, 8, EASE_EXPO_OUT_16);
  const base: React.CSSProperties = {
    fontFamily: FONT_SANS,
    fontWeight: 700,
    fontSize: 56,
    color: RED,
    whiteSpace: 'pre',
  };
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 476,
          height: 128,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: inP,
        }}
      >
        <div style={{ position: 'relative' }}>
          {/* RGB 分离：红/青两影 ±dxa 错开，screen 混合，主字最后压顶 */}
          <div style={{ ...base, position: 'absolute', left: 0, top: 0, transform: `translateX(${dxa}px)`, mixBlendMode: 'screen', opacity: 0.85 }}>
            {GLITCH_TXT}
          </div>
          <div style={{ ...base, position: 'absolute', left: 0, top: 0, color: CYAN, transform: `translateX(${-dxa}px)`, mixBlendMode: 'screen', opacity: 0.8 }}>
            {GLITCH_TXT}
          </div>
          {/* 主字自身也吃 1/4 幅度的抖动（dxb 与影不同哈希种子，错位不同步） */}
          <div style={{ ...base, position: 'relative', transform: `translateX(${dxb * 0.25}px)` }}>{GLITCH_TXT}</div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 640,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 400,
          fontSize: 32,
          lineHeight: 1.6,
          color: TEXT_DIM,
        }}
      >
        <div style={{ opacity: s1, filter: `blur(${(8 * (1 - s1)).toFixed(2)}px)` }}>主模型额度断供。</div>
        <div style={{ opacity: s2, filter: `blur(${(8 * (1 - s2)).toFixed(2)}px)` }}>它停摆了。</div>
      </div>
    </>
  );
};

export const S11: React.FC = () => {
  const f = useCurrentFrame();
  const outP = prog(f, 0, 30, EASE_INOUT);
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 时间轴场景退场：整体左移 200px + 淡出（终态定格复制件） */}
      {outP < 1 ? (
        <>
          <AbsoluteFill
            style={{
              background: `linear-gradient(180deg, ${BG_DARK}, ${SURFACE})`,
              opacity: 1 - outP,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translateX(${(-200 * outP).toFixed(2)}px)`,
              opacity: 1 - outP,
            }}
          >
            <Scene f={240} />
          </div>
        </>
      ) : null}
      {/* 故障文字 + 补充行 */}
      {f >= 30 ? <OfflineScene f={f} /> : null}
    </AbsoluteFill>
  );
};
