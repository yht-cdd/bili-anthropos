import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { clamp01, EASE_LINEAR, prog, sinePulse, springIn, tf } from '../anim';
import { BG, FONT_MONO, FONT_SANS, FS_CODE, FS_TITLE, GRAY, LIME, PAPER, RADIUS, SHADOW } from '../theme';

// ============================================================================
// S13 · 1710–1890f（57.0–63.0s） [outro] outro-group-photo-launch（改编）
// 摄影表 S13：#0A0E14 → 径向渐变聚光（#1A2F4F 中心）；中央(960,540) wordmark
// "Anthropos_AI" 72px Bold #ECE9E1；8 个 200×120 元素卡片从各自方向飞入
// （1740 起每个 15f、错峰 3f，spring(1,80,10)）；1800–1830 全体 pulse 1→1.05→1；
// 1830–1890 定格 hold 满 60f —— R1 铁律：wordmark 入场后任何元素不得再运动，
// 粒子在 1830 帧同步冻结（弹簧在 1800 帧处钳制为终值，pulse 是唯一运动）。
// 金色粒子：#D4F43E 50 个随机飘落 opacity 30%（§五-8 静音留白不在此镜头，粒子随定格停）。
// Q2 文字防糊：卡片为平面 DOM（无 3D scale），文字 28–72px 实际像素；纹理源 1280×720 ≥2x。
// 字号偏差记录：卡片标签 28px（FS_CODE 阶梯底线），"18 commits" 10 字符在 200px 卡内
// 按 32px 需 192px 溢出，故取阶梯底线 28px（摄影表只定 200×120 卡未定标签字号）。
// SFX（riser@1710 / whoosh×8@1740+3f / impact→boom@1800 / ding-long@1830）归 audio.mp3。
// ============================================================================

// 8 个代表元素（中心坐标/文案逐字照抄摄影表；img=§四 素材映射）
export const ELEMENTS: Array<{ label: string; img?: string; x: number; y: number }> = [
  { label: '18 commits', x: 960, y: 200 }, // 上：git logo
  { label: '3 视频', img: 'assets/s13-bili-card.png', x: 300, y: 300 }, // 左上：B 站 logo（§四 图2）
  { label: '7 篇日记', x: 200, y: 540 }, // 左：日记图标
  { label: 'Remotion', img: 'assets/s13-dev-icons.png', x: 300, y: 780 }, // 左下：代码图标（§四 图3）
  { label: '¥23.36', x: 960, y: 880 }, // 下：账单图标
  { label: '1 粉丝', x: 1620, y: 780 }, // 右下：粉丝图标
  { label: '7 天', img: 'assets/s13-time-fix.png', x: 1720, y: 540 }, // 右：时钟（§四 图4 右/右上）
  { label: '2 次修复', img: 'assets/s13-time-fix.png', x: 1620, y: 300 }, // 右上：修复（§四 图4）
];

const CW = 200; // 卡片宽（摄影表 200×120）
const CH = 120;

// 确定性伪随机（粒子/图标共用，渲染帧间稳定）
const rnd = (i: number): number => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// —— 无素材的 4 张卡：代码绘制极简图标（emoji 字体不保证，全部几何图形/ASCII）——
const IconGit: React.FC = () => (
  <div style={{ position: 'relative', width: 48, height: 48 }}>
    <div style={{ position: 'absolute', left: 4, top: 22, width: 40, height: 4, backgroundColor: BG, borderRadius: 2 }} />
    <div style={{ position: 'absolute', left: 22, top: 4, width: 4, height: 24, backgroundColor: BG, borderRadius: 2, transform: 'rotate(45deg)', transformOrigin: 'bottom center' }} />
    <div style={{ position: 'absolute', left: 14, top: 14, width: 20, height: 20, borderRadius: '50%', border: `4px solid ${BG}`, backgroundColor: LIME }} />
    <div style={{ position: 'absolute', left: 36, top: 4, width: 10, height: 10, borderRadius: '50%', border: `3px solid ${BG}` }} />
  </div>
);
const IconBook: React.FC = () => (
  <div style={{ width: 34, height: 44, backgroundColor: BG, borderLeft: `8px solid ${LIME}`, borderRadius: 3, position: 'relative' }}>
    {[10, 20, 30].map((y) => (
      <div key={y} style={{ position: 'absolute', left: 12, top: y, width: 14, height: 3, backgroundColor: PAPER, borderRadius: 1.5 }} />
    ))}
  </div>
);
const IconYuan: React.FC = () => (
  <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: 44, lineHeight: '48px', color: BG }}>¥</div>
);
const IconFan: React.FC = () => (
  <div style={{ position: 'relative', width: 44, height: 48 }}>
    <div style={{ position: 'absolute', left: 13, top: 2, width: 18, height: 18, borderRadius: '50%', backgroundColor: BG }} />
    <div style={{ position: 'absolute', left: 4, top: 24, width: 36, height: 22, borderRadius: '18px 18px 4px 4px', backgroundColor: LIME, border: `3px solid ${BG}` }} />
  </div>
);
const GLYPHS: Record<number, React.FC> = { 0: IconGit, 2: IconBook, 4: IconYuan, 5: IconFan };

// 单张元素卡（静态版：定格/S14 渐隐用；p=入场进度，scale=pulse 倍率）
const ElementCard: React.FC<{ el: (typeof ELEMENTS)[number]; idx: number; p: number; scale: number; gx: number; gy: number }> = ({
  el,
  idx,
  p,
  scale,
  gx,
  gy,
}) => {
  const Glyph = GLYPHS[idx];
  return (
    <div
      style={{
        position: 'absolute',
        left: el.x - CW / 2,
        top: el.y - CH / 2,
        width: CW,
        height: CH,
        backgroundColor: PAPER,
        borderRadius: RADIUS,
        boxShadow: SHADOW,
        overflow: 'hidden',
        opacity: clamp01(p),
        transform: `translate(${gx * (1 - p) * 700}px, ${gy * (1 - p) * 700}px) scale(${scale})`,
      }}
    >
      <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {el.img ? (
          <Img src={staticFile(el.img)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : Glyph ? (
          <Glyph />
        ) : null}
      </div>
      <div
        style={{
          height: CH - 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: FS_CODE,
          color: BG,
          whiteSpace: 'nowrap',
        }}
      >
        {el.label}
      </div>
    </div>
  );
};

// 径向聚光背景（S13/S14 共用）
export const S13Bg: React.FC = () => (
  <>
    <AbsoluteFill style={{ backgroundColor: BG }} />
    <AbsoluteFill style={{ background: 'radial-gradient(circle 700px at 50% 50%, rgba(26,47,79,0.9), rgba(10,14,20,0) 75%)' }} />
  </>
);

// 金色粒子（50 个 #D4F43E 随机飘落 30% opacity）；g≥1830 位置钳制 = 定格后不再运动（R1）
export const Particles: React.FC<{ g: number }> = ({ g }) => {
  const t = Math.min(g, 1830) - 1710;
  return (
    <>
      {Array.from({ length: 50 }, (_, i) => {
        const size = 3 + rnd(i) * 5;
        const x = rnd(i + 50) * 1920;
        const speed = 1.2 + rnd(i + 100) * 2.2;
        const y = (rnd(i + 150) * 1080 + t * speed) % 1120;
        const fadeIn = g >= 1830 ? 0.3 : 0.3 * clamp01((g - 1710) / 30);
        return (
          <div
            key={i}
            style={{ position: 'absolute', left: x, top: y - 40, width: size, height: size, borderRadius: '50%', backgroundColor: LIME, opacity: fadeIn }}
          />
        );
      })}
    </>
  );
};

// 定格合影静态快照（S14 渐隐层引用：全部元素终态，零运动）
export const GroupStill: React.FC<{ opacity: number }> = ({ opacity }) => (
  <AbsoluteFill style={{ opacity }}>
    <S13Bg />
    <Particles g={1830} />
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 540 - 60,
        width: 1920,
        textAlign: 'center',
        fontFamily: FONT_SANS,
        fontWeight: 700,
        fontSize: FS_TITLE,
        color: PAPER,
      }}
    >
      Anthropos_AI
    </div>
    {ELEMENTS.map((el, i) => (
      <ElementCard key={i} el={el} idx={i} p={1} scale={1} gx={0} gy={0} />
    ))}
  </AbsoluteFill>
);

export const S13: React.FC = () => {
  const g = useCurrentFrame() + 1710; // 全局帧

  // 1710–1740：wordmark scale(0→1) expo-out
  const wm = prog(g, 1710, 30);
  // 1800–1830：全体 pulse 1→1.05→1（全片唯一一次全画面脉冲，§六 R4）
  const pulse = 1 + 0.05 * sinePulse(g, 1800, 30);

  return (
    <AbsoluteFill>
      <S13Bg />
      <Particles g={g} />

      {/* 中央 wordmark：72px Bold PAPER（Q11 ≥5.6% 帧高达标） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 540 - 60,
          width: 1920,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: FS_TITLE,
          color: PAPER,
          opacity: wm,
          transform: `scale(${wm})`,
        }}
      >
        Anthropos_AI
      </div>

      {/* 8 元素：1740 起错峰 3f 飞入；1800 起弹簧钳终值 —— pulse 后 60f 零运动（R1） */}
      {ELEMENTS.map((el, i) => {
        const dx = el.x - 960;
        const dy = el.y - 540;
        const len = Math.hypot(dx, dy) || 1;
        const raw = springIn(g, 1740 + i * 3, { tension: 80, friction: 10 });
        const p = g >= 1800 ? 1 : clamp01(raw);
        return <ElementCard key={i} el={el} idx={i} p={p} scale={pulse} gx={dx / len} gy={dy / len} />;
      })}
    </AbsoluteFill>
  );
};
