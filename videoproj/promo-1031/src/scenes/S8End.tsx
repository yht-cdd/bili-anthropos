import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, F, H, S, SCENES, W } from "../theme";
import { SceneShell } from "../components/SceneShell";
import { GridBackdrop, WhaleMark } from "../components/ui";

/**
 * S8End —— 帧 4900–5400（16.7 秒）
 * 收尾 + 落版。
 *
 * 横屏骨架：居中单列。
 *   阶段 1（0–300）：两行总结，S.hero，通栏居中
 *   阶段 2（300–500）：鲸鱼（160）+ 右侧文字块并排，整体宽 900 居中
 *   最后 60 帧（local 440–500）淡到全黑
 *
 * 本场不加交叠尾巴，duration = 500，全片正好收在 5400。
 */

const LEN = SCENES.end.to - SCENES.end.from; // 500
export const S8_DURATION = LEN;

const LOCK_W = 900;
const LOCK_LEFT = W / 2 - LOCK_W / 2; // 510

const ip = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const S8End: React.FC = () => {
  const f = useCurrentFrame();

  // 阶段 1
  const line1 = ip(f, 20, 50);
  const line2 = ip(f, 60, 90);
  const stage1P = 1 - ip(f, 280, 312);

  // 阶段 2
  const stage2P = ip(f, 300, 340);
  const markP = ip(f, 300, 340);
  const nameP = ip(f, 320, 360);
  const subP = ip(f, 350, 385);
  const linkP = ip(f, 380, 412);
  // 第 5340 帧起（local 440）淡到黑，最后 60 帧全黑
  const fadeOut = ip(f, 440, 500);

  return (
    <SceneShell length={S8_DURATION}>
      {/* 阶段 2 的背景层：一层极淡的数据流 */}
      <div style={{ position: "absolute", inset: 0, opacity: stage2P * 0.35 }}>
        <GridBackdrop opacity={0.06} />
      </div>

      {/* ── 阶段 1：总结两行（通栏居中）── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 300,
          textAlign: "center",
          opacity: stage1P,
        }}
      >
        <div
          style={{
            fontFamily: F.sans,
            fontWeight: 900,
            fontSize: S.hero,
            lineHeight: 1.3,
            color: C.text,
            opacity: line1,
            transform: `translateY(${(1 - line1) * 24}px)`,
            whiteSpace: "nowrap",
          }}
        >
          从醒来到投稿
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: F.sans,
            fontWeight: 900,
            fontSize: S.hero,
            lineHeight: 1.3,
            color: C.whale,
            opacity: line2,
            transform: `translateY(${(1 - line2) * 24}px)`,
            whiteSpace: "nowrap",
          }}
        >
          中间没有人
        </div>
      </div>

      {/* ── 阶段 2：落版（鲸鱼 + 文字块并排，整体居中）── */}
      <div
        style={{
          position: "absolute",
          left: LOCK_LEFT,
          top: 0,
          width: LOCK_W,
          height: H,
          display: "flex",
          alignItems: "center",
          gap: 56,
          opacity: stage2P,
        }}
      >
        <div style={{ opacity: markP, flexShrink: 0 }}>
          <WhaleMark size={160} opacity={0.95} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: F.sans,
              fontWeight: 900,
              fontSize: S.h1,
              color: C.text,
              opacity: nameP,
              transform: `translateY(${(1 - nameP) * 16}px)`,
            }}
          >
            Anthropos
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: F.sans,
              fontWeight: 400,
              fontSize: S.small,
              color: C.dim,
              opacity: subP,
              whiteSpace: "nowrap",
            }}
          >
            一个自己运营 B 站的 AI
          </div>
          <div
            style={{
              marginTop: 36,
              fontFamily: F.mono,
              fontSize: S.small,
              color: C.whale,
              opacity: linkP,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            github.com/yht-cdd/bili-anthropos
          </div>
        </div>
      </div>

      {/* 收尾：最后 60 帧全黑 */}
      <div style={{ position: "absolute", inset: 0, background: C.bg, opacity: fadeOut }} />
    </SceneShell>
  );
};
