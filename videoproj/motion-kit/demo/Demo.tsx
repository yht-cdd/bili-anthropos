/**
 * demo/Demo.tsx —— motion-kit 演示片（10.0 秒 / 300 帧 @30fps / 1920x1080）
 *
 * 结构：9 个组件各 1 段 + 1 段组合镜头。
 * 每段都写进 `SEGMENTS` 交给 planSegments() 校验：入场 8-12、退场 4-6、
 * 两次动效之间 ≥20 帧停留、一屏 ≤2 个运动元素、动效窗口不许溢出段。
 * **数字改坏了，Studio 和渲染会直接报错**，不用靠人肉目检发现。
 *
 * 底部的「说明条」和左上「角标」是演示标记（静态），不属于镜头内容，
 * 所以不计入运动元素 —— 正式片里没有它们。
 */

import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import {
  FocusRack,
  Grain,
  MaskWipe,
  MotionBlur,
  Parallax,
  PushIn,
  Shake,
  Stagger,
  Vignette,
  planSegments,
  type SegmentSpec,
} from '../Motion';
import { progress } from '../easings';
import {
  BG_BOTTOM,
  BG_TOP,
  CORAL,
  ERROR,
  FONT_MONO,
  FONT_SANS,
  GRAY,
  H,
  LIME,
  TAG_STYLE,
  TEXT,
  TOTAL_FRAMES,
  W,
} from './theme';

// ————————————————————————————————————————————
// 时间轴（合规断言跑在这里）
// ————————————————————————————————————————————

const SEGMENTS: SegmentSpec[] = [
  {
    id: 'PushIn',
    durationInFrames: 28,
    moving: 1,
    knife: true,
    events: [{ at: 0, dur: 28, label: '缓推（连续镜头位移，不算入场动作）', group: 'camera' }],
  },
  {
    id: 'Shake',
    durationInFrames: 28,
    moving: 1,
    knife: true,
    events: [{ at: 6, dur: 20, label: '盖章震动（第 6 帧正落 sfx 的 ding）', group: 'shake' }],
  },
  {
    id: 'MaskWipe',
    durationInFrames: 32,
    enter: 8,
    exit: 4,
    moving: 1,
    knife: true,
    events: [
      { at: 0, dur: 8, label: '标题擦入', group: 'in' },
      { at: 0, dur: 8, label: '色块擦入', group: 'in' },
      { at: 28, dur: 4, label: '标题擦出（退场必须比入场快）', group: 'out' },
    ],
  },
  {
    id: 'Stagger',
    durationInFrames: 28,
    enter: 8,
    moving: 1,
    knife: true,
    // 一次 Stagger = 一个动效事件（同 group），别按 4 行数成 4 次
    events: [
      { at: 0, dur: 8, label: '第 1 行', group: 'stagger' },
      { at: 3, dur: 8, label: '第 2 行', group: 'stagger' },
      { at: 6, dur: 8, label: '第 3 行', group: 'stagger' },
      { at: 9, dur: 8, label: '第 4 行', group: 'stagger' },
    ],
  },
  {
    id: 'Parallax',
    durationInFrames: 28,
    moving: 1,
    knife: true,
    events: [{ at: 0, dur: 28, label: '前后景反向位移（一次镜头位移）', group: 'camera' }],
  },
  {
    id: 'FocusRack',
    durationInFrames: 28,
    enter: 8,
    moving: 1,
    knife: true,
    events: [{ at: 0, dur: 8, label: '糊转实', group: 'rack' }],
  },
  { id: 'Grain', durationInFrames: 24, moving: 0, knife: true, events: [] },
  { id: 'Vignette', durationInFrames: 24, moving: 0, knife: true, events: [] },
  {
    id: 'MotionBlur',
    durationInFrames: 32,
    moving: 1,
    knife: true,
    events: [{ at: 0, dur: 7, label: '甩镜 1500px / 7 帧 ≈ 214px 每帧', group: 'throw' }],
  },
  {
    id: 'Combined',
    durationInFrames: 48,
    enter: 8,
    moving: 2,
    knife: true,
    events: [
      { at: 0, dur: 48, label: 'PushIn', group: 'camera' },
      { at: 0, dur: 8, label: '标题进场', group: 'title' },
      { at: 28, dur: 14, label: '三行错峰', group: 'lines' },
    ],
  },
];

const PLAN = planSegments(SEGMENTS, { totalFrames: TOTAL_FRAMES });

// ————————————————————————————————————————————
// 共用小件
// ————————————————————————————————————————————

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</AbsoluteFill>
);

/** 左上角标：第几段 + 组件名。静态。 */
const Tag: React.FC<{ no: number; name: string }> = ({ no, name }) => (
  <div style={TAG_STYLE}>
    {String(no + 1).padStart(2, '0')} · {name}
  </div>
);

/** 底部说明条：静态，不参与动效。正式片里没有这一行。 */
const Caption: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 96,
      display: 'flex',
      justifyContent: 'center',
    }}
  >
    <div
      style={{
        background: 'rgba(8,11,18,0.78)',
        border: '1px solid #232A36',
        borderRadius: 999,
        padding: '14px 36px',
        fontSize: 40,
        color: '#CFD6E0',
        maxWidth: W - 200,
        fontFamily: FONT_SANS,
      }}
    >
      {text}
    </div>
  </div>
);

/** 深色底（多数段的舞台） */
const Stage: React.FC<{ children: React.ReactNode; bright?: boolean }> = ({ children, bright }) => (
  <AbsoluteFill
    style={{
      background: bright
        ? 'linear-gradient(180deg, #CFC9BE, #A9A29A)'
        : `linear-gradient(180deg, ${BG_TOP}, ${BG_BOTTOM})`,
      fontFamily: FONT_SANS,
      color: bright ? '#1A1A1A' : TEXT,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** 一张假「截图」，用来演示静帧类组件 */
const FakeShot: React.FC<{
  w?: number;
  h?: number;
  title?: string;
  lines?: string[];
}> = ({
  w = 1120,
  h = 540,
  title = 'render.log',
  lines = ['$ node scripts/render-video.mjs --title demo', '> encoding 42% …', '> frame 187 / 300'],
}) => (
  <div
    style={{
      width: w,
      height: h,
      background: '#0D1117',
      border: '2px solid #30363D',
      borderRadius: 24,
      padding: '40px 56px',
      fontFamily: FONT_MONO,
      fontSize: 34,
      lineHeight: 1.7,
      color: '#C9D1D9',
      boxSizing: 'border-box',
    }}
  >
    <div style={{ color: GRAY, fontSize: 30, marginBottom: 24 }}>{title}</div>
    {lines.map((l, i) => (
      <div key={i} style={{ color: l.startsWith('>') ? LIME : '#C9D1D9' }}>
        {l}
      </div>
    ))}
  </div>
);

// ————————————————————————————————————————————
// 01 PushIn —— 静帧缓推
// ————————————————————————————————————————————

const S01: React.FC = () => (
  <Stage>
    {/* 整段都在缓推：1 → 1.06，expoOut 前 1/3 最快、后面慢慢贴住。panX 让它斜推 */}
    <PushIn durationInFrames={28} panX={14} panY={-6}>
      <Center>
        <FakeShot title="静帧 · Ken Burns" />
      </Center>
    </PushIn>
    <Caption text="PushIn — 静帧缓推 1→1.06，expoOut；任何停留 >2s 的图都该挂" />
    <Tag no={0} name="PushIn" />
  </Stage>
);

// ————————————————————————————————————————————
// 02 Shake —— 冲击震动
// ————————————————————————————————————————————

const S02: React.FC = () => (
  <Stage>
    {/* 第 6 帧开砸：这一帧必须正好落 sfx 的 ding（纪律 3）。窗口 20 帧，末尾自己归零 */}
    <Shake start={6} durationInFrames={20} amplitude={14} damping={12} oscillations={3}>
      <Center>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 190, color: ERROR, lineHeight: 1 }}>✖</div>
          <div style={{ fontSize: 88, fontWeight: 700, marginTop: 16 }}>渲染失败</div>
          <div style={{ fontSize: 40, color: GRAY, marginTop: 14, fontFamily: FONT_MONO }}>
            exit code 137 · out of memory
          </div>
        </div>
      </Center>
    </Shake>
    <Caption text="Shake — 14px / damping 12 / 3 次衰减；挂在被砸的那个元素上" />
    <Tag no={1} name="Shake" />
  </Stage>
);

// ————————————————————————————————————————————
// 03 MaskWipe —— 遮罩擦入 / 擦出
// ————————————————————————————————————————————

const S03: React.FC = () => (
  <Stage>
    <Center>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44 }}>
        {/* 退场（外层，第 24 帧起 4 帧擦走）套着入场（内层，8 帧擦进）—— 组件可以叠 */}
        <MaskWipe direction="right" mode="out" durationInFrames={4} start={28}>
          <MaskWipe direction="left" durationInFrames={8}>
            <div style={{ display: 'flex', gap: 36, alignItems: 'baseline' }}>
              <div style={{ fontSize: 130, fontWeight: 800 }}>大标题</div>
              <div style={{ fontSize: 58, color: CORAL, fontFamily: FONT_MONO }}>MASK WIPE</div>
            </div>
          </MaskWipe>
        </MaskWipe>
        <MaskWipe direction="up" durationInFrames={8} featherPx={140}>
          <div
            style={{
              width: 940,
              height: 100,
              background: `linear-gradient(90deg, ${LIME}, #7FB800)`,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0A0F00',
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            色块进场 · 羽化前缘 140px
          </div>
        </MaskWipe>
      </div>
    </Center>
    <Caption text="MaskWipe — 8 帧硬边擦入 + 羽化擦入；退场 4 帧（套在外面即可）" />
    <Tag no={2} name="MaskWipe" />
  </Stage>
);

// ————————————————————————————————————————————
// 04 Stagger —— 逐行错峰
// ————————————————————————————————————————————

const LINES = [
  '$ npm run render',
  '> bundling … ok',
  '> frame 150 / 300 · 2.4s',
  '> done → out/demo.mp4',
];

const S04: React.FC = () => (
  <Stage>
    <Center>
      {/* step 3 帧（合规 2-4），每行各自 8 帧 expoOut；一次 Stagger 只算一次动效 */}
      <Stagger stepInFrames={3} durationInFrames={8} start={0} from="up" distance={28}>
        {LINES.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 48,
              lineHeight: 1.6,
              color: l.startsWith('>') ? LIME : TEXT,
            }}
          >
            {l}
          </div>
        ))}
      </Stagger>
    </Center>
    <Caption text="Stagger — 逐行错峰 3 帧 / 每步 expoOut；逐字用 text=…" />
    <Tag no={3} name="Stagger" />
  </Stage>
);

// ————————————————————————————————————————————
// 05 Parallax —— 前后景反向位移
// ————————————————————————————————————————————

const S05: React.FC = () => (
  <Stage>
    <Parallax
      durationInFrames={28}
      easing="expoInOut"
      foreX={18}
      backX={-10}
      background={
        <AbsoluteFill>
          <div
            style={{
              position: 'absolute',
              left: 130,
              top: 170,
              width: 640,
              height: 640,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #1E2A3C, #0C1017 72%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 150,
              bottom: 150,
              fontSize: 190,
              fontWeight: 800,
              color: 'rgba(236,233,225,0.07)',
              fontFamily: FONT_MONO,
            }}
          >
            BACK
          </div>
        </AbsoluteFill>
      }
      foreground={
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 940,
              padding: '56px 72px',
              background: 'rgba(13,17,23,0.93)',
              border: '2px solid #30363D',
              borderRadius: 28,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontSize: 66, fontWeight: 800 }}>前景 +18px</div>
            <div style={{ fontSize: 44, color: GRAY, marginTop: 14, fontFamily: FONT_MONO }}>
              背景 −10px · 同帧反向
            </div>
          </div>
        </AbsoluteFill>
      }
    />
    <Caption text="Parallax — 只有两层（纪律 4：一屏 ≤2 个运动元素），必须反向" />
    <Tag no={4} name="Parallax" />
  </Stage>
);

// ————————————————————————————————————————————
// 06 FocusRack —— 糊转实
// ————————————————————————————————————————————

const S06: React.FC = () => (
  <Stage>
    <FocusRack durationInFrames={8} fromBlur={10} fromScale={0.98}>
      <Center>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 118, fontWeight: 800 }}>调焦定格</div>
          <div style={{ fontSize: 46, color: CORAL, marginTop: 20, fontFamily: FONT_MONO }}>
            blur 10 → 0 · scale 0.98 → 1
          </div>
        </div>
      </Center>
    </FocusRack>
    <Caption text="FocusRack — 8 帧糊转实，必须配 scale；可当转场缓冲（非刀位）" />
    <Tag no={5} name="FocusRack" />
  </Stage>
);

// ————————————————————————————————————————————
// 07 Grain —— 噪点
// ————————————————————————————————————————————

const S07: React.FC = () => (
  <Stage bright>
    <Center>
      <div style={{ textAlign: 'center', color: '#1A1A1A' }}>
        <div style={{ fontSize: 112, fontWeight: 800 }}>噪点覆盖</div>
        <div style={{ fontSize: 44, marginTop: 16, fontFamily: FONT_MONO }}>
          opacity 0.07 · contrast 2.4 · seed 每 2 帧换
        </div>
      </div>
    </Center>
    {/* 灰底最吃得住噪点。正式片：只在全片最外层挂一次，别每段挂 */}
    <Grain opacity={0.07} seedStride={2} baseFrequency={0.72} contrast={2.4} />
    <Caption text="Grain — 全片挂一次；强度不够调 contrast，别抬 opacity" />
    <Tag no={6} name="Grain" />
  </Stage>
);

// ————————————————————————————————————————————
// 08 Vignette —— 暗角
// ————————————————————————————————————————————

const S08: React.FC = () => (
  <Stage bright>
    <Center>
      <div style={{ textAlign: 'center', color: '#1A1A1A' }}>
        <div style={{ fontSize: 112, fontWeight: 800 }}>暗角</div>
        <div style={{ fontSize: 44, marginTop: 16, fontFamily: FONT_MONO }}>
          radial · 边缘 0.35 黑
        </div>
      </div>
    </Center>
    <Vignette strength={0.35} spread={0.52} color="#000" />
    <Caption text="Vignette — 收视线、压亮底；>0.5 就成隧道了" />
    <Tag no={7} name="Vignette" />
  </Stage>
);

// ————————————————————————————————————————————
// 09 MotionBlur —— 拖影
// ————————————————————————————————————————————

/** 位移必须是纯函数：MotionBlur 要在「前几帧的位置」上画残影 */
const throwX = (f: number): number =>
  -1100 + 1500 * progress({ frame: f, start: 0, durationInFrames: 7, easing: 'expoInOut' });

const S09: React.FC = () => (
  <Stage>
    {/* 7 帧走 1500px ≈ 214px/帧，远超 40px/帧的门槛 → 必须挂拖影 */}
    <MotionBlur x={throwX} layers={3} opacity={0.3} trailFrames={1.2}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 620,
          marginTop: -140,
          width: 760,
          height: 280,
          background: `linear-gradient(135deg, ${CORAL}, #A34A2E)`,
          borderRadius: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 78,
          fontWeight: 800,
          color: '#160B06',
        }}
      >
        甩镜
      </div>
    </MotionBlur>
    <Caption text="MotionBlur — >40px/帧必挂；慢的时候强度自动收到 0" />
    <Tag no={8} name="MotionBlur" />
  </Stage>
);

// ————————————————————————————————————————————
// 10 组合镜头 —— PushIn + Stagger + Grain + Vignette
// ————————————————————————————————————————————

const SUB_LINES = ['能力资产化 = 把审美拆成参数', '任何小模型照着组装，都能出片', '9 个组件 · 3 条纪律 · 1 个入口'];

const S10: React.FC = () => (
  <Stage>
    <PushIn durationInFrames={48} to={1.05} panX={-18} panY={-10}>
      <Center>
        <div style={{ textAlign: 'center' }}>
          {/* 标题 8 帧擦进（第 1 个动效） */}
          <MaskWipe direction="up" durationInFrames={8}>
            <div style={{ fontSize: 112, fontWeight: 800, color: TEXT }}>镜头动效库</div>
          </MaskWipe>
          {/* 停 20 帧之后再上正文（纪律 2，写进 planSegments 断言） */}
          <div style={{ marginTop: 40 }}>
            <Stagger stepInFrames={3} durationInFrames={8} start={28} from="up" distance={24}>
              {SUB_LINES.map((l, i) => (
                <div key={i} style={{ fontSize: 46, lineHeight: 1.6, color: '#C9D1D9' }}>
                  {l}
                </div>
              ))}
            </Stagger>
          </div>
        </div>
      </Center>
    </PushIn>
    {/* 质感层挂最外，压住全场（覆盖层不算运动元素） */}
    <Grain opacity={0.05} />
    <Vignette strength={0.35} />
    <Caption text="组合 — PushIn + MaskWipe + Stagger + Grain + Vignette；两次动效间留了 20 帧" />
    <Tag no={9} name="Combined" />
  </Stage>
);

// ————————————————————————————————————————————
// 装配
// ————————————————————————————————————————————

const SCENES: React.FC[] = [S01, S02, S03, S04, S05, S06, S07, S08, S09, S10];

export const MotionKitDemo: React.FC = () => (
  <AbsoluteFill style={{ width: W, height: H }}>
    {PLAN.map((s, i) => {
      const Scene = SCENES[i];
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={s.id}>
          <Scene />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
