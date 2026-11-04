import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, lerpF, prog, springIn, tf } from '../anim';
import { ChatBubble } from '../components/ChatBubble';
import { Timestamp } from '../components/Timestamp';
import { BG, FONT_MONO, FONT_SANS, GRAY, ORANGE, SURFACE_CARD2, TEXT, TEXT_DIM } from '../theme';

// ============================================================================
// 镜4 · 390–570 帧（13.0s–19.0s）「把今天的值班写成日记」 — brief-v3 §三【镜头 4】
// 本地帧：0–30 气泡（y=280，同镜3曲线）；60–150 文件卡片 700x320（x=980 y=200，
// #161D2B 圆角 16），入场 y+60 scale(0.96) spring(1,90,12) 10 帧；
// 150–165 时间戳 [21:47] 淡入；165–180 四帧快切退场。
// 日记正文为设计稿指定文案（虚构化，仅数字 21,141 字节为真实值）。
// ============================================================================

const MD_LINES = ['# 2026-11-01 值班日志', '', '今天处理了 4 个任务，主要集中在……'];

export const S4: React.FC = () => {
  const f = useCurrentFrame();
  const bubP = prog(f, 0, 12, EASE_EXPO_OUT);
  const cardS = springIn(f, 60, { tension: 90, friction: 12 }); // 允许 spring 过冲（回弹手感）
  const tsP = prog(f, 150, 6, EASE_EXPO_OUT);
  const exit = 1 - lerpF(f, [165, 169], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div style={{ position: 'absolute', inset: 0, opacity: exit }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-80 * (1 - bubP)}px)`, opacity: bubP }}>
          <ChatBubble text="把今天的值班写成日记" x={160} y={280} />
        </div>

        {f >= 60 ? (
          <div
            style={{
              position: 'absolute',
              left: 980,
              top: 200,
              width: 700,
              height: 320,
              backgroundColor: SURFACE_CARD2,
              borderRadius: 16,
              opacity: Math.min(1, 0.25 + cardS),
              transform: tf([
                `translateY(${(60 * (1 - cardS)).toFixed(2)}px)`,
                `scale(${(0.96 + 0.04 * cardS).toFixed(4)})`,
              ]),
              padding: '28px 32px',
              boxSizing: 'border-box',
              boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
            }}
          >
            {/* 顶部：文件图标 + 文件名 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 5,
                  backgroundColor: ORANGE,
                  clipPath: 'polygon(0 0, 72% 0, 100% 28%, 100% 100%, 0 100%)',
                }}
              />
              <span style={{ fontFamily: FONT_SANS, fontWeight: 500, fontSize: 20, color: TEXT }}>
                diary/11-01.md
              </span>
            </div>
            {/* 正文：Markdown 预览前三行 */}
            <div
              style={{
                marginTop: 22,
                fontFamily: FONT_SANS,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.6,
                color: TEXT_DIM,
                whiteSpace: 'pre-wrap',
              }}
            >
              {MD_LINES.map((l, i) => (
                <div key={i} style={{ minHeight: 16 }}>
                  {l}
                </div>
              ))}
            </div>
            {/* 底部：文件大小 */}
            <div style={{ position: 'absolute', left: 32, bottom: 22, fontFamily: FONT_MONO, fontSize: 14, color: GRAY }}>
              21,141 字节
            </div>
          </div>
        ) : null}

        <Timestamp text="[21:47]" opacity={tsP} />
      </div>
    </AbsoluteFill>
  );
};
