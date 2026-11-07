import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_SWEEP, prog, shakeX, springIn } from '../anim';
import { CORAL, FONT_MONO, LIME, TERM_GRAY, TEXT, ZHIPU } from '../theme';

// ============================================================================
// S4 三个修复动作 · 全局 630–1140（brief §二·S4）
// 配方卡：[data] chart-live-moves 简化（卡1 走弧=其 A 式"事件沿线推进"的降配用法，
// 不取示波屏整套语境，记歧义）+ [effects] impact-feedback（卡3 B 式：命中=全局顿帧 2f
// + 冲击环 + 恢复震屏 6px τ2.2，第 4f 起；负片anime-impact C 式不用——本段非全片唯一高潮）。
// 三卡各 170 帧，卡间硬切「刀」（tick 三连全局 640/810/980 = 各卡 g=10，踩 slam 帧同钉；
// 硬切不加转场层，刀感由 slam 落定那一下承担——brief §二给定）。
// 每卡结构：顶部编号 28px #8B949E（左）+ 角标小字 28px（右）+ 主句 64px slam（g=10 起，
// scale 1.3→1.0 六帧 + shakeX amp10，同 S2 slamStyle）+ 示意区 560px 高（y 310–870）。
// 动效纪律复核：各卡静态元素 0–6 帧淡入（单元素），10–24 帧 slam+主动作（两元素），
// 之后 ≥140 帧真静止（停留 ≥20 帧富余）；主动效曲线全为 expo-out/sweep，无 linear。
// ============================================================================

const CARD = 170; // 每卡帧数（510/3）
const HIT = 10; // slam/tick 踩帧：卡1 640、卡2 810、卡3 980（全局）= 各卡 g=10

// —— 卡1 环形几何 ——
const CX = 960;
const CY = 290; // SVG 内坐标（示意区顶 310，y=560/2）
const RING_R = 185;
const DOT_A_DEG = -90; // 魔搭1（顶点）
const DOT_B_DEG = 120; // AMD（右下）

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
};

// slam 主句（同 S2 slamStyle 实现层，字号换 64px）
const slamStyle = (f: number, start: number): React.CSSProperties => {
  const p = prog(f, start, 6, EASE_SWEEP);
  const hold = prog(f, start, 4, EASE_EXPO_OUT);
  return {
    opacity: hold,
    transform: `translateX(${shakeX(f, start + 6, 10)}px) scale(${(1.3 - 0.3 * p).toFixed(4)})`,
  };
};

const Chrome: React.FC<{
  g: number;
  num: string;
  note: string;
  title: React.ReactNode;
}> = ({ g, num, note, title }) => {
  const intro = prog(g, 0, 6, EASE_EXPO_OUT); // 卡面静态件淡入（硬切后先立舞台）
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 84,
          fontFamily: FONT_MONO,
          fontSize: 28,
          color: TERM_GRAY,
          opacity: intro,
        }}
      >
        {num}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 130,
          top: 84,
          fontFamily: FONT_MONO,
          fontSize: 28,
          color: TERM_GRAY,
          textAlign: 'right',
          opacity: intro * 0.92,
        }}
      >
        {note}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 176,
          left: 0,
          width: 1920,
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 64,
          color: TEXT,
          ...slamStyle(g, HIT),
        }}
      >
        {title}
      </div>
    </>
  );
};

// —— 卡1：单点 → 环形（两圆点 + 循环箭头沿弧走 12 帧）——
const Card1: React.FC<{ g: number }> = ({ g }) => {
  const intro = prog(g, 0, 6, EASE_EXPO_OUT);
  const walk = prog(g, HIT, 12, EASE_SWEEP); // 12 帧走弧（brief 给定），前密后疏=砸
  const ang = DOT_A_DEG + (DOT_B_DEG - DOT_A_DEG) * walk;
  const tip = polar(CX, CY, RING_R, ang);
  const arrived = walk >= 1;
  const handoff = prog(g, 22, 10, EASE_EXPO_OUT); // 交接：A 熄 B 亮
  const pA = polar(CX, CY, RING_R, DOT_A_DEG);
  const pB = polar(CX, CY, RING_R, DOT_B_DEG);
  const dotB = springIn(g, 22, { tension: 150, friction: 13 });

  return (
    <>
      <Chrome
        g={g}
        num="修复 01"
        note="谁活着谁上，10 分钟冷却"
        title={
          <>
            ① 单点 → <span style={{ color: LIME }}>环形</span>
          </>
        }
      />
      <svg
        style={{ position: 'absolute', left: 0, top: 310, opacity: intro }}
        width={1920}
        height={560}
        viewBox="0 0 1920 560"
      >
        {/* 环轨道：虚线灰环 */}
        <circle
          cx={CX}
          cy={CY}
          r={RING_R}
          fill="none"
          stroke={TERM_GRAY}
          strokeOpacity={0.28}
          strokeWidth={2}
          strokeDasharray="3 12"
        />
        {/* 已过弧迹：珊瑚实线（chart-live A 式"写入点沿线推进"的降配） */}
        {walk > 0.005 ? (
          <path
            d={arcPath(CX, CY, RING_R, DOT_A_DEG, ang)}
            fill="none"
            stroke={CORAL}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.85}
          />
        ) : null}
        {/* 箭头：走弧的 marker，到 B 点驻留 */}
        {walk > 0.005 ? (
          <g transform={`translate(${tip.x.toFixed(2)} ${tip.y.toFixed(2)}) rotate(${ang + 90})`}>
            <path d="M 0 -14 L 11 10 L -11 10 Z" fill={CORAL} opacity={arrived ? 0.9 : 1} />
          </g>
        ) : null}
        {/* 点 A：魔搭1（青柠），交接后转暗 */}
        <circle cx={pA.x} cy={pA.y} r={26} fill={LIME} opacity={1 - 0.78 * handoff} />
        <text
          x={pA.x}
          y={pA.y - 42}
          fill={LIME}
          fontFamily={FONT_MONO}
          fontSize={26}
          textAnchor="middle"
          opacity={1 - 0.5 * handoff}
        >
          魔搭1
        </text>
        {/* 点 B：AMD（智谱紫），抵达后 spring 点亮 */}
        <circle
          cx={pB.x}
          cy={pB.y}
          r={26}
          fill={ZHIPU}
          opacity={0.25 + 0.75 * Math.min(1, dotB)}
        />
        <text
          x={pB.x + 46}
          y={pB.y + 8}
          fill={ZHIPU}
          fontFamily={FONT_MONO}
          fontSize={26}
          opacity={Math.min(1, dotB)}
        >
          AMD
        </text>
      </svg>
    </>
  );
};

// —— 卡2：闹钟交给门外的手（开关平移 + 速度驱动运动模糊）——
// MotionBlur：remotion 4.0.539 未导出 <MotionBlur/>，按 shot-transitions 卡的
// SpeedBlur 思路做帧确定实现：位移函数取中心差分速度 → 主体沿运动方向 scaleX 拉伸
// （sd≈0.085×速度、封顶 1.18×），另叠 lag 2f/4f 两枚残影（helpers/motion.ts `lagged`
// 语义：都是同一位置纯函数的延迟采样，不跨帧累积状态）。
const TRACK_FROM = 620;
const TRACK_TO = 1300;
const toggleX = (g: number): number => TRACK_FROM + (TRACK_TO - TRACK_FROM) * prog(g, HIT, 14, EASE_SWEEP);

const SwitchIcon: React.FC<{ x: number; g: number }> = ({ x, g }) => {
  const tx = toggleX(g);
  const speed = Math.abs(tx - toggleX(g - 1));
  const sx = 1 + Math.min(0.18, 0.00045 * speed); // 水平拉伸 = 方向性糊
  const land = prog(g, 26, 8, EASE_EXPO_OUT); // 落位后 knob 滑右、色转青柠
  const knob = -52 + 104 * prog(g, 26, 10, EASE_SWEEP);
  const ghosts: Array<{ d: number; o: number }> = [
    { d: 2, o: Math.min(0.16, speed * 0.0011) },
    { d: 4, o: Math.min(0.09, speed * 0.0006) },
  ];
  const pill = (cx: number, opacity: number, ghost: boolean) => (
    <g key={cx} transform={`translate(${cx} ${CY})`} opacity={opacity}>
      <rect
        x={-95}
        y={-42}
        width={190}
        height={84}
        rx={42}
        fill={ghost ? TEXT : 'rgba(255,255,255,0.08)'}
        stroke={ghost ? 'none' : 'rgba(255,255,255,0.14)'}
        strokeWidth={2}
      />
      {!ghost ? (
        <rect
          x={-95}
          y={-42}
          width={190}
          height={84}
          rx={42}
          fill={LIME}
          opacity={0.22 * land}
        />
      ) : null}
      <circle cx={ghost ? -52 : knob} cy={0} r={30} fill={ghost ? TEXT : land > 0.5 ? LIME : TERM_GRAY} />
    </g>
  );
  return (
    <svg
      style={{ position: 'absolute', left: 0, top: 310 }}
      width={1920}
      height={560}
      viewBox="0 0 1920 560"
    >
      {/* 平移轨道（静态示意底线） */}
      <line
        x1={TRACK_FROM - 90}
        y1={CY}
        x2={TRACK_TO + 90}
        y2={CY}
        stroke="#FFFFFF"
        strokeOpacity={0.07}
        strokeWidth={4}
        strokeDasharray="2 14"
      />
      {ghosts.map((gh) => (gh.o > 0.004 ? pill(toggleX(g - gh.d), gh.o, true) : null))}
      <g transform={`translate(${tx.toFixed(2)} ${CY}) scale(${sx.toFixed(4)} 1) translate(${(-tx).toFixed(2)} ${-CY})`}>
        {pill(tx, 1, false)}
      </g>
      {/* 左：睡觉的人（闭眼圆脸 + zz） */}
      <g opacity={prog(g, 0, 6, EASE_EXPO_OUT)}>
        <circle cx={x} cy={CY - 10} r={62} fill="none" stroke={TERM_GRAY} strokeWidth={3} />
        <path
          d={`M ${x - 38} ${CY - 16} q 15 12 30 0 M ${x + 8} ${CY - 16} q 15 12 30 0`}
          fill="none"
          stroke={TERM_GRAY}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <text x={x} y={CY + 108} fill={TERM_GRAY} fontFamily={FONT_MONO} fontSize={26} textAnchor="middle">
          睡觉的我（进程）
        </text>
      </g>
      {/* 右：门外（门 + 铃，bridge 的手） */}
      <g opacity={prog(g, 0, 6, EASE_EXPO_OUT)}>
        <rect x={1520} y={CY - 120} width={130} height={230} fill="none" stroke={TERM_GRAY} strokeWidth={3} />
        <circle cx={1545} cy={CY} r={7} fill={TERM_GRAY} />
        <g transform={`translate(1700 ${CY - 8})`} stroke={TERM_GRAY} strokeWidth={3} fill="none">
          <line x1={0} y1={-58} x2={0} y2={-40} />
          <path d="M -26 10 q 0 -46 26 -46 q 26 0 26 46 Z" />
          <circle cx={0} cy={18} r={6} fill={TERM_GRAY} stroke="none" />
        </g>
        <text x={1585} y={CY + 150} fill={TERM_GRAY} fontFamily={FONT_MONO} fontSize={26} textAnchor="middle">
          门外的 bridge
        </text>
      </g>
    </svg>
  );
};

const Card2: React.FC<{ g: number }> = ({ g }) => (
  <>
    <Chrome
      g={g}
      num="修复 02"
      note="bridge 自己数失败，自己发告警"
      title={
        <>
          ② 闹钟不该放在<span style={{ color: CORAL }}>睡觉的人</span>手里
        </>
      }
    />
    <SwitchIcon x={360} g={g} />
  </>
);

// —— 卡3：key 就是身份（一把 key 分裂两把，impact-feedback B 式）——
// 顿帧：命中帧 h=10 起全局冻结 2f（remap：h≥12 时内容帧 −2；卡 B 命门"必须全局"，
// 本卡所有动画层用 rf，闪白/环用真实帧 h——卡允许"冻结期间也要发生"的效果走真实帧）。
const KeyGlyph: React.FC<{ color: string; dim?: boolean }> = ({ color, dim }) => (
  <g stroke={color} strokeWidth={13} strokeLinecap="round" fill="none" opacity={dim ? 0.75 : 1}>
    <circle cx={-70} cy={0} r={34} />
    <line x1={-34} y1={0} x2={86} y2={0} />
    <line x1={60} y1={0} x2={60} y2={30} />
    <line x1={86} y1={0} x2={86} y2={24} />
  </g>
);

const Card3: React.FC<{ g: number }> = ({ g }) => {
  const rf = g <= HIT ? HIT : g >= 12 ? g - 2 : 10; // 全局顿帧 2f
  const intro = prog(g, 0, 6, EASE_EXPO_OUT);
  const wholeIn = prog(rf, 2, 4); // 整 key 先驻场
  const p1 = springIn(rf, HIT + 2, { tension: 150, friction: 13 }); // 解冻帧起弹开
  const p2 = springIn(rf, HIT + 6, { tension: 150, friction: 13 }); // 错峰 4f（卡 B 逐击语义）
  const ringP = prog(g, HIT, 16, EASE_SWEEP); // 冲击环（真实帧，冻结期间也要发生）
  const flash = g === HIT || g === HIT + 1 ? 0.12 : 0; // 白闪 2f
  const shake = shakeX(g, HIT + 2, 6, 8); // 恢复震屏：第 4f 起 6px τ≈2.2
  const gone = rf >= HIT; // 整 key 在命中帧让位给两把

  return (
    <>
      <Chrome
        g={g}
        num="修复 03"
        note="旧 key 余额尽 = 它整条线断供"
        title={
          <>
            ③ <span style={{ color: LIME }}>key</span> 就是身份
          </>
        }
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          backgroundColor: '#FFFFFF',
          opacity: flash,
          pointerEvents: 'none',
        }}
      />
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 310,
          opacity: intro,
          transform: `translateX(${shake.toFixed(2)}px)`,
        }}
        width={1920}
        height={560}
        viewBox="0 0 1920 560"
      >
        {/* 命中前：整 key（灰白）；命中帧起：分裂为两把 */}
        {!gone ? (
          <g transform={`translate(${CX} ${CY - 20}) rotate(-24) scale(1.5)`} opacity={wholeIn}>
            <KeyGlyph color={TEXT} />
          </g>
        ) : null}
        {gone ? (
          <>
            {/* 冲击环：白芯扩散 + 青柠辉，16f 收干（卡 B 三件套的环） */}
            <circle
              cx={CX}
              cy={CY - 20}
              r={40 + 330 * ringP}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2 + 6 * (1 - ringP)}
              opacity={0.55 * (1 - ringP)}
            />
            <circle
              cx={CX}
              cy={CY - 20}
              r={40 + 280 * ringP}
              fill="none"
              stroke={LIME}
              strokeWidth={3}
              opacity={0.3 * (1 - ringP)}
            />
            <g transform={`translate(${(CX - 260 * p1).toFixed(2)} ${CY - 20}) rotate(-24) scale(1.5)`}>
              <KeyGlyph color={LIME} />
            </g>
            <g transform={`translate(${(CX + 250 * p2).toFixed(2)} ${CY - 20}) rotate(24) scale(-1.5 1.5)`}>
              <KeyGlyph color={TERM_GRAY} dim />
            </g>
            <text
              x={CX - 260}
              y={CY + 132}
              fill={LIME}
              fontFamily={FONT_MONO}
              fontSize={26}
              textAnchor="middle"
              opacity={p1}
            >
              魔搭1 · 新 key √
            </text>
            <text
              x={CX + 250}
              y={CY + 132}
              fill={TERM_GRAY}
              fontFamily={FONT_MONO}
              fontSize={26}
              textAnchor="middle"
              opacity={p2}
            >
              魔搭2 · 旧 key × 备用
            </text>
          </>
        ) : null}
      </svg>
    </>
  );
};

export const S4: React.FC = () => {
  const f = useCurrentFrame();
  const card = f < CARD ? 0 : f < 2 * CARD ? 1 : 2;
  const g = f - card * CARD; // 卡内帧
  return (
    <AbsoluteFill style={{ backgroundColor: '#080B12' }}>
      {card === 0 ? <Card1 g={g} /> : null}
      {card === 1 ? <Card2 g={g} /> : null}
      {card === 2 ? <Card3 g={g} /> : null}
    </AbsoluteFill>
  );
};
