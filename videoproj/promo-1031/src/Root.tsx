import React from "react";
import { Composition } from "remotion";
import { AnthroposVideo } from "./AnthroposVideo";
import { FPS, H, TOTAL_FRAMES, W } from "./theme";

/**
 * 唯一一条合成：AnthroposVideo
 * 1920×1080（16:9 横屏）/ 30fps / 5400 帧（180.0 秒）
 * 宽高全部从 theme 取，改画布只改 theme.ts 一处。
 */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="AnthroposVideo"
    component={AnthroposVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={W}
    height={H}
  />
);
