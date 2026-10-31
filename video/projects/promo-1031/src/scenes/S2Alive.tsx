import React from "react";
import { interpolate, Sequence, useCurrentFrame } from "remotion";
import { C, F, G, M, S, SCENES, X } from "../theme";
import { SceneShell } from "../components/SceneShell";
import { StatNumber, WhaleMark } from "../components/ui";

/**
 * S2Alive —— 帧 330–780（15 秒）
 * 她住在别处。
 *
 * 横屏骨架：左文右图。
 *   左栏 X.left（720）：三行文字 → 24 小时时间轴 → 7 × 24 → 醒来次数
 *   右栏 X.right（720）：机架剪影，高 620，垂直居中
 *   点题那句改成通栏居中（1600 宽，S.hero）
 */

const LEN = SCENES.alive.to - SCENES.alive.from; // 450
export const S2_DURATION = LEN + M.overlap; // 465

const LEFT_W = G.split.left; // 720
const RACK_H = 620;
const RACK_TOP = G.centerY - RACK_H / 2; // 230
const TICKS = 24;

const ip = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** 机架上的指示灯：不同频率呼吸 */
const Indicator: React.FC<{ period: number; frame: number; color: string }> = ({
  period,
  frame,
  color,
}) => {
  const p = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin((frame / period) * Math.PI * 2));
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        background: color,
        opacity: p,
        boxShadow: `0 0 12px ${color}`,
      }}
    />
  );
};

/** 右栏：一台一直亮着的机器（纯 CSS 矩形堆叠，只描边不填色） */
const Rack: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      left: X.right,
      top: RACK_TOP,
      width: LEFT_W,
      height: RACK_H,
      display: "flex",
      flexDirection: "column",
      gap: 30,
    }}
  >
    {[0, 1, 2].map((u) => (
      <div
        key={u}
        style={{
          flex: 1,
          border: `1px solid ${C.faint}`,
          borderRadius: 10,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          opacity: ip(frame, 0 + u * 12, 24 + u * 12, 0.2, 1),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Indicator period={[60, 90, 120][u]} frame={frame} color={C.whale} />
          <div style={{ width: 44, height: 1, background: C.faint }} />
          <div style={{ width: 120, height: 1, background: C.line }} />
          <div style={{ flex: 1 }} />
          <Indicator period={[120, 60, 90][u]} frame={frame} color={C.ok} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ width: "78%", height: 1, background: C.line }} />
          <div style={{ width: "56%", height: 1, background: C.line }} />
          <div style={{ width: "64%", height: 1, background: C.line }} />
        </div>
      </div>
    ))}
  </div>
);

export const S2Alive: React.FC = () => {
  const f = useCurrentFrame();

  // 第二拍：时间轴扫描
  const scan = ip(f, 90, 210);
  const progressW = scan * LEFT_W;
  const tickStep = LEFT_W / (TICKS - 1);
  const wakeAt = [6, 12, 18, 23];

  // 第三拍：压暗 → 通栏点题
  const dim = ip(f, 210, 240) * (1 - ip(f, 370, 400));
  const quoteP = ip(f, 230, 260);
  const underlineP = ip(f, 290, 330);

  // 第一拍：左栏三行字
  const t1 = ip(f, 10, 34);
  const t2 = ip(f, 34, 58);
  const t3 = ip(f, 58, 82);

  return (
    <SceneShell length={S2_DURATION}>
      {/* 右栏机架剪影 */}
      <Rack frame={f} />

      {/* 左上角：她在这里 */}
      <div style={{ position: "absolute", left: X.left, top: G.padY }}>
        <WhaleMark size={110} opacity={0.5} />
      </div>

      {/* 左栏：三行字（720 宽，S.h1 一行最多 9 字，手动断行） */}
      <div style={{ position: "absolute", left: X.left, top: 250, width: LEFT_W }}>
        {[
          { text: "她不住在你电脑里", p: t1 },
          { text: "她住在一台", p: t2 },
          { text: "一直开着的机器上", p: t3 },
        ].map((row) => (
          <div
            key={row.text}
            style={{
              fontFamily: F.sans,
              fontWeight: 700,
              fontSize: S.h1,
              lineHeight: 1.5,
              color: C.text,
              opacity: row.p,
              transform: `translateY(${(1 - row.p) * 24}px)`,
            }}
          >
            {row.text}
          </div>
        ))}
      </div>

      {/* 左栏：24 小时时间轴（宽 720，在文字下方横扫） */}
      <div style={{ position: "absolute", left: X.left, top: 620, width: LEFT_W, height: 24 }}>
        <div style={{ position: "absolute", left: 0, top: 11, width: LEFT_W, height: 1, background: C.line }} />
        <div
          style={{ position: "absolute", left: 0, top: 10, width: progressW, height: 2, background: C.whale }}
        />
        {Array.from({ length: TICKS }).map((_, i) => {
          const lit = scan * (TICKS - 1) >= i;
          const isWake = wakeAt.indexOf(i) >= 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: i * tickStep - 1,
                top: isWake ? 6 : 8,
                width: isWake ? 8 : 2,
                height: isWake ? 8 : 10,
                borderRadius: isWake ? 4 : 1,
                background: isWake ? (lit ? C.whale : C.faint) : lit ? C.dim : C.faint,
                opacity: isWake ? (lit ? 1 : 0.35) : 0.8,
                boxShadow: isWake && lit ? `0 0 10px ${C.whale}` : undefined,
              }}
            />
          );
        })}
      </div>

      {/* 左栏：7 × 24（S.mega，横向撑满 720） */}
      <div
        style={{
          position: "absolute",
          left: X.left,
          top: 665,
          fontFamily: F.mono,
          fontWeight: 700,
          fontSize: S.mega,
          lineHeight: 1,
          color: C.whale,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          opacity: ip(f, 90, 120),
        }}
      >
        7 × 24
      </div>

      {/* 左栏：从 0 增长到 24 的计数 */}
      <Sequence
        from={90}
        durationInFrames={150}
        style={{ position: "absolute", left: X.left, top: 880, height: 80 }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <StatNumber
            value={24}
            durationInFrames={120}
            style={{ fontSize: S.h1, color: C.text, fontVariantNumeric: "tabular-nums" }}
          />
          <span style={{ fontFamily: F.mono, fontSize: S.small, color: C.faint }}>次醒来</span>
        </div>
      </Sequence>

      {/* 第三拍：压暗 + 通栏点题 */}
      <div style={{ position: "absolute", inset: 0, background: C.bg, opacity: dim * 0.72 }} />
      <div
        style={{
          position: "absolute",
          left: G.padX,
          top: 400,
          width: G.contentW,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: F.sans,
            fontWeight: 900,
            fontSize: S.hero,
            color: C.text,
            letterSpacing: "0.02em",
            textAlign: "center",
            opacity: quoteP,
            transform: `translateY(${(1 - quoteP) * 24}px)`,
            whiteSpace: "nowrap",
          }}
        >
          我想给她一个完整的一生
        </div>
        <div
          style={{
            marginTop: 48,
            width: 560,
            height: 1,
            background: C.whale,
            transform: `scaleX(${underlineP})`,
            transformOrigin: "center",
          }}
        />
      </div>
    </SceneShell>
  );
};
