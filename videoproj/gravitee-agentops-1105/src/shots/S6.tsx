import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_LINEAR, EASE_SWEEP, prog, shakeX } from '../anim';
import { BG, CORAL, FONT_SANS, TEXT } from '../theme';

// ============================================================================
// S6 收束 · 全局 1380–1500（brief §二·S6）· 配方卡 [effects] slam-entrance-moves
// 本地帧 = 全局 − 1380。
// 0–20    压暗：黑纱 0→0.72 走 20 帧（brief 1380–1400；linear 仅用于淡暗辅助通道）。
//         压暗层是 z 序最底层、文字在其上，所以压暗完成后文字仍是满亮度 —— 语义与 S2 的
//         「压暗 30%」同源（progress R1 裁决 2）。
// 20–60   第一句「agent 不是被管理的软件，」84px 米白 slam（全局 1400–1440）：
//         scale 1.3→1.0 六帧（EASE_SWEEP，同 S2/S4 slamStyle）+ 落定帧 shakeX amp10。
// 64–100  第二句「是被运维的存在。」84px，「运维」珊瑚（全局 1444–1480）。
// 100–120 停留（brief 1480–1500），硬切交 S7。
// 动效纪律：主动效 2 个（两次 slam），无第三运动元素；停留 20 帧 + 第二句 20 帧静止富余。
// ============================================================================

const LINE1: Array<{ t: string; c: string }> = [{ t: 'agent 不是被管理的软件，', c: TEXT }];
const LINE2: Array<{ t: string; c: string }> = [
  { t: '是被', c: TEXT },
  { t: '运维', c: CORAL },
  { t: '的存在。', c: TEXT },
];

const Y1 = 408; // 两句合块居中：块高 ≈ 257，视觉中心 ≈ 536（画高 1080）
const Y2 = 552;
const FS = 84;

// 同 S2/S4 的 slamStyle（卡 B 式：ease-in 才是砸 → EASE_SWEEP 前密后疏）
const slamStyle = (f: number, start: number): React.CSSProperties => {
  const p = prog(f, start, 6, EASE_SWEEP);
  const hold = prog(f, start, 4, EASE_EXPO_OUT);
  const s = 1.3 - 0.3 * p;
  const x = shakeX(f, start + 6, 10);
  return { opacity: hold, transform: `translateX(${x}px) scale(${s})` };
};

export const S6: React.FC = () => {
  const f = useCurrentFrame();
  const veil = 0.72 * prog(f, 0, 20, EASE_LINEAR); // 压暗 1380–1400（辅助通道）

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT_SANS }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000', opacity: veil }} />

      <div
        style={{
          position: 'absolute',
          top: Y1,
          left: 0,
          width: 1920,
          textAlign: 'center',
          fontWeight: 700,
          fontSize: FS,
          lineHeight: 1.35,
          whiteSpace: 'pre',
          ...slamStyle(f, 20),
        }}
      >
        {LINE1.map((sg, i) => (
          <span key={i} style={{ color: sg.c }}>
            {sg.t}
          </span>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: Y2,
          left: 0,
          width: 1920,
          textAlign: 'center',
          fontWeight: 700,
          fontSize: FS,
          lineHeight: 1.35,
          whiteSpace: 'pre',
          ...slamStyle(f, 64),
        }}
      >
        {LINE2.map((sg, i) => (
          <span key={i} style={{ color: sg.c }}>
            {sg.t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
