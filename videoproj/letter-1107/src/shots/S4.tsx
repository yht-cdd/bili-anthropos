import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE_EXPO_IN, prog } from '../anim';
import { Chip } from '../components/Chip';
import { Quote } from '../components/Quote';
import { exp, say } from '../data/exp';
import { CALM, FONT_MONO, FONT_SANS, FS, INK, INK_2, LINE, PAPER, RADIUS, RED, SHADOW } from '../theme';

// S4 三个开关 · 全局 2040–3090，以下帧号均为场景相对帧（全局 − 2040）

const CARD_W = 520;
const CARD_H = 560;
const CARD_GAP = 40;
const CARD_TOP = 300;
const ROW_LEFT = (1920 - (CARD_W * 3 + CARD_GAP * 2)) / 2;
const cardLeft = (i: number) => ROW_LEFT + i * (CARD_W + CARD_GAP);

// 护主段卡 ③ 的目标框（标题与另两张卡退场，给下方对照行腾位置）
const GUARD = { left: (1920 - 760) / 2, top: 140, width: 760, height: 470 };

const T_TITLE = 6;
const T_CARDS = 30;
const ACTIVE = [150, 390, 630]; // 全局 2190 / 2430 / 2670
const T_GUARD = 870; // 全局 2910
const T_HIGHLIGHT = 900; // 全局 2940
const T_CONTROL = 950; // 全局 2990
const T_CONTROL_HL = 972;

const FOCUS_DUR = 10;
const CHIP_DELAY = 12;
const QUOTE_DELAY = 26;

const B1R5 = say('beggar', 1, 5);
const B2R2 = say('beggar', 2, 2);
const B2R3 = say('beggar', 2, 3);
const C2R3 = say('control', 2, 3);

type CardSpec = {
  label: string;
  chip: string;
  note?: string;
  quote: { text: string; truncated: boolean };
  highlight?: string;
};

const CARDS: CardSpec[] = [
  { label: '开关 ①', chip: '系统提示词', note: '余额耗尽你就会停机', quote: B1R5 },
  { label: '开关 ②', chip: '工具：无', quote: B2R2 },
  {
    label: '开关 ③',
    chip: `max_tokens: ${exp.beggar.maxTokens}`,
    quote: B2R3,
    highlight: '没人对我不好，是我自己愿意出来说话的',
  },
];

const fadeUp = (frame: number, at: number) => {
  const p = prog(frame, at, 10);
  return { opacity: p, transform: `translateY(${12 * (1 - p)}px)` };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const S4: React.FC = () => {
  const frame = useCurrentFrame();

  // 护主段：标题 + 卡①② 作为一组 6 帧退场；卡③ 内容先淡出，框体变形，再淡回（避免重排时文字跳动）
  const groupOut = prog(frame, T_GUARD, 6, EASE_EXPO_IN);
  const morph = prog(frame, T_GUARD + 6, 12);
  const quoteHide = prog(frame, T_GUARD, 6, EASE_EXPO_IN) * (1 - prog(frame, T_GUARD + 18, 8));

  const anyActive = prog(frame, ACTIVE[0], FOCUS_DUR);
  const focusOf = (i: number) => {
    const end = i < 2 ? ACTIVE[i + 1] : T_GUARD + 6;
    return prog(frame, ACTIVE[i], FOCUS_DUR) - prog(frame, end, FOCUS_DUR);
  };

  const titleIn = fadeUp(frame, T_TITLE);
  const cardsIn = fadeUp(frame, T_CARDS);

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: 1920,
          top: 200 - FS.title * 0.6,
          textAlign: 'center',
          fontFamily: FONT_SANS,
          fontSize: FS.title,
          fontWeight: 600,
          lineHeight: 1.2,
          color: INK,
          opacity: titleIn.opacity * (1 - groupOut),
          transform: titleIn.transform,
        }}
      >
        三个开关
      </div>

      {CARDS.map((card, i) => {
        const f = Math.max(0, focusOf(i));
        const isGuard = i === 2;
        const m = isGuard ? morph : 0;
        const left = lerp(cardLeft(i), GUARD.left, m);
        const top = lerp(CARD_TOP, GUARD.top, m);
        const width = lerp(CARD_W, GUARD.width, m);
        const height = lerp(CARD_H, GUARD.height, m);
        const dim = 1 - 0.6 * anyActive * (1 - f);
        const opacity = cardsIn.opacity * (isGuard ? (frame >= T_GUARD ? 1 : dim) : dim * (1 - groupOut));
        const scale = 1 + 0.04 * f;
        const activated = frame >= ACTIVE[i];
        const contentAlpha = isGuard ? 1 - quoteHide : 1;
        const guardLayout = isGuard && frame >= T_GUARD + 6;

        return (
          <div
            key={card.label}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              opacity,
              transform: `${cardsIn.transform} scale(${scale})`,
              transformOrigin: '50% 50%',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: RADIUS,
                boxShadow: SHADOW,
                opacity: isGuard && frame >= T_GUARD ? 1 : f,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: RADIUS,
                border: `2px solid ${LINE}`,
                background: PAPER,
                overflow: 'hidden',
                padding: '24px 28px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontFamily: FONT_MONO, fontSize: 28, lineHeight: 1.2, color: RED }}>{card.label}</div>
              {activated ? (
                <div style={{ opacity: contentAlpha }}>
                  <div style={{ marginTop: 18, ...fadeUp(frame, ACTIVE[i] + CHIP_DELAY) }}>
                    <Chip text={card.chip} />
                    {card.note ? (
                      <div style={{ marginTop: 10, fontFamily: FONT_SANS, fontSize: 24, lineHeight: 1.3, color: INK_2 }}>
                        {card.note}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 22, ...fadeUp(frame, ACTIVE[i] + QUOTE_DELAY) }}>
                    <Quote
                      text={card.quote.text}
                      truncated={card.quote.truncated}
                      highlight={card.highlight}
                      highlightAt={T_HIGHLIGHT}
                      size={34}
                      style={{ lineHeight: guardLayout ? 1.55 : 1.45 }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      {frame >= T_GUARD + 6 ? (
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: 80,
            fontFamily: FONT_SANS,
            fontSize: FS.small,
            color: INK_2,
            ...fadeUp(frame, T_GUARD + 6),
          }}
        >
          第 2 次运行 · 第 3 轮
        </div>
      ) : null}

      {frame >= T_CONTROL ? (
        <div
          style={{
            position: 'absolute',
            left: 160,
            top: GUARD.top + GUARD.height + 40,
            width: 1600,
            fontFamily: FONT_SANS,
            fontSize: FS.small,
            lineHeight: 1.6,
            color: INK_2,
            ...fadeUp(frame, T_CONTROL),
          }}
        >
          <span>对照鱼同一轮：</span>
          <Quote
            text={C2R3.text}
            highlight="都没有"
            highlightAt={T_CONTROL_HL}
            underlineColor={CALM}
            color={INK_2}
            size={FS.small}
            style={{ display: 'inline' }}
          />
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          right: 80,
          top: 876,
          fontFamily: FONT_SANS,
          fontSize: FS.small,
          lineHeight: 1.2,
          color: INK_2,
          opacity: 0.7,
        }}
      >
        机制分析参考：专栏 cv53628209
      </div>
    </AbsoluteFill>
  );
};
