import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { blink, EASE_EXPO_OUT, lerpF, prog, typedLine } from '../anim';
import { ChatBubble } from '../components/ChatBubble';
import { Timestamp } from '../components/Timestamp';
import { BG, CORAL, FONT_MONO, GRAY, SURFACE, TEXT_DIM } from '../theme';

// ============================================================================
// 镜3 · 210–390 帧（7.0s–13.0s）「把昨天改过的文件列出来」 — brief-v3 §三【镜头 3】
// 本地帧：0–30 气泡左滑入（x-80→0，expo-out 12 帧，槽余量 hold）；
// 60–150 终端 800x280（x=1000 y=240），入场 scale(0.94→1) 10 帧，
// 打字每行延迟 8 帧 / 每字符 1.5 帧，光标 block 8x16 珊瑚 12 帧周期闪；
// 150–165 时间戳 [22:14] 淡入 6 帧；165–180 全场 4 帧快切退场。
// R1b 注：终端壳内联，不用 components/Panel —— 该文件在两轮子代理间被并行
// 进程改过 API（titleSize/bg），为避免竞态不再依赖共享组件。
// ============================================================================

const GIT_LINES = [
  '$ git log --since="yesterday" --name-only --oneline',
  '0a4cb43 Fix daily report query',
  'reports/daily.sql',
  'a3f2e10 Update diary template',
  'diary/template.md',
];
const TYPE_AT = 65; // 终端入场（60）+5 帧 ≈ 全局 275 = §C 打字音开始帧
const LINE_GAP = 8; // 原稿节奏帧数沿用
const CHAR_DUR = 1.5;
const TERM_W = 800;
const TERM_H = 280;

export const S3: React.FC = () => {
  const f = useCurrentFrame();
  const bubP = prog(f, 0, 12, EASE_EXPO_OUT);
  const termP = prog(f, 60, 10, EASE_EXPO_OUT);
  const tsP = prog(f, 150, 6, EASE_EXPO_OUT);
  const exit = 1 - lerpF(f, [165, 169], [0, 1]); // 4 帧快切
  const cursorOn = blink(f, TYPE_AT, 12);
  const typing = f >= TYPE_AT && f < 165;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div style={{ position: 'absolute', inset: 0, opacity: exit }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-80 * (1 - bubP)}px)`, opacity: bubP }}>
          <ChatBubble text="把昨天改过的文件列出来" x={160} y={300} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 1000,
            top: 240,
            width: TERM_W,
            height: TERM_H,
            backgroundColor: SURFACE,
            borderRadius: 12,
            fontFamily: FONT_MONO,
            opacity: termP,
            transform: `scale(${0.94 + 0.06 * termP})`,
            overflow: 'hidden',
            boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 14, color: GRAY }}>
            anthropos@local
          </div>
          <div style={{ padding: '16px 20px', fontSize: 14, lineHeight: 1.85, color: TEXT_DIM }}>
            {GIT_LINES.map((line, i) => {
              const n = typedLine(f, TYPE_AT, i, LINE_GAP, line.length, CHAR_DUR);
              const isLast = i === GIT_LINES.length - 1;
              const lineDone = n >= line.length;
              return (
                <div key={i} style={{ whiteSpace: 'pre' }}>
                  {line.slice(0, n)}
                  {typing && isLast && lineDone && cursorOn === 1 ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 16,
                        backgroundColor: CORAL,
                        marginLeft: 2,
                        verticalAlign: 'middle',
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <Timestamp text="[22:14]" opacity={tsP} />
      </div>
    </AbsoluteFill>
  );
};
