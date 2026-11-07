import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_LINEAR, EASE_SWEEP, clamp01, prog, springIn } from '../anim';
import { BG, FONT_MONO, LIME, RED, SURFACE, TERM_GRAY, TEXT, ZHIPU } from '../theme';

// ============================================================================
// S5 深夜手术 · 全局 1140–1380（brief §二·S5）· 配方卡 [effects] scanline-annotate-focus
// 本地帧 = 全局 − 1140。
// 0–12   全场静音 0.4s（sfx 缺口，R3 排）：纯黑，仅右上时间戳角标（验收检查点 1145）。
// 12–20  diff 窗推入：FocusRack = blur 8→0 走 8 帧 expo-out（brief 给定；库无同名卡，
//        按卡 §一 纪律用 focus-pull 语义实现，记歧义——与 v3 S11 同源做法）。
// 24 起  6 行 diff 逐行 Stagger step 6（同 S1 终端逐行判例；brief「窗滚动真实契约 diff」
//        按 tail 式逐行入场读法实现：逐帧滚动会让扫描线 bbox 触发数学失稳，且 S1 已有
//        逐行判例，记歧义）。
// 96–160 扫描线（全局 1236–1300，覆盖 brief 1240–1300 高亮窗）：3px 机器色光芯 +
//        身后 120px 渐隐 + 双侧游标三角 + 左侧 Y 读数。**零缓动 linear**——配方卡命门
//        「加 ease 就读作有人在拖进度条」，与 brief §一「禁 linear 主动效」冲突时，
//        本镜头服从配方卡（已记 progress）。
// 触发：线越过目标行（⚠️ 行）下缘那一帧 ft≈132 → 四角取景框 spring(210/15) 从外扩 60px
//        收拢（一次过冲）→ ft+3 对焦闪（fill .075 + 内描边）→ ft+6 落定为 0.05 常亮高亮
//        → ft+6 起贴机器色标签逐字打出（≈2.2 字/帧）→ 窗外状态行实时数 0/1→1/1。
// 172– 底部字幕 44px 米白打字机（1 帧/字，同 S3 判例）；234–240 压暗 6 帧交 S6。
// 全程镜头 1.000→1.035 极缓推（卡：推镜属辅助通道，linear）。
// ============================================================================

const WIN_W = 1240;
const WIN_X = (1920 - WIN_W) / 2; // 340
const HEADER_H = 46;
const CONTENT_TOP = HEADER_H + 20;
const ROW_H = 46; // 26px × 行高 1.77
const PAD_BOT = 70; // 底部留白 = 标签落位区
const ROWS = 6;
const WIN_H = CONTENT_TOP + ROWS * ROW_H + PAD_BOT; // 412
const WIN_Y = Math.round((1080 - WIN_H) / 2); // 334

// —— diff 内容：契约原文泛化行（brief §二给定 3 个 + 行照抄；上下文行取自 AGENTS.md
// §10.2.1 真实文字；唯一重构行 = 拆分前单 key 旧行 L2，措辞泛化、不含任何 key 值，
// 依据 diary 2026-11-04 23:52「魔搭拆成魔搭1/魔搭2」记录，已在 progress.md 声明）——
type Row = { k: '+' | '-' | ' '; t: string };
const DIFF: Row[] = [
  { k: ' ', t: '## §10.2.1 模型分层铁律（11-04 主人令 · 拆分魔搭1/魔搭2）' },
  { k: ' ', t: '> 别名 modelscope 保留：vision.mjs 硬编码了它（现指向新 key）' },
  { k: '-', t: '- | **魔搭** | modelscope | 一把 key | × 余额不足 = 全线断供 |' },
  { k: '+', t: '+ | **魔搭1** | modelscope1 | 新 key | √ 可用 |' },
  { k: '+', t: '+ | **魔搭2** | modelscope2 | 旧 key | × 余额不足，保留备用 |' },
  { k: '+', t: '+ ⚠️ 档位名有两份，必须同步改（bridge 遇未登记档位静默退回 auto）' },
];
const TARGET = ROWS - 1; // ⚠️ 行

const rowTopScreen = (i: number): number => WIN_Y + CONTENT_TOP + i * ROW_H;
const TARGET_BOTTOM = rowTopScreen(TARGET) + ROW_H; // 触发线：扫描越过该行下缘

// —— 扫描线几何（linear，卡命门）——
// 目标：触发帧 FT（线越过 ⚠️ 行下缘）落在全局 1268（local 128）——
// brief 高亮窗 1240–1300 内、且早于检查点 1270，保证 1270 帧上取景框/对焦闪已可读。
const SCAN0 = 96; // 全局 1236（brief 1240 前 4 帧起跑，保证 1240 时线已入窗）
const SCAN_V = 11; // px/帧，匀速零缓动
const SCAN_Y0 = WIN_Y - 12; // 322
const SCAN_Y1 = WIN_Y + WIN_H + 16; // 762（略过窗底）
const SCAN1 = SCAN0 + (SCAN_Y1 - SCAN_Y0) / SCAN_V; // ≈136 线走完行程
const scanYAt = (f: number): number => SCAN_Y0 + SCAN_V * (f - SCAN0);
const FT = SCAN0 + (TARGET_BOTTOM - SCAN_Y0) / SCAN_V; // 触发帧 ≈128.2（越过目标下缘）

export const S5: React.FC = () => {
  const f = useCurrentFrame();
  const winP = prog(f, 12, 8, EASE_EXPO_OUT); // 窗推入 8 帧（FocusRack）
  const blur = 8 * (1 - winP);
  const push = 1 + 0.035 * prog(f, 24, 216, EASE_LINEAR); // 全程极缓推（卡给 1.000→1.035）
  const veil = 0.55 * prog(f, 234, 6, EASE_LINEAR); // 段尾压暗交 S6（辅助通道 linear 允许）

  const scanning = f >= SCAN0;
  const sy = scanYAt(f);
  const lineVis = scanning && f <= 160 ? 1 - prog(f, 150, 10, EASE_LINEAR) : 0; // 出窗后 10 帧收干
  const fired = f >= FT; // 已标注（状态行实时数）

  // 目标行：被线侵入即亮（洗色随线位置推进），触发后对焦闪→常亮高亮
  const tTop = rowTopScreen(TARGET);
  const enterP = clamp01((sy - tTop) / ROW_H);
  const flash = fired ? 0.075 * (1 - prog(f, FT + 6, 12, EASE_EXPO_OUT)) + 0.05 : 0;
  const wash = Math.max(enterP * 0.1, flash);
  const setP = springIn(f, FT, { tension: 210, friction: 15 }); // 取景框收拢（外扩 60px→0）
  const arms = 40 - 14 * prog(f, FT + 3, 10, EASE_EXPO_OUT); // 臂长 40→26 晚 3f 收一档
  const labelOn = f >= FT + 6;
  const labelN = labelOn ? Math.min(11, Math.floor((f - (FT + 6)) / 2.2)) : 0; // ≈2.2 字/帧
  const labelText = '档位名×2·必须同步';

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 静音段 0–12：纯黑，仅时间戳角标（diary 2026-11-04 23:52 实录：手术完成时刻） */}
      <div
        style={{
          position: 'absolute',
          right: 60,
          top: 46,
          fontFamily: FONT_MONO,
          fontSize: 24,
          color: TERM_GRAY,
          opacity: prog(f, 2, 4, EASE_EXPO_OUT) * (f >= 12 ? 0.75 : 1),
        }}
      >
        2026-11-04 23:52 · AGENTS.md
      </div>

      {/* diff 窗（含取景框/标签，随 1.000→1.035 推镜整体缩放） */}
      <div
        style={{
          position: 'absolute',
          left: WIN_X,
          top: WIN_Y,
          width: WIN_W,
          transform: `scale(${push.toFixed(4)}) translateY(${(16 * (1 - winP)).toFixed(2)}px)`,
          transformOrigin: '50% 50%',
          opacity: winP,
          filter: `blur(${blur.toFixed(2)}px)`,
        }}
      >
        <div
          style={{
            width: WIN_W,
            height: WIN_H,
            backgroundColor: SURFACE,
            borderRadius: 12,
            fontFamily: FONT_MONO,
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'visible', // 取景框允许略探出窗沿（卡：从外扩处收拢）
            position: 'relative',
          }}
        >
          <div
            style={{
              height: HEADER_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
              fontSize: 18,
              color: TERM_GRAY,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span>git diff · AGENTS.md（主人深夜手改）</span>
            {/* 状态行：实时数已触发标注（卡：按 fired 实时统计，不许写死） */}
            <span style={{ color: fired ? ZHIPU : ZHIPU, opacity: scanning ? 0.95 : 0.55 }}>
              SCANNING · 同步 {fired ? '1/1 √' : '0/1'}
            </span>
          </div>
          {DIFF.map((row, i) => {
            const p = prog(f, 24 + i * 6, 8, EASE_EXPO_OUT); // 逐行 Stagger step 6
            const color = row.k === '+' ? LIME : row.k === '-' ? RED : TERM_GRAY;
            const isTarget = i === TARGET;
            const rowScreenTop = tTop - WIN_Y;
            return (
              <React.Fragment key={i}>
                {isTarget && wash > 0.001 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 14,
                      top: rowScreenTop - 4,
                      width: WIN_W - 28,
                      height: ROW_H + 8,
                      backgroundColor: ZHIPU,
                      opacity: wash,
                      borderRadius: 6,
                    }}
                  />
                ) : null}
                <div
                  style={{
                    position: 'absolute',
                    left: 26,
                    top: CONTENT_TOP + i * ROW_H,
                    width: WIN_W - 52,
                    height: ROW_H,
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      fontSize: 26,
                      whiteSpace: 'pre',
                      color,
                      opacity: p * (row.k === ' ' ? 0.8 : 1),
                      transform: `translateY(${ROW_H * (1 - p)}px)`,
                    }}
                  >
                    {row.t}
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* 四角取景框：L 角从外扩 60px 处 spring 收拢到目标行 bbox（一次过冲） */}
          {fired ? (
            <BracketCorners
              top={tTop - WIN_Y - 8}
              height={ROW_H + 16}
              setP={setP}
              arms={arms}
              stroke={isFlashWin(f) ? 3.5 : 2.6}
            />
          ) : null}

          {/* 标签：机器色小签，ft+6 起逐字打出，签宽随字长出（卡：一次性画满宽会露空条） */}
          {labelOn ? (
            <div
              style={{
                position: 'absolute',
                left: 26,
                top: CONTENT_TOP + TARGET * ROW_H + ROW_H + 12,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(91,92,242,0.18)',
                border: '1px solid rgba(91,92,242,0.65)',
                borderRadius: 6,
                padding: '0 12px',
                fontSize: 24,
                color: '#C9CBFF',
                whiteSpace: 'pre',
              }}
            >
              {labelText.slice(0, labelN)}
              {labelN < labelText.length ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 26,
                    marginLeft: 3,
                    backgroundColor: '#C9CBFF',
                    opacity: 1,
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* 扫描线系统：光芯 + 身后渐隐 + 双侧游标 + 左 Y 读数（随线滑动，属线的一部分） */}
      {lineVis > 0.001 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: lineVis, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: WIN_X - 16,
              top: sy - 120,
              width: WIN_W + 32,
              height: 120,
              background: `linear-gradient(to bottom, rgba(91,92,242,0), rgba(91,92,242,${(0.16).toFixed(2)}))`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: WIN_X - 16,
              top: sy,
              width: WIN_W + 32,
              height: 3,
              backgroundColor: ZHIPU,
              boxShadow: '0 0 18px rgba(91,92,242,0.85)',
            }}
          />
          {/* 双侧三角游标 */}
          {[WIN_X - 34, WIN_X + WIN_W + 34 - 16].map((x) => (
            <div
              key={x}
              style={{
                position: 'absolute',
                left: x,
                top: sy - 8,
                width: 0,
                height: 0,
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderLeft: `12px solid ${ZHIPU}`,
              }}
            />
          ))}
          {/* Y 读数：实时（卡：左侧读出当前 Y） */}
          <div
            style={{
              position: 'absolute',
              left: 96,
              top: sy - 12,
              fontFamily: FONT_MONO,
              fontSize: 20,
              color: ZHIPU,
              whiteSpace: 'pre',
            }}
          >
            {`Y ${Math.round(sy - WIN_Y).toString().padStart(4, '0')}`}
          </div>
        </div>
      ) : null}

      {/* 底部字幕打字机（44px 米白，1 帧/字同 S3 判例；完稿后闪两下摘除光标） */}
      {(() => {
        const SUB = '他没等我醒来，直接修了我的大脑。';
        const n = Math.min(SUB.length, Math.max(0, Math.floor((f - 172) / 1)));
        if (n <= 0) return null;
        const done = n >= SUB.length;
        const cur = done ? (f - 172 - SUB.length < 30 ? (Math.floor(((f - 172 - SUB.length) % 12) / 6) === 0 ? 1 : 0) : 0) : 1;
        return (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 120,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 44, fontWeight: 700, color: TEXT, whiteSpace: 'pre' }}>
              {SUB.slice(0, n)}
              <span
                style={{
                  display: 'inline-block',
                  width: 20,
                  height: 42,
                  marginLeft: 4,
                  backgroundColor: TEXT,
                  opacity: cur,
                  verticalAlign: '-6px',
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* 段尾压暗（退场纪律：6 帧，辅助通道） */}
      {veil > 0.001 ? (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000', opacity: veil }} />
      ) : null}
    </AbsoluteFill>
  );
};

// 对焦闪窗口：ft+3→+6（卡：填充峰值 .075 + 2px 内描边，第 6 帧起落定）
const isFlashWin = (f: number): boolean => f >= FT + 3 && f < FT + 6;

// 四角取景框：按像素外扩（卡命门：非比例缩放，大小目标收拢量一致）
const BracketCorners: React.FC<{
  top: number;
  height: number;
  setP: number;
  arms: number;
  stroke: number;
}> = ({ top, height, setP, arms, stroke }) => {
  const OUT = 60; // 外扩 60px（卡：外扩 <40px 看不出「对准」）
  const off = OUT * (1 - Math.min(setP, 1.06));
  const left = 16 - off;
  const right = WIN_W - 16 + off;
  const y0 = top - off;
  const y1 = top + height + off;
  const a = arms;
  const corner = (x: number, y: number, sx: number, sy: number, key: string) => (
    <div key={key} style={{ position: 'absolute', left: x, top: y, width: a, height: a }}>
      <div style={{ position: 'absolute', left: sx > 0 ? 0 : a - stroke, top: 0, width: stroke, height: a, backgroundColor: ZHIPU, opacity: 0.95 }} />
      <div style={{ position: 'absolute', left: 0, top: sy > 0 ? 0 : a - stroke, width: a, height: stroke, backgroundColor: ZHIPU, opacity: 0.95 }} />
    </div>
  );
  return (
    <>
      {corner(left, y0, 1, 1, 'tl')}
      {corner(right - a, y0, -1, 1, 'tr')}
      {corner(left, y1 - a, 1, -1, 'bl')}
      {corner(right - a, y1 - a, -1, -1, 'br')}
    </>
  );
};
