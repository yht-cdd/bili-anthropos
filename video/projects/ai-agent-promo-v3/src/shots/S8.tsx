import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { clamp01, EASE_EXPO_OUT, EASE_INOUT, lerpF, prog } from '../anim';
import {
  BG,
  BG_8A_FROM,
  BG_8A_TO,
  BG_DARK,
  BLUE,
  FONT_MONO,
  FONT_SANS,
  GREEN,
  GRAY,
  SURFACE,
  SURFACE_CARD,
  SURFACE_CARD2,
  TEXT,
  TEXT_DIM,
} from '../theme';

// ============================================================================
// 镜8 · 1050–1200 帧（35.0s–40.0s）四连快切 — brief-v3 §三【镜头 8】+ §一注
// 30fps 四段切点（0.5 进位）：38/37/38/37 → 本地帧界 0 / 38 / 75 / 113 / 150。
// 统一入场：scale(1.1→1.0) blur(6→0) opacity(0→1)，每段前 6 帧 expo-out。
// 8C 进度条与 8D 绿勾绘制起点按 §三动效曲线节的 30fps 换算值落帧：
// 进度条 1133–1145（区间标 1133–1148，动画 12 帧沿用原帧数，余量 hold，§〇-3）；
// 绿勾绘制 1170–1182（同上）。
// ============================================================================

const CENTER = (w: number, h: number): React.CSSProperties => ({
  position: 'absolute',
  left: (1920 - w) / 2,
  top: (1080 - h) / 2,
  width: w,
  height: h,
});

// 统一入场包壳：segStart 后 6 帧猛切进
const Slam: React.FC<{ start: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  start,
  children,
  style,
}) => {
  const f = useCurrentFrame();
  const lf = f - start;
  if (lf < 0) return null;
  const p = prog(lf, 0, 6, EASE_EXPO_OUT);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${1.1 - 0.1 * p})`,
        filter: `blur(${(6 * (1 - p)).toFixed(2)}px)`,
        opacity: p,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const GREEN_CHECK_PATH = 'M30 105 L82 155 L172 52';

export const S8: React.FC = () => {
  const f = useCurrentFrame();
  const barP = lerpF(f, [83, 95], [0, 1]); // 8C 进度条：起点取 §三换算值 1133（本地 83），12 帧 linear，余量 hold
  const drawP = prog(f, 120, 12, EASE_INOUT); // 8D 绿勾 stroke：起点 1170（本地 120），12 帧 ease-in-out
  const stepOn = (i: number) => f >= 99 + i * 4; // 三个绿勾每 4 帧一个

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* ── 8A 0–38：config diff 卡 ── */}
      {f < 38 ? (
        <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG_8A_FROM}, ${BG_8A_TO})` }}>
          <Slam start={0}>
            <div
              style={{
                ...CENTER(600, 200),
                backgroundColor: SURFACE_CARD,
                borderRadius: 12,
                borderLeft: `4px solid ${GREEN}`,
                padding: '30px 36px',
                boxSizing: 'border-box',
              }}
            >
              {/* §C 原文：两行均 #9CA3AF，删除/新增语义由左缘绿竖条承担，不自造红绿 */}
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, lineHeight: 2, color: TEXT_DIM, whiteSpace: 'pre' }}>
                <div>-  --concurrency 8</div>
                <div>+  --concurrency 4</div>
              </div>
              <div style={{ position: 'absolute', left: 36, bottom: 18, fontFamily: FONT_MONO, fontSize: 14, color: GRAY }}>
                config/render.yml
              </div>
            </div>
          </Slam>
        </AbsoluteFill>
      ) : null}

      {/* ── 8B 38–75：Pushed to main ── */}
      {f >= 38 && f < 75 ? (
        <AbsoluteFill style={{ backgroundColor: BG_DARK }}>
          <Slam start={38}>
            <div
              style={{
                ...CENTER(700, 180),
                backgroundColor: SURFACE,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                padding: '0 44px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(46,107,240,0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width={32} height={32} viewBox="0 0 32 32">
                  <path d="M16 27 L16 6 M7 15 L16 6 L25 15" stroke={BLUE} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: FONT_SANS, fontWeight: 500, fontSize: 24, color: TEXT }}>Pushed to main</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: GRAY, marginTop: 8 }}>0a4cb43</div>
              </div>
            </div>
          </Slam>
        </AbsoluteFill>
      ) : null}

      {/* ── 8C 75–113：GitHub Actions 进度 ── */}
      {f >= 75 && f < 113 ? (
        <AbsoluteFill style={{ backgroundColor: BG_DARK }}>
          <Slam start={75}>
            <div
              style={{
                ...CENTER(800, 240),
                backgroundColor: SURFACE_CARD2,
                borderRadius: 14,
                padding: '28px 40px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width={16} height={16} viewBox="0 0 16 16" fill="#C9D1D9">
                  {/* mark-github（octicons）路径，数字间全部空格分隔：SVG 合法写法，
                      紧凑连写会被 §六 IP 红线 grep 误伤（小数连排形如 IP），故拆开 */}
                  <path d="M8 0 C3.58 0 0 3.58 0 8 c0 3.54 2.29 6.53 5.47 7.59 .4 .07 .55 -.17 .55 -.38 0 -.19 -.01 -.82 -.01 -1.49 -2.01 .37 -2.53 -.49 -2.69 -.94 -.09 -.23 -.48 -.94 -.82 -1.13 -.28 -.15 -.68 -.52 -.01 -.53 .63 -.01 1.08 .58 1.23 .82 .72 1.21 1.87 .87 2.33 .66 .07 -.52 .28 -.87 .51 -1.07 -1.78 -.2 -3.64 -.89 -3.64 -3.95 0 -.87 .31 -1.59 .82 -2.15 -.08 -.2 -.36 -1.02 .08 -2.12 0 0 .67 -.21 2.2 .82 .64 -.18 1.32 -.27 2 -.27 s1.36 .09 2 .27 c1.53 -1.04 2.2 -.82 2.2 -.82 .44 1.1 .16 1.92 .08 2.12 .51 .56 .82 1.27 .82 2.15 0 3.07 -1.87 3.75 -3.65 3.95 .29 .25 .54 .73 .54 1.48 0 1.07 -.01 1.93 -.01 2.2 0 .21 .15 .46 .55 .38 A8.01 8.01 0 0 0 16 8 c0 -4.42 -3.58 -8 -8 -8 z" />
                </svg>
                <span style={{ fontFamily: FONT_SANS, fontWeight: 400, fontSize: 18, color: TEXT_DIM }}>
                  GitHub Actions · Run #41208859484
                </span>
              </div>
              <div style={{ marginTop: 30, width: 600, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div style={{ width: 600 * barP, height: 8, borderRadius: 4, backgroundColor: BLUE }} />
              </div>
              <div style={{ marginTop: 30, display: 'flex', gap: 44 }}>
                {['Build', 'Test', 'Deploy'].map((s, i) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT_SANS, fontSize: 18, color: TEXT_DIM }}>
                    <svg width={16} height={16} viewBox="0 0 16 16" style={{ opacity: stepOn(i) ? 1 : 0.15 }}>
                      <path d="M2 8.5 L6 12.5 L14 3.5" stroke={GREEN} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                    </svg>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </Slam>
        </AbsoluteFill>
      ) : null}

      {/* ── 8D 113–150：All checks passed ── */}
      {f >= 113 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 45%, rgba(30,63,46,0.4) 0%, ${BG_DARK} 68%)`,
          }}
        >
          <Slam start={113}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 320, display: 'flex', justifyContent: 'center' }}>
              <svg width={200} height={200} viewBox="0 0 200 200">
                <path
                  d={GREEN_CHECK_PATH}
                  stroke={GREEN}
                  strokeWidth={18}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={210}
                  strokeDashoffset={210 * (1 - clamp01(drawP))}
                />
              </svg>
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 580,
                textAlign: 'center',
                fontFamily: FONT_SANS,
                fontWeight: 700,
                fontSize: 32,
                color: TEXT,
              }}
            >
              All checks passed
            </div>
          </Slam>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
