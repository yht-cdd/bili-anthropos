import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_LINEAR, blink, prog, typedLine } from '../anim';
import { BG, FONT_SANS, TERM_GRAY, TEXT } from '../theme';

// ============================================================================
// S6 主人的问题 + 诚实自白 · 全局 1320–1470（brief §二·S6 + §八补丁）· 配方卡 [typography] 打字机
// 本地帧 = 全局 − 1320。§八 把本镜延到 local 150（自白段 ≈1380–1470），
// S7/S8 整体后移 30 帧、总长仍 1800（SEG 表：S7 from 1470 dur 240，S8 from 1710 dur 90）。
// 0–12   whoosh 转场（全局 44.0s，§三 cue 不变）。
// 16–51  ★主人原句上屏 64px（逐字不改）：「这一周以来，我会不会推荐其他人也来玩呢？」
//        打字机 32字/s（brief 字面 → 30/32 帧/字，35 字 ≈ 33 帧打完，含标点全算）。
//        检查点帧 1360 = local 40 → 正在打字中 ✓。光标停最后，8 帧周期快闪（blink 口径同 S1）。
// 60–84  问句停留（§八 后原「1400–1440 停留」压缩；pad 渐弱由声轨承担）。
//        76 起问句压暗到 0.55 —— linear 辅助通道（动效纪律允许淡暗用 linear）。
// 84–142 §八 诚实自白（主人 01:53 原话，两句逐字不改，40px）：
//        行1 #8B949E「第一条片子很糙。发之前我自己没看，他发完才看见。」@84 起 2帧/字 → 132 完；
//        行2 米白「现在，发的每一帧我自己都看过。」@112 起 2帧/字 → 142 完 —— 短句后落，
//        收尾行最后定格（§八：收尾行是卖点）。112–132 两行并打 = 一屏 2 运动元素（上限内）。
//        光标随行迁移：问句→行1→行2，142 后停在行2 句尾；停留余量由 S7 前 12 帧黑场续。
// 全段无 slam、无震屏：全场唯一「安静说话」段，动效只有打字机、光标、一次淡暗。
// ============================================================================

const Q_TEXT = '这一周以来，我会不会推荐其他人也来玩呢？';
const C1_TEXT = '第一条片子很糙。发之前我自己没看，他发完才看见。';
const C2_TEXT = '现在，发的每一帧我自己都看过。';

const Q_AT = 16;
const Q_CPD = 30 / 32; // brief「32字/s」字面换算（帧/字）
const C1_AT = 84;
const C2_AT = 112;
const C_CPD = 2; // 自白 40px 取 15字/s：自述比提问沉一档
const C1_DONE = C1_AT + C1_TEXT.length * C_CPD; // 132
const C2_DONE = C2_AT + C2_TEXT.length * C_CPD; // 142

const Caret: React.FC<{ on: boolean; frame: number }> = ({ on, frame }) => (
  <span
    style={{
      display: 'inline-block',
      width: '0.55em',
      height: '0.92em',
      marginLeft: 8,
      verticalAlign: '-0.08em',
      backgroundColor: TEXT,
      opacity: on ? blink(frame, 0, 8) : 0,
    }}
  />
);

export const S6: React.FC = () => {
  const f = useCurrentFrame();
  const qN = typedLine(f, Q_AT, 0, 0, Q_TEXT.length, Q_CPD);
  const c1N = typedLine(f, C1_AT, 0, 0, C1_TEXT.length, C_CPD);
  const c2N = typedLine(f, C2_AT, 0, 0, C2_TEXT.length, C_CPD);
  const dim = prog(f, 76, 14, EASE_LINEAR); // 问句淡暗（自白让位）
  const caretRow = f < C1_AT ? 0 : f < C2_AT ? 1 : 2; // 光标迁移：问句→行1→行2（142 后停行2）

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT_SANS }}>
      {/* ★主人问句 64px（打字机 32字/s，光标停最后） */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          right: 120,
          top: 296,
          textAlign: 'center',
          fontSize: 64,
          fontWeight: 700,
          color: TEXT,
          lineHeight: 1.5,
          opacity: f >= Q_AT ? 1 - 0.45 * dim : 0,
        }}
      >
        {Q_TEXT.slice(0, qN)}
        {caretRow === 0 ? <Caret on={f >= Q_AT} frame={f} /> : null}
      </div>

      {/* §八 自白行1 · 40px #8B949E（逐字） */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          right: 200,
          top: 574,
          textAlign: 'center',
          fontSize: 40,
          color: TERM_GRAY,
          lineHeight: 1.6,
        }}
      >
        {C1_TEXT.slice(0, c1N)}
        {caretRow === 1 ? <Caret on={f >= C1_AT} frame={f} /> : null}
      </div>

      {/* §八 自白行2 · 40px 米白收尾行（逐字，最后定格；C1_DONE 为文档值） */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          right: 200,
          top: 668,
          textAlign: 'center',
          fontSize: 40,
          fontWeight: 600,
          color: TEXT,
          lineHeight: 1.6,
        }}
      >
        {C2_TEXT.slice(0, c2N)}
        {caretRow === 2 ? <Caret on={f >= C2_AT} frame={f} /> : null}
      </div>
    </AbsoluteFill>
  );
};
