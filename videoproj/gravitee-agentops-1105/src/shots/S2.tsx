import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_LINEAR, EASE_SWEEP, prog, shakeX } from '../anim';
import { CORAL, FONT_SANS, LIME, TEXT } from '../theme';

// ============================================================================
// S2 标题卡 · 全局 150–330（brief §二·S2）· 配方卡 [effects] slam-entrance-moves
// 本地帧 = 全局 − 150。
// 0–8   全场压暗 30%（sfx rewind 位）——⚠️ 实现偏差：时间轴为无缝 Sequence，S1 窗口在
//       本段已不可见，压暗层落在黑底上（等效保留 brief 语义；若 R4 需真叠压，改 S1 Sequence
//       延长 180 帧重叠渲染，已记 progress.md）。
// 10–40 第一句 slam：scale 1.3→1.0 走 6 帧（卡 B「ease-in 才是砸」→ 用 EASE_SWEEP 前密后疏），
//       落定帧叠 shakeX（amplitude 10，指数衰减 ~8 帧收干）。
// 46–76 第二句 slam，「六小时」珊瑚。
// 90–130 第三句 72px 青柠 MaskWipe 左→右 10 帧（clip-path inset + 前缘亮线；
//       MaskWipe 卡库里无同名卡，按 §一 纪律用最接近的 wipe-transitions 语义实现，记歧义）。
// 140–180 停留（ding@90 = 全局 240）。第三句 8 帧前淡出，防与 S3 分屏叠字（≤6 帧纪律内）。
// slam 计数：本段 2 次（三句里的前两句）+ MaskWipe 非 slam，全片 S6 还有 1 次 →
// 卡纪律「全片砸入 ≤2 次」超限，裁决见 progress.md（brief 显式指令优先于卡的示例上限）。
// ============================================================================

const Y1 = 300; // 三句基线（居中偏上排布，1080 画高）
const Y2 = 470;
const Y3 = 640;

type Seg = { t: string; c: string };

const LINE1: Seg[] = [{ t: '我是一条 AI，', c: TEXT }];
const LINE2: Seg[] = [
  { t: '今天宕机', c: TEXT },
  { t: '六小时', c: CORAL },
  { t: '。', c: TEXT },
];
const LINE3: Seg[] = [{ t: '修我的人，是我主人。', c: LIME }];

const slamStyle = (
  f: number,
  start: number,
): React.CSSProperties => {
  const p = prog(f, start, 6, EASE_SWEEP); // 6 帧 scale 收（brief 给定）
  const hold = prog(f, start, 4, EASE_EXPO_OUT); // opacity 前 4 帧到位，重量交给 scale
  const s = 1.3 - 0.3 * p;
  const x = shakeX(f, start + 6, 10);
  return {
    opacity: hold,
    transform: `translateX(${x}px) scale(${s})`,
  };
};

export const S2: React.FC = () => {
  const f = useCurrentFrame();
  const dim = 0.3 * prog(f, 0, 8, EASE_LINEAR); // 压暗层（linear 仅用于淡暗辅助通道）
  const wipe = prog(f, 90, 10, EASE_SWEEP); // MaskWipe 10 帧左→右
  // 擦除前缘 = clip-path 揭示边（inset 相对整行 1920 宽），必须与揭示边重合，
  // 线落在文字范围（约 600–1320px）外就收起——否则亮线与擦除脱节读作贴纸。
  const wipeEdge = 1920 * wipe;
  const line3Exit = prog(f, 172, 6, EASE_EXPO_OUT); // 段尾 6 帧淡出（防叠字）

  return (
    <AbsoluteFill style={{ backgroundColor: '#080B12' }}>
      {/* 压暗 30% */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000', opacity: dim }} />

      {/* 第一句 96px slam */}
      <div
        style={{
          position: 'absolute',
          top: Y1,
          left: 0,
          width: 1920,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: 96,
          color: TEXT,
          ...slamStyle(f, 10),
        }}
      >
        {LINE1.map((sg, i) => (
          <span key={i} style={{ color: sg.c }}>
            {sg.t}
          </span>
        ))}
      </div>

      {/* 第二句 96px slam，「六小时」珊瑚 */}
      <div
        style={{
          position: 'absolute',
          top: Y2,
          left: 0,
          width: 1920,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: 96,
          ...slamStyle(f, 46),
        }}
      >
        {LINE2.map((sg, i) => (
          <span key={i} style={{ color: sg.c }}>
            {sg.t}
          </span>
        ))}
      </div>

      {/* 第三句 72px 青柠 MaskWipe 左→右 */}
      <div
        style={{
          position: 'absolute',
          top: Y3,
          left: 0,
          width: 1920,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: 72,
          color: LIME,
          clipPath: `inset(0 ${(100 - 100 * wipe).toFixed(2)}% 0 0)`,
          opacity: 1 - line3Exit,
        }}
      >
        {LINE3.map((sg, i) => (
          <span key={i} style={{ color: sg.c }}>
            {sg.t}
          </span>
        ))}
      </div>

      {/* 擦除前缘亮线（wipe-transitions 卡判例：无亮线的 wipe 读作 PPT 转场，命门） */}
      {wipeEdge > 590 && wipeEdge < 1332 ? (
        <div
          style={{
            position: 'absolute',
            left: wipeEdge,
            top: Y3 - 12,
            width: 3,
            height: 96,
            backgroundColor: LIME,
            boxShadow: '0 0 18px rgba(212,244,62,0.8)',
            opacity: 1 - line3Exit,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
