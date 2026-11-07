import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, F, G, M, S, SCENES, W, X } from "../theme";
import { SceneShell } from "../components/SceneShell";

/**
 * S7Rounds —— 帧 4050–4900（28 秒）
 * 分轮做事，最后一步停手。
 *
 * 横屏骨架：
 *   上半 0–510：左文件树（X.left 720）/ 右 progress.md（X.right 720）
 *   下半 510–850：卡片居中，灰色按钮 560 宽居中，三行边界文字在按钮下方居中（不并排）
 *   收尾：整屏压暗，「这一步，得人来按」S.hero 通栏居中
 */

const LEN = SCENES.rounds.to - SCENES.rounds.from; // 850
export const S7_DURATION = LEN + M.overlap; // 865

const COL_W = G.split.left; // 720
const CARD_W = 760;
const CARD_LEFT = W / 2 - CARD_W / 2; // 580
const BTN_W = 560;

const ip = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const TREE: { text: string; kind: "dir" | "file"; indent: number; size?: string }[] = [
  { text: "videoproj/promo-1031/", kind: "dir", indent: 0 },
  { text: "├─ brief.md", kind: "file", indent: 0, size: "1.2K" },
  { text: "├─ progress.md", kind: "file", indent: 0, size: "840B" },
  { text: "├─ src/", kind: "dir", indent: 0 },
  { text: "│  ├─ theme.ts", kind: "file", indent: 1 },
  { text: "│  └─ scenes/", kind: "dir", indent: 1, size: "8 个" },
  { text: "└─ out/", kind: "dir", indent: 0 },
];

const ROUNDS: { title: string; body: string }[] = [
  { title: "## 第 1 轮", body: "写了 theme + 3 个组件，S1/S2 能跑" },
  { title: "## 第 2 轮", body: "S3 四格快剪做完，时间轴对齐" },
  { title: "## 第 3 轮", body: "S5、S6 完成。还差配音" },
];

const BOUNDARY = [
  { text: "她可以决定看什么", color: C.dim },
  { text: "也可以决定说什么", color: C.dim },
  { text: "但不能决定发不发", color: C.bad },
];

export const S7Rounds: React.FC = () => {
  const f = useCurrentFrame();

  const upperP = 1 - ip(f, 500, 530);
  const lowerP = ip(f, 510, 540);

  const dim = ip(f, 780, 810) * 0.7;
  const finalP = ip(f, 786, 816);

  return (
    <SceneShell length={S7_DURATION}>
      {/* ── 上半：分轮续做 ── */}
      <div style={{ position: "absolute", inset: 0, opacity: upperP }}>
        {/* 三个小圆点：每轮出现时由灰变绿 */}
        <div style={{ position: "absolute", left: X.left, top: 118, display: "flex", gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: f >= 60 + i * 70 ? C.ok : C.faint,
                opacity: f >= 60 + i * 70 ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* 左：文件树 */}
        <div style={{ position: "absolute", left: X.left, top: 190, width: COL_W }}>
          {TREE.map((row, i) => {
            const start = 20 + i * 20;
            const p = ip(f, start, start + 18);
            const color = row.kind === "dir" ? C.whale : C.dim;
            return (
              <div
                key={row.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  height: 52,
                  paddingLeft: row.indent * 24,
                  opacity: p,
                  transform: `translateX(${(1 - p) * -16}px)`,
                }}
              >
                <span style={{ fontFamily: F.mono, fontSize: S.code, color, whiteSpace: "nowrap" }}>
                  {row.text}
                </span>
                {row.size ? (
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: S.label,
                      color: C.faint,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {row.size}
                  </span>
                ) : null}
              </div>
            );
          })}

          {/* src/ 那一支的竖线 */}
          <div
            style={{
              position: "absolute",
              left: 8,
              top: 156,
              width: 1,
              height: 104,
              background: C.line,
              transform: `scaleY(${ip(f, 80, 92)})`,
              transformOrigin: "top",
            }}
          />
        </div>

        {/* 右：progress.md */}
        <div style={{ position: "absolute", left: X.right, top: 190, width: COL_W }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: S.label,
              color: C.faint,
              marginBottom: 24,
              opacity: ip(f, 40, 58),
            }}
          >
            progress.md
          </div>
          {ROUNDS.map((r, i) => {
            const start = 60 + i * 70;
            const p = ip(f, start, start + 20);
            const q = ip(f, start + 20, start + 40);
            return (
              <div
                key={r.title}
                style={{ marginBottom: 40, opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}
              >
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: S.small,
                    color: C.whale,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.title}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: F.sans,
                    fontSize: S.small,
                    lineHeight: 1.7,
                    color: C.dim,
                    opacity: q,
                  }}
                >
                  {r.body}
                </div>
              </div>
            );
          })}
        </div>

        {/* 字幕 */}
        <div
          style={{
            position: "absolute",
            left: X.left,
            top: 830,
            width: G.contentW,
            fontFamily: F.sans,
            fontWeight: 500,
            fontSize: S.body,
            color: C.dim,
            opacity: ip(f, 250, 280),
          }}
        >
          一条片子做四五天，是正常的
        </div>
      </div>

      {/* ── 下半：停手，等批准 ── */}
      <div style={{ position: "absolute", inset: 0, opacity: lowerP }}>
        <div
          style={{
            position: "absolute",
            left: CARD_LEFT,
            top: 140,
            width: CARD_W,
            background: C.panel,
            border: `1px solid ${C.line}`,
            borderRadius: 16,
            padding: 36,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontFamily: F.mono,
                fontSize: S.code,
                color: C.text,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              out/video.mp4
            </span>
            <span
              style={{
                fontFamily: F.sans,
                fontSize: S.label,
                color: C.ok,
                background: `${C.ok}1A`,
                border: `1px solid ${C.ok}55`,
                borderRadius: 4,
                padding: "4px 12px",
              }}
            >
              渲染完成
            </span>
          </div>

          {/* 需要你确认 */}
          <div
            style={{
              marginTop: 40,
              textAlign: "center",
              fontFamily: F.sans,
              fontWeight: 500,
              fontSize: S.small,
              color: C.warm,
              opacity: ip(f, 610, 640),
            }}
          >
            需要你确认
          </div>

          {/* 灰掉的按钮：560 宽居中，opacity 0.5 + not-allowed 的视觉暗示 */}
          <div
            style={{
              margin: "16px auto 0",
              width: BTN_W,
              height: 88,
              borderRadius: 8,
              background: C.faint,
              border: `1px solid ${C.line}`,
              opacity: 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: F.sans,
              fontWeight: 700,
              fontSize: S.body,
              color: C.dim,
              cursor: "not-allowed",
            }}
          >
            发布到 B 站
          </div>
        </div>

        {/* 三行边界：按钮下方居中，竖着排 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 500,
            textAlign: "center",
          }}
        >
          {BOUNDARY.map((row, i) => {
            const start = 650 + i * 24;
            const p = ip(f, start, start + 24);
            return (
              <div
                key={row.text}
                style={{
                  fontFamily: F.sans,
                  fontWeight: 500,
                  fontSize: S.body,
                  lineHeight: 1.7,
                  color: row.color,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 18}px)`,
                }}
              >
                {row.text}
              </div>
            );
          })}
        </div>
      </div>

      {/* 收尾：这一步，得人来按 */}
      <div style={{ position: "absolute", inset: 0, background: C.bg, opacity: dim }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: F.sans,
          fontWeight: 900,
          fontSize: S.hero,
          color: C.text,
          opacity: finalP,
          transform: `translateY(${(1 - finalP) * 20}px)`,
          whiteSpace: "nowrap",
        }}
      >
        这一步，得人来按
      </div>
    </SceneShell>
  );
};
