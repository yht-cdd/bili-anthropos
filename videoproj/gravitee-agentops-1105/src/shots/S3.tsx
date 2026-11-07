import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, blink, prog, typedLine } from '../anim';
import { CORAL, FONT_SANS, LIME, TERM_GRAY, TEXT } from '../theme';

// ============================================================================
// S3 问题 · 全局 330–630（brief §二·S3）· 配方卡 [interaction] 分屏对比 + [typography] 打字机
// 本地帧 = 全局 − 330。
// 0–8   左右分屏推入：左块 x−18、右块 x+18 → 0，8 帧 expo-out（brief Parallax 给定值；
//       库里无同名「分屏对比」卡，最接近 rhythm/quad-split-parallel-scenes，按其
//       「左右两屏各自独立入场、中缝对齐」语义实现，位移参数一律照 brief，记歧义）。
// 左 40%「管软件的常识」56px 米白 + 三行 36px 终端灰，Stagger step 12；
// 右 40%「agent 的现实」56px 珊瑚 + 两行 36px，「13 次」青柠（行内分段）。
// 150–156 中缝竖线 2px 珊瑚，6 帧从中心 grow（brief 480–540 窗内取中点起跑）。
// 230 起底部字幕 40px 打字机；⚠️ brief「32 字/s」≈0.94 帧/字 帧间不可实施，
//       取 1 帧/字符（帧确定无插值，typewriter 卡命门），17 字 230–247 打完，记歧义。
// ============================================================================

const LEFT_X = 130;
const RIGHT_X = 130;
const COL_W = 768; // 40% of 1920
const TITLE_Y = 210;
const ROW_Y = 340;
const ROW_H = 72;
const ROW_STEP = 12; // 三行逐行 Stagger step 12 帧（brief 给定）

const LEFT_ROWS = ['进程活着 = 服务正常', 'CPU 空闲 = 没事干', '重启一下 = 修好了'];

type Seg = { t: string; c: string };
const RIGHT_ROWS: Seg[][] = [
  [{ t: '进程一切正常', c: TERM_GRAY }],
  [
    { t: '可它整条线 ', c: TERM_GRAY },
    { t: '13 次', c: LIME },
    { t: '没醒来', c: TERM_GRAY },
  ],
];

const SUB = '它的命不在进程里，在模型额度里。';

export const S3: React.FC = () => {
  const f = useCurrentFrame();
  const push = prog(f, 0, 8, EASE_EXPO_OUT); // 分屏推入 8 帧
  const dx = 18 * (1 - push);
  const lineP = prog(f, 150, 6, EASE_EXPO_OUT); // 竖线 6 帧 grow
  const n = typedLine(f, 230, 0, 0, SUB.length, 1); // 1 帧/字
  // 光标三态（typewriter-moves 卡）：打字中常亮＝果断；完稿后 12 帧周期闪两下，随后摘除
  const done = n >= SUB.length;
  const cursorOn = done ? (f - 230 - SUB.length < 30 ? blink(f, 230 + SUB.length, 12) : 0) : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: '#080B12', fontFamily: FONT_SANS }}>
      {/* 左列：管软件的常识 */}
      <div
        style={{
          position: 'absolute',
          left: LEFT_X,
          top: TITLE_Y,
          width: COL_W,
          opacity: push,
          transform: `translateX(${-dx}px)`,
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, color: TEXT }}>管软件的常识</div>
        {LEFT_ROWS.map((row, i) => {
          const p = prog(f, 36 + i * ROW_STEP, 8, EASE_EXPO_OUT);
          return (
            <div
              key={row}
              style={{
                marginTop: i === 0 ? 46 : ROW_H - 36,
                fontSize: 36,
                color: TERM_GRAY,
                opacity: p,
                transform: `translateY(${16 * (1 - p)}px)`,
                whiteSpace: 'pre',
              }}
            >
              {row}
            </div>
          );
        })}
      </div>

      {/* 右列：agent 的现实 */}
      <div
        style={{
          position: 'absolute',
          right: RIGHT_X,
          top: TITLE_Y,
          width: COL_W,
          textAlign: 'right',
          opacity: push,
          transform: `translateX(${dx}px)`,
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, color: CORAL }}>agent 的现实</div>
        {RIGHT_ROWS.map((segs, i) => {
          const p = prog(f, 36 + i * ROW_STEP, 8, EASE_EXPO_OUT);
          return (
            <div
              key={i}
              style={{
                marginTop: i === 0 ? 46 : ROW_H - 36,
                fontSize: 36,
                opacity: p,
                transform: `translateY(${16 * (1 - p)}px)`,
                whiteSpace: 'pre',
              }}
            >
              {segs.map((sg, j) => (
                <span key={j} style={{ color: sg.c }}>
                  {sg.t}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* 中缝竖线：2px 珊瑚，从画心向两端 grow */}
      <div
        style={{
          position: 'absolute',
          left: 959,
          top: 180 + (240 * (1 - lineP)),
          width: 2,
          height: 720 * lineP,
          backgroundColor: CORAL,
          opacity: lineP > 0 ? 0.9 : 0,
        }}
      />

      {/* 底部字幕打字机 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 130,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: TEXT, whiteSpace: 'pre' }}>
          {SUB.slice(0, n)}
          <span
            style={{
              display: 'inline-block',
              width: 20,
              height: 40,
              marginLeft: 4,
              backgroundColor: TEXT,
              opacity: n > 0 ? cursorOn : 0,
              verticalAlign: '-6px',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
