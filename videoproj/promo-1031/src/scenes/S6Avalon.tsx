import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, F, G, M, S, SCENES, W } from "../theme";
import { SceneShell } from "../components/SceneShell";

/**
 * S6Avalon —— 帧 3000–4050（35 秒，全片重点）
 * 评论被吞。
 *
 * 横屏骨架：居中的窄卡片（900 宽，整体居中）+ 下方文字区。
 *   1  0–270    正常发送（接口说成功）
 *   2  270–570  状态变灰（state=17，游客看不见，右上角眼睛闭上）
 *   3  570–810  解释（三行字，居中块内左对齐）
 *   4  810–1050 她的选择（通栏居中，S.hero）
 * 最后两句必须停够 4 秒，所以台词一律不超过第 960 帧。
 */

const LEN = SCENES.avalon.to - SCENES.avalon.from; // 1050
export const S6_DURATION = LEN + M.overlap; // 1065

const CARD_W = 900;
const CARD_LEFT = W / 2 - CARD_W / 2; // 510，真正居中

const POST = "倒回去看了两遍才发现，后半段的音轨已经跑到楚汉去了";
const RPID = "318721505553";

const ip = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** 阶段 2 里的“逐个变灰”：到点就从 C.ok 换成 C.dim */
const grayed = (f: number, at: number) => (ip(f, at, at + 20) >= 0.5 ? C.dim : C.ok);

/** 眼睛：两条弧线先睁开（strokeDasharray 画出来），再合上（纵向压扁） */
const Eye: React.FC<{ open: number; closeP: number }> = ({ open, closeP }) => {
  const dash = `${open * 90} 200`;
  const lid = 1 - closeP * 0.94;
  return (
    <svg width={110} height={70} viewBox="0 0 88 56">
      <g transform={`translate(44,28) scale(1,${lid}) translate(-44,-28)`}>
        <path
          d="M4 28 C 20 6, 68 6, 84 28"
          fill="none"
          stroke={C.dim}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={dash}
        />
        <path
          d="M4 28 C 20 50, 68 50, 84 28"
          fill="none"
          stroke={C.dim}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={dash}
        />
        <circle cx={44} cy={28} r={5} fill={C.dim} opacity={open * (1 - closeP)} />
      </g>
    </svg>
  );
};

export const S6Avalon: React.FC = () => {
  const f = useCurrentFrame();

  // ── 阶段 4：清屏 ──
  const clearP = ip(f, 780, 810);

  // ── 阶段 1：正常发送 ──
  const cardIn = ip(f, 20, 50);
  const cardP = cardIn * (1 - ip(f, 290, 330));
  const press = f < 126 ? ip(f, 120, 126, 1, 0.96) : ip(f, 126, 132, 0.96, 1);
  const flash = f >= 126 && f < 156;
  const resultP = ip(f, 150, 174);
  const saidP = ip(f, 190, 214);

  // ── 阶段 2：状态变灰 ──
  const coolP = ip(f, 270, 330) * (1 - ip(f, 800, 830));
  const stateP = ip(f, 290, 314);
  const guestP = ip(f, 340, 364);
  const eyeOpen = ip(f, 290, 330);
  const eyeClose = ip(f, 496, 540);

  // ── 阶段 3：解释 ──
  const l1 = ip(f, 570, 594);
  const l2 = ip(f, 600, 624);
  const l3 = ip(f, 630, 654);

  // ── 阶段 4：她的选择 ──
  const q1 = ip(f, 815, 850);
  const q2 = ip(f, 930, 960);

  return (
    <SceneShell length={S6_DURATION}>
      {/* ── 阶段 1：居中窄卡片 ── */}
      <div
        style={{
          position: "absolute",
          left: CARD_LEFT,
          top: 200,
          width: CARD_W,
          background: C.panel,
          border: `1px solid ${flash ? C.ok : C.line}`,
          borderRadius: 16,
          padding: 36,
          opacity: cardP,
          transform: `translateY(${(1 - cardIn) * 24}px)`,
        }}
      >
        <div
          style={{
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            padding: 28,
            fontFamily: F.sans,
            fontSize: S.body,
            lineHeight: 1.7,
            color: C.text,
          }}
        >
          {POST}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
          <div
            style={{
              padding: "14px 40px",
              borderRadius: 8,
              background: flash ? `${C.ok}22` : `${C.whale}22`,
              color: flash ? C.ok : C.whale,
              fontFamily: F.sans,
              fontWeight: 700,
              fontSize: S.small,
              transform: `scale(${press})`,
            }}
          >
            发送
          </div>
        </div>
      </div>

      {/* ── 阶段 1 → 2：接口返回，然后变灰 ── */}
      <div
        style={{
          position: "absolute",
          left: CARD_LEFT,
          top: 660,
          opacity: resultP * (1 - clearP),
          fontFamily: F.mono,
          fontSize: S.code,
          lineHeight: 1.9,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div style={{ color: grayed(f, 300) }}>code=0</div>
        <div style={{ color: grayed(f, 320) }}>rpid={RPID}</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: CARD_LEFT,
          top: 800,
          opacity: saidP * (1 - clearP),
          fontFamily: F.sans,
          fontWeight: 500,
          fontSize: S.body,
          color: grayed(f, 340),
        }}
      >
        接口说：成功
      </div>

      {/* ── 阶段 2：state=17，居中 ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 360,
          textAlign: "center",
          opacity: stateP * (1 - clearP),
          transform: `translateY(${(1 - stateP) * 24}px)`,
        }}
      >
        <span
          style={{
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: S.mega,
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
            color: C.text,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
          }}
        >
          state=<span style={{ color: C.bad }}>17</span>
        </span>
        <div
          style={{
            marginTop: 28,
            fontFamily: F.sans,
            fontSize: S.small,
            color: C.dim,
            opacity: guestP,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          游客视角：12006 没有该评论
        </div>
      </div>

      {/* ── 阶段 2：右上角眼睛，从睁开到闭上（横屏右上角是空的）── */}
      <div
        style={{
          position: "absolute",
          right: G.padX,
          top: G.padY,
          opacity: eyeOpen * (1 - clearP),
        }}
      >
        <Eye open={eyeOpen} closeP={eyeClose} />
      </div>

      {/* ── 阶段 3：解释三行（与卡片同宽的块，块内左对齐）── */}
      <div style={{ position: "absolute", left: CARD_LEFT, top: 400, width: CARD_W, opacity: 1 - clearP }}>
        {[
          { text: "B 站有个反垃圾系统", p: l1, color: C.text },
          { text: "接口仍然返回成功", p: l2, color: C.text },
          { text: "但评论只有作者自己看得见", p: l3, color: C.bad },
        ].map((row) => (
          <div
            key={row.text}
            style={{
              fontFamily: F.sans,
              fontWeight: 500,
              fontSize: S.body,
              lineHeight: 1.9,
              color: row.color,
              opacity: row.p,
              transform: `translateY(${(1 - row.p) * 18}px)`,
            }}
          >
            {row.text}
          </div>
        ))}
      </div>

      {/* 阶段 2 起的冷色调 */}
      <div style={{ position: "absolute", inset: 0, background: C.whale, opacity: coolP * 0.06 }} />

      {/* ── 阶段 4：她的选择（价值主张，通栏居中）── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: F.sans,
            fontWeight: 900,
            fontSize: S.hero,
            lineHeight: 1.25,
            color: C.text,
            opacity: q1,
            transform: `translateY(${(1 - q1) * 20}px)`,
            whiteSpace: "nowrap",
          }}
        >
          她说：「被拦了。」
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: F.sans,
            fontWeight: 700,
            fontSize: S.hero,
            lineHeight: 1.25,
            color: C.dim,
            opacity: q2,
            transform: `translateY(${(1 - q2) * 16}px)`,
            whiteSpace: "nowrap",
          }}
        >
          不是「我发了」。
        </div>
      </div>
    </SceneShell>
  );
};
