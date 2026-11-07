import React from 'react';
import type { CSSProperties } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { blink, lerpF, prog, typed } from '../anim';
import {
  CORAL,
  ERROR,
  FONT_MONO,
  FONT_SANS,
  HARDCUT,
  LIME,
  SUB_SAFE_BOTTOM,
  TEXT,
  TERM_FG,
  TS_GRAY,
  TS_PX,
  TS_X,
  TS_Y,
} from '../theme';
import { Terminal } from './Terminal';

// ============================================================================
// S5 爬起来（全局帧 960–1199 = 本地 0–239，32.0s–40.0s）· brief v2.1 §四 S5
// 四连硬切（4 帧切点），每拍 60 帧：
//   B1 0–59    日志滚动停在第 47 行，行内 --concurrency 8 高亮
//   B2 60–119  字幕「不是网络的问题。是参数写错了。」（「参数」珊瑚色），日志压暗留存
//   B3 120–179 单行 diff 修复（红→绿）+ git push 回车
//   B4 180–239 ✓ run 41208859484 青柠通过；角标时间戳连跳 03:14→03:21→03:40（每跳 8 帧）
//   （sfx pad 底床回升 @ 全局 1140 = 38.0s，R3 已落 audio.json）
// 叙事连续性：日志里 retry 1/4→3/4 对上 S1 的 failed after 3 retries，
//   第 47 行的第 4 次重试对上 S4 字幕「第 4 次重试」。
// ============================================================================
const RED_TINT = 'rgba(229,72,77,0.14)';
const GREEN_TINT = 'rgba(63,185,80,0.14)';

// B1：渲染日志（第 37–47 行，末行即停留点；--concurrency 8 是元凶）
const GUTTER0 = 37;
const LOG: ReadonlyArray<readonly [string, string]> = [
  ['ok', '[render] 288/1800 frames · 03:11'],
  ['ok', '[render] 574/1800 frames · 03:12'],
  ['net', '[net   ] socket hang up (retry 1/4)'],
  ['ok', '[render] retrying scene S4 …'],
  ['net', '[net   ] socket hang up (retry 2/4)'],
  ['ok', '[render] 574/1800 frames · 03:13'],
  ['warn', '[warn  ] worker #2 exited code=137'],
  ['warn', '[warn  ] chromium: page crash'],
  ['err', '[retry ] task failed after 3 retries'],
  ['dim', '[retry ] trying once more…'],
  ['hit', '[retry ] $ remotion render out/video.mp4 --concurrency 8'],
];
const HL_AT = 20; // 第 47 行高亮（滚动停住后 6 帧）
const SUB2 = ['不是网络的问题。', '是参数写错了。'];
const TS_SEQ = ['03:14', '03:21', '03:40']; // B4 角标连跳

// B1/B2 共用：日志窗口。dim>0 时压暗留存（B2 背景）；scroll=true 时前 18 帧滚到第 47 行停住
const LogPanel: React.FC<{ frame: number; dim: number }> = ({ frame, dim }) => {
  const scrolled = dim === 0;
  const lift = scrolled ? (1 - lerpF(frame, [0, 18], [0, 1])) * 240 : 0; // 上滚 240px 后停
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Terminal>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 30,
            lineHeight: '44px',
            color: '#C9D1D9',
            minHeight: 520,
            transform: `translateY(${-lift}px)`,
          }}
        >
          {LOG.map(([kind, text], i) => {
            const at = 2 + i * 1.4; // 滚动期逐行落下（≈16 帧落完，随后停）
            const seen = frame >= at;
            const lineNo = String(GUTTER0 + i).padStart(2, ' ');
            const isHit = kind === 'hit';
            const hl = isHit ? prog(frame, HL_AT, 6) : 0;
            const color =
              kind === 'err'
                ? ERROR
                : kind === 'warn'
                ? TS_GRAY
                : kind === 'net'
                ? ERROR
                : kind === 'dim'
                ? TS_GRAY
                : '#C9D1D9';
            const shown = isHit ? text.replace(' --concurrency 8', '') : text;
            return (
              <div
                key={text}
                style={{
                  whiteSpace: 'nowrap',
                  opacity: seen ? 1 : 0,
                  color,
                  paddingLeft: 8,
                  backgroundColor: hl > 0 ? `rgba(212,244,62,${(0.16 * hl).toFixed(3)})` : 'transparent',
                  borderLeft: hl > 0 ? `6px solid rgba(212,244,62,${hl.toFixed(3)})` : '6px solid transparent',
                }}
              >
                <span style={{ color: TS_GRAY, marginRight: 18 }}>{lineNo}</span>
                {shown}
                {isHit ? (
                  <span style={{ color: LIME, fontWeight: 700 }}>{' --concurrency 8'}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </Terminal>
      {scrolled && frame >= HL_AT ? (
        <div
          style={{
            position: 'absolute',
            left: TS_X,
            top: TS_Y,
            fontFamily: FONT_MONO,
            fontSize: 34,
            color: TS_GRAY,
            opacity: prog(frame, HL_AT, 6),
          }}
        >
          {'// 第 47 行'}
        </div>
      ) : null}
      {dim > 0 ? (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: `rgba(0,0,0,${dim})` }} />
      ) : null}
    </AbsoluteFill>
  );
};

// B3：单行 diff 修复 + git push
const PushPanel: React.FC<{ frame: number }> = ({ frame }) => {
  const l = frame - 120; // 本拍本地帧
  const pushCmd = 'git push origin main';
  const n = typed(frame, 148, pushCmd.length);
  const enterPressed = frame >= 148 + Math.ceil((pushCmd.length * 30) / 32) + 6;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Terminal>
        <div style={{ fontFamily: FONT_MONO, fontSize: 32, lineHeight: '52px', color: '#C9D1D9' }}>
          <div style={{ color: TS_GRAY }}>
            {'remotion.render.sh'}
            <span style={{ color: ERROR }}>{' −1'}</span>
            <span style={{ color: TERM_FG }}>{' +1'}</span>
          </div>
          {l >= 6 ? (
            <div
              style={{
                color: ERROR,
                backgroundColor: RED_TINT,
                fontWeight: 700,
                paddingLeft: 10,
                opacity: prog(frame, 126, 4),
                transform: `translateX(${(1 - prog(frame, 126, 4)) * 22}px)`,
              }}
            >
              {'- --concurrency 8'}
            </div>
          ) : null}
          {l >= 22 ? (
            <div
              style={{
                color: TERM_FG,
                backgroundColor: GREEN_TINT,
                fontWeight: 700,
                paddingLeft: 10,
                opacity: prog(frame, 142, 4),
                transform: `translateY(${(1 - prog(frame, 142, 4)) * 12}px)`,
              }}
            >
              {'+ --concurrency 4'}
            </div>
          ) : null}
          {l >= 28 ? (
            <div style={{ marginTop: 8 }}>
              <span style={{ color: TERM_FG }}>{'anthropos@local $ '}</span>
              <span style={{ color: TEXT }}>{pushCmd.slice(0, n)}</span>
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 30,
                  marginLeft: 6,
                  verticalAlign: 'middle',
                  backgroundColor: (enterPressed ? blink(frame, 168, 2) : 1) ? TEXT : 'transparent',
                }}
              />
            </div>
          ) : null}
          {enterPressed ? (
            <div style={{ color: TS_GRAY, opacity: prog(frame, 174, 4) }}>
              {'Enumerating objects: 7, done.'}
            </div>
          ) : null}
        </div>
      </Terminal>
    </AbsoluteFill>
  );
};

// B4：✓ run 41208859484 盖章 + 角标时间戳连跳（每跳 8 帧）
const RunStamp: React.FC<{ frame: number }> = ({ frame }) => {
  const p = prog(frame, 180, 6);
  const jump = (i: number): number => {
    const at = 192 + i * 12; // 03:21@192、03:40@204（8 帧过渡 + 4 帧停留再跳）
    const fin = prog(frame, at, 8);
    const fout = i === 2 ? 1 : 1 - prog(frame, at + 12, 8);
    return Math.min(fin, fout);
  };
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 92,
          fontWeight: 700,
          color: LIME,
          whiteSpace: 'nowrap',
          opacity: Math.min(1, p * 1.6),
          transform: `scale(${1.22 - 0.22 * p})`,
          textShadow: '0 0 48px rgba(212,244,62,0.28)',
        }}
      >
        {'✓ run 41208859484'}
      </div>
      <div
        style={{
          marginTop: 22,
          fontFamily: FONT_SANS,
          fontSize: 28,
          color: TS_GRAY,
          opacity: prog(frame, 194, 8),
        }}
      >
        {'第 5 次，过了。'}
      </div>
      {/* 角标时间戳（§三位置）：03:14→03:21→03:40 连跳 */}
      <div
        style={{
          position: 'absolute',
          left: TS_X,
          top: TS_Y,
          fontFamily: FONT_MONO,
          fontSize: TS_PX,
          color: TS_GRAY,
          height: TS_PX * 1.4,
        }}
      >
        {TS_SEQ.map((ts, i) => {
          const o = i === 0 ? 1 - prog(frame, 192, 8) : jump(i);
          if (o <= 0.004) return null;
          return (
            <span
              key={ts}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                opacity: o,
                color: i === 2 ? LIME : TS_GRAY,
                whiteSpace: 'nowrap',
              }}
            >
              {ts}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const S5: React.FC = () => {
  const frame = useCurrentFrame();
  const beat = Math.floor(frame / 60); // 0/1/2/3 四拍
  const beatIn = prog(frame, beat * 60, HARDCUT); // 4 帧硬切入
  const sub2 = beat === 1 ? prog(frame, 66, 10) : 0;

  return (
    <AbsoluteFill style={{ fontFamily: FONT_SANS }}>
      {/* B1 / B2 背景日志：B2 压暗留存 */}
      {frame < 120 ? (
        <div style={{ opacity: beatIn }} key={`log${beat}`}>
          <LogPanel frame={frame} dim={beat === 1 ? 0.62 : 0} />
        </div>
      ) : null}

      {/* B2：字幕「不是网络的问题。是参数写错了。」（「参数」珊瑚色） */}
      {beat === 1 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: SUB_SAFE_BOTTOM,
            textAlign: 'center',
            fontSize: 62,
            fontWeight: 700,
            color: TEXT,
            opacity: sub2,
            transform: `translateY(${(1 - sub2) * 30}px)`,
          }}
        >
          {SUB2[0]}
          {'是'}
          <span style={{ color: CORAL }}>{'参数'}</span>
          {'写错了。'}
        </div>
      ) : null}

      {beat === 2 ? (
        <div style={{ opacity: beatIn }}>
          <PushPanel frame={frame} />
        </div>
      ) : null}
      {beat === 3 ? (
        <div style={{ opacity: beatIn }}>
          <RunStamp frame={frame} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
