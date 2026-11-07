import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
import { FPS, H, TOTAL, W } from './theme';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="AnthroposVideo"
    component={Main}
    durationInFrames={TOTAL}
    fps={FPS}
    width={W}
    height={H}
  />
);
