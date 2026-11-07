import React from 'react';
import { useCurrentFrame } from 'remotion';
import { charCount, flashOn, prog } from '../anim';
import { FONT_MONO, FS, RADIUS, RED, SHADOW, TERM_BG, TERM_DIM, TERM_INK } from '../theme';

export type TerminalLine = {
  kind: 'header' | 'out' | 'comment' | 'dim';
  text: string;
  at: number /* 本行开始打字的相对帧 */;
  truncated?: boolean;
};

export type TerminalProps = {
  title: string;
  width: number;
  height: number;
  lines: TerminalLine[];
  accent?: string;
  style?: React.CSSProperties;
};

const CHAR_DUR = 1.2; // 帧/字
const BAR_H = 44;
const PAD_X = 32;
const PAD_Y = 24;
const BLINK_PERIOD = 16;

type KindStyle = { size: number; lh: number; gap: number; color: string; italic?: boolean; prefix?: string; typed: boolean };

const KIND: Record<TerminalLine['kind'], KindStyle> = {
  header: { size: 26, lh: 1.5, gap: 18, color: TERM_DIM, typed: false },
  dim: { size: 26, lh: 1.5, gap: 8, color: TERM_DIM, typed: false },
  comment: { size: 28, lh: 1.5, gap: 8, color: TERM_DIM, italic: true, prefix: '› ', typed: true },
  out: { size: FS.quote, lh: 1.55, gap: 10, color: TERM_INK, typed: true },
};

// 估算一段文字在给定宽度下的行数（等宽字体：CJK 全角，ASCII 约 0.6 字宽）
const estimateRows = (chars: string[], fontSize: number, maxWidth: number): number => {
  let rows = 1;
  let x = 0;
  for (const c of chars) {
    if (c === '\n') {
      rows++;
      x = 0;
      continue;
    }
    const w = c.charCodeAt(0) < 0x2e80 ? fontSize * 0.6 : fontSize;
    if (x + w > maxWidth) {
      rows++;
      x = w;
    } else x += w;
  }
  return rows;
};

export const Terminal: React.FC<TerminalProps> = ({ title, width, height, lines, accent, style }) => {
  const frame = useCurrentFrame();
  const innerW = width - PAD_X * 2;
  const availH = height - BAR_H - PAD_Y * 2;

  const visible = lines
    .filter((l) => frame >= l.at)
    .map((l) => {
      const k = KIND[l.kind];
      const chars = Array.from(l.text);
      const prefix = k.prefix ?? '';
      const n = k.typed ? charCount(frame, l.at, chars.length, CHAR_DUR) : chars.length;
      const shown = chars.slice(0, n);
      const done = n >= chars.length;
      const rows = estimateRows(Array.from(prefix).concat(shown, ['▌']), k.size, innerW);
      return { l, k, prefix, shown: shown.join(''), done, h: rows * k.size * k.lh + k.gap };
    });

  const total = visible.reduce((s, v) => s + v.h, 0);
  const push = Math.max(0, total - availH);

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        background: TERM_BG,
        borderRadius: RADIUS,
        boxShadow: SHADOW,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height: BAR_H,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 10,
          borderBottom: accent ? `3px solid ${accent}` : undefined,
          boxSizing: 'border-box',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: TERM_DIM, opacity: 0.7 }} />
        ))}
        <div style={{ marginLeft: 14, fontFamily: FONT_MONO, fontSize: 22, color: TERM_DIM, whiteSpace: 'nowrap' }}>
          {title}
        </div>
      </div>
      <div style={{ position: 'absolute', left: PAD_X, right: PAD_X, top: BAR_H + PAD_Y, bottom: PAD_Y, overflow: 'hidden' }}>
        <div style={{ transform: `translateY(${-push}px)` }}>
          {visible.map(({ l, k, prefix, shown, done }, i) => {
            const fade = k.typed ? 1 : prog(frame, l.at, 4);
            const typing = k.typed && !done;
            const blink = l.truncated && done && flashOn(frame, l.at + Array.from(l.text).length * CHAR_DUR, BLINK_PERIOD);
            return (
              <div
                key={i}
                style={{
                  marginTop: k.gap,
                  fontFamily: FONT_MONO,
                  fontSize: k.size,
                  lineHeight: k.lh,
                  color: k.color,
                  fontStyle: k.italic ? 'italic' : 'normal',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  opacity: fade,
                }}
              >
                {prefix}
                {shown}
                {typing ? <span style={{ color: TERM_DIM }}>▌</span> : null}
                {l.truncated && done ? <span style={{ color: RED, opacity: blink ? 1 : 0 }}>▌</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
