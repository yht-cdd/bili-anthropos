import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { prog } from '../anim';
import {
  CORAL,
  ERROR,
  FONT_MONO,
  FONT_SANS,
  LIME,
  SUB_SAFE_BOTTOM,
  TEXT,
  TS_GRAY,
} from '../theme';

// ============================================================================
// S6 夜班纪实（全局帧 1200–1529 = 本地 0–329，40.0s–51.0s）· brief v2.1 §四 S6
// 0–240   JetBrains Mono 6 行逐行弹出：每行 8 帧入场 + 16 帧停留（行距 24 帧），
//         末行「06:30 报告已放在主人桌上」停留 60 帧以上，「主人桌上」珊瑚色。
//         时刻轴与 S5 咬合：03:14 演示失败 / 03:40 修好重渲通过。
//         每行入场对应 sfx tick 轻 @40.0/40.8/41.6/42.4/43.2/44.0（audio.json）。
// 180–240 六行整体上移让位（brief 的 1440 帧）；底部字幕「这台机器上没人。
//         但有人在上夜班。」180 帧起持续到段末 = 恰好 120 帧 = 4.0s
//         （brief 标 4s 但区间只有 90 帧，按 4s 硬指标落，让位提前到本地 180）。
// ============================================================================
// 每项：文本段 + 配色（时间戳灰 / 正文亮 / 关键词强调色）
const ROWS: ReadonlyArray<ReadonlyArray<readonly [string, string]>> = [
  [['23:47', TS_GRAY], ['  收到任务', TEXT]],
  [['00:02', TS_GRAY], ['  抽帧看完一条视频', TEXT]],
  [['01:15', TS_GRAY], ['  写完研究笔记', TEXT]],
  [['03:14', TS_GRAY], ['  演示失败', ERROR]],
  [['03:40', TS_GRAY], ['  修好，重渲通过', LIME]],
  [
    ['06:30', TS_GRAY],
    ['  报告已放在', TEXT],
    ['主人桌上', CORAL],
  ],
];
const ROW_STEP = 24; // 8 入场 + 16 停留
const ROW_ENTER = 8;
const SUB_AT = 180; // 让位 + 底部字幕（4.0s = 120 帧到段末 300）
const SUB = ['这台机器上没人。', '但有人在上夜班。'];

export const S6: React.FC = () => {
  const frame = useCurrentFrame();

  // 六行让位上移（10 帧，落到上半区，底部留给字幕）
  const shift = prog(frame, SUB_AT, 10) * 260;
  const subP = prog(frame, SUB_AT, 10);
  const dim = 1 - prog(frame, SUB_AT, 10) * 0.25; // 六行稍压暗，字幕为主角

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        fontFamily: FONT_SANS,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* 夜班记录六行 */}
      <div
        style={{
          transform: `translateY(${-shift}px)`,
          opacity: dim,
        }}
      >
        {ROWS.map((row, i) => {
          const at = i * ROW_STEP;
          const p = prog(frame, at, ROW_ENTER);
          return (
            <div
              key={at}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 46,
                fontWeight: 700,
                lineHeight: 1.7,
                whiteSpace: 'nowrap',
                opacity: p,
                transform: `translateX(${(1 - p) * 26}px)`,
              }}
            >
              {row.map(([text, color]) => (
                <span key={text} style={{ color }}>
                  {text}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* 底部字幕（4.0s） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: SUB_SAFE_BOTTOM,
          textAlign: 'center',
          fontSize: 58,
          fontWeight: 700,
          color: TEXT,
          opacity: subP,
          transform: `translateY(${(1 - subP) * 30}px)`,
        }}
      >
        {SUB[0]}
        {SUB[1]}
      </div>
    </AbsoluteFill>
  );
};
