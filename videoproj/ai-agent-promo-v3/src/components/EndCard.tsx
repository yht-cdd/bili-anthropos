// v3-R3：尾卡共享件 —— 镜14「AI」+星芒、镜15–17「AGENT」拼字行、镜18 上移终态。
// §C 素材口径：一律用 assets/logos/ 真实文件的 data URI（logosData.ts，v2 coverData.ts 做法，
//   CI 只带 src/，public/ 不跟）。画幅/基线按 §三【镜头 15-17】统一处理规范。
import React from 'react';
import { Img } from 'remotion';
import { EASE_EXPO_OUT, prog, springIn } from '../anim';
import { AGNES_URI, ANTHROPIC_URI, GOOGLE_URI, NEBIUS_URI, TENCENT_DOCS_URI, XIAOMI_URI } from '../logosData';
import { BG_GRAD_BOTTOM, BG_GRAD_TOP, BLUE, LIME, ORANGE, TEXT } from '../theme';

// Noto Serif SC 未装、Noto Serif CJK SC 已装（fc-list 实测）——字体族名记裁决
export const FONT_SERIF =
  "'Noto Serif SC', 'Noto Serif CJK SC', 'Songti SC', 'SimSun', serif";

// 拼字行几何（§三 镜15-17）：band top=640、高 120（画面节「y=640、字母高 120」为准；
// 同节「baseline y=700」与之几何矛盾——640+120=760，裁 band 底沿 760 为视觉基线，记裁决）
export const ROW_TOP = 640;
export const ROW_H = 120;

// 「AI」180px 米白衬线 + 右上 64px 珊瑚星芒（星芒=anthropic.svg，R2 已改 fill #D97757）。
// 静止版供镜15–17/18 直接叠用（跨镜接力同 S11 OfflineScene 手法）。
export const AiLockup: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: 380,
      height: 260,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div style={{ position: 'relative' }}>
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontWeight: 700,
          fontSize: 180,
          lineHeight: 1.1,
          letterSpacing: 48,
          color: TEXT,
          // letter-spacing 把空隙加在「I」右侧，marginRight 负补偿回视觉居中
          marginRight: -48,
        }}
      >
        AI
      </div>
      <Img
        src={ANTHROPIC_URI}
        style={{
          position: 'absolute',
          top: 4,
          right: -84,
          width: 64,
          height: 64,
          objectFit: 'contain',
        }}
      />
    </div>
  </div>
);

type Letter = {
  key: string;
  uri: string;
  brand: string; // 品牌色（内发光用）
  glow: string; // drop-shadow 发光半径
  start: number; // 入场帧（镜15-17 本地 = 全局-1800）
  clip?: boolean; // nebius 为 131×36 wordmark，取首字母窗（裁：真实素材红线优先，不重绘矢量）
};

const LETTERS: Letter[] = [
  { key: 'A', uri: AGNES_URI, brand: '#5B8DEF', glow: '2px', start: 0 },
  { key: 'G', uri: GOOGLE_URI, brand: BLUE, glow: '2px', start: 5 },
  { key: 'E', uri: XIAOMI_URI, brand: ORANGE, glow: '2px', start: 10 },
  { key: 'N', uri: NEBIUS_URI, brand: LIME, glow: '2px', start: 15, clip: true },
  { key: 'T', uri: TENCENT_DOCS_URI, brand: BLUE, glow: '2px', start: 20 },
];

// §C 统一处理规范：高 120 / 底对齐 / 投影 blur8 黑0.4 y+4 / 边缘 1px 品牌色内发光（opacity 0.6）/
// 每字母延迟 4 帧（帧表 5 帧等距为准，见 S15 注）入场 spring(1,100,10)。
const LogoCell: React.FC<{ l: Letter; f: number; breathe: boolean }> = ({ l, f, breathe }) => {
  // 未到起点的字母：spring 不启动（负 frame 防御，跨镜接力时后续字母保持 0）
  const s = f < l.start ? 0 : springIn(f, l.start, { tension: 100, friction: 10 });
  const op = Math.max(0, Math.min(1, s * 2));
  // 呼吸（§C：1825 起 1.0→1.02 60帧 sine；本段只剩 5 帧，幅度 ≤0.012，按原样实装）
  const br =
    breathe && f >= 25 ? 1 + 0.02 * Math.sin((Math.PI * (f - 25)) / 60) : 1;
  const scale = (0.8 + 0.2 * s) * br;
  const img = (
    <Img
      src={l.uri}
      style={{
        width: l.clip ? 131 : 110,
        height: l.clip ? 36 : ROW_H,
        objectFit: 'contain',
        display: 'block',
      }}
    />
  );
  return (
    <div
      style={{
        width: 110,
        height: ROW_H,
        display: 'flex',
        alignItems: 'flex-end', // 底对齐=视觉基线
        justifyContent: 'center',
        opacity: op,
        transform: `translateY(${((1 - s) * 80).toFixed(2)}px) scale(${scale.toFixed(4)})`,
        transformOrigin: 'bottom center',
        // 投影 0 y+4 blur8 黑0.4；边缘内发光=0 偏移 1px 品牌色（0.6≈hex 99）
        filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.4)) drop-shadow(0 0 1px ${l.brand}99)`,
      }}
    >
      {l.clip ? (
        /* nebius.svg = 131×36 青柠圆角底板+深色字。裁窗取首字母「n」tile：
           字形 native x≈10.1–26.8，取 8–29.6 视窗（止于「e」起笔 30.5 前）→ scale 3.333 后左移 26.7px */
        <div style={{ width: 72, height: ROW_H, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ transform: 'translateX(-26.7px) scale(3.333)', transformOrigin: '0 100%', flex: 'none' }}>{img}</div>
        </div>
      ) : (
        img
      )}
    </div>
  );
};

// 「AGENT」拼字行（flex 居中，110 宽单元 + 120 间隙；§C 槽心 240px 系旧排布残留，
// 与「居中/间距120」取 flex 自洽解，记裁决）。top 可由调用方覆盖（镜18 外裹变换用）
export const AgentRow: React.FC<{ f: number; breathe?: boolean; top?: number }> = ({
  f,
  breathe,
  top = ROW_TOP,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top,
      height: ROW_H,
      display: 'flex',
      justifyContent: 'center',
      gap: 120,
      alignItems: 'flex-end',
    }}
  >
    {LETTERS.map((l) => (
      <LogoCell key={l.key} l={l} f={f} breathe={!!breathe} />
    ))}
  </div>
);

// 镜14 背景：深蓝黑渐变自上而下铺开（§C 曲线节 1740–1755=15 帧为准，画面节 30 帧系其子集）
export const GradientReveal: React.FC<{ f: number }> = ({ f }) => {
  const p = prog(f, 0, 15, EASE_EXPO_OUT);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: BG_GRAD_TOP }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: -1080,
          height: 1080,
          transform: `translateY(${(p * 1080).toFixed(2)}px)`,
          background: `linear-gradient(180deg, ${BG_GRAD_TOP} 0%, ${BG_GRAD_BOTTOM} 100%)`,
        }}
      />
    </>
  );
};
