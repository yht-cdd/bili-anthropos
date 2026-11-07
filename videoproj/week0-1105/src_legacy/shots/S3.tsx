import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_SWEEP, prog, shakeX, sinePulse } from '../anim';
import { BG, CORAL, FONT_MONO, FONT_SANS, LIME, SURFACE, TERM_GRAY, TEXT } from '../theme';

// ============================================================================
// S3 另辟蹊径 · 全局 480–720（brief §二·S3）· 配方卡 [effects] icon-performance-moves + slam-entrance-moves(B 式)
// 本地帧 = 全局 − 480。
// 0–12   FocusRack 切入：整段 blur 10px→0 + scale 1.04→1（12 帧 expo-out）。
//        ⚠️ 库里无同名「FocusRack」卡，取 icon-performance-moves「邻居 rack focus 失焦」的反向语义
//        （全场虚→实，模拟镜头对上焦），参数照 brief，记歧义于 progress.md。
// 14–44  底部生态位一行小图标：5 个「dsh 大众」灰胶囊 Stagger step 6（14/20/26/32/38），
//        第 6 个「opencode」青柠在 local 40（= 全局 520，brief tick@520）亮起：
//        落地 squash（宽 1.12/高 0.88，2 帧）+ 弹簧回稳 + 冲击环扩散（attention-bounce 的最小实例），
//        同时 5 个灰位降饱和到 45%（邻居让位）。
// 80–140（全局 560–620）主句 64px slam ★「另辟蹊径的 opencode，不是 dsh 大众。」
//        scale 1.3→1.0 走 6 帧 ease-in，落定叠 shakeX amplitude 8。
//        ⚠️ brief 未给 S3 震幅，取 8（< S1 的 12，主次有别），记歧义。
//        「opencode」上青柠、「dsh 大众」上终端灰 = 与图标行同色系（视觉口径，文字逐字未动）。
// 160–220（全局 640–700）副句 44px 拆两行（★主人句），「卖惨」「斤斤计较」珊瑚。
// 234–240 整段 6 帧淡出（退场纪律），交给 S4 的 whoosh。
// 砸入计数：本片 S1 合计 + S3 主句 = 2 次，符合 slam 卡「全片 ≤2」纪律。
// ============================================================================

const CHIP = 110;
const CHIP_GAP = 46;
const ROW_W = 6 * CHIP + 5 * CHIP_GAP;
const ROW_X = (1920 - ROW_W) / 2;
const ROW_Y = 730;

// 颜色插值：青柠位「先灰后亮」用连续插值，不做硬切（硬切读作贴图换了张）
type RGB = [number, number, number];
const rgba = (c: RGB, a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const GRAY_RGB: RGB = [139, 148, 158]; // = TERM_GRAY
const LIME_RGB: RGB = [212, 244, 62]; // = LIME

const SUB_L1 = 'api 模型每天日拨额度——';
const SUB_L2_A = '不必';
const SUB_L2_B = '卖惨';
const SUB_L2_C = '，也不必';
const SUB_L2_D = '斤斤计较';
const SUB_L2_E = '成本。';

type Seg = { t: string; c: string };
const MAIN_SEGS: Seg[] = [
  { t: '另辟蹊径的 ', c: TEXT },
  { t: 'opencode', c: LIME },
  { t: '，不是 ', c: TEXT },
  { t: 'dsh 大众', c: TERM_GRAY },
  { t: '。', c: TEXT },
];

const LIME_AT = 40; // 全局 520（brief tick@520）
const LAND = LIME_AT + 9; // 青柠位升起 9 帧后落地：挤压、冲击环、邻居让位都从这帧起算

export const S3: React.FC = () => {
  const f = useCurrentFrame();
  const rack = prog(f, 0, 12, EASE_EXPO_OUT); // FocusRack 拉焦
  const slam = prog(f, 80, 6, EASE_SWEEP); // 主句 scale 收
  const slamIn = prog(f, 80, 4, EASE_EXPO_OUT);
  const shake = shakeX(f, 86, 8); // 落定帧起震
  const ignite = prog(f, LAND, 10, EASE_EXPO_OUT); // 亮起：边框/底纹/辉光插值
  const sq = prog(f, LAND, 2, EASE_SWEEP) * (1 - prog(f, LAND + 2, 8, EASE_EXPO_OUT)); // 接触 2f 压扁，8f 回稳
  const ring = prog(f, LAND, 16, EASE_EXPO_OUT); // 冲击环
  const dimGray = prog(f, LAND, 12, EASE_EXPO_OUT); // 邻居让位
  const s1 = prog(f, 160, 10, EASE_EXPO_OUT);
  const s2 = prog(f, 170, 10, EASE_EXPO_OUT);
  const exit = prog(f, 234, 6, EASE_EXPO_OUT);
  const pulse = sinePulse(f, LAND + 16, 90); // 亮起的呼吸（辉光周期 90 帧，幅度只给 box-shadow）

  const squashX = 1 + 0.14 * sq; // 卡：squash 缺席 = 没有重量
  const squashY = 1 - 0.14 * sq;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: FONT_SANS,
        opacity: 1 - exit,
        filter: `blur(${(10 * (1 - rack)).toFixed(2)}px)`,
        transform: `scale(${1.04 - 0.04 * rack})`,
      }}
    >
      {/* 主句 64px slam（★主人句逐字，仅分段着色） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 262,
          width: 1920,
          textAlign: 'center',
          fontSize: 64,
          fontWeight: 700,
          color: TEXT,
          opacity: slamIn,
          transform: `translateX(${shake}px) scale(${1.3 - 0.3 * slam})`,
        }}
      >
        {MAIN_SEGS.map((sg, i) => (
          <span key={i} style={{ color: sg.c }}>
            {sg.t}
          </span>
        ))}
      </div>

      {/* 副句 44px 两行（★主人句拆分，珊瑚强调两个词） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 414,
          width: 1920,
          textAlign: 'center',
          fontSize: 44,
          fontWeight: 500,
          color: TEXT,
          lineHeight: 1.55,
        }}
      >
        <div style={{ opacity: s1, transform: `translateY(${12 * (1 - s1)}px)` }}>{SUB_L1}</div>
        <div
          style={{ opacity: s2, transform: `translateY(${12 * (1 - s2)}px)` }}
        >
          <span>{SUB_L2_A}</span>
          <span style={{ color: CORAL, fontWeight: 700 }}>{SUB_L2_B}</span>
          <span>{SUB_L2_C}</span>
          <span style={{ color: CORAL, fontWeight: 700 }}>{SUB_L2_D}</span>
          <span>{SUB_L2_E}</span>
        </div>
      </div>

      {/* 生态位图标行：5 灰「dsh 大众」+ 1「opencode」青柠（Stagger 先灰后亮） */}
      {Array.from({ length: 6 }, (_, i) => {
        const isLime = i === 5;
        const at = isLime ? LIME_AT : 14 + i * 6; // step 6 先起灰位，青柠在 local 40 入场
        const p = prog(f, at, 9, EASE_EXPO_OUT);
        const x = ROW_X + i * (CHIP + CHIP_GAP);
        const lift = 26 * (1 - p);
        const grayDim = isLime ? 1 : 1 - 0.55 * dimGray; // 邻居让位（卡：邻居失焦/降饱和）
        const limeRgb = mix(GRAY_RGB, LIME_RGB, ignite);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: ROW_Y + lift,
              width: CHIP,
              opacity: p * grayDim,
              transform: isLime ? `scale(${squashX.toFixed(4)}, ${squashY.toFixed(4)})` : undefined,
              transformOrigin: '50% 100%',
              textAlign: 'center',
            }}
          >
            {/* 落地冲击环（attention-bounce 溅点的最小实例）：画在卡体之前 → 压在卡片背后，
                否则环叠在图标上读作「靶子」 */}
            {isLime && f >= LAND && ring < 1 ? (
              <div
                style={{
                  position: 'absolute',
                  left: CHIP / 2 - 190 * ring,
                  top: CHIP / 2 - 190 * ring,
                  width: 380 * ring,
                  height: 380 * ring,
                  borderRadius: '50%',
                  border: `${Math.max(1, 7 * (1 - ring)).toFixed(1)}px solid ${rgba(LIME_RGB, 0.55)}`,
                  opacity: 1 - ring,
                }}
              />
            ) : null}
            {/* 卡体 */}
            <div
              style={{
                position: 'relative',
                width: CHIP,
                height: CHIP,
                borderRadius: 22,
                backgroundColor: SURFACE,
                border: `2px solid ${isLime ? rgba(limeRgb, 0.35 + 0.65 * ignite) : rgba(GRAY_RGB, 0.35)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isLime
                  ? `0 0 ${Math.round((18 + 16 * pulse) * ignite)}px ${rgba(LIME_RGB, (0.35 + 0.25 * pulse) * ignite)}`
                  : 'none',
                overflow: 'hidden',
              }}
            >
              {/* 亮起后的青柠底纹（叠层插值，不硬切） */}
              {isLime ? (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: rgba(LIME_RGB, 0.12 * ignite) }} />
              ) : null}
              {/* 小图标全用内联图形，不引外部 logo */}
              {isLime ? (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    backgroundColor: rgba(limeRgb, 0.9),
                  }}
                />
              ) : (
                <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
                  <circle cx="28" cy="19" r="10" fill={TERM_GRAY} />
                  <path d="M8 50c0-11 9-17 20-17s20 6 20 17z" fill={TERM_GRAY} />
                </svg>
              )}
            </div>
            {/* 标签 */}
            <div
              style={{
                marginTop: 14,
                fontFamily: FONT_MONO,
                fontSize: 22,
                color: isLime ? rgba(limeRgb, 1) : TERM_GRAY,
                whiteSpace: 'nowrap',
              }}
            >
              {isLime ? 'opencode' : 'dsh 大众'}
            </div>
          </div>
        );
      })}

      {/* 底部生态位图标行以图形自明，不再叠注解文案 */}
    </AbsoluteFill>
  );
};
