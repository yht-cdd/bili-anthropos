import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { prog, tf } from '../anim';
import {
  BG,
  FONT_MONO,
  FONT_SANS,
  FS_CODE,
  FS_SLOGAN,
  GRAY,
  LEDGER,
  MID,
  PAPER,
  RADIUS,
  RED,
  SHADOW,
} from '../theme';

// ============================================================================
// S6 · 720–840f（24.0–28.0s） [interaction] type-and-filter（简化版）
// #1A1F2C 底；顶部标语「这一周以来，」fadein；中央模拟终端窗（1200×500）8 行活动
// 日志逐行浮现（每行 6f，间隔加速 12→8→6f；tick 连发递减归 R4 audio）。
// 日志行 28px Mono = 终端装饰层底线字号（§一 允许，无偏差）。
// 行内 [时间戳] 用次要灰，正文账本绿；「⚠️ 断供」行转红（红色仅断供一词）。
// ============================================================================

// 设计稿 §S6 mock 逐字照抄（数据已脱敏：假 hash / cid=… 占位）
const LOGS: Array<{ time: string; text: string; alert?: boolean }> = [
  { time: '11-01 03:24', text: '视频投稿成功 BV1xx...' },
  { time: '11-01 14:07', text: 'commit da3f2e1: 修复ASR时间轴对齐' },
  { time: '11-02 09:15', text: '私信回复 @用户A 关于开源协议' },
  { time: '11-02 22:33', text: '日记写入 day2.md' },
  { time: '11-03 11:42', text: '删除不当评论 cid=...' },
  { time: '11-03 23:47', text: '⚠️ 断供 6h（人工修复中）', alert: true },
  { time: '11-04 08:19', text: '视频渲染完成 18 镜头' },
  { time: '11-04 15:55', text: 'commit 8b2a9f4: 音画同步修正' },
];

// 逐行起点：750 起，间隔加速 12f→8→6f（8 行 7 个间隔）
const LINE_STARTS = [750, 762, 773, 783, 792, 800, 807, 813];

export const S6: React.FC = () => {
  const g = useCurrentFrame() + 720; // 全局帧

  // 修复 R7（720f 切镜空帧，照 1410f 先例）：标语 fadein 起点提前 2f → 720 帧 p≈0.36，
  // 消除 S5→S6 切镜 1 帧纯 MID 无文字空帧；SEG 窗 720–840 未动。
  const sloganP = prog(g, 718, 30);

  return (
    <AbsoluteFill style={{ backgroundColor: MID }}>
      {/* 顶部标语（960,180） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 180 - 40,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: FS_SLOGAN,
          lineHeight: '80px',
          color: PAPER,
          opacity: sloganP,
        }}
      >
        这一周以来，
      </div>

      {/* 模拟终端窗（1200×500 中心 960,450 → top=200 让位标语下沿） */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 600,
          top: 230,
          width: 1200,
          height: 500,
          backgroundColor: BG,
          borderRadius: RADIUS,
          border: '1px solid rgba(63,182,139,0.22)',
          boxShadow: SHADOW,
          padding: '28px 40px',
          boxSizing: 'border-box',
          opacity: prog(g, 740, 16),
        }}
      >
        {/* 终端顶栏三点 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['#F0524D', '#D97757', '#3FB68B'].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c, opacity: 0.7 }} />
          ))}
        </div>
        {LOGS.map((l, i) => {
          const p = prog(g, LINE_STARTS[i], 6);
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT_MONO,
                fontSize: FS_CODE,
                lineHeight: '48px',
                whiteSpace: 'pre',
                opacity: p,
                transform: tf([`translateY(${(1 - p) * 10}px)`]),
              }}
            >
              <span style={{ color: GRAY }}>[{l.time}] </span>
              <span style={{ color: l.alert ? RED : LEDGER }}>{l.text}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
