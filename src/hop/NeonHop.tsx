import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { memberById } from "../crew/characters";
import { CrewSvg } from "../crew/CrewSvg";
import { TITLE_FONT } from "../fonts";
import type { HopLane, HopProps } from "./types";

// Perspektiva: kamera plitkalar yo'lagi ustida, plitkalar uzoqdan yaqinlashib keladi.
const FOCAL = 450;
const CAM_H = 3.9;
const PLAYER_Z = 3;
const TILE_SPACING = 2.4;
const COLUMNS = [-1.35, 0, 1.35];
const TILE_W = 1.05;
const TILE_D = 1.1;

const column = (seed: number, lane: number, n: number) => Math.floor(random(`col-${seed}-${lane}-${n}`) * 3);

const Lane: React.FC<{ lane: HopLane; index: number; width: number; height: number; seed: number; bpm: number }> = ({
  lane,
  index,
  width,
  height,
  seed,
  bpm,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const member = memberById(lane.member);
  const beatLen = (fps * 60) / bpm;
  const beatPos = frame / beatLen;
  const beat = Math.floor(beatPos);
  const phase = beatPos - beat;
  const horizon = height * 0.3;
  const cx = width / 2;

  const project = (x: number, z: number) => {
    const s = FOCAL / z;
    return { x: cx + x * s, y: horizon + CAM_H * s, s };
  };

  // Ko'rinadigan plitkalar: hozirgi zarbdan oldingi 1 tadan keyingi 16 tagacha
  const tiles = [];
  for (let n = beat - 1; n <= beat + 16; n++) {
    const z = PLAYER_Z + (n - beatPos) * TILE_SPACING;
    if (z < 0.9) continue;
    const x = COLUMNS[column(seed, index, n)];
    const near = z - TILE_D / 2;
    const far = z + TILE_D / 2;
    if (near <= 0.5) continue;
    const a = project(x - TILE_W / 2, near);
    const b = project(x + TILE_W / 2, near);
    const c = project(x + TILE_W / 2, far);
    const d = project(x - TILE_W / 2, far);
    const landed = n === beat;
    const flash = landed ? Math.exp(-phase * 6) : 0;
    const fade = interpolate(z, [PLAYER_Z + 6 * TILE_SPACING, PLAYER_Z + 14 * TILE_SPACING], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    tiles.push(
      <polygon
        key={n}
        points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`}
        fill={landed ? `rgba(255,255,255,${0.35 + flash * 0.6})` : `${lane.color}55`}
        stroke={landed ? "#FFFFFF" : lane.color}
        strokeWidth={Math.max(1.5, 4 * (FOCAL / z) / 150)}
        opacity={fade}
        style={{ filter: `drop-shadow(0 0 ${6 + flash * 18}px ${lane.color})` }}
      />,
    );
  }

  // Qahramon: hozirgi plitkadan keyingisiga parabola bo'ylab sakraydi
  const fromX = COLUMNS[column(seed, index, beat)];
  const toX = COLUMNS[column(seed, index, beat + 1)];
  const ease = phase < 0.5 ? 2 * phase * phase : 1 - Math.pow(-2 * phase + 2, 2) / 2;
  const worldX = fromX + (toX - fromX) * ease;
  const ground = project(worldX, PLAYER_Z);
  const jump = Math.sin(phase * Math.PI) * height * 0.13;
  const squash = phase < 0.08 ? 1 - (0.08 - phase) * 2.5 : 1;
  const charSize = width * 0.34;
  const score = Math.max(0, beat);
  const levelUp = beat > 0 && beat % 32 === 0 ? Math.exp(-phase * 2) : 0;

  return (
    <div style={{ position: "absolute", left: index * width, top: 0, width, height, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 30%, ${lane.color}66 0%, #0A0418 55%, #05020C 100%)`,
        }}
      />
      {/* uzoqdagi yulduzlar */}
      {new Array(18).fill(0).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: random(`sx-${index}-${i}`) * width,
            top: random(`sy-${index}-${i}`) * horizon * 0.9,
            width: 3,
            height: 3,
            borderRadius: 2,
            background: "white",
            opacity: 0.3 + 0.7 * Math.abs(Math.sin(frame / 20 + i)),
          }}
        />
      ))}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {tiles.reverse()}
        <ellipse cx={ground.x} cy={ground.y + 4} rx={charSize * 0.28 * (1 - jump / (height * 0.3))} ry={10} fill="rgba(0,0,0,0.45)" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: ground.x - charSize / 2,
          top: ground.y - charSize * 1.3 - jump,
          transform: `scale(${2 - squash}, ${squash})`,
          transformOrigin: "50% 100%",
          filter: `drop-shadow(0 0 18px ${lane.color})`,
        }}
      >
        <CrewSvg member={member} size={charSize} mouthOpen={phase < 0.3 ? 1 - phase * 3 : 0} />
      </div>
      {/* sarlavha va hisob */}
      <div
        style={{
          position: "absolute",
          top: 22,
          width: "100%",
          textAlign: "center",
          fontFamily: TITLE_FONT,
          fontSize: 54,
          color: lane.color,
          WebkitTextStroke: "5px black",
          paintOrder: "stroke fill",
          textShadow: `0 0 20px ${lane.color}`,
        }}
      >
        {member.name.toUpperCase()}
      </div>
      <div
        style={{
          position: "absolute",
          top: 90,
          width: "100%",
          textAlign: "center",
          fontFamily: TITLE_FONT,
          fontSize: 40,
          color: "white",
          WebkitTextStroke: "4px black",
          paintOrder: "stroke fill",
        }}
      >
        {score}
      </div>
      {levelUp > 0.05 ? (
        <div
          style={{
            position: "absolute",
            top: height * 0.42,
            width: "100%",
            textAlign: "center",
            fontFamily: TITLE_FONT,
            fontSize: 60,
            color: "#FFE600",
            WebkitTextStroke: "5px black",
            paintOrder: "stroke fill",
            opacity: levelUp,
            transform: `scale(${1 + (1 - levelUp) * 0.4})`,
          }}
        >
          LEVEL {beat / 32 + 1}!
        </div>
      ) : null}
      {index > 0 ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#000" }} /> : null}
    </div>
  );
};

export const NeonHop: React.FC<HopProps> = ({ lanes, bpm, seed, music, channelName }) => {
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const laneW = width / lanes.length;
  const content = useMemo(() => lanes, [lanes]);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {content.map((lane, i) => (
        <Lane key={i} lane={lane} index={i} width={laneW} height={height} seed={seed} bpm={bpm} />
      ))}
      <div
        style={{
          position: "absolute",
          right: 24,
          bottom: 18,
          fontFamily: TITLE_FONT,
          fontSize: 30,
          color: "rgba(255,255,255,0.8)",
          WebkitTextStroke: "3px black",
          paintOrder: "stroke fill",
        }}
      >
        {channelName}
      </div>
      {music ? (
        <Audio
          src={staticFile(music)}
          volume={(f) =>
            interpolate(f, [0, fps * 0.5, durationInFrames - fps * 2, durationInFrames], [0, 0.95, 0.95, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
