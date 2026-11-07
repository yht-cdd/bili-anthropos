import React from 'react';
import { Composition } from 'remotion';
import { AgentPromo } from './Main';
import { FPS, H, TOTAL_FRAMES, W } from './theme';

// 60.0s * 30fps = 1800 帧 · 1920x1080 横版（brief v2.1 §二 成片规格）
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AnthroposVideo"
        component={AgentPromo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  );
};
