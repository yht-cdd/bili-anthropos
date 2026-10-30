import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type Segment = { index: number; text: string; from: number; to: number };

export type VideoProps = {
  title: string;
  subtitle: string;
  kicker: string;
  accent: string;
  seconds?: number;
  segments?: Segment[];
};

/**
 * 竖屏 1080×1920。
 * 两种模式：
 *   1) 有 segments —— 按配音时间轴切场景，每段文字和音频严格对齐
 *   2) 没有 —— 一张标题卡（预览用）
 */
export const AnthroposVideo: React.FC<VideoProps> = ({
  title,
  subtitle,
  kicker,
  accent,
  segments,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const progress = Math.min(1, Math.max(0, frame / (durationInFrames - 1)));

  const list = segments && segments.length ? segments : null;
  const cur = list
    ? list.find((s) => t >= s.from && t < s.to) || list[list.length - 1]
    : null;

  // 每段进场：在段内做一次淡入上移
  const local = cur ? frame - Math.round(cur.from * fps) : frame;
  const enter = spring({ frame: local, fps, config: { damping: 200 }, durationInFrames: fps * 0.6 });
  const titleY = interpolate(enter, [0, 1], [50, 0]);
  const titleOpacity = interpolate(enter, [0, 1], [0, 1]);

  const subDelay = spring({ frame: frame - fps * 0.6, fps, config: { damping: 200 } });
  const subOpacity = interpolate(subDelay, [0, 1], [0, 1]);
  const subY = interpolate(subDelay, [0, 1], [30, 0]);

  return (
    <AbsoluteFill
      style={{
        background: "#0E0E10",
        fontFamily:
          '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif',
        color: "#F5F5F7",
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at 20% 25%, ${accent}22, transparent 70%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 96,
          top: 422,
          width: 8,
          height: interpolate(enter, [0, 1], [0, 420]),
          background: accent,
          borderRadius: 4,
        }}
      />

      <div style={{ position: "absolute", left: 144, right: 96, top: 422 }}>
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
          {list && cur ? `${kicker} · ${String(cur.index).padStart(2, "0")}/${list.length}` : kicker}
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
          {list && cur ? cur.text : title}
        </div>

        {!list && (
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
        )}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, background: "#1C1C20" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: accent }} />
      </div>

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
