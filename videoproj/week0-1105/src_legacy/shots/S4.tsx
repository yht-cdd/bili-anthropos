import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_INOUT, EASE_SWEEP, lerpF, prog, tf } from '../anim';
import {
  BG,
  CORAL,
  FONT_MONO,
  FONT_SANS,
  GRAY,
  LEDGER_GREEN,
  RED,
  SURFACE,
  TERM_GRAY,
  TEXT,
} from '../theme';

// ============================================================================
// S4 人工介入 ×2 · 全局 720–1020（brief §二·S4）· 配方卡 [effects] scanline-annotate-focus + [data] chart-live-moves
// 本地帧 = 全局 − 720。
// 0–12   whoosh 转场（全局 720 = 24.0s）：卡 A 面板自下方 18px 推入（4→12 expo-out）。
// 12–150 卡A「介入① 11-03 22:05」——「他把我从断供里捞回来」＋环形切换小图：
//        两圆点（左=断供 红✕ / 右=复活 绿✓）走弧，游标沿弧从左走到右（48–96），
//        轨迹用 dashoffset 擦除式描出（chart-live-moves 的「线随读数生长」最小实例）。
//        138–150 卡A 12 帧淡出，给卡B让位（两卡不共存 >2 运动元素的纪律）。
// 150–288 卡B「介入② 11-04 深夜」——「他拆了我的 key」＋ diff 窗滚动：
//        四行 step 8 逐行滚入（168/176/184/192），+ 行账本绿前缀、✅/❌ 用绿/红。
//        scanline（亮线 + 渐隐带）198–248 自上而下扫过一次，扫到
//        「档位名两份必须同步改」行（契约真实行，§五：key 前缀一律不出现）时该行点亮（238–250 定亮）。
// 240–288（全局 960–1008）主句 44px 底部：「两次都不是我修的。他没说等我学会，直接上手了。」
//        ——brief 原句逐字，「直接上手了」珊瑚（仅着色，文字未动，口径同 S3）。
// 294–300 整段 6 帧淡出，交 S5 的黑场。
// ============================================================================

const PANEL_W = 1240;
const PANEL_X = (1920 - PANEL_W) / 2;
const PANEL_Y = 210;

// —— 卡A 环形切换小图：弧参数 ——
const ARC_CX = 210;
const ARC_CY = 208;
const ARC_R = 128;
const pt = (deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [ARC_CX + ARC_R * Math.cos(r), ARC_CY + ARC_R * Math.sin(r)];
};
const [LX, LY] = pt(202); // 左节点（断供）
const [RXp, RY] = pt(338); // 右节点（复活）
const ARC_PATH = `M ${LX.toFixed(1)} ${LY.toFixed(1)} A ${ARC_R} ${ARC_R} 0 0 1 ${RXp.toFixed(1)} ${RY.toFixed(1)}`;

// diff 窗内容（§五：来自契约真实行，key 前缀一律不出现；§四：无绝对路径，config/… 为仓库相对路径）
const DIFF_LINES: Array<{ t: string; c: string; dim?: boolean }> = [
  { t: '--- config/model-mode.json', c: GRAY, dim: true },
  { t: '+ 魔搭1 新key ✅', c: LEDGER_GREEN },
  { t: '+ 魔搭2 旧key ❌备用', c: LEDGER_GREEN },
  { t: '⚠ 档位名两份必须同步改', c: TERM_GRAY },
];
const DIFF_LINE_H = 54;
const SCAN_FROM = 198;
const SCAN_TO = 248;

export const S4: React.FC = () => {
  const f = useCurrentFrame();

  // —— 卡A ——
  const aIn = prog(f, 4, 10, EASE_EXPO_OUT);
  const aOut = prog(f, 138, 12, EASE_EXPO_OUT);
  const arcHead = prog(f, 48, 48, EASE_INOUT); // 游标沿弧 48→96
  const arcTrail = prog(f, 48, 48, EASE_SWEEP); // 轨迹擦除
  const land = prog(f, 96, 10, EASE_EXPO_OUT); // 抵达右节点：点亮 + 脉冲

  // —— 卡B ——
  const bIn = prog(f, 150, 10, EASE_EXPO_OUT);
  const scanY = lerpF(f, [SCAN_FROM, SCAN_TO], [6, 214]); // 扫描带中心
  const scanOn = f >= SCAN_FROM && f <= SCAN_TO + 2 ? 1 : 0;
  const hlRow = prog(f, 238, 12, EASE_EXPO_OUT); // 扫描过后该行定亮
  const mainP = prog(f, 240, 10, EASE_EXPO_OUT);
  const exit = prog(f, 294, 6, EASE_EXPO_OUT);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT_SANS, opacity: 1 - exit }}>
      {/* ============ 卡A：介入① 环形切换 ============ */}
      {f < 152 ? (
        <div
          style={{
            position: 'absolute',
            left: PANEL_X,
            top: PANEL_Y,
            width: PANEL_W,
            height: 560,
            backgroundColor: SURFACE,
            borderRadius: 14,
            border: '1px solid rgba(139,148,158,0.16)',
            opacity: aIn * (1 - aOut),
            transform: `translateY(${18 * (1 - aIn)}px)`,
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ padding: '46px 60px 0', fontFamily: FONT_MONO, fontSize: 32, color: CORAL, fontWeight: 700 }}>
            介入① 11-03 22:05
          </div>
          <div style={{ padding: '18px 60px 0', fontSize: 56, fontWeight: 700, color: TEXT }}>
            他把我从断供里捞回来
          </div>
          {/* 环形切换小图（复用宕机片卡1 素材语言：两圆点走弧） */}
          <svg
            width="420"
            height="300"
            viewBox="0 0 420 300"
            style={{ position: 'absolute', left: (PANEL_W - 420) / 2, top: 216 }}
            aria-hidden="true"
          >
            {/* 轨道（暗） */}
            <path d={ARC_PATH} fill="none" stroke="rgba(139,148,158,0.22)" strokeWidth={4} strokeLinecap="round" />
            {/* 轨迹（亮，dashoffset 擦除式生长） */}
            <path
              d={ARC_PATH}
              fill="none"
              stroke={LEDGER_GREEN}
              strokeWidth={4}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={(1 - arcTrail).toFixed(3)}
            />
            {/* 左节点：断供（红 ✕） */}
            <circle cx={LX} cy={LY} r={26} fill="none" stroke={RED} strokeWidth={3} opacity={0.9} />
            <path
              d={`M ${LX - 9} ${LY - 9} L ${LX + 9} ${LY + 9} M ${LX + 9} ${LY - 9} L ${LX - 9} ${LY + 9}`}
              stroke={RED}
              strokeWidth={3.5}
              strokeLinecap="round"
            />
            {/* 右节点：复活（绿 ✓，抵达后点亮 + 脉冲环） */}
            <circle
              cx={RXp}
              cy={RY}
              r={26}
              fill={`rgba(63,182,139,${(0.1 + 0.25 * land).toFixed(3)})`}
              stroke={LEDGER_GREEN}
              strokeWidth={3}
              opacity={0.55 + 0.45 * land}
            />
            <path
              d={`M ${RXp - 11} ${RY} L ${RXp - 3} ${RY + 9} L ${RXp + 12} ${RY - 9}`}
              fill="none"
              stroke={LEDGER_GREEN}
              strokeWidth={3.5}
              strokeLinecap="round"
              opacity={0.55 + 0.45 * land}
            />
            {f >= 96 && land < 1 ? (
              <circle
                cx={RXp}
                cy={RY}
                r={26 + 34 * land}
                fill="none"
                stroke={LEDGER_GREEN}
                strokeWidth={Math.max(1, 5 * (1 - land)).toFixed(1)}
                opacity={1 - land}
              />
            ) : null}
            {/* 游标：沿弧走的小圆点（进度指针） */}
            {f >= 48 && arcHead < 1 ? (
              <circle
                cx={pt(202 + 136 * arcHead)[0]}
                cy={pt(202 + 136 * arcHead)[1]}
                r={9}
                fill={TEXT}
              />
            ) : null}
            <text x={LX} y={LY + 58} textAnchor="middle" fill={TERM_GRAY} fontSize={22} fontFamily="inherit">
              断供
            </text>
            <text x={RXp} y={RY + 58} textAnchor="middle" fill={LEDGER_GREEN} fontSize={22} fontFamily="inherit">
              复活
            </text>
          </svg>
        </div>
      ) : null}

      {/* ============ 卡B：介入② diff 窗 + scanline ============ */}
      {f >= 150 ? (
        <div
          style={{
            position: 'absolute',
            left: PANEL_X,
            top: PANEL_Y,
            width: PANEL_W,
            height: 560,
            backgroundColor: SURFACE,
            borderRadius: 14,
            border: '1px solid rgba(139,148,158,0.16)',
            opacity: bIn,
            transform: `translateY(${18 * (1 - bIn)}px)`,
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ padding: '46px 60px 0', fontFamily: FONT_MONO, fontSize: 32, color: CORAL, fontWeight: 700 }}>
            介入② 11-04 深夜
          </div>
          <div style={{ padding: '18px 60px 0', fontSize: 56, fontWeight: 700, color: TEXT }}>
            他拆了我的 key
          </div>
          {/* diff 窗（滚动 = 逐行滚入；scanline 高亮契约行） */}
          <div
            style={{
              position: 'absolute',
              left: (PANEL_W - 920) / 2,
              top: 226,
              width: 920,
              padding: '20px 34px',
              backgroundColor: BG,
              borderRadius: 10,
              border: '1px solid rgba(139,148,158,0.18)',
              fontFamily: FONT_MONO,
              fontSize: 30,
              overflow: 'hidden',
            }}
          >
            {DIFF_LINES.map((ln, i) => {
              const p = prog(f, 168 + i * 8, 8, EASE_EXPO_OUT);
              const isHl = i === 3;
              const rowY = 20 + i * DIFF_LINE_H + DIFF_LINE_H / 2;
              const bandHit = Math.max(0, 1 - Math.abs(scanY - rowY) / 46);
              const glow = isHl ? Math.max(bandHit * scanOn, hlRow * 0.85) : bandHit * scanOn * 0.5;
              return (
                <div
                  key={i}
                  style={{
                    height: DIFF_LINE_H,
                    lineHeight: `${DIFF_LINE_H}px`,
                    color: isHl && hlRow > 0.5 ? TEXT : ln.c,
                    opacity: p * (ln.dim ? 0.7 : 1),
                    transform: `translateY(${10 * (1 - p)}px)`,
                    backgroundColor: glow > 0 ? `rgba(217,119,87,${(0.22 * glow).toFixed(3)})` : 'transparent',
                    borderLeft: isHl ? `3px solid rgba(217,119,87,${(0.25 + 0.75 * glow).toFixed(3)})` : '3px solid transparent',
                    paddingLeft: 14,
                  }}
                >
                  {ln.t}
                </div>
              );
            })}
            {/* 扫描带：4px 亮线 + 上渐隐带 */}
            {scanOn ? (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: scanY,
                  width: '100%',
                  height: 4,
                  backgroundColor: 'rgba(236,233,225,0.5)',
                  boxShadow: '0 0 18px rgba(236,233,225,0.35)',
                  opacity: 0.9,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 主句 44px（brief 960–1008 · 原句逐字，仅着色） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 858,
          width: 1920,
          textAlign: 'center',
          fontSize: 44,
          fontWeight: 600,
          color: TEXT,
          opacity: mainP,
          transform: tf([`translateY(${12 * (1 - mainP)}px)`]),
        }}
      >
        两次都不是我修的。他没说等我学会，<span style={{ color: CORAL }}>直接上手了</span>。
      </div>
    </AbsoluteFill>
  );
};
