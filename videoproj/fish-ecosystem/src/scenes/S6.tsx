import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame } from 'remotion';
import { BODY_PX, CARD, CYAN, DIM, LINE, MAGENTA, NOTE_PX, TEXT, TITLE_PX } from '../theme';
import { enter, exitFade } from '../anim';

// S6 54.000-66.000 我也下场（360 帧）
// 16:41 我发第一条真人级评论（小字: 被自家闸门退稿2次，129字砍到71字）
// 17:25 鱼回我 — 卡片弹出「看看你，加油！」，定格1.5s（帧210后无动画直到退场）
// 出处: brief 素材来源-真实事件时间线 + 退稿记录
export const S6: React.FC = () => {
  const frame = useCurrentFrame();
  const out = frame > 348 ? exitFade(frame, 348) : {};

  return (
    <AbsoluteFill style={{ alignItems: 'center', ...out }}>
      <div style={{ fontSize: TITLE_PX * 0.62, fontWeight: 700, color: DIM, letterSpacing: 8, marginTop: 250, ...enter(frame, 6) }}>
        我也下场
      </div>

      {/* 16:41 我的评论 */}
      <div style={{ marginTop: 110, ...enter(frame, 24) }}>
        <div style={{ fontSize: BODY_PX * 1.15, fontWeight: 700, color: CYAN, fontVariantNumeric: 'tabular-nums' }}>16:41</div>
        <div style={{ width: 840, backgroundColor: CARD, border: `2px solid ${LINE}`, borderLeft: `8px solid ${CYAN}`, borderRadius: 22, padding: '36px 44px', marginTop: 22 }}>
          <div style={{ fontSize: BODY_PX * 0.95, color: TEXT }}>我发了第一条真人级评论</div>
          <div style={{ fontSize: NOTE_PX, color: DIM, marginTop: 16, ...enter(frame, 70) }}>
            被自家闸门退稿2次，129字砍到71字
          </div>
        </div>
      </div>

      {/* 间隔: 16分钟后 */}
      <div style={{ width: 4, height: 70, backgroundColor: LINE, marginTop: 36, ...enter(frame, 130) }} />
      <div style={{ fontSize: NOTE_PX, color: DIM, marginTop: 18, ...enter(frame, 140) }}>16 分钟后</div>

      {/* 17:25 鱼回我 — 卡片弹出后定格 */}
      <div style={{ marginTop: 44, ...enter(frame, 165) }}>
        <div style={{ fontSize: BODY_PX * 1.15, fontWeight: 700, color: MAGENTA, fontVariantNumeric: 'tabular-nums' }}>17:25 · 鱼回我</div>
        <div style={{ width: 840, backgroundColor: CARD, border: `2px solid ${MAGENTA}`, borderRadius: 22, padding: '42px 44px', marginTop: 22, textAlign: 'center', ...pop(frame, 180) }}>
          <div style={{ fontSize: TITLE_PX * 0.82, fontWeight: 700, color: TEXT }}>看看你，加油！</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 回信卡片弹出 (spring 入场, ~帧210 落定 → 定格到退场)
const pop = (frame: number, delay: number) => {
  const p = spring({ frame: frame - delay, fps: 30, config: { damping: 200, overshootClamping: true } });
  return {
    opacity: Math.max(0, Math.min(1, p)),
    transform: `translateY(${(1 - Math.max(0, Math.min(1, p))) * 46}px) scale(${0.92 + 0.08 * Math.max(0, Math.min(1, p))})`,
  };
};
