import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, F, G, M, S, SCENES } from "../theme";
import { SceneShell } from "../components/SceneShell";

/**
 * S4Day —— 帧 1140–2280（38 秒）
 * 她的一天：收信 / 挑片 / 看片 / 记下来。
 *
 * 横屏骨架：四格横排。X = 160 / 562 / 964 / 1366（每格 372 宽，间距 30），高 620，垂直居中。
 * 四格是「攒起来」的：每格在自己的 285 帧里从 +80px 压入，接着往左退成 0.42 透明度，
 * 最后四格并排铺满 1600 —— 横屏不需要把前一格扔掉。
 * 格内宽度只有 332，正文一律 S.label / S.small，不塞 48px。
 */

const LEN = SCENES.day.to - SCENES.day.from; // 1140
export const S4_DURATION = LEN + M.overlap; // 1155
const CELL = 285;
const CELL_H = 620;
const CELL_TOP = G.centerY - CELL_H / 2; // 230
const PAD = 20;

const ip = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const cellLeft = (i: number) => G.originX + i * (G.quad.w + G.quad.gap);

/** 四格共用的容器：序号在顶部，内容在格内纵向排列，字幕在格下方 */
const Cell: React.FC<{
  index: number;
  subtitle: string;
  children: (seg: number) => React.ReactNode;
}> = ({ index, subtitle, children }) => {
  const f = useCurrentFrame();
  const seg = f - index * CELL;

  // 还没轮到自己就不存在；轮到自己之后不再消失，只往后退
  if (seg < 0) return null;

  const enter = ip(seg, 0, 18);
  const recede = index < 3 ? ip(seg, CELL - M.overlap, CELL + 30, 1, 0.42) : 1;
  const opacity = enter * recede;
  const translateY = (1 - enter) * M.shift - (1 - recede) * 40;

  return (
    <div style={{ position: "absolute", left: cellLeft(index), top: CELL_TOP, width: G.quad.w }}>
      <div
        style={{
          position: "relative",
          height: CELL_H,
          background: C.panel,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          overflow: "hidden",
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {/* 序号（每格顶部） */}
        <div
          style={{
            position: "absolute",
            left: PAD,
            top: 16,
            fontFamily: F.mono,
            fontSize: S.label,
            color: C.faint,
            letterSpacing: "0.08em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>

        {/* 格内内容区：纵向排列 */}
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 56, bottom: PAD }}>
          {children(seg)}
        </div>
      </div>

      {/* 字幕：格下方，左对齐（372 宽只放得下 S.small） */}
      <div
        style={{
          marginTop: 18,
          width: G.quad.w,
          fontFamily: F.sans,
          fontWeight: 500,
          fontSize: S.small,
          lineHeight: 1.4,
          color: C.dim,
          opacity: opacity * ip(seg, 40, 70),
          transform: `translateY(${translateY}px)`,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

// ── 格 1：收信 ─────────────────────────────────────────
const MAILS = [
  { from: "本地 AGENT", subject: "[PROJECT] promo-1031 分镜与口播稿" },
  { from: "邮箱", subject: "本周排期确认" },
  { from: "本地 AGENT", subject: "[PROJECT] 渲染链路踩坑" },
  { from: "订阅", subject: "每日模型简报" },
  { from: "未知发件人", subject: "合作咨询：看个视频" },
];
const HIGHLIGHT = 2;

const CellMail: React.FC<{ seg: number }> = ({ seg }) => {
  const tagP = ip(seg, 70, 96);
  const flyP = ip(seg, 150, 190);
  const folderGlow = ip(seg, 180, 210);

  return (
    <>
      {/* 归档目标：右上角的小文件夹 */}
      <div style={{ position: "absolute", right: 0, top: -28, opacity: 0.5 + folderGlow * 0.5 }}>
        <svg width={44} height={36} viewBox="0 0 96 78">
          <path
            d="M6 16c0-5 4-9 9-9h22l9 11h35c5 0 9 4 9 9v37c0 5-4 9-9 9H15c-5 0-9-4-9-9Z"
            fill="none"
            stroke={folderGlow > 0.5 ? C.whale : C.faint}
            strokeWidth={4}
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {MAILS.map((m, i) => {
        const isHi = i === HIGHLIGHT;
        const fly = isHi ? flyP : 0;
        const appear = ip(seg, 10 + i * 8, 28 + i * 8);
        return (
          <div
            key={m.subject}
            style={{
              height: 88,
              paddingTop: 14,
              borderBottom: `1px solid ${C.line}`,
              background: isHi ? `${C.whale}14` : "transparent",
              opacity: appear * (isHi ? 1 - ip(seg, 170, 200) : 1),
              transform: `translate(${fly * 70}px, ${fly * -250}px) scale(${1 - fly * 0.55})`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: isHi ? C.whale : C.faint,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontFamily: F.sans,
                  fontSize: S.label,
                  color: isHi ? C.text : C.faint,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {m.from}
              </span>
              {isHi ? (
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: S.label,
                    color: C.whale,
                    opacity: tagP,
                  }}
                >
                  [P]
                </span>
              ) : null}
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: F.sans,
                fontSize: S.label,
                color: isHi ? C.text : C.dim,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {m.subject}
            </div>
          </div>
        );
      })}
    </>
  );
};

// ── 格 2：挑片 ─────────────────────────────────────────
const SOURCES = [
  { name: "首页推荐", count: 4, score: "12.4" },
  { name: "热门", count: 3, score: "16.2" },
  { name: "排行", count: 4, score: "9.1" },
  { name: "科技区", count: 3, score: "15.4" },
  { name: "AI 搜索", count: 3, score: "13.1" },
];
const PICKED = 7;

const CellPick: React.FC<{ seg: number }> = ({ seg }) => {
  const pickP = ip(seg, 200, 240);
  let k = -1;

  return (
    <>
      {SOURCES.map((src, i) => (
        <div key={src.name} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span
              style={{
                fontFamily: F.sans,
                fontSize: S.label,
                color: ip(seg, 10 + i * 6, 28 + i * 6) > 0.5 ? C.dim : C.faint,
              }}
            >
              {src.name}
            </span>
            <span
              style={{
                fontFamily: F.mono,
                fontSize: S.label,
                color: C.whale,
                fontVariantNumeric: "tabular-nums",
                opacity: ip(seg, 60 + i * 30, 80 + i * 30) * (1 - pickP * 0.7),
              }}
            >
              {src.score}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {Array.from({ length: src.count }).map((_, j) => {
              k += 1;
              const idx = k;
              const scanned = seg >= 60 + idx * 8;
              const isPicked = idx === PICKED;
              return (
                <div
                  key={j}
                  style={{
                    width: 30 + (isPicked ? pickP * 16 : 0),
                    height: 20,
                    borderRadius: 3,
                    background: scanned ? C.whale : C.faint,
                    opacity: scanned ? (isPicked ? 1 : 0.9 - pickP * 0.55) : 0.45,
                    boxShadow: isPicked && pickP > 0.5 ? `0 0 12px ${C.whale}` : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
};

// ── 格 3：看片 ─────────────────────────────────────────
const CellWatch: React.FC<{ seg: number }> = ({ seg }) => {
  const G_S = 84;
  const GAP = 8;
  const bars = 20;

  return (
    <>
      {/* 九宫格：逐格从暗到亮 */}
      <div style={{ position: "relative", width: G_S * 3 + GAP * 2, height: G_S * 3 + GAP * 2, margin: "0 auto" }}>
        {Array.from({ length: 9 }).map((_, i) => {
          const r = Math.floor(i / 3);
          const c = i % 3;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: c * (G_S + GAP),
                top: r * (G_S + GAP),
                width: G_S,
                height: G_S,
                background: C.panel,
                border: `1px solid ${C.line}`,
                borderRadius: 3,
                opacity: 0.25 + 0.75 * ip(seg, 20 + i * 10, 44 + i * 10),
              }}
            />
          );
        })}
      </div>

      {/* 音轨波形：20 根竖条 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, height: 190 }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: C.line }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "flex-end",
            gap: 5,
          }}
        >
          {Array.from({ length: bars }).map((_, i) => {
            const h = 14 + Math.abs(Math.sin(seg * 0.08 + i)) * 150;
            const appear = ip(seg, 40 + i * 2, 60 + i * 2);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: h * appear,
                  borderRadius: 2,
                  background: i % 5 === 0 ? C.whale : C.faint,
                  opacity: 0.9,
                }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
};

// ── 格 4：记下来 ───────────────────────────────────────
const DIARY = [
  ["##", "今天"],
  ["", "看完一条讲老工程的长视频"],
  ["", "画面全是字幕，声音里一句没念"],
  ["", "记一笔：音轨和画面要分开看"],
  ["", "明天接着排 promo-1031 的分镜"],
];

const CellDiary: React.FC<{ seg: number }> = ({ seg }) => (
  <>
    <div style={{ position: "absolute", left: 0, top: 0, width: G.quad.w - PAD * 2 }}>
      {DIARY.map(([mark, text], i) => {
        const p = ip(seg, 20 + i * 12, 44 + i * 12);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 14,
              fontFamily: F.sans,
              fontSize: S.label,
              lineHeight: 1.6,
              color: C.text,
              opacity: p,
              transform: `translateY(${(1 - p) * -14}px)`,
            }}
          >
            <span style={{ fontFamily: F.mono, color: C.whale, width: 26, flexShrink: 0 }}>{mark}</span>
            <span>{text}</span>
          </div>
        );
      })}
    </div>

    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 4,
        textAlign: "right",
        fontFamily: F.sans,
        fontSize: S.label,
        color: C.dim,
        letterSpacing: "0.04em",
        opacity: ip(seg, 96, 120),
      }}
    >
      —— Anthropos
    </div>
  </>
);

export const S4Day: React.FC = () => (
  <SceneShell length={S4_DURATION}>
    <Cell index={0} subtitle="先收信，是昨天发来的工程文档">
      {(seg: number) => <CellMail seg={seg} />}
    </Cell>
    <Cell index={1} subtitle="五个来源，按她自己的标准打分">
      {(seg: number) => <CellPick seg={seg} />}
    </Cell>
    <Cell index={2} subtitle="下载、转写、看画面">
      {(seg: number) => <CellWatch seg={seg} />}
    </Cell>
    <Cell index={3} subtitle="看完写进日记。没有人催她。">
      {(seg: number) => <CellDiary seg={seg} />}
    </Cell>
  </SceneShell>
);