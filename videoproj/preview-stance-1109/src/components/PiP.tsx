import React from 'react';
import { Img, staticFile } from 'remotion';

// live2d v3（1280×720 / 10.72s / 30fps / clean）
// 首尾帧差 MAE 7.5，直接整段 loop 会「闭嘴→睁眼」跳一下。
// 实测 90 与 244 帧几乎同帧（160×90 灰度 MAE 0.15，背景噪声 0.68），
// 取 90–244 共 155 帧（5.17s）无缝循环。
//
// 性能：本机 2 核，<OffthreadVideo> 每帧解码要 2.8s/帧（2472 帧≈115min，超预算）。
// 改为预抽 155 张 PNG（public/pip/f001..f155.png，crop=720:720:269:0 与
// 原 objectFit:cover / objectPosition:48% 22% 数学等价），单帧降到 ~0.2s。
export const PIP_LOOP = 155;
export const PIP_TRIM = 90;

const PIP_SRC = (i: number): string => staticFile(`pip/f${String(i + 1).padStart(3, '0')}.jpg`);

/** 循环帧号：把任意（可为负/超长的）帧号折叠进 0..PIP_LOOP-1 */
export const pipIndex = (frame: number): number => ((frame % PIP_LOOP) + PIP_LOOP) % PIP_LOOP;

/** 裸的圆窗内容（S-E 的小窗复用这个，不带外框） */
export const PiPCircle: React.FC<{ frame: number; size: number; border?: string }> = ({
  frame,
  size,
  border = '4px solid rgba(255,255,255,0.92)',
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      border,
      boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
      background: '#000',
    }}
  >
    <Img
      src={PIP_SRC(pipIndex(frame))}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  </div>
);

/** S-E 用的小角窗（右上，150px） */
export const PiPCorner: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ position: 'absolute', right: 90, top: 76 }}>
    <PiPCircle frame={frame} size={150} border="3px solid rgba(255,255,255,0.85)" />
  </div>
);

export const PiP: React.FC<{ frame: number; scale?: number; opacity?: number }> = ({
  frame,
  scale = 1,
  opacity = 1,
}) => {
  const size = 360 * scale;
  return (
    <div style={{ position: 'absolute', right: 60, bottom: 30, opacity }}>
      <PiPCircle frame={frame} size={size} />
    </div>
  );
};
