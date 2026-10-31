import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, sceneTransition } from "../theme";

/**
 * 场景外壳。
 *
 * 只干一件事：把 theme.sceneTransition() 的结果套到画面上 ——
 * 进场「从 +80px 压入」，出场「上移 −80px 淡出」，交叠由 SceneShell 之间的
 * Sequence 尾巴（M.overlap 帧）保证。
 *
 * 场景自己只管内容，不用重复写位移，也不允许用纯 opacity 交叉溶解。
 *
 * length：本场在时间轴上占的帧数（含交叠尾巴），由调用方传入。
 */
export const SceneShell: React.FC<{
  length: number;
  children?: React.ReactNode;
}> = ({ length, children }) => {
  const frame = useCurrentFrame();

  // 兜底：帧不在范围内就不渲染（正常情况由 <Sequence> 已经裁好）
  if (frame < 0 || frame >= length) return null;

  const t = sceneTransition(frame, length);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        opacity: t.opacity,
        transform: `translateY(${t.translateY}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
