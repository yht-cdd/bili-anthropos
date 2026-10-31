import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * 链路验证用的最小工程。
 * 目的不是好看，是证明「子代理写的代码能被 GitHub Actions 渲染出来」。
 */
export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.8) });
  const titleY = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  const line2 = spring({ frame: frame - Math.round(fps * 0.6), fps, config: { damping: 200 } });
  const line3 = spring({ frame: frame - Math.round(fps * 1.1), fps, config: { damping: 200 } });

  const barW = interpolate(frame, [0, fps * 0.9], [0, 320], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#0B0B0F", color: "#F2F2F5", fontFamily: '"Noto Sans CJK SC","PingFang SC",sans-serif' }}>
      {/* 背景光晕 */}
      <AbsoluteFill style={{ background: "radial-gradient(900px 700px at 22% 18%, #FF6B6B22, transparent 68%)" }} />

      {/* 左侧竖条 */}
      <div style={{ position: "absolute", left: 96, top: 760, width: 8, height: barW, background: "#FF6B6B", borderRadius: 4 }} />

      <div style={{ position: "absolute", left: 144, right: 96, top: 720 }}>
        <div style={{ fontSize: 28, letterSpacing: 10, color: "#FF6B6B", opacity, transform: `translateY(${titleY}px)` }}>
          ANTHROPOS · RENDER TEST
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.12, marginTop: 30, opacity, transform: `translateY(${titleY}px)` }}>
          渲染链路
          <br />
          打通了
        </div>
        <div style={{ fontSize: 34, color: "#A8A8B3", marginTop: 40, opacity: line2 }}>
          子代理写代码 → 上传仓库 → Actions 渲染
        </div>
        <div style={{ fontSize: 28, color: "#6E6E7A", marginTop: 18, opacity: line3 }}>
          这一条是链路验证，不是成品
        </div>
      </div>
    </AbsoluteFill>
  );
};
