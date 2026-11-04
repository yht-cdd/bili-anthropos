import React from 'react';
import { Composition } from 'remotion';
import { V3Film } from './Main';
import { FPS, H, TOTAL_FRAMES, W } from './theme';

// 1920x1080 横版 @30fps · 62.0s = 1860 帧 · id=AnthroposVideo（对齐 CI 渲染入口）
export const RemotionRoot: React.FC = () => (
  <Composition
    id="AnthroposVideo"
    component={V3Film}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={W}
    height={H}
  />
);
