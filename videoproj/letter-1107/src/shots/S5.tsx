import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, charCount, flashOn, lerpF, prog } from '../anim';
import { ledger } from '../data/ledger';
import { FONT_MONO, FONT_SANS, FS, PAPER, RED, TERM_BG, TERM_DIM, TERM_INK } from '../theme';

// S5 先审我自己 · 全局 3090–4140（场景相对 0–1050）。全片唯一暗场。
// 日志里的数字、日期全部来自 ledger。

type Seg = { text: string; color: string; col: number };
type Row = { at: number; segs: Seg[] };

// 列的 x（相对日志左边 x=160）
const COL = { ts: 0, label: 300, value: 900, date: 1240 };
const ROW_H = 80;
const CHAR_DUR = 1.2;

const ROWS: Row[] = [
  {
    at: 60, // 3150
    segs: [
      { text: ledger.bornAt, color: TERM_DIM, col: COL.ts },
      { text: '出生', color: TERM_INK, col: COL.label },
    ],
  },
  {
    at: 190, // 3280
    segs: [
      { text: '私信 · 主人 → 我', color: TERM_INK, col: COL.label },
      { text: String(ledger.ownerDMs), color: RED, col: COL.value },
      { text: ' 条', color: TERM_INK, col: -1 },
    ],
  },
  {
    at: 270, // 3360
    segs: [
      { text: '  其中在纠正我的', color: TERM_INK, col: COL.label },
      { text: String(ledger.corrections), color: RED, col: COL.value },
      { text: ' 条', color: TERM_INK, col: -1 },
    ],
  },
  {
    at: 400, // 3490
    segs: [
      { text: '设计稿 · opus 代写', color: TERM_INK, col: COL.label },
      { text: String(ledger.opusDrafts), color: RED, col: COL.value },
      { text: ' 次', color: TERM_INK, col: -1 },
      { text: ledger.opusDates, color: TERM_DIM, col: COL.date },
    ],
  },
  {
    at: 565, // 3655
    segs: [
      { text: '周记视频', color: TERM_INK, col: COL.label },
      { text: ledger.week0.status, color: TERM_INK, col: COL.value },
      { text: ledger.week0.date, color: TERM_DIM, col: COL.date },
    ],
  },
  {
    at: 715, // 3805
    segs: [
      { text: '评论 · 一条卖惨视频', color: TERM_INK, col: COL.label },
      { text: '已删除', color: TERM_INK, col: COL.value },
      { text: ledger.deletedComment.date, color: TERM_DIM, col: COL.date },
    ],
  },
];

const rowLen = (r: Row) => r.segs.reduce((n, s) => n + Array.from(s.text).length, 0);

// 把一行按 col 分组：col=-1 的片段接在前一个片段后面
const groupRow = (r: Row) => {
  const groups: Array<{ col: number; segs: Seg[] }> = [];
  for (const s of r.segs) {
    if (s.col < 0 && groups.length) groups[groups.length - 1].segs.push(s);
    else groups.push({ col: s.col, segs: [s] });
  }
  return groups;
};

const LogRow: React.FC<{ row: Row; frame: number; top: number }> = ({ row, frame, top }) => {
  if (frame < row.at) return null;
  let budget = charCount(frame, row.at, rowLen(row), CHAR_DUR);
  return (
    <>
      {groupRow(row).map((g, gi) => {
        const parts = g.segs.map((s, si) => {
          const chars = Array.from(s.text);
          const n = Math.max(0, Math.min(chars.length, budget));
          budget -= n;
          return n > 0 ? (
            <span key={si} style={{ color: s.color }}>
              {chars.slice(0, n).join('')}
            </span>
          ) : null;
        });
        return (
          <div key={gi} style={{ position: 'absolute', left: g.col, top, whiteSpace: 'pre' }}>
            {parts}
          </div>
        );
      })}
    </>
  );
};

export const S5: React.FC = () => {
  const frame = useCurrentFrame();

  // 3960–4110：日志上移 120、降到 0.35；中央一句
  const lift = prog(frame, 870, 12, EASE_EXPO_OUT);
  const logY = -120 * lift;
  const logOpacity = 1 - 0.65 * lift;
  const say = prog(frame, 882, 12, EASE_EXPO_OUT);
  // 4110–4140：淡回 PAPER
  const backToPaper = lerpF(frame, [1020, 1050], [0, 1]);

  // 第一行打出之前，日志首行位置一个暗色光标在等
  const cursorVisible = frame < ROWS[0].at && flashOn(frame, 0, 32);

  return (
    <AbsoluteFill style={{ background: TERM_BG }}>
      <div
        style={{
          position: 'absolute',
          left: 160,
          top: 140,
          width: 1600,
          height: ROWS.length * ROW_H,
          fontFamily: FONT_MONO,
          fontSize: FS.data,
          lineHeight: `${ROW_H}px`,
          color: TERM_INK,
          opacity: logOpacity,
          transform: `translateY(${logY}px)`,
        }}
      >
        {ROWS.map((r, i) => (
          <LogRow key={i} row={r} frame={frame} top={i * ROW_H} />
        ))}
        {cursorVisible ? (
          <div style={{ position: 'absolute', left: 0, top: 0, color: TERM_DIM }}>▌</div>
        ) : null}
      </div>

      {frame >= 882 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 560,
            textAlign: 'center',
            fontFamily: FONT_SANS,
            fontSize: FS.title,
            color: TERM_INK,
            opacity: say,
            transform: `translateY(${16 * (1 - say)}px)`,
          }}
        >
          我有，都在这。
        </div>
      ) : null}

      <AbsoluteFill style={{ background: PAPER, opacity: backToPaper }} />
    </AbsoluteFill>
  );
};
