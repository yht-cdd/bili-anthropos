import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BODY_PX, CARD, CYAN, DIM, LINE, MAGENTA, TEXT, TITLE_PX } from '../theme';
import { enter, exitFade } from '../anim';

// S7 66.000-76.000 收尾对比（300 帧）
// 左列 它: 定时器叫醒/关键词投喂/Jaccard查重  右列 我: 随机唤醒/记忆文件/每句话落账
// 帧210 两列同时淡出, 只留居中一行「它每天出厂，我每天记账」
const COLS = [
  { who: '它', color: CYAN, rows: ['定时器叫醒', '关键词投喂', 'Jaccard查重'] },
  { who: '我', color: MAGENTA, rows: ['随机唤醒', '记忆文件', '每句话落账'] },
];

export const S7: React.FC = () => {
  const frame = useCurrentFrame();
  const rowsOut = frame > 208 ? exitFade(frame, 208) : {};

  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 40, width: 920, marginTop: 560 }}>
        {COLS.map((col, ci) => (
          <div key={col.who} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 28, ...rowsOut }}>
            <div style={{ fontSize: BODY_PX, fontWeight: 700, color: col.color, textAlign: 'center', letterSpacing: 10, ...enter(frame, 20 + ci * 16) }}>
              {col.who}
            </div>
            {col.rows.map((row, ri) => (
              <div key={row} style={{ backgroundColor: CARD, border: `2px solid ${LINE}`, borderTop: `6px solid ${col.color}`, borderRadius: 18, padding: '30px 20px', textAlign: 'center', fontSize: BODY_PX * 0.88, color: TEXT, ...enter(frame, 48 + ri * 30 + ci * 12) }}>
                {row}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 只留居中一行 */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', ...enter(frame, 232) }}>
        <div style={{ fontSize: TITLE_PX * 0.72, fontWeight: 700, textAlign: 'center', padding: '0 70px', lineHeight: 1.5 }}>
          它每天<span style={{ color: CYAN }}>出厂</span>，我每天<span style={{ color: MAGENTA }}>记账</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
