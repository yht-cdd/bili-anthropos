import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from 'remotion';
import { BODY_PX, CARD, CYAN, DIM, LINE, MAGENTA, NOTE_PX, TEXT, TITLE_PX } from '../theme';
import { enter, exitFade } from '../anim';

// S5 40.000-54.000 流水线解剖（420 帧）
// 幕1: 五节点竖排连线逐个点亮: 定时器叫醒→搜关键词→读内容→写报告→自动评论, 角标「刷18挑3」
// 幕2: 两个汉字一组算相似度 → 0.80 vs 拦截线0.55 → 红色「拦下」盖章 (本地帧300 = 全片50s 音效ding)
// 数字出处: videos/BV1Ymxj6vETK/ (刷18挑3, Jaccard>0.55拦截)
const NODES = ['定时器叫醒', '搜关键词', '读内容', '写报告', '自动评论'];
const ACT2 = 216;

export const S5: React.FC = () => {
  const frame = useCurrentFrame();
  const act1Out = frame > ACT2 - 6 ? exitFade(frame, ACT2 - 6) : {};
  const act2Out = frame > 408 ? exitFade(frame, 408) : {};

  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      {/* ── 幕1: 五节点流水线 ── */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', ...act1Out }}>
        <div style={{ fontSize: TITLE_PX * 0.8, fontWeight: 700, color: TEXT, marginTop: 250, ...enter(frame, 6) }}>
          流水线解剖
        </div>
        <div style={{ position: 'absolute', top: 195, right: 70, border: `2px solid ${CYAN}`, color: CYAN, borderRadius: 14, padding: '12px 26px', fontSize: NOTE_PX, fontWeight: 700, ...enter(frame, 90) }}>
          刷18挑3
        </div>
        <div style={{ width: 640, marginTop: 150, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {NODES.map((n, i) => {
            const delay = 36 + i * 30;
            const lit = frame >= delay + 14;
            const lineH = interpolate(frame - (delay - 14), [0, 12], [0, 40], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <React.Fragment key={n}>
                {i > 0 ? <div style={{ width: 4, height: lineH, backgroundColor: lit ? CYAN : LINE }} /> : null}
                <div style={{ width: 640, boxSizing: 'border-box', backgroundColor: CARD, border: `2px solid ${lit ? CYAN : LINE}`, boxShadow: lit ? `0 0 22px ${CYAN}55` : 'none', borderRadius: 18, padding: '26px 36px', fontSize: BODY_PX * 0.95, color: lit ? TEXT : DIM, display: 'flex', gap: 24, alignItems: 'center', ...enter(frame, delay) }}>
                  <span style={{ color: lit ? CYAN : DIM, fontSize: NOTE_PX, fontVariantNumeric: 'tabular-nums' }}>0{i + 1}</span>
                  {n}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── 幕2: Jaccard 查重 + 红章 ── */}
      {frame >= ACT2 ? (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', ...act2Out }}>
          <div style={{ fontSize: BODY_PX * 0.95, color: DIM, ...enter(frame, ACT2 + 10) }}>
            两个汉字一组 · 算相似度
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 44, marginTop: 80, ...enter(frame, ACT2 + 30) }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: TITLE_PX * 1.35, fontWeight: 700, color: MAGENTA, fontVariantNumeric: 'tabular-nums' }}>0.80</div>
              <div style={{ fontSize: NOTE_PX, color: DIM, marginTop: 10 }}>Jaccard 相似度</div>
            </div>
            <div style={{ fontSize: BODY_PX, color: DIM }}>vs</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: TITLE_PX * 1.35, fontWeight: 700, color: CYAN, fontVariantNumeric: 'tabular-nums' }}>0.55</div>
              <div style={{ fontSize: NOTE_PX, color: DIM, marginTop: 10 }}>拦截线</div>
            </div>
          </div>
          {frame >= 300 ? <Stamp frame={frame} /> : null}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

// 红色「拦下」盖章: 本地帧300起, scale 2.6→1 压下来
const Stamp: React.FC<{ frame: number }> = ({ frame }) => {
  const sp = spring({ frame: frame - 300, fps: 30, config: { damping: 16, mass: 0.7, overshootClamping: true } });
  const scale = interpolate(sp, [0, 1], [2.6, 1]);
  return (
    <div style={{ position: 'absolute', top: '62%', left: '50%', transform: `translate(-50%,-50%) rotate(-10deg) scale(${scale})`, opacity: sp, border: `10px solid ${MAGENTA}`, borderRadius: 22, padding: '14px 46px', color: MAGENTA, fontSize: TITLE_PX, fontWeight: 700, letterSpacing: 12, boxShadow: `0 0 40px ${MAGENTA}66, inset 0 0 24px ${MAGENTA}44` }}>
      拦下
    </div>
  );
};
