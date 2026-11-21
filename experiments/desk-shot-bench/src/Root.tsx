import React from 'react';
import {Composition} from 'remotion';
import {DeskShot} from './DeskShot';

export const Root: React.FC = () => (
  <Composition
    id="DeskShot"
    component={DeskShot}
    durationInFrames={660}
    fps={30}
    width={1920}
    height={1080}
  />
);
