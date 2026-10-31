import React from "react";
import { Composition } from "remotion";
import { Demo } from "./Demo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="AnthroposVideo" component={Demo} durationInFrames={450} fps={30} width={1080} height={1920} />
    </>
  );
};
