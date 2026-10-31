import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, F, G, M, S, SCENES, X } from "../theme";
import { SceneShell } from "../components/SceneShell";

/**
 * S5Mismatch —— 帧 2280–3000（24 秒）
 * 音画对不上。
 *
 * 横屏骨架：左图右音轨。
 *   左栏 X.left：九宫格 540×540（垂直居中），红框标出 3 格
 *   右栏 X.right：波形 720 宽，中途突然变平，下面逐行给判断
 *   「对不上。」压在全屏正中（S.mega），压暗时左右一起暗
 */

const LEN = SCENES.mismatch.to - SCENES.mismatch.from; // 720
export const S5_DURATION = LEN + M.overlap; // 735

const GRID_SIZE = 540;
const GAP = 12;
const CELL = (GRID_SIZE - GAP * 2) / 3; // 172
const GRID_TOP = G.centerY - GRID_SIZE / 2; // 270

const COL_W = G.split.left; // 720
const BARS = 24;
const BAR_W = 18;
const BAR_GAP = 12;
const FLAT_AT = 14; // 第 14 根之后突然变平

const ip = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const RED_CELLS = [1, 5, 7];

export const S5Mismatch: React.FC = () => {
  const f = useCurrentFrame();

  const judge1 = ip(f, 240, 268);
  const judge2 = ip(f, 268, 296);
  const dim = ip(f, 360, 396) * (1 - ip(f, 600, 660));
  const verdictP = ip(f, 372, 396);
  const subP = ip(f, 400, 424);
  const jitter = Math.sin(Math.floor(f / 8) * 1.9) * 2;

  return (
    <SceneShell length={S5_DURATION}>
      {/* 小标题：左画面 / 右音轨 */}
      <div
        style={{
          position: "absolute",
          left: X.left,
          top: 208,
          fontFamily: F.mono,
          fontSize: S.label,
          color: C.faint,
          letterSpacing: "0.08em",
          opacity: ip(f, 0, 20),
        }}
      >
        画面
      </div>
      <div
        style={{
          position: "absolute",
          left: X.right,
          top: 208,
          fontFamily: F.mono,
          fontSize: S.label,
          color: C.faint,
          letterSpacing: "0.08em",
          opacity: ip(f, 0, 20),
        }}
      >
        音轨
      </div>

      {/* 左右之间的分隔线（落在两栏间距的正中） */}
      <div
        style={{
          position: "absolute",
          left: X.left + G.split.left + G.split.gap / 2,
          top: GRID_TOP,
          width: 1,
          height: GRID_SIZE,
          background: C.line,
          opacity: 0.7,
        }}
      />

      {/* 左栏：九宫格 */}
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const lit = ip(f, 10 + i * 6, 30 + i * 6, 0.12, 1);
        const boxed = RED_CELLS.indexOf(i) >= 0 ? ip(f, 90 + i * 6, 110 + i * 6) : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: X.left + c * (CELL + GAP),
              top: GRID_TOP + r * (CELL + GAP),
              width: CELL,
              height: CELL,
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderRadius: 3,
              opacity: lit,
            }}
          >
            {boxed > 0 ? (
              <div
                style={{
                  position: "absolute",
                  inset: -2,
                  border: `2px solid ${C.bad}`,
                  borderRadius: 3,
                  opacity: boxed,
                  background: `${C.bad}14`,
                }}
              />
            ) : null}
          </div>
        );
      })}

      {/* 右栏：波形（第 14 根之后突然变平） */}
      <div style={{ position: "absolute", left: X.right, top: 246, width: COL_W, height: 240 }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: C.line }} />
        <div style={{ position: "absolute", left: 0, bottom: 0, display: "flex", alignItems: "flex-end", gap: BAR_GAP }}>
          {Array.from({ length: BARS }).map((_, i) => {
            const wave = 24 + Math.abs(Math.sin(f * 0.08 + i)) * 200;
            const flatP = i >= FLAT_AT ? ip(f, 120, 138) : 0;
            const appear = ip(f, 60 + i * 2, 80 + i * 2);
            return (
              <div
                key={i}
                style={{
                  width: BAR_W,
                  height: Math.max(2, wave * (1 - flatP)) * appear,
                  borderRadius: 2,
                  background: i >= FLAT_AT && flatP > 0.5 ? C.faint : C.dim,
                  opacity: i >= FLAT_AT && flatP > 0.5 ? 0.5 : 0.85,
                }}
              />
            );
          })}
        </div>

        {/* 竖直虚线：声音断掉的位置 */}
        <div
          style={{
            position: "absolute",
            left: FLAT_AT * (BAR_W + BAR_GAP) - 6,
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: `2px dashed ${C.bad}`,
            opacity: ip(f, 120, 140) * 0.9,
          }}
        />
      </div>

      {/* 右栏：逐行判断 */}
      <div style={{ position: "absolute", left: X.right, top: 560, width: COL_W }}>
        <div
          style={{
            fontFamily: F.sans,
            fontSize: S.small,
            color: C.dim,
            opacity: judge1,
            transform: `translateY(${(1 - judge1) * 16}px)`,
          }}
        >
          画面：<span style={{ color: C.text }}>字幕墙，每一帧都有字</span>
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: F.sans,
            fontSize: S.small,
            color: C.dim,
            opacity: judge2,
            transform: `translateY(${(1 - judge2) * 16}px)`,
          }}
        >
          音轨：<span style={{ color: C.text }}>只有一声「嗯」</span>
        </div>
      </div>

      {/* 压暗（左右一起暗）+ 结论压在全屏正中 */}
      <div style={{ position: "absolute", inset: 0, background: C.bg, opacity: dim * 0.66 }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: verdictP,
          transform: `translateX(${jitter}px)`,
        }}
      >
        <div
          style={{
            fontFamily: F.sans,
            fontWeight: 900,
            fontSize: S.mega,
            lineHeight: 1.1,
            color: C.bad,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          对不上。
        </div>
        <div
          style={{
            marginTop: 32,
            fontFamily: F.sans,
            fontSize: S.body,
            color: C.dim,
            opacity: subP,
          }}
        >
          这种结论，猜不出来
        </div>
      </div>
    </SceneShell>
  );
};
