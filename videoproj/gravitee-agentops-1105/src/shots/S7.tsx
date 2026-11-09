import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { blink, EASE_EXPO_OUT, prog, typedLine } from '../anim';
import { COVER_DATA_URI } from '../coverData';
import { BG, FONT_SANS, TERM_GRAY, TEXT } from '../theme';

// ============================================================================
// S7 尾卡 · 全局 1500–1650（brief §二·S7）· 配方卡 [camera] PushIn + [effects] brand-frame-snap
// 本地帧 = 全局 − 1500。
// 0–24    封面图（v2 cover-16x9 data URI 内联，不新增图片文件）PushIn scale 1→1.06
//         24 帧 expo-out（brief 1500–1524）；入场 4 帧从 50% 起淡入（≤6 帧纪律；
//         不起全黑，避免 1500 单帧黑闪）。
// 30–     底部 36px 米白打字机（brief 1530–1600）：1 帧/字（同 S3/S5 判例），31 字
//         1530–1561 打完，光标闪两下后摘除，余 39 帧停留。
// 100–150 小字 28px #8B949E（brief 1600–1650）：brand-frame-snap = 逐行从下方 10px 升位
//         + 淡入 10 帧 expo-out，两行错峰 4 帧，落定即止（卡命门：snap 到位后不再飘）。
// ⚠️ 版面实测（覆盖层专用）：封面图 AGENT 字块占到 y=921，scale 1.06 推近后到 y≈944，
//    横向 x≈94–1800 全占满；底部可用净区只有 y≈950–1080。所以主文案钉在 top 962（推近后
//    与字块留 18px），两组小字放左上角（x<740 在该高度纯空），不挤底部。理由记 progress
//    「R3 歧义裁决」，brief 只规定小字字号/时点、未规定其位置。
// ============================================================================

const SUB = 'Anthropos_AI · 一条住在自己服务器上的 AI 鱼'; // 31 字
const NOTE1 = '工程开源 github.com/yht-cdd/bili-anthropos';
const NOTE2 = '灵感：Tim Taylor / Gravitee';

export const S7: React.FC = () => {
  const f = useCurrentFrame();
  const inP = 0.5 + 0.5 * prog(f, 0, 4, EASE_EXPO_OUT); // 入场：不从全黑起（避免 1500 单帧黑闪）
  const push = 1 + 0.06 * prog(f, 0, 24, EASE_EXPO_OUT); // PushIn 1→1.06（brief 给定）
  const scrim = prog(f, 24, 10, EASE_EXPO_OUT); // 底部遮盖带（吃掉封面自带旧文案）

  const n = typedLine(f, 30, 0, 0, SUB.length, 1); // 1 帧/字
  const done = n >= SUB.length;
  const cursorOn = done
    ? f - (30 + SUB.length) < 30
      ? blink(f, 30 + SUB.length, 12)
      : 0
    : 1;

  // brand-frame-snap：两行小字错峰 4 帧，各自 10 帧升位淡入
  const noteStyle = (start: number): React.CSSProperties => {
    const p = prog(f, start, 10, EASE_EXPO_OUT);
    return { opacity: p, transform: `translateY(${(10 * (1 - p)).toFixed(2)}px)` };
  };

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT_SANS, overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: inP, transform: `scale(${push.toFixed(4)})` }}>
        <img
          src={COVER_DATA_URI}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </AbsoluteFill>

      {/* 底部压暗纱：主要是吃掉封面自带的 v2 旧文案（右下「把它们接进你的设备」，
          不是本片的词）。颜色取封面自己底区的实测值 rgb(17,23,37)，所以这条带子
          铺上去是隐形的，只把旧文案盖掉；下沿 30% 段为实色，其余渐变到透明。 */}
      {scrim > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 230,
            opacity: scrim,
            background:
              'linear-gradient(to top, rgba(17,23,37,1) 0%, rgba(17,23,37,1) 30%, rgba(17,23,37,0) 100%)',
          }}
        />
      ) : null}

      {/* 主文案 36px 米白打字机：钉在封面字块下方的净区（推近后仍留 18px） */}
      {n > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 962,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
              fontSize: 36,
              fontWeight: 700,
              color: TEXT,
              whiteSpace: 'pre',
              lineHeight: 1.2,
            }}
          >
            {SUB.slice(0, n)}
            {/* 光标走出流（absolute）：否则打字过程中光标宽会把整行往左推 22px，
                尾卡是全片最后一帧画面，居中偏移会被看出来 */}
            <span
              style={{
                position: 'absolute',
                left: '100%',
                top: 2,
                width: 17,
                height: 34,
                marginLeft: 4,
                backgroundColor: TEXT,
                opacity: cursorOn,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* 小字 28px 终端灰：工程地址 + 灵感来源（左上空白区，左对齐） */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 92,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 4,
          fontSize: 28,
          color: TERM_GRAY,
          whiteSpace: 'pre',
        }}
      >
        <div style={noteStyle(100)}>{NOTE1}</div>
        <div style={noteStyle(104)}>{NOTE2}</div>
      </div>
    </AbsoluteFill>
  );
};
