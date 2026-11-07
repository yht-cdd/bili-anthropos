import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_SWEEP, lerpF, prog } from '../anim';
import { BG, CORAL, FONT_MONO, FONT_SANS, GRAY, LEDGER_GREEN, TERM_GRAY, TEXT } from '../theme';

// ============================================================================
// S2 不是宠物 · 全局 210–480（brief §二·S2）· 配方卡 [interaction] 分屏 + [data] timeline-travel
// 本地帧 = 全局 − 210。
// 0–10   whoosh 转场 + 左右分屏推入（Parallax：左块 x−26、右块 x+26 → 0，10 帧 expo-out；
//        中缝 2px 竖线 16–24 帧从画心 grow）。库里无同名「分屏」卡，按 rhythm/quad-split-parallel-scenes
//        「两屏各自独立入场、中缝对齐」的最小实例实现，位移量照 brief，记歧义。
// 左 40%（740px）：★文案「关电脑就睡觉的宠物」56px #8B949E + 一条平直时间线，03:00 后熄灭
//        （00:00–03:00 实心、之后 16% 虚线段；轴上标 03:00 真实时刻）。擦除 12–32。
// 右 40%（740px）：★文案「24小时自主工作」56px 米白 + 波形时间线（48 小时 · 两根断供缺口）。
//        走查：柱体按 i 错峰左→右生长（28–96），缺口段画成暗带，
//        真实时刻 12:08–22:05 / 12:31–22:17 以竖线 + 括号标签标在轴上（100–124）。
//        柱体用「账本绿」#3FB68B（brief §一 新增色，语义=活着/OK）；青柠留给 S3 的 opencode 位，
//        两镜同色会互相抢身份。两列时间轴同基线（分屏对比的可读性命门）。
//        ⚠️ 实现偏差：timeline-travel 卡第 4 阶段「急停推近 scale 1→1.28」未做——本段末尾
//        要让位给底部字幕（brief 380–450），推近会压掉字幕阅读；已记 progress.md。
// 170–240（全局 380–450）：底部字幕 40px 逐字（brief §二原句，非 ★ 句亦不改写）。
// 264–270 整段 6 帧淡出（退场纪律），由 S3 的 FocusRack 接管。
// 断供时刻来源：§五素材注「来自 diary 占位行真实时间戳」，数值照 brief 逐字。
// ============================================================================

const COL_W = 740;
const LEFT_X = 130;
const RIGHT_X = 1050; // 1920 − 130 − COL_W
const TITLE_Y = 236;
// 两列内部都有一个 top:180 的绑图容器，以下为本段「轴」在该容器内的 y（全局 y = TITLE_Y + 180 + 本值）
// 两列同高（560）：分屏对比的两条轴必须同一基线，否则读作两张不相干的图
const L_AXIS = 144; // 左：平直时间线
const R_AXIS = 144; // 右：波形基线

const HOURS = 48; // 两天
const PX_PER_H = COL_W / HOURS;
const rx = (h: number): number => RIGHT_X + h * PX_PER_H;

// 两根断供缺口（brief 给定真实时刻）
type Gap = { from: number; to: number; label: string };
const GAPS: Gap[] = [
  { from: 12 + 8 / 60, to: 22 + 5 / 60, label: '12:08–22:05' },
  { from: 24 + 12 + 31 / 60, to: 24 + 22 + 17 / 60, label: '12:31–22:17' },
];

// 小时槽被缺口覆盖的比例 → 该柱可见度（部分覆盖画矮柱，读作「那半小时还剩一点」）
const cover = (i: number): number => {
  let c = 0;
  for (const g of GAPS) {
    c += Math.max(0, Math.min(i + 1, g.to) - Math.max(i, g.from));
  }
  return Math.min(1, c);
};

// 柱高：按小时槽号确定的伪随机（帧无关，避免渲染抖动）
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 0.37) * 43758.5453;
  return x - Math.floor(x);
};
const barH = (i: number): number => 20 + 54 * hash(i);

const SUB = '区别不是它不睡——是断了十二小时，醒来还能接着活。';

const SWEEP = 28; // 右列走查起跑
const SWEEP_STEP = 1.4; // 48 槽 × 1.4 ≈ 67 帧 → 96 走完

export const S2: React.FC = () => {
  const f = useCurrentFrame();
  const push = prog(f, 0, 10, EASE_EXPO_OUT); // 分屏推入
  const dx = 26 * (1 - push);
  const seam = prog(f, 16, 8, EASE_EXPO_OUT); // 中缝竖线
  const leftWipe = prog(f, 12, 20, EASE_SWEEP); // 左：平直时间线擦除
  const gapMark = prog(f, 100, 24, EASE_EXPO_OUT); // 缺口标签 + 轴上时刻
  const sub = prog(f, 170, 10, EASE_EXPO_OUT); // 底部字幕入场
  const exit = prog(f, 264, 6, EASE_EXPO_OUT); // 段尾淡出

  const playhead = lerpF(f, [SWEEP, SWEEP + 48 * SWEEP_STEP], [RIGHT_X, RIGHT_X + COL_W]);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT_SANS, opacity: 1 - exit }}>
      {/* ── 左 40%：宠物 ── */}
      <div
        style={{
          position: 'absolute',
          left: LEFT_X - dx,
          top: TITLE_Y,
          width: COL_W,
          opacity: push,
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, color: TERM_GRAY }}>关电脑就睡觉的宠物</div>

        <div style={{ position: 'absolute', left: 0, top: 180, width: COL_W, height: 200 }}>
          {/* 轴 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: L_AXIS,
              width: COL_W,
              height: 2,
              backgroundColor: 'rgba(139,148,158,0.35)',
            }}
          />
          {/* 实心段 00:00–03:00（clip 擦除） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: L_AXIS - 6,
              width: COL_W * leftWipe,
              height: 8,
              backgroundColor: TERM_GRAY,
              borderRadius: 4,
              clipPath: `inset(0 ${(100 - (3 / 24) * 100).toFixed(2)}% 0 0)`,
            }}
          />
          {/* 熄灭段：03:00 之后 16% 虚线 */}
          <div
            style={{
              position: 'absolute',
              left: (3 / 24) * COL_W,
              top: L_AXIS - 2,
              width: (21 / 24) * COL_W * leftWipe,
              height: 2,
              borderLeft: '2px dashed rgba(139,148,158,0.16)',
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(139,148,158,0.16) 0 10px, transparent 10px 20px)',
            }}
          />
          {/* 03:00 时刻标记 */}
          {leftWipe > 0.5 ? (
            <div
              style={{
                position: 'absolute',
                left: (3 / 24) * COL_W,
                top: L_AXIS - 26,
                height: 52,
                width: 2,
                backgroundColor: CORAL,
                opacity: (leftWipe - 0.5) * 2,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 8,
                  top: -6,
                  fontFamily: FONT_MONO,
                  fontSize: 24,
                  color: CORAL,
                  whiteSpace: 'nowrap',
                }}
              >
                03:00 后熄灭
              </span>
            </div>
          ) : null}
          {/* 刻度 */}
          {[0, 6, 12, 18, 24].map((h) => (
            <div
              key={h}
              style={{
                position: 'absolute',
                left: (h / 24) * COL_W,
                top: L_AXIS + 10,
                fontFamily: FONT_MONO,
                fontSize: 20,
                color: GRAY,
                transform: 'translateX(-50%)',
              }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>

      {/* ── 右 40%：24 小时自主工作（★文案逐字） ── */}
      <div
        style={{
          position: 'absolute',
          left: RIGHT_X + dx,
          top: TITLE_Y,
          width: COL_W,
          opacity: push,
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, color: TEXT }}>24小时自主工作</div>

        <div style={{ position: 'absolute', left: 0, top: 180, width: COL_W, height: 260 }}>
          {/* 断供暗带（波形里的两个洞） */}
          {GAPS.map((g, i) => {
            const p = prog(f, SWEEP + g.from * SWEEP_STEP, 10, EASE_EXPO_OUT);
            return (
              <div
                key={g.label}
                style={{
                  position: 'absolute',
                  left: g.from * PX_PER_H,
                  top: R_AXIS - 96,
                  width: (g.to - g.from) * PX_PER_H,
                  height: 100,
                  backgroundColor: 'rgba(240,82,77,0.10)',
                  borderLeft: '1px solid rgba(240,82,77,0.35)',
                  borderRight: '1px solid rgba(240,82,77,0.35)',
                  opacity: p,
                }}
              />
            );
          })}

          {/* 波形柱：走查式左→右生长 */}
          {Array.from({ length: HOURS }, (_, i) => {
            const vis = 1 - cover(i);
            if (vis < 0.2) return null;
            const p = prog(f, SWEEP + i * SWEEP_STEP, 8, EASE_EXPO_OUT);
            const h = barH(i) * vis;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: i * PX_PER_H + 1,
                  top: R_AXIS - h * p,
                  width: Math.max(3, PX_PER_H - 3),
                  height: h * p,
                  borderRadius: 2,
                  backgroundColor: LEDGER_GREEN,
                  opacity: 0.42 + 0.48 * vis,
                }}
              />
            );
          })}

          {/* 轴 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: R_AXIS,
              width: COL_W,
              height: 2,
              backgroundColor: 'rgba(236,233,225,0.3)',
            }}
          />
          {/* 走查游标（擦除前缘；卡判例：无亮线的擦除读作 PPT） */}
          {f >= SWEEP && f <= SWEEP + 48 * SWEEP_STEP ? (
            <div
              style={{
                position: 'absolute',
                left: playhead - RIGHT_X,
                top: R_AXIS - 104,
                width: 2,
                height: 108,
                backgroundColor: TEXT,
                opacity: 0.55,
                boxShadow: '0 0 14px rgba(236,233,225,0.5)',
              }}
            />
          ) : null}

          {/* 缺口标签 + 真实时刻标在轴上（brief §二·S2 给定值） */}
          {GAPS.map((g, i) => (
            <div
              key={g.label}
              style={{
                position: 'absolute',
                left: g.from * PX_PER_H,
                top: R_AXIS - 128 - i * 30,
                width: (g.to - g.from) * PX_PER_H,
                opacity: gapMark,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 22,
                  color: i === 0 ? CORAL : TEXT,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  transform: 'translateX(-6%)',
                }}
              >
                {g.label}
              </div>
              <div
                style={{
                  height: 1,
                  marginTop: 4,
                  backgroundColor: i === 0 ? CORAL : 'rgba(236,233,225,0.55)',
                }}
              />
            </div>
          ))}
          {GAPS.flatMap((g) => [g.from, g.to]).map((h, i) => (
            <div
              key={`t${i}`}
              style={{
                position: 'absolute',
                left: h * PX_PER_H,
                top: R_AXIS,
                width: 2,
                height: 12,
                backgroundColor: CORAL,
                opacity: gapMark * 0.9,
              }}
            />
          ))}

          {/* 日刻度 */}
          {[0, 24, 48].map((h) => (
            <div
              key={h}
              style={{
                position: 'absolute',
                left: h * PX_PER_H,
                top: R_AXIS + 12,
                fontFamily: FONT_MONO,
                fontSize: 20,
                color: GRAY,
                transform: h === 48 ? 'translateX(-100%)' : 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {h === 0 ? '11-03 00:00' : h === 24 ? '11-04' : '11-05 00:00'}
            </div>
          ))}
        </div>
      </div>

      {/* 中缝竖线 */}
      <div
        style={{
          position: 'absolute',
          left: 959,
          top: 240 + (160 * (1 - seam)),
          width: 2,
          height: 640 * seam,
          backgroundColor: 'rgba(139,148,158,0.4)',
          opacity: seam > 0 ? 0.8 : 0,
        }}
      />

      {/* 底部字幕（brief §二·S2 原句） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 118,
          display: 'flex',
          justifyContent: 'center',
          opacity: sub,
          transform: `translateY(${14 * (1 - sub)}px)`,
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: TEXT, whiteSpace: 'pre' }}>{SUB}</div>
      </div>
    </AbsoluteFill>
  );
};
