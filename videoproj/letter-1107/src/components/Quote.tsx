import React from 'react';
import { useCurrentFrame } from 'remotion';
import { flashOn, prog, EASE_LINEAR } from '../anim';
import { FONT_SANS, FS, INK, RED } from '../theme';

export type QuoteProps = {
  text: string;
  highlight?: string;
  highlightAt?: number;
  truncated?: boolean;
  size?: number;
  /** 下划线颜色，默认 RED */
  underlineColor?: string;
  /** 文字颜色，默认 INK */
  color?: string;
  style?: React.CSSProperties;
};

const UNDERLINE_FRAMES = 10;
const BLINK_PERIOD = 16;

export const Quote: React.FC<QuoteProps> = ({
  text,
  highlight,
  highlightAt = 0,
  truncated = false,
  size = FS.quote,
  underlineColor = RED,
  color = INK,
  style,
}) => {
  const frame = useCurrentFrame();

  let before = text;
  let hl = '';
  let after = '';
  if (highlight) {
    const idx = text.indexOf(highlight);
    if (idx >= 0) {
      before = text.slice(0, idx);
      hl = highlight;
      after = text.slice(idx + highlight.length);
    } else {
      console.warn(`[Quote] highlight 未在原文中找到：${highlight}`);
    }
  }

  const p = hl ? prog(frame, highlightAt, UNDERLINE_FRAMES, EASE_LINEAR) : 0;

  return (
    <div
      style={{
        fontFamily: FONT_SANS,
        fontSize: size,
        lineHeight: 1.6,
        color,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        ...style,
      }}
    >
      「{before}
      {hl ? (
        <span
          style={{
            backgroundImage: `linear-gradient(${underlineColor}, ${underlineColor})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: '0 100%',
            backgroundSize: `${p * 100}% 3px`,
            paddingBottom: 2,
          }}
        >
          {hl}
        </span>
      ) : null}
      {after}
      {truncated ? <span style={{ color: RED, opacity: flashOn(frame, 0, BLINK_PERIOD) ? 1 : 0 }}>▌</span> : null}」
    </div>
  );
};
