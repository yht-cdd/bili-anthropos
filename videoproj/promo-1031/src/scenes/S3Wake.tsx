import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, F, G, M, S, SCENES, X } from "../theme";
import { SceneShell } from "../components/SceneShell";
import { GridBackdrop, Terminal, WhaleMark } from "../components/ui";

/**
 * S3Wake —— 帧 780–1140（12 秒）
 * 凌晨零点，她自己醒。
 *
 * 横屏骨架：左数字右终端。
 *   左栏 X.left（720）：00:00 用 S.mega 撑满，下方「她自己醒了」
 *   右栏 X.right（720）：终端，垂直居中，本场第 180 帧起逐行输出
 *   鲸鱼标记移到右上角（横屏左上角会撞内容）
 */

const LEN = SCENES.wake.to - SCENES.wake.from; // 360
export const S3_DURATION = LEN + M.overlap; // 375

const COL_W = G.split.left; // 720

const BOOT_LINES = [
  "$ 日切开始",
  "  收信 → 归档 knowledge/projects/",
  "  复盘昨天 → 3 条任务，2 条完成",
  "  排今天 → TODAY.md 已更新",
];

const ip = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** 终端行里的数字要用 C.text 挑出来 —— 正文是 C.dim，数字才是重点 */
const withNumbers = (line: string, base: string) =>
  line.split(/(\d+)/g).map((part, i) =>
    /^\d+$/.test(part) ? (
      <span key={i} style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>
        {part}
      </span>
    ) : (
      <span key={i} style={{ color: base }}>
        {part}
      </span>
    ),
  );

export const S3Wake: React.FC = () => {
  const f = useCurrentFrame();

  // 冒号 2Hz：与 S1 的光标同频
  const colonOn = Math.floor(f / (30 / M.cursorHz)) % 2 === 0;
  // 圆环 3 秒一次呼吸（90 帧）
  const ringScale = 0.85 + (Math.sin((f / 90) * Math.PI * 2) + 1) * 0.1;

  const clockP = ip(f, 0, 24);
  const whaleP = ip(f, 0, 30, 0, 0.9);

  return (
    <SceneShell length={S3_DURATION}>
      <GridBackdrop opacity={0.05} />

      {/* 右上角：鲸鱼标记 + 极淡圆环 */}
      <div style={{ position: "absolute", right: G.padX, top: G.padY }}>
        <div
          style={{
            position: "absolute",
            left: -40,
            top: -40,
            width: 200,
            height: 200,
            borderRadius: 100,
            border: `1px solid ${C.whale}26`,
            transform: `scale(${ringScale})`,
          }}
        />
        <WhaleMark size={120} opacity={whaleP} />
      </div>

      {/* 左栏：巨大时间戳 */}
      <div
        style={{
          position: "absolute",
          left: X.left,
          top: 340,
          width: COL_W,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: S.mega,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
            opacity: clockP,
            transform: `translateY(${(1 - clockP) * 20}px)`,
          }}
        >
          <span style={{ color: C.text }}>00</span>
          <span style={{ color: colonOn ? C.text : C.faint }}>:</span>
          <span style={{ color: C.text }}>00</span>
        </div>
        <div
          style={{
            marginTop: 28,
            fontFamily: F.sans,
            fontSize: S.body,
            color: C.dim,
            opacity: ip(f, 24, 48),
          }}
        >
          她自己醒了
        </div>
      </div>

      {/* 右栏：终端，本场第 180 帧起，每行间隔 24 帧 */}
      <div style={{ position: "absolute", left: X.right, top: 300, width: COL_W }}>
        <Terminal title="anthropos">
          {BOOT_LINES.map((line, i) => {
            const start = 180 + i * 24;
            const appear = ip(f, start, start + 24);
            const isCmd = line.startsWith("$");
            return (
              <div
                key={line}
                style={{
                  fontFamily: F.mono,
                  fontSize: S.code,
                  lineHeight: 1.9,
                  color: isCmd ? C.ok : C.dim,
                  opacity: appear,
                  transform: `translateX(${(1 - appear) * 12}px)`,
                  whiteSpace: "nowrap",
                }}
              >
                {isCmd ? <span style={{ color: C.ok }}>{line}</span> : withNumbers(line, C.dim)}
              </div>
            );
          })}
        </Terminal>
      </div>
    </SceneShell>
  );
};
