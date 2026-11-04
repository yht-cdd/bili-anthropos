import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { blink, EASE_EXPO_OUT, lerpF, prog, sinePulse, typedLine } from '../anim';
import {
  AMBER,
  BG,
  CORAL,
  CYAN,
  FONT_MONO,
  FONT_SANS,
  GRAY,
  HL_BG,
  SURFACE,
  TEXT_DIM,
} from '../theme';

// ============================================================================
// 镜7 · 810–1050 帧（27.0s–35.0s）Retry 4/∞ 终端 — brief-v3 §三【镜头 7】
// 本地帧：0–30 主文字缩为顶部标签。设计稿自相矛盾（曲线节 translateY 只 -80，
//   画面节要求「成为顶部标签」）→ 取叙事意图：从镜6 中心位（y≈490）上移至
//   y=80、scale 0.5（72→36px）、opacity 0.7。记歧义清单。
// 30–60 终端 1000x560 居中，30–42 perspective(800px) rotateX(-8→0)
//   translateZ(-200→0) expo-out 12 帧；打字本地 60 起跑（全局 870=打字音重启），
//   每行延迟 12 帧 / 每字符 1.5 帧。
// 120–126（全局 930）「Analysis: line 47」行黄色高亮 0→0.8 sine pulsing；
// 150–162（全局 960）青色扫描线 0→220 linear 12 帧，落定后留 4px 青色描边框；
// 180（全局 990）起 Patching 行右侧珊瑚 spinner 4 帧/圈；
// 210–240 停留 + 光标闪烁。全局 1005–1013 静音缺口属音频层（R2）。
// 正文 20px：设计稿未给镜7字号，介于镜1(14px)/镜5(16px) 之上取可读值，记歧义清单。
// 几何：header 40 + 正文 paddingTop 44 + 行高 44 → 第 4 行（Root cause）底缘
//   恰在 y=220，与扫描线终点吻合。
// ============================================================================

const LINES = [
  '[03:38:14] Retry 4/∞',
  '[03:38:15] Reading error log...',
  '[03:38:47] Analysis: line 47',
  '[03:38:48] Root cause: --concurrency 8 exceeds limit',
  '[03:38:49] Patching config...',
];
const HL_ROW = 2; // 黄色高亮行
const SCAN_ROW = 3; // 扫描线框定行（行底 y=220）
const SPIN_ROW = 4; // spinner 行
const TYPE_AT = 60;
const LINE_GAP = 12;
const CHAR_DUR = 1.5;
const HEADER_H = 40;
const BODY_PAD_TOP = 44;
const ROW_H = 44;

export const S7: React.FC = () => {
  const f = useCurrentFrame();
  const labelP = prog(f, 0, 30, EASE_EXPO_OUT);
  const termP = prog(f, 30, 12, EASE_EXPO_OUT);
  // 高亮：6 帧 sine 半波 0→0.8，126 帧后保持 0.8
  const hlOpacity = f < 120 ? 0 : f < 126 ? 0.8 * sinePulse(f, 120, 6) : 0.8;
  // 扫描线：150–162 y 0→220 linear；162 后线消失、描边框留下
  const scanY = 220 * lerpF(f, [150, 162], [0, 1]);
  const scanDone = f >= 162;
  const spinDeg = f >= 180 ? (((f - 180) % 4) / 4) * 360 : 0;
  const cursorOn = blink(f, TYPE_AT, 12);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 顶部标签（镜6 主文字缩入；起点 y=490 与镜6 中心位对齐保证跨镜连续） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 80 + (490 - 80) * (1 - labelP),
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: 72,
          color: CORAL,
          transform: `scale(${1 - 0.5 * labelP})`,
          opacity: 1 - 0.3 * labelP,
        }}
      >
        但它没放弃。
      </div>

      {/* 终端：3D 入场 */}
      <div style={{ perspective: 800 }}>
        <div
          style={{
            position: 'absolute',
            left: (1920 - 1000) / 2,
            top: (1080 - 560) / 2,
            width: 1000,
            height: 560,
            backgroundColor: SURFACE,
            borderRadius: 16,
            fontFamily: FONT_MONO,
            opacity: termP,
            transform: `rotateX(${(-8 * (1 - termP)).toFixed(3)}deg) translateZ(${(-200 * (1 - termP)).toFixed(2)}px)`,
            boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
            overflow: 'hidden',
          }}
        >
          <div style={{ height: HEADER_H, display: 'flex', alignItems: 'center', padding: '0 18px', fontSize: 14, color: GRAY }}>
            anthropos@local ~ [03:38]
          </div>
          <div style={{ paddingTop: BODY_PAD_TOP, paddingLeft: 36, paddingRight: 36, fontSize: 20, color: TEXT_DIM }}>
            {LINES.map((line, i) => {
              const n = typedLine(f, TYPE_AT, i, LINE_GAP, line.length, CHAR_DUR);
              const isHl = i === HL_ROW;
              const isScan = i === SCAN_ROW;
              const isSpin = i === SPIN_ROW;
              return (
                <div
                  key={i}
                  style={{
                    height: ROW_H,
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'pre',
                    background: isHl && hlOpacity > 0 ? HL_BG : 'transparent',
                    color: isHl && hlOpacity > 0.3 ? AMBER : TEXT_DIM,
                    boxShadow: isScan && scanDone ? `0 0 0 4px ${CYAN}` : 'none',
                    borderRadius: isScan && scanDone ? 4 : 0,
                    paddingLeft: 10,
                    marginLeft: -10,
                    paddingRight: 10,
                  }}
                >
                  {line.slice(0, n)}
                  {isSpin && f >= 180 ? (
                    <span
                      style={{
                        marginLeft: 16,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: `2.5px solid ${CORAL}`,
                        borderTopColor: 'transparent',
                        display: 'inline-block',
                        transform: `rotate(${spinDeg}deg)`,
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                  {i === LINES.length - 1 && n >= line.length && cursorOn === 1 ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 18,
                        backgroundColor: CORAL,
                        marginLeft: 3,
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          {/* 扫描线：从窗口顶 y=0 扫到行底 y=220，12 帧 linear */}
          {f >= 150 && !scanDone ? (
            <div
              style={{
                position: 'absolute',
                left: 28,
                right: 28,
                top: scanY,
                height: 2,
                backgroundColor: CYAN,
                boxShadow: `0 0 12px ${CYAN}`,
              }}
            />
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
