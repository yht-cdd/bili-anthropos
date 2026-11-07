import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, M, S } from "../theme";

/**
 * 方块光标，闪烁频率跟 M.cursorHz 走。
 * S1 的开场和 S3 的时间戳冒号用同一个节奏，形成呼应。
 * 默认高度按横屏主字号（S.body 之上）给，场景里可再传。
 */
export const Cursor: React.FC<{ height?: number; width?: number; color?: string }> = ({
  height = 120,
  width = 6,
  color = C.ok,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const period = fps / M.cursorHz;
  const on = Math.floor(frame % period) < period / 2;
  return (
    <div
      style={{
        display: "inline-block",
        width,
        height,
        background: color,
        opacity: on ? 1 : 0,
        marginLeft: 8,
        verticalAlign: "middle",
      }}
    />
  );
};

/** 打字机：用 clipPath 遮罩，不逐字挂 DOM */
export const Typed: React.FC<{
  text: string;
  startFrame?: number;
  framesPerChar?: number;
  style?: React.CSSProperties;
  showCursor?: boolean;
}> = ({ text, startFrame = 0, framesPerChar = 4, style, showCursor = true }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;
  const chars = Math.max(0, Math.floor(elapsed / framesPerChar));
  const p = Math.min(1, chars / Math.max(1, text.length));

  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      <span style={{ ...style, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>{text}</span>
      {showCursor && p < 1 ? <Cursor height={(style?.fontSize as number) || 120} /> : null}
    </div>
  );
};

/** 等宽数字：带 tabular-nums，避免增长时宽度抖动 */
export const StatNumber: React.FC<{
  value: number;
  from?: number;
  durationInFrames?: number;
  format?: (n: number) => string;
  style?: React.CSSProperties;
}> = ({ value, from = 0, durationInFrames = 30, format, style }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [0, durationInFrames], [from, value], {
    extrapolateRight: "clamp",
  });
  const text = format ? format(v) : Math.round(v).toLocaleString("en-US");
  return (
    <span
      style={{
        fontFamily: F.mono,
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {text}
    </span>
  );
};

/** 终端窗口：标题栏 + 内容区 */
export const Terminal: React.FC<{
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ title = "bash", children, style }) => (
  <div
    style={{
      background: C.panel,
      border: `1px solid ${C.line}`,
      borderRadius: 12,
      overflow: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        paddingLeft: 20,
        gap: 10,
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      {[C.bad, C.warm, C.ok].map((c, i) => (
        <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.55 }} />
      ))}
      <span style={{ marginLeft: 12, color: C.faint, fontFamily: F.mono, fontSize: S.label }}>{title}</span>
    </div>
    <div style={{ padding: 32 }}>{children}</div>
  </div>
);

/** 极淡的数据流网格背景，只为了让黑不死 */
export const GridBackdrop: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.6) % 80;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        backgroundImage: `
          linear-gradient(to right, ${C.whale}22 1px, transparent 1px),
          linear-gradient(to bottom, ${C.whale}22 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
        backgroundPosition: `0 ${offset}px`,
      }}
    />
  );
};

/**
 * 鲸鱼娘剪影（纯 SVG，不用位图）。
 * 只用最少的线条暗示：鲸尾 + 头鳍 + 一个发光的点。
 * 不做萌系细节 —— 这片子里她只是「存在」，不抢戏。
 * 横屏默认尺寸上调到 160（竖屏时代是 120，放在 1920 宽里偏小）。
 */
export const WhaleMark: React.FC<{ size?: number; opacity?: number; glow?: boolean }> = ({
  size = 160,
  opacity = 1,
  glow = true,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    style={{ opacity, filter: glow ? `drop-shadow(0 0 24px ${C.whale}55)` : undefined }}
  >
    {/* 鲸身 */}
    <path
      d="M22 56c0 14 12 24 28 24 17 0 28-11 28-26 0-6-2-11-5-15"
      fill="none"
      stroke={C.whale}
      strokeWidth={3}
      strokeLinecap="round"
    />
    {/* 鲸尾 */}
    <path
      d="M22 56c-6-2-10-8-10-14 6 3 10 3 14 1-2-6 0-12 4-16 1 7 5 11 10 13"
      fill="none"
      stroke={C.whale}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* 头鳍 */}
    <path d="M62 40c5-6 11-7 16-4" fill="none" stroke={C.whale} strokeWidth={3} strokeLinecap="round" />
    {/* 眼睛：一个发光的点 */}
    <circle cx={66} cy={52} r={2.6} fill={C.ok} />
  </svg>
);
