import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type VideoProps = {
  title: string;
  subtitle: string;
  kicker: string;
  accent: string;
  seconds?: number;
};

/**
 * 竖屏 1080×1920。
 * 只做一件事：把一句话讲清楚 —— 大字标题 + 一行副标题 + 进度条。
 * 复杂动效留给后面按需加，这里先保证「能渲染出成片」。
 */
export const AnthroposVideo: React.FC<VideoProps> = ({ title, subtitle, kicker, accent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: fps * 0.9 });
  const titleY = interpolate(enter, [0, 1], [60, 0]);
  const titleOpacity = interpolate(enter, [0, 1], [0, 1]);

  const subDelay = spring({ frame: frame - fps * 0.6, fps, config: { damping: 200 } });
  const subOpacity = interpolate(subDelay, [0, 1], [0, 1]);
  const subY = interpolate(subDelay, [0, 1], [30, 0]);

  const progress = Math.min(1, Math.max(0, frame / (durationInFrames - 1)));
  const drift = interpolate(frame, [0, durationInFrames], [0, -40]);

  return (
    <AbsoluteFill
      style={{
        background: "#0E0E10",
        fontFamily:
          '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif',
        color: "#F5F5F7",
      }}
    >
      {/* 背景渐晕 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at 20% ${20 + drift * 0.05}%, ${accent}22, transparent 70%)`,
        }}
      />

      {/* 左侧竖条 */}
      <div
        style={{
          position: "absolute",
          left: 96,
          top: height * 0.22,
          width: 8,
          height: interpolate(enter, [0, 1], [0, 420]),
          background: accent,
          borderRadius: 4,
        }}
      />

      <div style={{ position: "absolute", left: 144, right: 96, top: height * 0.22 }}>
        <div
          style={{
            fontSize: 30,
            letterSpacing: 8,
            color: accent,
            opacity: titleOpacity,
            marginBottom: 36,
            fontWeight: 600,
          }}
        >
          {kicker}
        </div>

        <div
          style={{
            fontSize: 88,
            lineHeight: 1.18,
            fontWeight: 800,
            letterSpacing: -1,
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 40,
            lineHeight: 1.5,
            color: "#B9B9C0",
            transform: `translateY(${subY}px)`,
            opacity: subOpacity,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* 底部进度条 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, background: "#1C1C20" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: accent }} />
      </div>

      {/* 角标 */}
      <div
        style={{
          position: "absolute",
          left: 96,
          bottom: 72,
          fontSize: 24,
          letterSpacing: 6,
          color: "#6E6E76",
        }}
      >
        ANTHROPOS
      </div>
    </AbsoluteFill>
  );
};
