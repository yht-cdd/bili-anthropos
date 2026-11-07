import React from 'react';
import { Composition } from 'remotion';
import { MotionKitDemo } from './Demo';
import { FPS, H, TOTAL_FRAMES, W } from './theme';

// 10.0s * 30fps = 300 帧 · 1920x1080 横版（12.-1 画幅铁律）
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MotionKitDemo"
      component={MotionKitDemo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={W}
      height={H}
    />
  );
};
