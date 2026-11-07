import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Main';
import { FPS, H, TOTAL_FRAMES, W } from './theme';

// 1920x1080 横版 @30fps · 60.0s = 1800 帧 · id=AnthroposVideo（brief §一）
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
