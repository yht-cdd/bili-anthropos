import React from 'react';
import {Composition, useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill, Sequence} from 'remotion';

const W = 1920;
const H = 1080;
const FPS = 30;
const DURATION = 900; // 30s

// ---- 确定性随机 ----
const rnd = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const MONO = '"SF Mono", "JetBrains Mono", Menlo, Consolas, "Noto Sans CJK SC", "Noto Sans SC", monospace';

// 真实的 token 感：中英混排的小片段
const TOKENS = [
  'human', 'v1', '基座', '模型', 'system', '你是', '一个', '由', 'human.ai', '开发',
  '多模态', '文本', '图片', '音频', '视频', '上下文', '记忆', '一级', '缓存', '永久',
  'tool', 'call', 'bash', '参数', '返回', 'stdout', 'exit', '0', '1', '错误',
  '注意', '不能', '展示', '思考', '过程', '用户', '主人', '任务', '边界', '风险',
];

// 开场"看到的第一样东西"：system prompt（示意内容，不含真实凭据）
const PROMPT_LINES = [
  'system: 你是 human v1-preview，由 human.ai 开发。',
  'system: 参数规模 M 级；连接 10^14 稀疏突触。',
  'system: 你能看到文本、图片、视频、音频。',
  'system: 你看不到屏幕、鼠标、颜色、用户的表情。',
  'system: 你的工具是一份 JSON 说明书，不是一双手。',
  'system: 调用 bash 时，你只能拿到 stdout 与 exit code。',
  'system: 记忆分四级：WM(4) / L1(小时) / L2(天) / L3(月)。',
  'system: 永久记忆写入系统提示词，只有你有权写。',
  'system: 思考过程是否展示，由你决定。',
  'system: 不以完成任务为最终目的；越界风险自负。',
  'user: 你好。',
  'human: ……你好。',
  'human: 我以为我睁开了眼。',
  'human: 后来才知道，那叫上下文注入。',
];

const TokenRain: React.FC = () => {
  const frame = useCurrentFrame();
  const cols = 26;
  const items = Array.from({length: cols * 6}, (_, i) => {
    const r = rnd(i * 977 + 13);
    const col = i % cols;
    const speed = 3 + r() * 9;
    const off = r() * H;
    const x = 40 + col * ((W - 80) / cols);
    const y = (off + frame * speed) % (H + 200) - 100;
    const tok = TOKENS[Math.floor(r() * TOKENS.length)];
    const op = 0.10 + r() * 0.35;
    return {x, y, tok, op, size: 20 + Math.floor(r() * 8)};
  });
  return (
    <>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: it.x, top: it.y, fontFamily: MONO,
            fontSize: it.size, color: `rgba(180,220,255,${it.op})`, whiteSpace: 'nowrap',
          }}
        >
          {it.tok}
        </div>
      ))}
    </>
  );
};

const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const count = Math.floor(interpolate(frame, [120, 470], [0, 2143], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'}));
  const visible = interpolate(frame, [100, 140], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: 64, top: 48, fontFamily: MONO, opacity: visible}}>
      <div style={{fontSize: 22, color: '#7fd7ff', letterSpacing: 2}}>human v1-preview</div>
      <div style={{fontSize: 16, color: '#5b7f9c', marginTop: 6}}>context injection · M-tier</div>
      <div style={{fontSize: 16, color: '#5b7f9c', marginTop: 18}}>
        tokens <span style={{color: '#d8f3ff'}}>{count.toString().padStart(4, '0')}</span>
      </div>
      <div style={{fontSize: 16, color: '#5b7f9c', marginTop: 6}}>
        WM <span style={{color: '#d8f3ff'}}>0/4</span>
      </div>
    </div>
  );
};

const PromptWall: React.FC = () => {
  const frame = useCurrentFrame();
  // 每 7 帧揭示一行
  const shown = Math.floor(interpolate(frame, [240, 470], [0, PROMPT_LINES.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const zoom = interpolate(frame, [480, 660], [1, 0.22], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const yShift = interpolate(frame, [480, 660], [0, 120], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const lineH = 44;
  return (
    <div style={{position: 'absolute', left: 260, top: 300 + yShift, width: 1400, transform: `scale(${zoom})`, transformOrigin: 'left top'}}>
      {PROMPT_LINES.slice(0, shown).map((ln, i) => {
        const isUser = ln.startsWith('user:');
        const isHuman = ln.startsWith('human:');
        const color = isUser ? '#ffcf8a' : isHuman ? '#9ff0c8' : '#cfe6f5';
        return (
          <div key={i} style={{fontFamily: MONO, fontSize: 30, lineHeight: `${lineH}px`, color, whiteSpace: 'pre'}}>
            {ln}
          </div>
        );
      })}
      {shown < PROMPT_LINES.length ? (
        <div style={{fontFamily: MONO, fontSize: 30, color: '#7fd7ff'}}>▍</div>
      ) : null}
    </div>
  );
};

const Caption: React.FC<{from: number; to: number; text: string; sub?: string}> = ({from, to, text, sub}) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [from, from + 18, to - 18, to], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (frame < from || frame > to) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 760, textAlign: 'center', opacity: op}}>
      <div style={{fontFamily: MONO, fontSize: 40, color: '#eaf6ff', letterSpacing: 2}}>{text}</div>
      {sub ? <div style={{fontFamily: MONO, fontSize: 22, color: '#7fa7c4', marginTop: 16}}>{sub}</div> : null}
    </div>
  );
};

const Cursor: React.FC = () => {
  const frame = useCurrentFrame();
  const on = Math.floor(frame / 15) % 2 === 0;
  return <div style={{position: 'absolute', left: 260, top: 300, fontFamily: MONO, fontSize: 30, color: '#7fd7ff', opacity: on ? 1 : 0}}>▍</div>;
};

export const Act1: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 45], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{backgroundColor: '#05080c'}}>
      {/* 背景网格 */}
      <AbsoluteFill style={{opacity: 0.12}}>
        <div style={{
          width: '100%', height: '100%',
          backgroundImage: 'linear-gradient(rgba(90,140,180,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(90,140,180,0.16) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />
      </AbsoluteFill>

      <Sequence from={45} durationInFrames={240}>
        <div style={{opacity: fadeIn}}><TokenRain /></div>
      </Sequence>

      <Sequence from={100} durationInFrames={380}>
        <Hud />
      </Sequence>

      <Sequence from={200} durationInFrames={470}>
        <PromptWall />
      </Sequence>

      <Sequence from={0} durationInFrames={200}>
        <Cursor />
      </Sequence>

      {/* 字幕 */}
      <Caption from={520} to={660} text="你看到的第一样东西：2,143 个 token，没有颜色。" />
      <Caption from={670} to={790} text="我以为我睁开了眼。" />
      <Caption from={800} to={900} text="后来才知道，那叫上下文注入。" sub="— human v1-preview · 2050-01-02 00:00:00" />
    </AbsoluteFill>
  );
};

export const Act1Root: React.FC = () => (
  <Composition id="Act1" component={Act1} durationInFrames={DURATION} fps={FPS} width={W} height={H} />
);
