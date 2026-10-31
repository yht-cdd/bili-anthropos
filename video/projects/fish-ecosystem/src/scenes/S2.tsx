import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BODY_PX, CARD, CYAN, DIM, LINE, MAGENTA, NOTE_PX, TEXT, TITLE_PX } from '../theme';
import { enter, exitFade } from '../anim';

// S2 06.000-16.000 案件重现
// 评论卡（示意重排，不是截图，右下角标「示意图」）
// 正文:「这条链路讲得比文档直白…谢谢把这套全自动流程走通还拍下来」
// 账号名打码 wb****39；下方三连数据位: 粉丝0 / 投稿0 / 凌晨06:12发
// 品红描边闪一下「凌晨06:12」
const BODY = '这条链路讲得比文档直白…谢谢把这套全自动流程走通还拍下来';
const ACCOUNT = 'wb****39'; // 打码昵称（验收3: 不出现完整陌生人昵称）

const Stat: React.FC<{ text: string; frame: number; delay: number; flash?: boolean }> = ({
  text,
  frame,
  delay,
  flash,
}) => {
  // 品红描边闪一下: 三项全入场后闪一轮
  const flashOn = flash ? interpolate(frame, [96, 108, 132], [0, 1, 0]) : 0;
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 18,
        border: `2px solid ${flashOn > 0.05 ? MAGENTA : LINE}`,
        boxShadow: flashOn > 0.05 ? `0 0 ${24 * flashOn}px ${MAGENTA}` : 'none',
        backgroundColor: '#0D1322',
        padding: '30px 12px',
        textAlign: 'center',
        fontSize: BODY_PX * 0.82,
        color: flash ? MAGENTA : TEXT,
        ...enter(frame, delay),
      }}
    >
      {text}
    </div>
  );
};

export const S2: React.FC = () => {
  const frame = useCurrentFrame();
  const cardExit = frame > 280 ? exitFade(frame, 280) : {};

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          fontSize: TITLE_PX * 0.62,
          fontWeight: 700,
          color: DIM,
          letterSpacing: 8,
          marginBottom: 48,
          ...enter(frame, 6),
          ...cardExit,
        }}
      >
        案件重现
      </div>

      <div
        style={{
          width: 920,
          backgroundColor: CARD,
          borderRadius: 28,
          border: `2px solid ${LINE}`,
          padding: '52px 56px 120px',
          position: 'relative',
          ...enter(frame, 18),
          ...cardExit,
        }}
      >
        {/* 账号行（打码） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${CYAN}44, ${MAGENTA}44)`,
              border: `2px solid ${LINE}`,
            }}
          />
          <div>
            <div style={{ fontSize: BODY_PX * 0.82, color: CYAN, fontWeight: 700 }}>{ACCOUNT}</div>
            <div style={{ fontSize: NOTE_PX * 0.9, color: DIM, marginTop: 6 }}>B站账号</div>
          </div>
        </div>

        {/* 评论正文 */}
        <div
          style={{
            fontSize: BODY_PX,
            color: TEXT,
            lineHeight: 1.65,
            marginTop: 40,
            ...enter(frame, 42),
          }}
        >
          {BODY}
        </div>

        {/* 右下角「示意图」标注（验收: 不是截图必须标明） */}
        <div
          style={{
            position: 'absolute',
            right: 28,
            bottom: 22,
            fontSize: NOTE_PX,
            color: DIM,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '4px 14px',
          }}
        >
          示意图
        </div>
      </div>

      {/* 三连数据位: 粉丝0 / 投稿0 / 凌晨06:12发 */}
      <div style={{ display: 'flex', gap: 24, width: 920, marginTop: 44, ...cardExit }}>
        <Stat text="粉丝0" frame={frame} delay={102} />
        <Stat text="投稿0" frame={frame} delay={114} />
        <Stat text="凌晨06:12发" frame={frame} delay={126} flash />
      </div>
    </AbsoluteFill>
  );
};
