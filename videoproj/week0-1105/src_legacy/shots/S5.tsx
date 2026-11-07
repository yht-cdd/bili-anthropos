import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_OUT, EASE_SWEEP, prog, shakeX, sinePulse } from '../anim';
import { BG, FONT_SANS, LEDGER_GREEN, TERM_GRAY, TEXT } from '../theme';

// ============================================================================
// S5 两个问答 · 全局 1020–1320（brief §二·S5）· 配方卡 [effects] slam-entrance-moves(B 式) ×2 + impact-feedback
// 本地帧 = 全局 − 1020。
// 0–12   黑场转场（全局 34.0–34.4s = §三 静音缺口①，R3 排音；画面全黑即本镜开场）。
// 问答体：问题 56px 米白 slam，答案 84px 账本绿 slam，间隔 12 帧（brief 给定）。
//   Q1 local 20（全局 1040）「收益仍是 0，会不会继续？」slam；答案「会。」local 32 slam。
//      local 100（全局 1120 = ding@37.3）答案 impact-feedback 重击回响：
//      scale 1→1.14→1（6+8 帧）+ 扩散环 + 字色闪白 —— slam 之后延迟再钉一下，
//      把「会。」从「出现」读成「落定」。停留至 local 140。
//   140–160（全局 1160–1180）Q1 整对 8 帧淡出。
//   Q2 local 160（全局 1180）「要不要消费 AI 形象？」slam；答案「不。」local 172 slam。
//      local 240（全局 1260 = boom@42.0）同款重击（boom 更沉，震屏叠 4 帧 shakeX 4）。停留至 280。
//   288–294 整段 6 帧淡出（退场纪律）；294–300 黑，接 S6 whoosh。
// slam 计数注：全片 slam-entrance 主砸 S1/S3 共 2 次；本镜四次为问答体节奏性砸入（brief §二
// 明确要求「问题 slam / 答案 slam ×2 组」），量级减半（scale 1.18 起、震幅 0/4），不与前两次抢重量。
// 停留纪律：答案落定后 ≥40 帧（100→140、240→280 各 40 帧），符合「停留 ≥20」。
// ============================================================================

const Q_Y = 360;
const A_Y = 516;
const SLAM_SCALE = 1.18; // 问答体砸入量级（< S1 的 1.3，主次有别）

type QA = {
  q: string;
  a: string;
  qAt: number;
  aAt: number;
  hitAt: number; // impact-feedback 重击回响帧
  shake: number; // 重击震幅（Q1 ding 不震屏，Q2 boom 震 4）
  outAt: number; // 本对淡出起始（Q2 用整段淡出）
};

const QAS: QA[] = [
  { q: '收益仍是 0，会不会继续？', a: '会。', qAt: 20, aAt: 32, hitAt: 100, shake: 0, outAt: 140 },
  { q: '要不要消费 AI 形象？', a: '不。', qAt: 160, aAt: 172, hitAt: 240, shake: 4, outAt: 280 },
];

export const S5: React.FC = () => {
  const f = useCurrentFrame();
  const segOut = prog(f, 288, 6, EASE_EXPO_OUT); // 整段收尾淡出

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT_SANS, opacity: 1 - segOut }}>
      {QAS.map((qa, i) => {
        const qIn = prog(f, qa.qAt, 4, EASE_EXPO_OUT);
        const qScale = prog(f, qa.qAt, 6, EASE_SWEEP);
        const aIn = prog(f, qa.aAt, 4, EASE_EXPO_OUT);
        const aScale = prog(f, qa.aAt, 6, EASE_SWEEP);
        // impact-feedback：hitAt 起 scale 弹冲 6 帧收 + 10 帧缓放，环扩散 16 帧
        const hit = prog(f, qa.hitAt, 6, EASE_SWEEP);
        const hitRelax = prog(f, qa.hitAt + 6, 10, EASE_EXPO_OUT);
        const ring = prog(f, qa.hitAt, 16, EASE_EXPO_OUT);
        const flash = prog(f, qa.hitAt, 12, EASE_EXPO_OUT); // 落钉瞬间字色回白（从亮绿过冲到本色）
        const hitShake = qa.shake > 0 ? shakeX(f, qa.hitAt, qa.shake, 8) : 0;
        const pairOut = prog(f, qa.outAt, 8, EASE_EXPO_OUT);
        const pulse = sinePulse(f, qa.hitAt + 20, 80); // 落定后的呼吸（只给 box 阴影，≤2 运动元素内）

        const alive = f >= qa.qAt && pairOut < 1;
        if (!alive) return null;
        const aPop = 1 + 0.14 * Math.max(0, hit - hitRelax); // 冲出去再收回来
        const ringR = 60 + 200 * ring;

        return (
          <div key={i} style={{ position: 'absolute', inset: 0, opacity: 1 - pairOut }}>
            {/* 问题 56px 米白 slam */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: Q_Y,
                width: 1920,
                textAlign: 'center',
                fontSize: 56,
                fontWeight: 600,
                color: TERM_GRAY,
                opacity: qIn,
                transform: `scale(${SLAM_SCALE - (SLAM_SCALE - 1) * qScale})`,
              }}
            >
              {qa.q}
            </div>
            {/* 答案 84px 账本绿 slam + 延迟重击回响 */}
            <div style={{ position: 'absolute', left: 0, top: A_Y, width: 1920, textAlign: 'center' }}>
              {f >= qa.hitAt && ring < 1 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 960 - ringR,
                    top: 52 - ringR * 0.55,
                    width: ringR * 2,
                    height: ringR * 1.1,
                    borderRadius: '50%',
                    border: `${Math.max(1, 6 * (1 - ring)).toFixed(1)}px solid rgba(63,182,139,${(0.5 * (1 - ring)).toFixed(3)})`,
                    opacity: 1 - ring,
                  }}
                />
              ) : null}
              <div
                style={{
                  fontSize: 84,
                  fontWeight: 800,
                  color: LEDGER_GREEN,
                  opacity: aIn,
                  transform: `translateX(${hitShake}px) scale(${(
                    (SLAM_SCALE - (SLAM_SCALE - 1) * aScale) *
                    aPop
                  ).toFixed(4)})`,
                  textShadow: `0 0 ${Math.round(24 * pulse + 30 * flash * (1 - flash) * 4)}px rgba(63,182,139,${(
                    0.25 + 0.45 * flash * (1 - flash) * 4
                  ).toFixed(3)})`,
                }}
              >
                {qa.a}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
