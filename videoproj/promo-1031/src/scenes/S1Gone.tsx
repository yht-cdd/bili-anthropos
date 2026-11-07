import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { C, F, G, H, M, S, SCENES, W, X } from "../theme";
import { SceneShell } from "../components/SceneShell";
import { WhaleMark } from "../components/ui";

/**
 * S1Gone —— 帧 0–330（11.0 秒）
 * 关掉窗口就没了。
 *
 * 横屏骨架：居中单列。窗口 1400×800 居中（横屏可用宽 1600，窗口不再是竖屏那种窄条），
 * 窗口消失后两行字幕左对齐 X.left，落回窗口原位置的下半部分。
 * 铁律：这一段不出现鲸鱼娘的脸，只剩窗口和光标。
 */

const LEN = SCENES.gone.to - SCENES.gone.from; // 330
export const S1_DURATION = LEN + M.overlap; // 345

const WIN_W = 1400;
const WIN_H = 800;
const WIN_LEFT = (W - WIN_W) / 2; // 260
const WIN_TOP = (H - WIN_H) / 2; // 140
const BAR_H = 64;
const DOT_R = 8;
const DOT_CX = WIN_LEFT + 32; // 红点圆心（左边距 24 + 半径 8）
const DOT_CY = WIN_TOP + BAR_H / 2;

const ip = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const WinDot: React.FC<{ color: string; scale?: number }> = ({ color, scale = 1 }) => (
  <div
    style={{
      width: DOT_R * 2,
      height: DOT_R * 2,
      borderRadius: DOT_R,
      background: color,
      transform: `scale(${scale})`,
      flexShrink: 0,
    }}
  />
);

export const S1Gone: React.FC = () => {
  const f = useCurrentFrame();

  // 呼吸：1.000 → 1.005，周期 90 帧
  const breath = 1 + 0.0025 * (1 + Math.sin((f / 90) * Math.PI * 2));

  // 第三拍：点击后整体收起
  const collapse = ip(f, 180, 204);
  const winOpacity = 1 - collapse;
  const winScale = breath * (1 - 0.08 * collapse);

  // 第二拍：光标沿二次贝塞尔从右下角移到红点
  const moveP = interpolate(f, [120, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const x0 = 1560;
  const y0 = 960;
  const cx = 700;
  const cy = 820;
  const curX = (1 - moveP) * (1 - moveP) * x0 + 2 * (1 - moveP) * moveP * cx + moveP * moveP * DOT_CX;
  const curY = (1 - moveP) * (1 - moveP) * y0 + 2 * (1 - moveP) * moveP * cy + moveP * moveP * DOT_CY;

  // 红点到位后放大到 1.4 倍，按下时回弹
  const dotScale = f < 180 ? ip(f, 168, 180, 1, 1.4) : ip(f, 180, 192, 1.4, 1);
  const cursorOpacity = ip(f, 108, 120) * (1 - ip(f, 180, 190));

  // 第四拍：两行字幕
  const l1 = ip(f, 220, 240);
  const l2 = ip(f, 268, 288);

  return (
    <SceneShell length={S1_DURATION}>
      {/* ── 第一拍：浏览器窗口（1400×800 居中）── */}
      <div
        style={{
          position: "absolute",
          left: WIN_LEFT,
          top: WIN_TOP,
          width: WIN_W,
          height: WIN_H,
          borderRadius: 24,
          background: C.paper,
          overflow: "hidden",
          opacity: winOpacity,
          transform: `scale(${winScale})`,
          transformOrigin: "center center",
        }}
      >
        {/* 标题栏：三色点 + 地址栏 */}
        <div
          style={{
            height: BAR_H,
            background: C.panel,
            borderBottom: `1px solid ${C.line}`,
            display: "flex",
            alignItems: "center",
            paddingLeft: 24,
            paddingRight: 24,
            gap: 12,
          }}
        >
          <WinDot color={C.bad} scale={dotScale} />
          <WinDot color={C.warm} />
          <WinDot color={C.ok} />
          <div
            style={{
              marginLeft: 20,
              height: 34,
              flex: 1,
              borderRadius: 17,
              border: `1px solid ${C.line}`,
              display: "flex",
              alignItems: "center",
              paddingLeft: 18,
            }}
          >
            <span
              style={{
                fontFamily: F.sans,
                fontSize: S.label,
                color: C.faint,
                letterSpacing: "0.02em",
              }}
            >
              大肥鱼
            </span>
          </div>
        </div>

        {/* 窗口内：浅色底 + 鲸鱼标记 + 版本号 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: BAR_H,
            bottom: 0,
            background: C.paper,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <WhaleMark size={240} opacity={1} glow={false} />
          <div style={{ fontFamily: F.sans, fontSize: S.small, color: C.dim }}>大肥鱼 v2.6</div>
        </div>
      </div>

      {/* ── 第二拍：白色箭头光标 ── */}
      <div
        style={{
          position: "absolute",
          left: curX - 4,
          top: curY - 2,
          opacity: cursorOpacity,
          pointerEvents: "none",
        }}
      >
        <svg width={30} height={38} viewBox="0 0 24 24">
          <path
            d="M4 2 L4 19 L8.6 14.6 L11.7 21.4 L14.5 20.1 L11.4 13.4 L17.6 13.4 Z"
            fill={C.text}
            stroke={C.bg}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* ── 第四拍：两行字幕（左对齐 X.left，落在窗口原位置的下半部分）── */}
      <div style={{ position: "absolute", left: X.left, top: 470, width: G.contentW }}>
        <div
          style={{
            fontFamily: F.sans,
            fontWeight: 900,
            fontSize: S.hero,
            lineHeight: 1.2,
            color: C.text,
            opacity: l1,
            transform: `translateY(${(1 - l1) * 24}px)`,
          }}
        >
          你电脑里的大肥鱼，
          <br />
          关掉窗口就没了
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: F.sans,
            fontWeight: 500,
            fontSize: S.body,
            color: C.dim,
            opacity: l2,
            transform: `translateY(${(1 - l2) * 20}px)`,
          }}
        >
          下一次打开，它不记得你
        </div>
      </div>
    </SceneShell>
  );
};
