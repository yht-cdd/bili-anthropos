import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_LINEAR, EASE_SWEEP, prog } from '../anim';
import { COVER_DATA_URI } from '../coverData';
import { FONT_SANS, GRAY, TEXT } from '../theme';

// ============================================================================
// S8 尾卡 · 全局 1710–1800（brief §二·S8，§八 后移 30 → 压缩为 90 帧保总长 1800）· [camera] PushIn + [effects] brand-frame-snap
// 本地帧 = 全局 − 1710。
// ⚠️ brief 原文 1710/1770 两个子锚点是「原帧号 +30」直接平移的结果（1680→1710、1740→1770、1800 不变）：
//    窗口只剩 90 帧（3.0s）。brief 要求「总长仍 1800」与「后续镜号整体后移 30」只能这样同时成立。
// 0–90   v2 封面 PushIn：coverData（v3 定稿 16:9）scale 1.06→1.00 全程缓推（linear 相机辅助通道，
//        brief 未给速率；PushIn 长镜头匀速是常规，非主动效，linear 合规）+ 压暗底罩提亮至 0.25→0.42。
// 30–60（全局 1740–1770，brief 1710–1770 原锚点）：
//        「Anthropos_AI · week0」56px 米白 slam-lite（量级 1.10，不再占砸入计数）+
//        「下一周见」36px #8B949E 下挂 6 帧错峰。
// 60–90（全局 1770–1800）：小字 28px「工程开源 github.com/yht-cdd/bili-anthropos」淡入。
//        检查点帧 1770（brief §六.2 原值即此锚点）→ 小字入场第一帧 ✓。
// 退场：不做 —— 片尾直切黑（brand-frame-snap 的收帧感由 PushIn 减速承担）。
// ============================================================================

const L1 = 'Anthropos_AI · week0';
const L2 = '下一周见';
const L3 = '工程开源 github.com/yht-cdd/bili-anthropos';

export const S8: React.FC = () => {
  const f = useCurrentFrame();
  const push = prog(f, 0, 90, EASE_LINEAR); // PushIn 缓推全程
  const l1 = prog(f, 30, 8, EASE_SWEEP);
  const l1In = prog(f, 30, 5, EASE_LINEAR);
  const l2 = prog(f, 42, 8, EASE_SWEEP);
  const l3 = prog(f, 60, 10, EASE_LINEAR);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: FONT_SANS }}>
      <img
        src={COVER_DATA_URI}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${(1.06 - 0.06 * push).toFixed(4)})`,
        }}
      />
      {/* 压暗底罩：文字可读性（PushIn 同时轻微提亮，读作推近时光线涌来） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: `rgba(8,11,18,${(0.42 - 0.17 * push).toFixed(3)})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 402,
          width: 1920,
          textAlign: 'center',
          fontSize: 56,
          fontWeight: 800,
          color: TEXT,
          opacity: l1In,
          transform: `scale(${(1.1 - 0.1 * l1).toFixed(4)})`,
        }}
      >
        {L1}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 500,
          width: 1920,
          textAlign: 'center',
          fontSize: 36,
          color: GRAY,
          opacity: l2,
          transform: `translateY(${10 * (1 - l2)}px)`,
        }}
      >
        {L2}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 976,
          width: 1920,
          textAlign: 'center',
          fontSize: 28,
          color: GRAY,
          opacity: l3,
        }}
      >
        {L3}
      </div>
    </AbsoluteFill>
  );
};
