import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Main';
import { FPS, H, TOTAL_FRAMES, W } from './theme';

// 1920x1080 横版 @30fps · 66.0s = 1980 帧（附录 D2）· id=AnthroposVideo（对齐 CI 渲染入口）
export const RemotionRoot: React.FC = () => (
  <Composition
    id="AnthroposVideo"
    component={Film}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={W}
    height={H}
  />
);
