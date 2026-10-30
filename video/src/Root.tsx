import React from "react";
import { Composition } from "remotion";
import { AnthroposVideo, type VideoProps } from "./AnthroposVideo";

const FPS = 30;

const defaultProps: VideoProps = {
  title: "她第一次自己剪了一条视频",
  subtitle: "整条线没有我动手",
  kicker: "ANTHROPOS",
  accent: "#FF6B6B",
  seconds: 15,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AnthroposVideo"
      component={AnthroposVideo}
      durationInFrames={FPS * (defaultProps.seconds ?? 15)}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
      // 时长由参数决定，不让调用方去算帧数
      calculateMetadata={({ props }) => ({
        durationInFrames: FPS * Math.max(3, Number(props.seconds ?? 15)),
      })}
    />
  );
};
