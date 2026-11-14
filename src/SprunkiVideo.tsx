import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Captions } from "./components/Captions";
import { SceneVisual } from "./components/SceneVisual";
import type { SceneProps, VideoProps } from "./types";

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6], [0.55, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ backgroundColor: "white", opacity }} />;
};

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: width * 0.012,
          width: `${(frame / durationInFrames) * 100}%`,
          background: "linear-gradient(90deg, #FFE600, #FF2E93)",
        }}
      />
    </AbsoluteFill>
  );
};

const Scene: React.FC<{ scene: SceneProps; index: number }> = ({ scene, index }) => (
  <AbsoluteFill>
    <SceneVisual scene={scene} index={index} />
    <Captions words={scene.words} />
    {index > 0 ? <Flash /> : null}
    {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
  </AbsoluteFill>
);

export const SprunkiVideo: React.FC<VideoProps> = ({ scenes, music, musicVolume, format }) => {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Series>
        {scenes.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={scene.durationInFrames}>
            <Scene scene={scene} index={i} />
          </Series.Sequence>
        ))}
      </Series>
      {format === "short" ? <ProgressBar /> : null}
      {music ? (
        <Audio
          src={staticFile(music)}
          loop
          volume={(f) =>
            musicVolume *
            interpolate(f, [0, fps, durationInFrames - fps * 2, durationInFrames], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
