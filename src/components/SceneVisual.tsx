import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TITLE_FONT } from "../fonts";
import type { SceneProps } from "../types";
import { Background } from "./Background";
import { mascotFace, MascotSvg } from "./Mascot";

const KenBurns: React.FC<{ src: string; index: number }> = ({ src, index }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames - 1);
  const mode = index % 4;
  const scale = mode === 1 ? interpolate(progress, [0, 1], [1.2, 1.05]) : interpolate(progress, [0, 1], [1.05, 1.2]);
  const shift = mode === 2 ? interpolate(progress, [0, 1], [-3, 3]) : mode === 3 ? interpolate(progress, [0, 1], [3, -3]) : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${shift}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const CharacterStage: React.FC<{ src: string; index: number }> = ({ src, index }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 9, stiffness: 120 } });
  const bob = Math.sin(frame / 6) * 12; // musiqa ritmiga o'xshash tebranish
  const squash = 1 + Math.sin(frame / 3) * 0.015;
  const vertical = height > width;
  const size = vertical ? height * 0.52 : height * 0.78;

  return (
    <AbsoluteFill>
      <Background seed={index} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: vertical ? height * 0.08 : 0 }}>
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            position: "absolute",
            background: "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 65%)",
            transform: `scale(${0.6 + enter * 0.6})`,
          }}
        />
        <Img
          src={staticFile(src)}
          style={{
            height: size,
            width: "auto",
            maxWidth: width * 0.9,
            objectFit: "contain",
            transform: `translateY(${(1 - enter) * height * 0.6 + bob}px) scale(${enter}, ${enter * squash})`,
            filter: "drop-shadow(0 25px 35px rgba(0,0,0,0.5))",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const NameCard: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 10 } });
  return (
    <AbsoluteFill>
      <Background seed={index} />
      {text ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div
            style={{
              fontFamily: TITLE_FONT,
              fontSize: width * 0.1,
              color: "white",
              textAlign: "center",
              transform: `scale(${pop}) rotate(${Math.sin(frame / 10) * 3}deg)`,
              WebkitTextStroke: `${width * 0.006}px black`,
              textShadow: "0 10px 0 rgba(0,0,0,0.35)",
              padding: "0 6%",
            }}
          >
            {text.toUpperCase()}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/** Rasm yo'q sahna: Coree markazda katta bo'lib gapiradi */
const HostShot: React.FC<{ scene: SceneProps; index: number }> = ({ scene, index }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const { talking, mouthOpen, blink } = mascotFace(scene.words, frame, fps);
  const enter = spring({ frame, fps, config: { damping: 11 } });
  const size = vertical ? width * 0.62 : height * 0.6;
  const bob = Math.sin(frame / 7) * (talking ? 14 : 7);
  const side = index % 2 === 0 ? -1 : 1;

  return (
    <AbsoluteFill>
      <Background seed={index} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: vertical ? height * 0.12 : height * 0.1 }}>
        <div
          style={{
            width: size * 1.25,
            height: size * 1.25,
            borderRadius: "50%",
            position: "absolute",
            background: "radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 65%)",
          }}
        />
        <div
          style={{
            transform: `translateY(${(1 - enter) * height * 0.5 + bob}px) rotate(${side * (4 + Math.sin(frame / 12) * 3)}deg) scale(${0.85 + enter * 0.15})`,
            filter: "drop-shadow(0 25px 35px rgba(0,0,0,0.45))",
          }}
        >
          <MascotSvg mouthOpen={mouthOpen} blink={blink} size={size} look={Math.sin(frame / 30) * side} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Rasm ham, personaj nomi ham bo'lmasa (va maskot yoqilgan bo'lsa) markazda Coree chiqadi */
export const isHostShot = (scene: SceneProps, host: boolean): boolean =>
  host && !scene.image && !scene.character.trim();

export const SceneVisual: React.FC<{ scene: SceneProps; index: number; host: boolean }> = ({ scene, index, host }) => {
  if (isHostShot(scene, host)) {
    return <HostShot scene={scene} index={index} />;
  }
  if (scene.image && scene.imageKind === "character") {
    return <CharacterStage src={scene.image} index={index} />;
  }
  if (scene.image && scene.imageKind === "photo") {
    return <KenBurns src={scene.image} index={index} />;
  }
  return <NameCard text={scene.character} index={index} />;
};
