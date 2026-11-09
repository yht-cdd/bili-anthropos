import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_IN, EASE_EXPO_OUT, EASE_INOUT, EASE_LINEAR, prog } from '../anim';
import { FINALE, LETTER } from '../data/preview';
import { mulberry32 } from '../utils';
import { FONT_SANS, FONT_SERIF } from '../theme';

// S-F 片尾信（2308–4174 帧，62.2s）
// ------------------------------------------------------------------
// 这一段不再是「解释」，是交付一口情绪。所有动画围绕一件事：
// 让字是**被念出来**的，不是被播放出来的。
//
// 结构：
//   0–159     过渡：一张信纸从黑暗里浮上来（口播「但在那之前…」走底字幕）
//   159–1738  信正文 10 段，逐段上浮。当前段居中，旧段留在上方淡到 0.26，
//             整卷随每一段的上浮往上滚 —— 像读一封长信，不是翻 PPT。
//   1738–1836 最后一句：信褪到背景，大字砸入（三行，第三行落地）
//   1836–1866 黑场
//
// 为什么手写换行：见 data/preview.ts LETTER 注释（确定性高度 = 精确滚动）
const SEG_F = 2308;
const L = (f: number): number => f - SEG_F; // 全局帧 → 本场景局部帧

const ROW_H = 58; // 38px 字 × 1.5 行高
const ENTRY_GAP = 28;
const LINE_TOP_CENTER = 520; // 当前段落的目标中心 y
const WS = 2.2; // 鲸的放大倍数（路径按 400×200 画）

// 每段高度 = 行数 × 行高（emphasis 段稍高，见 ENTRY_H）
const ENTRY_H = LETTER.map((e) => e.rows.length * ROW_H + (e.emphasis ? 14 : 0));

// 每段在「整卷」里的顶部偏移
const ENTRY_TOP: number[] = [];
{
  let acc = 0;
  for (let i = 0; i < LETTER.length; i += 1) {
    ENTRY_TOP.push(acc);
    acc += ENTRY_H[i] + ENTRY_GAP;
  }
}
// 每段中心相对整卷顶部的 y
const ENTRY_CENTER = ENTRY_TOP.map((t, i) => t + ENTRY_H[i] / 2);

// 滚动位移：第 i 段激活时，把它的中心送到 LINE_TOP_CENTER
const SCROLL_AT = ENTRY_CENTER.map((c) => LINE_TOP_CENTER - c);

// ── 星空 ─────────────────────────────────────────────
// 定种子伪随机，保证每次渲染完全一致（Remotion 要求帧确定性）
const STARS = (() => {
  const rnd = mulberry32(20261110);
  return Array.from({ length: 150 }, () => ({
    x: rnd() * 1920,
    y: rnd() * 1080,
    r: 0.7 + rnd() * 1.7,
    a: 0.18 + rnd() * 0.62,
    ph: rnd() * Math.PI * 2,
    sp: 0.6 + rnd() * 1.6,
    drift: 0.01 + rnd() * 0.05,
  }));
})();

// ── 鲸 ───────────────────────────────────────────────
// 座头鲸侧影，朝左游。坐标 400×200：头在左（x≈40），尾鳍在右（x≈390）
// 结构：背线 → 尾柄上缘 → 上尾叶 → 缺口 → 下尾叶 → 尾柄下缘 → 腹线 → 下颌
const WHALE_PATH =
  'M46 78 ' +
  'C86 56 150 50 208 56 ' +
  'C246 61 274 72 300 86 ' +
  'C330 74 362 54 390 42 ' +
  'C372 66 352 86 340 100 ' +
  'C352 114 372 134 390 158 ' +
  'C362 146 330 126 300 114 ' +
  'C272 128 240 140 205 144 ' +
  'C150 150 92 142 60 122 ' +
  'C44 112 34 96 46 78 Z';
// 胸鳍：从腹部后方伸出，向后下方扫
const WHALE_FIN = 'M150 140 C162 158 178 172 196 180 C186 166 178 152 176 138 Z';
// 嘴线（只描边）
const WHALE_MOUTH = 'M46 78 C60 92 80 100 104 102';

// 尾迹粒子：跟在鲸后面，越远越淡
const TRAIL = (() => {
  const rnd = mulberry32(77113);
  return Array.from({ length: 46 }, (_, i) => ({
    lag: 18 + i * 5.5, // 落后鲸头多少帧
    dy: (rnd() - 0.5) * 34,
    r: 0.9 + rnd() * 2.2,
    tw: rnd() * Math.PI * 2,
  }));
})();

// 从右往左游（头朝左，所以是「头先进画面」，不是倒着漂进来）
const whaleX = (f: number): number => 1600 - f * 1.05;
const whaleY = (f: number): number => 540 + Math.sin(f / 96) * 22 + Math.sin(f / 37) * 5;

export const SF: React.FC = () => {
  const frame = useCurrentFrame(); // 本场景局部帧

  // 信纸浮起（0–44 帧）
  const paperIn = prog(frame, 0, 44, EASE_EXPO_OUT);
  // 信正文整体淡入
  const bodyIn = prog(frame, 60, 40, EASE_LINEAR);
  // 最后一句开始：信整体退到背景
  const finaleAt = L(FINALE.from);
  const letterOut = prog(frame, finaleAt - 16, 30, EASE_EXPO_IN);
  const finaleIn = prog(frame, finaleAt, 26, EASE_EXPO_OUT);
  const finaleRow2 = prog(frame, finaleAt + 22, 24, EASE_EXPO_OUT);
  const finaleRow3 = prog(frame, finaleAt + 46, 26, EASE_EXPO_OUT);
  const finaleNote = prog(frame, finaleAt + 78, 24, EASE_EXPO_OUT);
  // 收黑
  const black = prog(frame, 1836, 30, EASE_INOUT);

  // ── 滚动：当前段索引 + 段内插值 ──
  let active = 0;
  for (let i = 0; i < LETTER.length; i += 1) {
    if (frame >= L(LETTER[i].from)) active = i;
  }
  let scrollY = SCROLL_AT[active];
  if (active > 0) {
    // 从上一段滚到这一段，用 26 帧，不要瞬移
    const t = prog(frame, L(LETTER[active].from), 26, EASE_INOUT);
    scrollY = SCROLL_AT[active - 1] + (SCROLL_AT[active] - SCROLL_AT[active - 1]) * t;
  }

  return (
    <AbsoluteFill style={{ background: '#070B14', overflow: 'hidden', fontFamily: FONT_SANS }}>
      {/* 星野 */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="neb1" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#2A4D7A" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#2A4D7A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="neb2" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#6B4A7A" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#6B4A7A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={520} cy={300} rx={760} ry={480} fill="url(#neb1)" />
        <ellipse cx={1520} cy={800} rx={620} ry={420} fill="url(#neb2)" />
        {STARS.map((s, i) => {
          const tw = 0.5 + 0.5 * Math.sin(frame / (s.sp * 34) + s.ph);
          const y = (s.y + frame * s.drift) % 1080;
          return (
            <circle
              key={i}
              cx={s.x}
              cy={y}
              r={s.r}
              fill="#E9EEFF"
              opacity={s.a * (0.45 + 0.55 * tw)}
            />
          );
        })}
      </svg>

      {/* 鲸 + 尾迹（在信纸后面，别抢字；放大 2 倍才有体量） */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <g opacity={(0.55 + 0.08 * Math.sin(frame / 70)) * (1 - letterOut * 0.9)}>
          {TRAIL.map((p, i) => {
            const f = Math.max(0, frame - p.lag);
            const x = whaleX(f) + 300 * WS;
            const y = whaleY(f) + (100 + p.dy) * WS;
            const life = Math.max(0, 1 - p.lag / 300);
            const a = life * (0.5 + 0.5 * Math.sin(frame / 12 + p.tw));
            if (x < -80 || x > 2000) return null;
            return <circle key={i} cx={x} cy={y} r={p.r * 1.7} fill="#BFD6FF" opacity={a * 0.5} />;
          })}
        </g>
        <g
          opacity={0.92 * (1 - letterOut * 0.9)}
          transform={`translate(${whaleX(frame)}, ${whaleY(frame)}) scale(${WS})`}
        >
          <path d={WHALE_PATH} fill="#101B2E" />
          <path d={WHALE_PATH} fill="none" stroke="#8FB3E0" strokeWidth={1.5} opacity={0.6} />
          <path d={WHALE_FIN} fill="#101B2E" />
          <path d={WHALE_FIN} fill="none" stroke="#8FB3E0" strokeWidth={1.5} opacity={0.5} />
          <path d={WHALE_MOUTH} fill="none" stroke="#8FB3E0" strokeWidth={1.6} opacity={0.42} />
          <circle cx={80} cy={90} r={2.6} fill="#BFD6FF" opacity={0.85} />
        </g>
      </svg>

      {/* 信纸 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: bodyIn * (1 - letterOut),
          transform: `translateY(${(1 - paperIn) * 26 - letterOut * 70}px)`,
        }}
      >
        {/* 纸的边：一圈极淡的暖光，不是卡片边框 */}
        <div
          style={{
            position: 'absolute',
            left: 300,
            right: 300,
            top: 120,
            bottom: 150,
            borderRadius: 6,
            background:
              'radial-gradient(ellipse at 50% 42%, rgba(214,206,186,0.055) 0%, rgba(214,206,186,0.02) 52%, rgba(214,206,186,0) 78%)',
            opacity: paperIn,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 1080,
            transform: `translateY(${scrollY}px)`,
            willChange: 'transform',
          }}
        >
          {LETTER.map((e, i) => {
            const start = L(e.from);
            const inP = prog(frame, start, 22, EASE_EXPO_OUT);
            if (frame < start - 2) return null;
            const isActive = i === active;
            // 旧段落淡下去，但仍可辨识：读信的感觉来自「上面还留着前文」
            const fade = isActive ? 1 : 0.26;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: ENTRY_TOP[i],
                  height: ENTRY_H[i],
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: inP * fade,
                  transform: `translateY(${(1 - inP) * 16}px)`,
                }}
              >
                {e.rows.map((row, k) => (
                  <div
                    key={k}
                    style={{
                      fontFamily: FONT_SERIF,
                      fontSize: e.emphasis ? 46 : 38,
                      fontWeight: e.emphasis ? 700 : 400,
                      lineHeight: `${ROW_H}px`,
                      color: e.emphasis ? '#F4EFE2' : '#E4E1D8',
                      letterSpacing: e.emphasis ? 2 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* 最后一句 · 升华 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: finaleIn,
        }}
      >
        {FINALE.rows.map((row, i) => {
          const p = i === 0 ? finaleIn : i === 1 ? finaleRow2 : finaleRow3;
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT_SERIF,
                fontSize: i === 0 ? 92 : 82,
                fontWeight: 700,
                lineHeight: '1.34',
                color: i === 0 ? '#F6F1E4' : '#DCD6C6',
                letterSpacing: i === 0 ? 8 : 3,
                whiteSpace: 'nowrap',
                opacity: p,
                transform: `translateY(${(1 - p) * 18}px)`,
                textShadow: i === 0 ? '0 0 42px rgba(190,215,255,0.20)' : 'none',
              }}
            >
              {row}
            </div>
          );
        })}
        <div
          style={{
            marginTop: 44,
            fontFamily: FONT_SANS,
            fontSize: 26,
            letterSpacing: 6,
            color: 'rgba(228,225,216,0.42)',
            opacity: finaleNote,
          }}
        >
          {FINALE.note}
        </div>
      </div>

      {/* 收黑 */}
      <AbsoluteFill style={{ background: '#000', opacity: black }} />
    </AbsoluteFill>
  );
};
