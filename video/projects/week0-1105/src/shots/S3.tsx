import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { flashOn, prog, sinePulse } from '../anim';
import {
  BG,
  FONT_MONO,
  FONT_SANS,
  FS_CAPTION,
  FS_DATA,
  FS_SLOGAN,
  FS_AUX,
  LEDGER,
  PAPER,
  RED,
} from '../theme';

// ============================================================================
// S3 · 330–480f（11.0–16.0s） [data] timeline-travel + [effects] light-play-moves
// 7 天额度柱状从左到右加速生长（pop 连发同拍）→ 11-03/11-04 变红闪烁（buzz）→
// 底部「13次轮询 / 0次响应」fadein+pulse（error）。局部帧 = 全局帧 − 330。
// ★主句「api模型每天日拨额度，」逐字（标点不动）。「断供 6h」标注由设计稿 24px
// 升至 32px（§五 翻车预防5：辅助文字 ≥32px 硬线，二者冲突取硬线，见 progress 偏差记录）。
// ============================================================================

const SLOGAN = 'api模型每天日拨额度，'; // ★ 逐字，标点不动

// 7 天（10-30 至 11-04）额度 mock：剩余百分比；后两天断供
const DAYS: Array<{ day: string; pct: number; out: boolean }> = [
  { day: '10-30', pct: 86, out: false },
  { day: '10-31', pct: 92, out: false },
  { day: '11-01', pct: 78, out: false },
  { day: '11-02', pct: 95, out: false },
  { day: '11-03', pct: 0, out: true }, // 断供 6h
  { day: '11-04', pct: 0, out: true }, // 断供 6h
  { day: '11-05', pct: 41, out: false }, // 复位日（部分消耗）
];

// 柱状生长起点（音效表同序）：间隔加速 10→8→6→6→4→4f
const BAR_STARTS = [360, 370, 378, 384, 390, 394, 398];

const CELL_W = 200;
const GAP = 32; // = grid gutter
const BAR_W = 120;
const BAR_MAX = 200; // 额度条最大高度（区域内）

export const S3: React.FC = () => {
  const g = useCurrentFrame() + 330; // 全局帧

  // 修复 R7（330f 切镜空帧，照 1410f 先例）：标语 fadein 起点提前 2f → 330 帧 p≈0.36，
  // 消除 S2→S3 切镜 1 帧纯黑空帧；SEG 窗 330–480 未动。
  const sloganP = prog(g, 328, 30);

  // 420–450f：11-03/11-04 在 #3FB68B ↔ #F0524D 之间闪烁（半周期 5f，约闪 3 次）
  // 闪烁窗外：断供柱从生长起即为红（红色专用于「断供」一词，§七·4）
  const blinkWindow = g >= 420 && g < 450;
  const redNow = (out: boolean): boolean => out && (!blinkWindow || flashOn(g, 420, 10));

  // 450–480f：底部文字 fadein + pulse
  const footP = prog(g, 450, 30);
  const footPulse = 1 + 0.02 * sinePulse(g, 450, 30);

  const rowW = CELL_W * 7 + GAP * 6;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 顶部标语（960,150） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 150 - 40,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: FS_SLOGAN,
          lineHeight: '80px',
          color: PAPER,
          opacity: sloganP,
        }}
      >
        {SLOGAN}
      </div>

      {/* 时间轴：7 根柱（区域中心 960,460） */}
      <div
        style={{
          position: 'absolute',
          left: 960 - rowW / 2,
          top: 300,
          width: rowW,
          height: 320,
          display: 'flex',
          gap: GAP,
          alignItems: 'flex-end',
        }}
      >
        {DAYS.map((d, i) => {
          const grow = prog(g, BAR_STARTS[i], 8);
          const red = d.out && redNow(d.out);
          const h = Math.max(d.pct > 0 ? (d.pct / 100) * BAR_MAX : 8, 8) * grow;
          return (
            <div key={d.day} style={{ width: CELL_W, display: 'flex', flexDirection: 'column', alignItems: 'center', height: 320 }}>
              {/* 日期标签（顶部） */}
              <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: FS_DATA, color: PAPER, opacity: prog(g, BAR_STARTS[i] - 4, 8) }}>
                {d.day}
              </div>
              {/* 额度条（底部对齐生长） */}
              <div style={{ flex: 1, width: BAR_W, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div
                  style={{
                    width: BAR_W,
                    height: h,
                    backgroundColor: red ? RED : LEDGER,
                    borderRadius: '4px 4px 0 0',
                    boxShadow: red ? '0 0 16px rgba(240,82,77,0.4)' : 'none',
                  }}
                />
              </div>
              {/* 额度数值 */}
              <div style={{ fontFamily: FONT_MONO, fontSize: FS_AUX, color: red ? RED : PAPER, marginTop: 8, opacity: prog(g, BAR_STARTS[i] + 2, 8) }}>
                {d.out ? '0%' : `${d.pct}%`}
              </div>
            </div>
          );
        })}
      </div>

      {/* 断供标注（11-03/11-04 柱下方） */}
      {DAYS.map((d, i) =>
        d.out ? (
          <div
            key={d.day}
            style={{
              position: 'absolute',
              left: 960 - rowW / 2 + i * (CELL_W + GAP) + CELL_W / 2 - 60,
              top: 640,
              width: 120,
              textAlign: 'center',
              fontFamily: FONT_SANS,
              fontWeight: 700,
              fontSize: FS_AUX, // 设计稿 24px → 硬线 32px（见文件头偏差记录）
              color: RED,
              opacity: prog(g, 420, 8) * (blinkWindow && !flashOn(g, 420, 10) ? 0.55 : 1),
            }}
          >
            断供 6h
          </div>
        ) : null,
      )}

      {/* 底部（960,800）：仅断供期间显示 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 800 - 32,
          textAlign: 'center',
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: FS_CAPTION,
          lineHeight: '64px',
          color: RED,
          opacity: footP,
          transform: `scale(${footPulse})`,
        }}
      >
        13次轮询 / 0次响应
      </div>
    </AbsoluteFill>
  );
};
