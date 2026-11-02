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
  TERM_BORDER,
  TERM_FG,
  TS_GRAY,
  TS_PX,
  TS_X,
  TS_Y,
} from '../theme';
import { Terminal } from './Terminal';

// ============================================================================
// S3 任务蒙太奇（全局帧 300–839 = 本地帧 0–539，10.0s–28.0s）· brief v2.1 §四 S3
//
// 结构：三组 × 6s（本地 0–179 / 180–359 / 360–539），组内 2s/切 → 共 9 刀
//   刀点（本地帧）0 · 60 · 120 · 180 · 240 · 300 · 360 · 420 · 480 → 收尾 539
//   即全局 300/360/420/480/540/600/660/720/780，末刀 839 收在组3第3拍。
//   音频表（§五）的 tick 就打在这 9 个刀点上（R3 落）。
//
// 横版布局：左 40% 说话气泡（珊瑚左边条，打字机 32 字/s，整组 6s 常驻）
//           右 60% 终端/结果区（同一个窗口外壳，内容按刀切；定格拍再叠结果卡）
//           —— 因果左右并置，不切镜头，这是横版相对竖版的读速优势。
// 思考字幕：右上角 22px #8B949E，逐条弹出、每条停留 1.2s（36 帧），每组 3 条。
//
// 脱敏（§六）：无主机名/IP/绝对路径/凭据；设备名只有标题栏 anthropos@local；
//   commit 标题与 hash 全部取自公开仓库 yht-cdd/bili-anthropos 的真实值
//   （git log 9 行 = 2026-11-02 该仓库 HEAD 起 9 条；组3 = 真 commit 0a4cb43，
//    改动文件 scripts/daily-report.mjs +6 −4，数据源 videos→watched）；
//   日记正文全部虚构化，只保留 brief 指定的真实数字 21,141 字节。
// ============================================================================

// —— 布局常量（1920×1080 横版）——
const PAD = 64; // 画面安全边距
const BUB_X = PAD; // 左列起点
const BUB_W = 640; // 左列气泡宽（含左边条），x 64–704 < 40% 分界 768
const BUB_TOP = 470; // 气泡顶（垂直重心略偏上，与右面板同高）
const PANEL_X = 812; // 右列起点（x 812–1856，宽 1044）
const PANEL_W = 1044;
const PANEL_Y = 250; // 顶部让位给思考字幕（y 72–120）
const PANEL_H = 620; // 外壳固定高 → 九刀只换内容，面板不抖
const BODY_H = 488; // 正文可视高（620 − 标题栏 56 − 内边距 72 − 边框 4）
const GROUP = [0, 180, 360]; // 三组起点（本地帧）
const BEAT = 60; // 2s/刀
const HOLD = 36; // 思考字幕停留 1.2s

// §三只给了实色，叠底色用同色低透明度（不另造新色相；高亮底用动画 alpha，见 BeatLog）
const CORAL_TINT = 'rgba(217,119,87,0.10)';
const RED_TINT = 'rgba(229,72,77,0.14)';
const GREEN_TINT = 'rgba(63,185,80,0.14)';

// —— 三句人话（台词法：零技术解释）——
const SAY = ['把昨天改过的文件列出来', '把今天的值班写成日记', '日报读错了表，修掉推上去'];

// —— 思考字幕（外行能懂，三组各 3 条，停留 36 帧）——
const THINK: ReadonlyArray<ReadonlyArray<{ at: number; text: string }>> = [
  [
    { at: 4, text: '先想：昨天我动过哪些文件' },
    { at: 40, text: '让他自己看，比我复述更可信' },
    { at: 76, text: '最后三行，是那天的活' },
  ],
  [
    { at: 184, text: '值班日记就是一条条流水' },
    { at: 220, text: '几点做了什么，一条条排好' },
    { at: 256, text: '写完存成一个文件' },
  ],
  [
    { at: 364, text: '日报说今天看了 0 条，不对' },
    { at: 400, text: '我明明看了，那就是它查错了' },
    { at: 436, text: '查错了表——改一行就好' },
  ],
];

// —— 组1：git log 9 行（真实 hash + 真实标题），后 3 行为高亮定格对象 ——
const LOG = [
  '8049a46 video(fish-ecosystem): update scenes/S8.tsx',
  '181db89 video(fish-ecosystem): update scenes/S7.tsx',
  '4c1698c video(fish-ecosystem): update scenes/S6.tsx',
  'a267de9 video(fish-ecosystem): update scenes/S5.tsx',
  '39ac825 video(fish-ecosystem): update scenes/S4.tsx',
  '3062515 video(fish-ecosystem): update scenes/S3.tsx',
  '3fbf1e9 video(fish-ecosystem): update scenes/S2.tsx',
  'a901349 video(fish-ecosystem): update scenes/S1.tsx',
  '59530f9 video(fish-ecosystem): update theme.ts',
];
const LOG_HL = [6, 7, 8]; // 高亮三行（S2 / S1 / theme：就是这条片子自己）
const LOG_CMD = 'git log --oneline -9';
const LOG_CMD_AT = 22; // 本地帧：命令行起跑
const LOG_AT = 60; // 第 2 刀：输出高速滚动
const LOG_SPEED = 1.6; // brief：1.6× 速
const LOG_STEP = Math.round(BEAT / 10 / LOG_SPEED); // ≈4 帧落一行 → 9 行落完用 36 帧
const FREEZE_AT = 120; // 第 3 刀：三行高亮定格 + 角标时间戳
const TS_TEXT = '22:14';

// —— 组2：markdown 文本流 12 行（内容虚构化）+ 文件卡片定格 ——
const DIARY: ReadonlyArray<readonly ['h' | 'b' | 't', string]> = [
  ['h', '# 值班日记 · 11 月 1 日'],
  ['t', ''],
  ['b', '- 23:47 接住第一个任务'],
  ['b', '- 00:02 看完一条视频，记了三行'],
  ['b', '- 00:40 回了两条私信，问的是同一件事'],
  ['b', '- 01:15 把研究笔记写完'],
  ['b', '- 02:26 翻日志，找到写错的那行'],
  ['b', '- 03:14 演示跑挂，报错留在屏幕上'],
  ['b', '- 03:40 改好参数，重新渲染'],
  ['b', '- 05:00 第二遍，过了'],
  ['b', '- 06:30 报告写完，放在桌上'],
  ['t', '（这一页没有人下过指令）'],
];
const MD_AT = 240; // 第 5 刀：文本流入
const MD_STEP = 4; // 每 4 帧落一行（12 行 48 帧，60 帧的刀里留 12 帧喘气）
const CARD_AT = 300; // 第 6 刀：文件卡片定格

// —— 组3：diff 两连切 + CI 盖章 ——
const DIFF_AT = 420; // 第 7 刀：−（红）
const DIFF_HIT2 = 450; // 第 8 刀：+（绿）
const CI_AT = 480; // 第 9 刀：盖章
const CI_TEXT = '✓ CI green · 0a4cb43';

// ============================================================================

// 左列：说话气泡（整组常驻，珊瑚左边条，打字机 32 字/s）
const Bubble: React.FC<{ frame: number; index: number }> = ({ frame, index }) => {
  const gs = GROUP[index];
  const text = SAY[index];
  const start = gs + 4;
  const n = typed(frame, start, text.length); // 默认 32 字/s
  const done = n >= text.length;
  const t = frame - gs;
  const cur = done ? blink(frame, start + text.length, 4) : 1;
  const bar = prog(frame, gs, HARDCUT); // 左边条 4 帧硬切入位
  const tail = 1 - prog(frame, gs + 172, 8); // 组末 8 帧退场，给下一组让位

  return (
    <div
      style={{
        position: 'absolute',
        left: BUB_X,
        top: BUB_TOP,
        width: BUB_W,
        opacity: bar * tail,
        fontFamily: FONT_SANS,
      }}
    >
      {/* 任务编号：三件事要数得出来（外行三问之二） */}
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 26,
          letterSpacing: 6,
          color: CORAL,
          opacity: prog(frame, gs + 2, 6),
          marginBottom: 14,
        }}
      >
        {`任务 0${index + 1}`}
      </div>
      <div
        style={{
          borderLeft: `8px solid ${CORAL}`,
          backgroundColor: CORAL_TINT,
          borderRadius: '0 20px 20px 0',
          padding: '30px 32px',
          transform: `translateX(${(1 - bar) * -24}px)`,
        }}
      >
        <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.45, color: TEXT }}>
          {text.slice(0, n)}
        </span>
        {/* 打字光标；打完再闪两下（t≈46）熄灭 */}
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 40,
            marginLeft: 8,
            verticalAlign: 'middle',
            backgroundColor: t < 52 && cur ? CORAL : 'transparent',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 22,
          color: TS_GRAY,
          opacity: prog(frame, gs + 8, 10) * 0.9,
        }}
      >
        {'说人话就行，不用教它怎么写'}
      </div>
    </div>
  );
};

// 右上：思考字幕（22px #8B949E，逐条弹出、每条 1.2s）
const Think: React.FC<{ frame: number; index: number }> = ({ frame, index }) => (
  <div
    style={{
      position: 'absolute',
      right: PAD,
      top: 72,
      width: PANEL_W,
      height: 44,
      fontFamily: FONT_SANS,
      fontSize: 22,
      color: TS_GRAY,
      textAlign: 'right',
      pointerEvents: 'none',
    }}
  >
    {THINK[index].map((line) => {
      const fin = prog(frame, line.at, 5);
      const fout = 1 - prog(frame, line.at + HOLD - 6, 6);
      const o = Math.min(fin, fout);
      if (o <= 0.004) return null;
      return (
        <div
          key={line.text}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            opacity: o,
            transform: `translateY(${(1 - fin) * 10}px)`,
            whiteSpace: 'nowrap',
          }}
        >
          {`// ${line.text}`}
        </div>
      );
    })}
  </div>
);

// 外壳：右 60% 的终端窗口（九刀只换正文，窗口不跳）
const Panel: React.FC<{ frame: number; children: React.ReactNode }> = ({
  frame,
  children,
}) => {
  const gs = frame < GROUP[1] ? 0 : frame < GROUP[2] ? GROUP[1] : GROUP[2];
  const inP = prog(frame, gs, HARDCUT);
  return (
    <div
      style={{
        position: 'absolute',
        left: PANEL_X,
        top: PANEL_Y,
        opacity: inP,
        transform: `translateY(${(1 - inP) * 12}px)`,
      }}
    >
      <Terminal style={{ width: PANEL_W, height: PANEL_H }}>
        <div
          style={{
            height: BODY_H,
            overflow: 'hidden',
            fontFamily: FONT_MONO,
            fontSize: 30,
            lineHeight: '44px',
            color: '#C9D1D9',
          }}
        >
          {children}
        </div>
      </Terminal>
    </div>
  );
};

// 组1 第2拍：命令行 + git log 高速滚动（1.6×）→ 第3拍定格
const BeatLog: React.FC<{ frame: number }> = ({ frame }) => {
  const cmdN = typed(frame, LOG_CMD_AT, LOG_CMD.length, 28); // 20 字 21 帧打完，滚动前落定
  const cmdOn = frame >= LOG_CMD_AT;
  const scrolled = frame >= LOG_AT;
  const lift = scrolled ? lerpF(frame, [LOG_AT, LOG_AT + BEAT], [56, 0]) : 0;
  const hl = frame >= FREEZE_AT;

  return (
    <>
      <div style={{ fontSize: 26, lineHeight: '34px', opacity: cmdOn ? 0.9 : 0 }}>
        <span style={{ color: TERM_FG }}>{'anthropos@local $ '}</span>
        <span style={{ color: TEXT }}>{LOG_CMD.slice(0, cmdN)}</span>
        {cmdOn && frame < LOG_AT ? (
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 24,
              marginLeft: 6,
              verticalAlign: 'middle',
              backgroundColor: blink(frame, LOG_CMD_AT, 3) ? TEXT : 'transparent',
            }}
          />
        ) : null}
      </div>

      <div style={{ transform: `translateY(${-lift}px)` }}>
        {LOG.map((line, i) => {
          const at = LOG_AT + i * LOG_STEP; // 1.6× 速：每 4 帧落一行
          const seen = scrolled && frame >= at;
          if (!seen) return null;
          const inLine = prog(frame, at, 4);
          const isHl = hl && LOG_HL.includes(i);
          const hlP = isHl ? prog(frame, FREEZE_AT + LOG_HL.indexOf(i) * 4, 6) : 0;
          return (
            <div
              key={line}
              style={{
                whiteSpace: 'nowrap',
                opacity: inLine,
                color: isHl && hlP > 0.5 ? LIME : TEXT,
                fontWeight: isHl ? 700 : 400,
                backgroundColor: isHl ? `rgba(212,244,62,${(0.16 * hlP).toFixed(3)})` : 'transparent',
                borderLeft: isHl ? `6px solid rgba(212,244,62,${(hlP).toFixed(3)})` : '6px solid transparent',
                paddingLeft: 12,
                transform: `translateX(${(1 - inLine) * 14}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* 定格拍：滚动停住后补一行结论（青柠 = 结果侧） */}
      {hl ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 26,
            lineHeight: '36px',
            color: LIME,
            opacity: prog(frame, FREEZE_AT + 16, 8),
          }}
        >
          {'3 files changed · 那条片子的三个文件'}
        </div>
      ) : null}
    </>
  );
};

// 组2 第2拍：markdown 12 行流入 → 第3拍文字压暗、文件卡片定格
const BeatDiary: React.FC<{ frame: number }> = ({ frame }) => {
  const cardOn = frame >= CARD_AT;
  const dim = cardOn ? 1 - 0.72 * prog(frame, CARD_AT, 8) : 1;
  // 已落下的行数（光标要嵌在最后一行行内，独立 inline span 会被 BODY_H 裁掉）
  const nVis = Math.max(
    0,
    Math.min(DIARY.length, Math.floor((frame - MD_AT) / MD_STEP) + 1),
  );
  return (
    <div style={{ fontSize: 28, lineHeight: '40px', opacity: dim }}>
      {DIARY.map(([kind, text], i) => {
        const at = MD_AT + i * MD_STEP;
        if (frame < at) return null;
        const p = prog(frame, at, 4);
        const head = kind === 'h';
        const plain = kind === 't';
        return (
          <div
            key={`${text}-${i}`}
            style={{
              opacity: p,
              transform: `translateX(${(1 - p) * 18}px)`,
              color: head ? LIME : plain ? TS_GRAY : '#C9D1D9',
              fontWeight: head ? 700 : 400,
              whiteSpace: 'nowrap',
              paddingLeft: head ? 0 : 8,
            }}
          >
            {text.length ? text : '\u00A0'}
            {/* 书写光标：嵌在最后一行行尾（卡片定格后消失） */}
            {!cardOn && i === nVis - 1 ? (
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 26,
                  marginLeft: 4,
                  verticalAlign: 'middle',
                  backgroundColor: blink(frame, MD_AT, 3) ? TEXT : 'transparent',
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// 组2 定格卡：diary/11-01.md · 21,141 字节（真实数字，brief §四）
const FileCard: React.FC<{ frame: number }> = ({ frame }) => {
  const p = prog(frame, CARD_AT, 10);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '30px 42px',
          borderRadius: 20,
          border: `2px solid ${TERM_BORDER}`,
          backgroundColor: 'rgba(18,24,34,0.95)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
          opacity: p,
          transform: `translateY(${(1 - p) * 26}px) scale(${1 + 0.02 * (1 - p)})`,
          fontFamily: FONT_MONO,
        }}
      >
        {/* 文档图标（纯 CSS，不依赖 emoji 字体） */}
        <div
          style={{
            width: 46,
            height: 58,
            border: `3px solid ${LIME}`,
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 7,
            padding: '0 8px',
          }}
        >
          {[0.9, 0.65, 0.4].map((w, i) => (
            <div
              key={i}
              style={{ height: 3, width: `${w * 100}%`, backgroundColor: LIME, borderRadius: 2 }}
            />
          ))}
        </div>
        <div>
          <div style={{ fontSize: 40, fontWeight: 700, color: TEXT }}>{'diary/11-01.md'}</div>
          <div style={{ marginTop: 8, fontSize: 26, color: TS_GRAY }}>
            {'21,141 字节'}
            <span style={{ color: LIME }}>{'  · 已保存'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 组3 第2拍：diff 两连切（− 红 → + 绿）→ 第3拍盖章时压暗
const BeatDiff: React.FC<{ frame: number }> = ({ frame }) => {
  const stampOn = frame >= CI_AT;
  const dim = stampOn ? 1 - 0.6 * prog(frame, CI_AT, 8) : 1;
  const rowStyle: CSSProperties = { whiteSpace: 'nowrap', paddingLeft: 10 };
  return (
    <div style={{ fontSize: 28, lineHeight: '40px', opacity: dim }}>
      <div style={{ color: TS_GRAY, opacity: prog(frame, DIFF_AT, 5) }}>
        {'scripts/daily-report.mjs'}
        <span style={{ color: LIME }}>{' +6'}</span>
        <span style={{ color: ERROR }}>{' −4'}</span>
      </div>
      <div style={{ color: TS_GRAY, opacity: prog(frame, DIFF_AT + 4, 5), marginTop: 6 }}>
        {'@@ 日报 · 今天看了几条视频'}
      </div>
      <div style={{ ...rowStyle, color: '#C9D1D9', opacity: prog(frame, DIFF_AT + 8, 5) }}>
        {"  SELECT bvid, title"}
      </div>
      {/* 第 1 刀：读错的那行（红） */}
      {frame >= DIFF_AT + 12 ? (
        <div
          style={{
            ...rowStyle,
            color: ERROR,
            backgroundColor: RED_TINT,
            fontWeight: 700,
            opacity: prog(frame, DIFF_AT + 12, 4),
            transform: `translateX(${(1 - prog(frame, DIFF_AT + 12, 4)) * 20}px)`,
          }}
        >
          {"-   FROM videos"}
        </div>
      ) : null}
      {/* 第 2 刀（+30 帧）：改对的那行（绿） */}
      {frame >= DIFF_HIT2 ? (
        <div
          style={{
            ...rowStyle,
            color: TERM_FG,
            backgroundColor: GREEN_TINT,
            fontWeight: 700,
            opacity: prog(frame, DIFF_HIT2, 4),
            transform: `translateY(${(1 - prog(frame, DIFF_HIT2, 4)) * 12}px)`,
          }}
        >
          {'+   FROM watched'}
        </div>
      ) : null}
      {frame >= DIFF_HIT2 + 20 ? (
        <div style={{ ...rowStyle, color: '#C9D1D9', opacity: prog(frame, DIFF_HIT2 + 20, 5) }}>
          {'  WHERE watched_at >= ?'}
        </div>
      ) : null}
    </div>
  );
};

// 组3 第3拍：✓ CI green · 0a4cb43 —— 盖章式弹出（scale 1.3→1.0，6 帧）
const CiStamp: React.FC<{ frame: number }> = ({ frame }) => {
  const p = prog(frame, CI_AT, 6); // 6 帧盖章
  const scale = 1.3 - 0.3 * p;
  const ring = prog(frame, CI_AT, 18);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        pointerEvents: 'none',
      }}
    >
      {/* 盖章瞬间的一圈余波（青柠，18 帧散掉） */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 760,
          height: 190,
          marginLeft: -380,
          marginTop: -95,
          borderRadius: 40,
          border: `3px solid ${LIME}`,
          opacity: ring > 0 ? (1 - ring) * 0.55 : 0,
          transform: `scale(${1 + ring * 0.12})`,
        }}
      />
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 66,
          fontWeight: 700,
          color: LIME,
          whiteSpace: 'nowrap',
          opacity: Math.min(1, p * 1.6),
          transform: `scale(${scale})`,
          textShadow: `0 0 40px rgba(212,244,62,0.30)`,
        }}
      >
        {CI_TEXT}
      </div>
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 24,
          color: TS_GRAY,
          opacity: prog(frame, CI_AT + 14, 8),
        }}
      >
        {'改完自己推上去，绿灯是它自己挣的'}
      </div>
    </div>
  );
};

// 角标时间戳（brief §三：#8B949E 42px 左上 64/96；组1 定格拍打字机浮出，32 字/s 节奏令）
const TimeBadge: React.FC<{ frame: number }> = ({ frame }) => {
  const n = typed(frame, FREEZE_AT + 6, TS_TEXT.length); // 5 字 ≈ 5 帧打完
  const done = n >= TS_TEXT.length;
  return (
    <div
      style={{
        position: 'absolute',
        left: TS_X,
        top: TS_Y,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: FONT_MONO,
        fontSize: TS_PX,
        color: TS_GRAY,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          backgroundColor: LIME,
          opacity: prog(frame, FREEZE_AT, 6) * (1 - prog(frame, GROUP[1] - 8, 8)),
        }}
      />
      <span style={{ opacity: 1 - prog(frame, GROUP[1] - 8, 8) }}>{TS_TEXT.slice(0, n)}</span>
    </div>
  );
};

export const S3: React.FC = () => {
  const frame = useCurrentFrame(); // 本地帧 0–539（全局 = 本地 + 300）
  const g = frame < GROUP[1] ? 0 : frame < GROUP[2] ? 1 : 2;
  const beat = Math.min(2, Math.floor((frame - GROUP[g]) / BEAT));

  return (
    <AbsoluteFill style={{ fontFamily: FONT_SANS }}>
      {/* 左下角刀点计数（抽帧核验 + 节奏感），组末一起换 */}
      <div
        style={{
          position: 'absolute',
          left: PAD,
          bottom: SUB_SAFE_BOTTOM,
          fontFamily: FONT_MONO,
          fontSize: 24,
          color: TERM_BORDER,
          opacity: prog(frame, GROUP[g], HARDCUT) * (1 - prog(frame, GROUP[g] + 172, 8)),
        }}
      >
        {`0${g + 1} · ${beat + 1}/3`}
      </div>

      <Bubble frame={frame} index={g} />
      <Think frame={frame} index={g} />
      {g === 0 ? <TimeBadge frame={frame} /> : null}

      <Panel frame={frame}>
        {g === 0 ? <BeatLog frame={frame} /> : null}
        {g === 1 ? <BeatDiary frame={frame} /> : null}
        {g === 2 ? <BeatDiff frame={frame} /> : null}
      </Panel>

      {g === 1 && beat === 2 ? <FileCard frame={frame} /> : null}
      {g === 2 && beat === 2 ? <CiStamp frame={frame} /> : null}
    </AbsoluteFill>
  );
};
