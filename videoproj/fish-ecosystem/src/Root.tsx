import React from 'react';
import { Composition } from 'remotion';
import { FishEcosystem } from './Main';

// 80s * 30fps = 2400 帧 (brief: 目标总长 78-82s)
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AnthroposVideo"
        component={FishEcosystem}
        durationInFrames={2400}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
