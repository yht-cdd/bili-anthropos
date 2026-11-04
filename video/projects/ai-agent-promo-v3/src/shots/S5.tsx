import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, lerpF, prog, springIn } from '../anim';
import { ChatBubble } from '../components/ChatBubble';
import { Timestamp } from '../components/Timestamp';
import {
  BG,
  BLUE,
  DIFF_ADD_BG,
  DIFF_DEL_BG,
  FONT_MONO,
  FONT_SANS,
  GREEN,
  GRAY,
  RED_SOFT,
  SURFACE,
} from '../theme';

// ============================================================================
// 镜5 · 570–750 帧（19.0s–25.0s）diff「日报读错了表，修掉推上去」 — brief-v3 §三【镜头 5】
// 本地帧：0–30 气泡（y=260）；60–150 对比窗口 900x360（x=860 y=180），
// 入场 scale(0.95)+blur(4px) expo-out 12 帧；CI 图标 105 帧（全局 675）
// spring(1,100,8) 6 帧弹入；150–165 时间戳 [23:08]；165–180 快切退场。
// 内容即 v2 真事：真 commit 0a4cb43，videos→watched（公开仓库可查）。
// ============================================================================

export const S5: React.FC = () => {
  const f = useCurrentFrame();
  const bubP = prog(f, 0, 12, EASE_EXPO_OUT);
  const winP = prog(f, 60, 12, EASE_EXPO_OUT);
  const ciS = springIn(f, 105, { tension: 100, friction: 8 });
  const tsP = prog(f, 150, 6, EASE_EXPO_OUT);
  const exit = 1 - lerpF(f, [165, 169], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div style={{ position: 'absolute', inset: 0, opacity: exit }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-80 * (1 - bubP)}px)`, opacity: bubP }}>
          <ChatBubble text="日报读错了表，修掉推上去" x={160} y={260} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 860,
            top: 180,
            width: 900,
            height: 360,
            backgroundColor: SURFACE,
            borderRadius: 12,
            fontFamily: FONT_MONO,
            opacity: winP,
            transform: `scale(${0.95 + 0.05 * winP})`,
            filter: `blur(${(4 * (1 - winP)).toFixed(2)}px)`,
            overflow: 'hidden',
            boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          }}
        >
          {/* 顶栏：diff 标签 */}
          <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 14, color: GRAY }}>
            reports/daily.sql
          </div>
          {/* 左右分栏 */}
          <div style={{ display: 'flex', height: 250 }}>
            <div
              style={{
                width: 440,
                backgroundColor: DIFF_DEL_BG,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 36,
                fontSize: 16,
                color: RED_SOFT,
              }}
            >
              -FROM videos
            </div>
            <div style={{ width: 20, backgroundColor: BLUE }} />
            <div
              style={{
                width: 440,
                backgroundColor: DIFF_ADD_BG,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 36,
                fontSize: 16,
                color: GREEN,
              }}
            >
              +FROM watched
            </div>
          </div>
          {/* 底部：commit + CI 状态 */}
          <div style={{ height: 74, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px' }}>
            <span style={{ fontSize: 14, color: GRAY }}>0a4cb43</span>
            <div
              style={{
                width: 16,
                height: 16,
                transform: `scale(${Math.max(0, ciS)})`,
                opacity: f >= 105 ? Math.min(1, ciS * 2) : 0,
              }}
            >
              <svg width={16} height={16} viewBox="0 0 16 16">
                <path d="M2 8.5 L6 12.5 L14 3.5" stroke={GREEN} strokeWidth={2.5} fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontFamily: FONT_SANS, fontWeight: 400, fontSize: 14, color: GRAY }}>passed</span>
          </div>
        </div>

        <Timestamp text="[23:08]" opacity={tsP} />
      </div>
    </AbsoluteFill>
  );
};
