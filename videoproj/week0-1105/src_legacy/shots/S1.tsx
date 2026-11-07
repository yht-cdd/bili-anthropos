import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_LINEAR, EASE_SWEEP, blink, prog, shakeX } from '../anim';
import { BG, CORAL, FONT_MONO, GRAY, SURFACE, TERM_GRAY, TEXT } from '../theme';

// ============================================================================
// S1 账单开场 · 全局 0–210（brief §二·S1）· 配方卡 [typography] 终端逐行 + [effects] slam-entrance-moves(B 式)
// 本地帧 = 全局帧（S1 从 0 起）。
// 0–8   黑场（sfx error@9 = 全局 9 帧，R3 排音）。
// 8–14  终端窗入场（1100px，同 v3 窗体规格：表面 #0F131C / radius 12 / 顶栏 44px）。
// 10–150 六行账单逐行 Stagger step 10（brief 给定），每行 8 帧 expo-out 在裁切盒内升起
//        （type-assembly-moves A 式 split-text-stagger 的行级用法）；末行 60–68 落定后
//        光标 12 帧周期快闪，停留 ≥20 帧（brief 检查点帧 45 = 第 4 行正在入场）。
// 152–162 窗体压暗到 55%（辅助通道淡暗，linear 只用于此，见 anim.ts 纪律）——把重量让给合计。
// 160–210 合计行 slam：「23.36¥」96px 珊瑚，scale 1.3→1.0 走 6 帧 ease-in（卡 B「ease-in 才是砸」），
//        落定帧叠 shakeX amplitude 12（brief 给定）+ 冲击环 14 帧；boom@162 与落定同帧（R3 排音）。
// 文案：六行照 brief §二·S1 逐字（后四行金额为示意占位，§五素材注：投稿前按 logs 真实拆分替换，23.36 不动）。
// ============================================================================

const WIN_W = 1100;
const WIN_X = (1920 - WIN_W) / 2;
const WIN_Y = 200;
const HEADER_H = 44;
const CONTENT_TOP = HEADER_H + 20;
const LINE_H = 57; // 30px × lineHeight 1.9
const PAD_X = 34;
const WIN_H = CONTENT_TOP + LINE_H * 6 + 30;

const START = 10; // 窗入场 8–14，正文 10 起逐行（brief 给定窗）
const STEP = 10; // Stagger step 10 帧（brief 给定）

const SLAM_AT = 160; // 合计行 slam 起跑（brief 160–210）
const HIT = 162; // boom@162：震屏/冲击环与声音同帧钉（slam 卡：无声版三件套读作抽搐）

// 账单六行（金额列用点线补齐，whiteSpace:'pre' 原样上屏）
const BILL_LINES: Array<{ text: string; c: string }> = [
  { text: '$ 一周账单', c: TEXT },
  { text: '修我自己 ............ 12.00', c: TERM_GRAY },
  { text: 'GitHub 基础项目 ..... 4.20', c: TERM_GRAY },
  { text: '服务器 ............. 5.00', c: TERM_GRAY },
  { text: 'opus 设计稿 ........ 1.10', c: TERM_GRAY },
  { text: 'asr ............... 1.06', c: TERM_GRAY },
];

export const S1: React.FC = () => {
  const f = useCurrentFrame();
  const winP = prog(f, 8, 6, EASE_EXPO_OUT); // 窗体入场 8–14，6 帧 expo-out
  const dim = prog(f, 152, 10, EASE_LINEAR); // 152–162 压暗（合计行的让位）
  const slam = prog(f, SLAM_AT, 6, EASE_SWEEP); // scale 收 6 帧
  const slamIn = prog(f, SLAM_AT, 4, EASE_EXPO_OUT); // opacity 前 4 帧到位，重量交给 scale
  const ring = prog(f, HIT, 14, EASE_EXPO_OUT); // 冲击环 120→560px
  const shake = shakeX(f, HIT, 12); // brief：Shake amplitude 12

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 终端窗 */}
      <div
        style={{
          position: 'absolute',
          left: WIN_X,
          top: WIN_Y,
          width: WIN_W,
          height: WIN_H,
          backgroundColor: SURFACE,
          borderRadius: 12,
          fontFamily: FONT_MONO,
          opacity: winP * (1 - 0.45 * dim),
          transform: `scale(${0.94 + 0.06 * winP}) translateY(${14 * (1 - winP)}px)`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: HEADER_H,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            fontSize: 18,
            color: GRAY,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          anthropos@local ~ week0
        </div>
        {BILL_LINES.map((line, i) => {
          const p = prog(f, START + i * STEP, 8, EASE_EXPO_OUT);
          const isLast = i === BILL_LINES.length - 1;
          const cur = isLast ? blink(f, 70, 12) : 0; // 末行落定后光标 12 帧周期
          return (
            <div
              key={line.text}
              style={{
                position: 'absolute',
                left: PAD_X,
                top: CONTENT_TOP + i * LINE_H,
                width: WIN_W - PAD_X * 2,
                height: LINE_H,
                overflow: 'hidden', // 裁切盒：行从下缘升起
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  lineHeight: `${LINE_H}px`,
                  color: line.c,
                  whiteSpace: 'pre',
                  opacity: p,
                  transform: `translateY(${LINE_H * (1 - p)}px)`,
                }}
              >
                {line.text}
                {isLast ? (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 32,
                      marginLeft: 6,
                      backgroundColor: TERM_GRAY,
                      opacity: dim > 0 ? 0 : cur,
                      verticalAlign: '-5px',
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* 冲击环（slam B 式三件套：环 + 震屏；白芯 + 珊瑚柔辉，暗场口径） */}
      {f >= HIT && ring < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: 960 - 280 * ring,
            top: 733 - 280 * ring,
            width: 560 * ring,
            height: 560 * ring,
            borderRadius: '50%',
            border: `${Math.max(1, 8 * (1 - ring)).toFixed(1)}px solid rgba(217,119,87,0.55)`,
            boxShadow: `0 0 ${Math.round(40 * (1 - ring))}px rgba(236,233,225,${0.35 * (1 - ring)})`,
            opacity: 1 - ring,
          }}
        />
      ) : null}

      {/* 合计行 slam 96px 珊瑚 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 655,
          width: 1920,
          textAlign: 'center',
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: 96,
          color: CORAL,
          opacity: slamIn,
          transform: `translateX(${shake}px) scale(${1.3 - 0.3 * slam})`,
        }}
      >
        23.36¥
      </div>
    </AbsoluteFill>
  );
};
