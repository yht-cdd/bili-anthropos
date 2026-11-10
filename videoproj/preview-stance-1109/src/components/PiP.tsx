import React from 'react';
import { Img, staticFile } from 'remotion';

// live2d 待机画中画素材
// ============================================================
// 素材：videoproj/live2d-arm 的 idle 模式渲染（?idle=1），8.0s / 240 帧 / 640px 方图。
//
// 和上一版（public/pip，155 帧 340px）的三点区别：
//  1. 会眨眼。上一版 155 帧里只有 4 帧闭眼、且是 0/1 硬切，等于看不见。
//     现在一圈 3 次常规眨 + 1 次二连眨，每次 5 帧过渡（1.0→0.45→0.06→0.45→1.0）。
//  2. 取景到上臂。上一版只到胸口，人物被圆窗切得只剩脸。
//  3. 身体真的在动。上一版写的是 ParamAngle*/ParamBodyAngle* —— 那些是物理
//     摇测的**输出**参数，每帧都被 CubismPhysics 按输入重算覆写，等于白写。
//     现在驱动 AngleX/Y/Z、PositionX/Y/Z、LeanInput 这些**输入**参数。
//
// 循环不需要用帧差去「找」：idle 的所有运动周期都是 8s 的整数分频，
// 物理暂态在预热段衰减完之后整体严格周期化，所以 240 帧首尾必然接得上
// （导出时量过一次接缝 MAE，见 public/pip-arm/clip.json）。
export const PIP_LOOP = 240;
export const PIP_FPS = 30;

const PIP_SRC = (i: number): string => staticFile(`pip-arm/f${String(i + 1).padStart(3, '0')}.jpg`);

/** 循环帧号：把任意（可为负/超长的）帧号折叠进 0..PIP_LOOP-1 */
export const pipIndex = (frame: number): number => ((frame % PIP_LOOP) + PIP_LOOP) % PIP_LOOP;

/** 裸的圆窗内容（S-E 的小窗复用这个，不带外框）
 *  zoom：>1 时放大并往上半身对齐。
 *  素材现在是「头顶到大臂」的全身取景，放进 200px 的小角窗时脸只有十几像素；
 *  S-E 那颗角窗要的是「认出这是她」，所以放大到胸口取景。 */
export const PiPCircle: React.FC<{
  frame: number;
  size: number;
  border?: string;
  zoom?: number;
}> = ({ frame, size, border = '4px solid rgba(255,255,255,0.92)', zoom = 1 }) => (
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
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: zoom === 1 ? undefined : `scale(${zoom})`,
        transformOrigin: '50% 32%',
      }}
    />
  </div>
);

/** S-E 用的小角窗（右上） */
export const PiPCorner: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ position: 'absolute', right: 84, top: 70 }}>
    <PiPCircle frame={frame} size={200} zoom={1.75} border="3px solid rgba(255,255,255,0.85)" />
  </div>
);

// 取景到上臂之后，同样的 size 里脸变小了，所以底数从 360 提到 440。
// S-D 的 1.35 倍放大由 Main.tsx 传入。
export const PiP: React.FC<{ frame: number; scale?: number; opacity?: number }> = ({
  frame,
  scale = 1,
  opacity = 1,
}) => {
  const size = 440 * scale;
  return (
    <div style={{ position: 'absolute', right: 48, bottom: 26, opacity }}>
      <PiPCircle frame={frame} size={size} />
    </div>
  );
};
