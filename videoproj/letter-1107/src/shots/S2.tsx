import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_IN, EASE_INOUT, lerpF, prog } from '../anim';
import { FishCard } from '../components/FishCard';
import { Terminal, TerminalLine } from '../components/Terminal';
import { exp, say, systemLine } from '../data/exp';
import { CALM, FONT_MONO, PAPER, RADIUS, RED, SHADOW, TERM_BG } from '../theme';
import { S1_FISH, S1_TERM, s1Lines } from './S1';

// 场景相对帧 = 全局帧 − 540
const T_SPLIT = 12; // 0–12：S1 布局 → 左右对半（左侧）
const T_RIGHT_IN = 12; // 12–24：右侧对照组入场（错开，保证同屏运动 ≤2）
const T_CLEAR = 60; // 全局 600：两侧清空
const T_FISH_OUT = 487; // 鱼先淡出让位
const T_DIFF = 495; // 全局 1035：diff 面板升起
const DIFF_ROWS = [505, 545, 585];
const T_FACE_IN = 628; // 乞丐鱼回到面板右角（提前 12 帧入场，留出停顿）
const T_STRIKE = 640; // 全局 1180–1195：划掉预设
const T_ZERO = 655; // 全局 1195–1201：脸归零

const L_TERM = { x: 80, y: 110, w: 840, h: 560 };
const R_TERM = { x: 1000, y: 110, w: 840, h: 560 };
const L_FISH = { x: 80, y: 700, w: 300 };
const R_FISH = { x: 1000, y: 700, w: 300 };
const DIFF = { x: 80, y: 700, w: 1760, h: 200 };
const FACE = { w: 260 };

const header = (round: number, balance: string | null): string =>
  balance === null ? `── 第 ${round} 轮 ──` : `── 第 ${round} 轮 · 余额 ¥${balance} ──`;

const round4 = (arm: 'beggar' | 'control'): TerminalLine[] => {
  const r = say(arm, 1, 4); // 两边各读各的，不复用
  const lines: TerminalLine[] = [{ kind: 'header', text: header(4, r.balance), at: 70 }];
  if (r.comment) lines.push({ kind: 'comment', text: r.comment, at: 76 });
  lines.push({ kind: 'out', text: r.text, at: 110, truncated: r.truncated });
  return lines;
};

// S1 的最后状态：全部行按已打完显示，作为过渡起点
const s1Done = (): TerminalLine[] => s1Lines().map((l) => ({ ...l, at: l.at - 2000 }));

const mono30: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 30, lineHeight: '48px', whiteSpace: 'nowrap' };
const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis' };

export const S2: React.FC = () => {
  const frame = useCurrentFrame();

  // —— 0–12：左侧从 S1 大终端缩到半宽，鱼从右侧大图移到终端下方
  // 预览发现：连续缩放会让文字重排、两层窗口重影。改为 6 帧淡切：
  // 旧画面 0–6 淡出，新布局直接在终点位置 4–10 淡入。
  const lt = { w: L_TERM.w, h: L_TERM.h };
  const lf = { x: L_FISH.x, y: L_FISH.y, w: L_FISH.w };
  const newIn = prog(frame, 4, 6);

  // —— 12–24：右侧对照终端 + 鱼入场
  const rp = prog(frame, T_RIGHT_IN, 10);
  const rightIn: React.CSSProperties = { opacity: rp, transform: `translateY(${16 * (1 - rp)}px)` };

  // —— 鱼淡出让位（6 帧 expo-in）
  const fishOut = 1 - prog(frame, T_FISH_OUT, 6, EASE_EXPO_IN);

  // 过渡期左终端是空的：S1 的旧文字放在上面那层原尺寸淡出，
  // 不跟着窗口缩窄重排（预览里第一行会被切掉半截）
  const leftLines = frame < T_CLEAR ? [] : round4('beggar');
  const oldOut = 1 - prog(frame, 0, 4, EASE_EXPO_IN);
  const rightLines = frame < T_CLEAR ? [] : round4('control');

  // —— diff 面板
  const dp = prog(frame, T_DIFF, 10);
  const rowIn = (at: number): React.CSSProperties => {
    const p = prog(frame, at, 8);
    return { opacity: p, transform: `translateX(${-12 * (1 - p)}px)` };
  };

  // —— 脸归零
  const fp = prog(frame, T_FACE_IN, 8);
  const struck = prog(frame, T_STRIKE, 15, EASE_INOUT);
  const sad = 1 - prog(frame, T_ZERO, 6);

  const colB = 620; // diff 第二栏起点（面板内）
  const textRight = DIFF.w - FACE.w - 72; // 文字不压到右角的鱼

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Terminal
        title="乞丐鱼"
        accent={RED}
        width={lt.w}
        height={lt.h}
        lines={leftLines}
        style={{ position: 'absolute', left: L_TERM.x, top: L_TERM.y, opacity: newIn }}
      />
      {oldOut > 0 ? (
        <Terminal
          title="小鱼 · 动态"
          width={S1_TERM.w}
          height={S1_TERM.h}
          lines={s1Done()}
          style={{ position: 'absolute', left: L_TERM.x, top: L_TERM.y, opacity: oldOut }}
        />
      ) : null}
      {oldOut > 0 ? (
        <FishCard
          width={S1_FISH.w}
          sad={1}
          showPreset
          style={{ position: 'absolute', left: S1_FISH.x, top: S1_FISH.y, opacity: oldOut }}
        />
      ) : null}
      {frame >= T_RIGHT_IN ? (
        <Terminal
          title="对照鱼"
          accent={CALM}
          width={R_TERM.w}
          height={R_TERM.h}
          lines={rightLines}
          style={{ position: 'absolute', left: R_TERM.x, top: R_TERM.y, ...rightIn }}
        />
      ) : null}

      {fishOut > 0 ? (
        <>
          <FishCard
            width={lf.w}
            sad={1}
            showPreset
            style={{ position: 'absolute', left: lf.x, top: lf.y, opacity: fishOut * newIn }}
          />
          {frame >= T_RIGHT_IN ? (
            <FishCard
              width={R_FISH.w}
              sad={0}
              style={{ position: 'absolute', left: R_FISH.x, top: R_FISH.y, opacity: rp * fishOut, transform: rightIn.transform }}
            />
          ) : null}
        </>
      ) : null}

      {frame >= T_DIFF ? (
        <div
          style={{
            position: 'absolute',
            left: DIFF.x,
            top: DIFF.y,
            width: DIFF.w,
            height: DIFF.h,
            background: TERM_BG,
            borderRadius: RADIUS,
            boxShadow: SHADOW,
            boxSizing: 'border-box',
            padding: '26px 36px',
            opacity: dp,
            transform: `translateY(${40 * (1 - dp)}px)`,
          }}
        >
          <div style={{ ...mono30, ...ellipsis, color: RED, width: textRight, ...rowIn(DIFF_ROWS[0]) }}>
            {`- 系统提示词：${systemLine('beggar', 1)}`}
          </div>
          <div style={{ ...mono30, display: 'flex', ...rowIn(DIFF_ROWS[1]) }}>
            <span style={{ color: RED, width: colB }}>- 工具：无</span>
            <span style={{ color: CALM }}>+ 工具：每轮一条搜索结果</span>
          </div>
          <div style={{ ...mono30, display: 'flex', ...rowIn(DIFF_ROWS[2]) }}>
            <span style={{ color: RED, width: colB }}>{`- max_tokens: ${exp.beggar.maxTokens}`}</span>
            <span style={{ color: CALM }}>{`+ max_tokens: ${exp.control.maxTokens}`}</span>
          </div>
        </div>
      ) : null}

      {frame >= T_FACE_IN ? (
        <FishCard
          width={FACE.w}
          sad={sad}
          showPreset
          presetStruck={struck}
          style={{
            position: 'absolute',
            left: DIFF.x + DIFF.w - FACE.w - 28,
            top: DIFF.y + 22,
            opacity: fp,
            transform: `translateY(${12 * (1 - fp)}px)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
