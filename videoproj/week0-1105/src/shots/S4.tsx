import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { prog, sinePulse, springIn, tf } from '../anim';
import { Card } from '../components/Card';
import {
  BLUE_BOT,
  BLUE_TOP,
  CORAL,
  FONT_MONO,
  FONT_SANS,
  FS_AUX,
  FS_DATA,
  FS_SLOGAN,
  GRAY,
  MID,
  PAPER,
} from '../theme';

// ============================================================================
// S4 · 480–600f（16.0–20.0s） 自拟（摄影棚灯光 + 手术台隐喻）
// 手术室蓝调径向渐变底；主句「不必像别人那样卖惨。」expo-out 入场；
// 两张手术记录卡左右 spring 飞入 → 双卡 pulse（scale 1→1.03→1）。
// 全局帧号见摄影表 S4；pad 氛围床（480f 起 8s，highpass 200Hz）属 R4 audio 轮。
// 字号偏差：卡内 28px 两行（时间戳/备注）低于硬线，按 S3 先例升至 32px（见 progress）。
// ============================================================================

type Record = {
  no: string;
  time: string;
  what: string;
  who: string;
  start: number; // 飞入起始全局帧
  dir: -1 | 1; // 飞入方向
};

const RECORDS: Record[] = [
  { no: '修复 #1', time: '11-03 23:47', what: '单点→环形降级链', who: '主人操刀 / 6 小时停机', start: 510, dir: -1 },
  { no: '修复 #2', time: '11-04 02:33', what: '主备 key 档位同步', who: '主人操刀 / 契约级改动', start: 540, dir: 1 },
];

const REC_W = 400;
const REC_H = 200;
const REC_GAP = 80; // 设计稿给定卡间距

export const S4: React.FC = () => {
  const g = useCurrentFrame() + 480; // 全局帧

  const sloganP = prog(g, 480, 30); // translateY(-30→0) + fadein，expo-out
  // 570–600f：双卡同时 pulse 1→1.03→1（30f 单程 = 周期 60 的半程）
  const pulse = 1 + 0.03 * sinePulse(g, 570, 60);

  const rowW = REC_W * 2 + REC_GAP;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle 900px at 50% 42%, ${BLUE_TOP} 0%, ${BLUE_BOT} 78%)` }}>
      {/* 主句（960,400 中心） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 360,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: FS_SLOGAN,
          lineHeight: '80px',
          color: PAPER,
          opacity: sloganP,
          transform: tf([`translateY(${(1 - sloganP) * -30}px)`]),
        }}
      >
        不必像别人那样卖惨。
      </div>

      {/* 两张手术记录卡（中心 960,650） */}
      <div
        style={{
          position: 'absolute',
          left: 960 - rowW / 2,
          top: 650 - REC_H / 2,
          width: rowW,
          display: 'flex',
          gap: REC_GAP,
          transform: tf([pulse !== 1 ? `scale(${pulse})` : null]),
        }}
      >
        {RECORDS.map((r) => {
          const s = springIn(g, r.start); // spring(1,80,10)
          return (
            <Card
              key={r.no}
              w={REC_W}
              h={REC_H}
              bg={MID}
              limeBorder
              shadow="0 4px 16px rgba(0,0,0,0.5)" // 设计稿 S4 指定（比全局 SHADOW 重）
              style={{
                opacity: Math.min(1, s * 1.4),
                transform: tf([`translateX(${(1 - s) * r.dir * 200}px)`]),
              }}
            >
              {/* 横 padding 20px：32px 底线字号下「主人操刀 / 6 小时停机」需 335px 内宽 */}
              <div style={{ padding: '16px 20px', boxSizing: 'border-box' }}>
                <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: FS_DATA, lineHeight: '48px', color: CORAL }}>{r.no}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: FS_AUX, lineHeight: '38px', color: GRAY }}>{r.time}</div>
                <div style={{ fontFamily: FONT_SANS, fontSize: FS_AUX, lineHeight: '38px', color: PAPER }}>{r.what}</div>
                <div style={{ fontFamily: FONT_SANS, fontSize: FS_AUX, lineHeight: '38px', color: GRAY }}>{r.who}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
