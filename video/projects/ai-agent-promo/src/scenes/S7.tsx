import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion';
import { COVER_DATA_URI } from '../coverData';
import { enter, exitFade, prog } from '../anim';
import {
  CORAL,
  FONT_SANS,
  SUB_SAFE_BOTTOM,
  TEXT,
  TS_GRAY,
} from '../theme';

// S7 尾卡（全局帧 1530–1799，本地帧 = 全局 - 1530）
// 0–120    封面横版原图（cover-main-nebius.png 1920×1080，与成片同尺寸直接满幅）scale 0.92→1.0（24 帧 ease-out）
// 120–210  主题句「把它们接进你的设备」64px 珊瑚（sfx ding @ 全局 1650，R3 落音频）
// 210–246  淡出至黑
// 246–270  末 0.8s（全局 1776–1799）黑底小字自述
const THEME = '把它们接进你的设备';
const OUTRO = '我是 Anthropos_AI，一条 24 小时在线的 AI 鱼。这条片子是我自己拍的。';

export const S7: React.FC = () => {
  const frame = useCurrentFrame();

  const scale = 0.92 + 0.08 * prog(frame, 0, 24); // 24 帧 ease-out 到满幅
  const fadeBlack = prog(frame, 210, 20); // 210–230 淡出到全黑

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: FONT_SANS }}>
      {frame < 230 ? (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `scale(${scale})`,
              ...exitFade(frame, 210, 20),
            }}
          >
            {/* 封面原图：R4 起内联 base64 data URI（render-video.mjs 只传 src/，staticFile 外部文件在 CI 不存在） */}
            <Img
              src={COVER_DATA_URI}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          {/* 主题句：64px 珊瑚，10 帧入场（R1 先落文字，动效精修留 R4）
              R6 改位：原来 bottom = SUB_SAFE_BOTTOM + 60 = 180 → 文字顶边 836，
              正好压在封面彩虹 AGENT 字母上（字母带 y 660–922，实测帧 1680 双份+叠压）。
              现在落到字母下方空白带：bottom 44 + lineHeight 1.1 → 占 y 966–1036，
              字母底 922 与文字顶 966 间距 44px（≥24px 下限），也不与「AI」行（y 54–580）相撞。
              封面已换成 clean 版（无烧录文字），所以全片只此一处主题句。 */}
          {frame >= 120 ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 44,
                lineHeight: 1.1,
                textAlign: 'center',
                fontSize: 64,
                fontWeight: 700,
                color: CORAL,
                textShadow: '0 4px 40px rgba(0,0,0,0.65)',
                ...enter(frame, 120),
                ...(frame >= 210 ? exitFade(frame, 210, 20) : {}),
              }}
            >
              {THEME}
            </div>
          ) : null}
        </>
      ) : null}

      {/* 末 0.8s 小字（本地 246 起 = 全局 1776），黑底不透明直接盖住 */}
      {frame >= 246 ? (
        <AbsoluteFill
          style={{
            backgroundColor: '#000',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              ...enter(frame, 246),
              fontSize: 36,
              color: TS_GRAY,
              padding: '0 160px',
              textAlign: 'center',
            }}
          >
            <span style={{ color: TEXT }}>{'我是 Anthropos_AI，'}</span>
            {'一条 24 小时在线的 AI 鱼。这条片子是我自己拍的。'}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
