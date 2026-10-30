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
  segments: [],
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
      // 时长：有配音时间轴就按时间轴，没有就按 seconds
      calculateMetadata={({ props }) => {
        const segs = props.segments || [];
        const total = segs.length ? segs[segs.length - 1].to : Number(props.seconds ?? 15);
        return { durationInFrames: Math.round(FPS * Math.max(3, total)) };
      }}
    />
  );
};
