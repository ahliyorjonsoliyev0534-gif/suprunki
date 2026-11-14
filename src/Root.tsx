import React from "react";
import { CalculateMetadataFunction, Composition, Still } from "remotion";
import { SprunkiVideo } from "./SprunkiVideo";
import { Thumbnail } from "./Thumbnail";
import { FPS, SIZES, type VideoProps } from "./types";

// Studio'da (npm run dev) ochilganda ko'rinadigan namuna
const demo: VideoProps = {
  format: "short",
  channelName: "SprunkiCoreee",
  title: "Demo",
  thumbnailText: "SECRET OF OREN",
  music: null,
  musicVolume: 0.1,
  host: true,
  scenes: [
    {
      audio: null,
      durationInFrames: 90,
      image: null,
      imageKind: "none",
      character: "Oren",
      words: "Did you know Oren has a hidden secret".split(" ").map((text, i) => ({
        text,
        startMs: i * 320,
        endMs: i * 320 + 280,
      })),
    },
    {
      audio: null,
      durationInFrames: 75,
      image: null,
      imageKind: "none",
      character: "Raddy",
      words: "Which Sprunki is your favorite?".split(" ").map((text, i) => ({
        text,
        startMs: i * 320,
        endMs: i * 320 + 280,
      })),
    },
  ],
};

const metadata: CalculateMetadataFunction<VideoProps> = ({ props }) => {
  const size = SIZES[props.format];
  return {
    ...size,
    fps: FPS,
    durationInFrames: Math.max(1, props.scenes.reduce((sum, s) => sum + s.durationInFrames, 0)),
  };
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="SprunkiVideo"
      component={SprunkiVideo}
      defaultProps={demo}
      calculateMetadata={metadata}
      durationInFrames={165}
      fps={FPS}
      width={1080}
      height={1920}
    />
    <Still id="Thumbnail" component={Thumbnail} defaultProps={{ ...demo, format: "long" }} width={1280} height={720} />
  </>
);
