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
const COLUMNS = [-0.85, 0, 0.85];
const TILE_W = 0.74;
const TILE_D = 1.1;
const BEATS_PER_LEVEL = 32;
const STAR_CHANCE = 0.3;

const column = (seed: number, lane: number, n: number) => Math.floor(random(`col-${seed}-${lane}-${n}`) * 3);
/** Shu plitkada yig'iladigan yulduzcha bormi (har yo'lakda har xil, shuning uchun musobaqa bo'ladi) */
const hasStar = (seed: number, lane: number, n: number) => n > 0 && random(`star-${seed}-${lane}-${n}`) < STAR_CHANCE;
const starsUpTo = (seed: number, lane: number, beat: number) => {
  let count = 0;
  for (let n = 1; n <= beat; n++) if (hasStar(seed, lane, n)) count++;
  return count;
};

const StarShape: React.FC<{ cx: number; cy: number; r: number; fill?: string; rotate?: number; opacity?: number }> = ({
  cx,
  cy,
  r,
  fill = "#FFE600",
  rotate = 0,
  opacity = 1,
}) => {
  const points = new Array(10)
    .fill(0)
    .map((_, i) => {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.45;
      return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
    })
    .join(" ");
  return (
    <polygon
      points={points}
      fill={fill}
      stroke="#000"
      strokeWidth={Math.max(1.5, r * 0.12)}
      strokeLinejoin="round"
      opacity={opacity}
      transform={`rotate(${rotate} ${cx} ${cy})`}
    />
  );
};

/** Har level'da fon almashadi: yulduzli osmon -> neon to'r -> shahar siluetlari */
const Environment: React.FC<{ level: number; color: string; width: number; height: number; horizon: number; index: number; frame: number }> = ({
  level,
  color,
  width,
  height,
  horizon,
  index,
  frame,
}) => {
  const kind = level % 3;
  if (kind === 1) {
    // neon to'r (perspektiva chiziqlari)
    const lines = [];
    for (let i = -6; i <= 6; i++) {
      lines.push(<line key={`v${i}`} x1={width / 2} y1={horizon} x2={width / 2 + i * width * 0.35} y2={height} stroke={color} strokeWidth={1.5} opacity={0.35} />);
    }
    for (let j = 1; j <= 8; j++) {
      const t = ((j + (frame % 30) / 30) / 8) ** 2;
      lines.push(<line key={`h${j}`} x1={0} y1={horizon + t * (height - horizon)} x2={width} y2={horizon + t * (height - horizon)} stroke={color} strokeWidth={1.5} opacity={0.3} />);
    }
    return (
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {lines}
        <circle cx={width / 2} cy={horizon - 20} r={70} fill={color} opacity={0.25} />
      </svg>
    );
  }
  if (kind === 2) {
    // shahar siluetlari va oy
    const buildings = new Array(9).fill(0).map((_, i) => {
      const w = width / 9;
      const h = 40 + random(`b-${index}-${level}-${i}`) * 110;
      return <rect key={i} x={i * w} y={horizon - h} width={w - 3} height={h} fill="#0B0620" stroke={color} strokeWidth={1.5} opacity={0.9} />;
    });
    return (
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <circle cx={width * 0.75} cy={horizon * 0.45} r={34} fill="#FFF6C8" opacity={0.85} />
        {buildings}
      </svg>
    );
  }
  // yulduzli osmon
  return (
    <>
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
    </>
  );
};

const Lane: React.FC<{
  lane: HopLane;
  index: number;
  width: number;
  height: number;
  seed: number;
  bpm: number;
  winner: boolean;
  finale: number;
}> = ({ lane, index, width, height, seed, bpm, winner, finale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const member = memberById(lane.member);
  const beatLen = (fps * 60) / bpm;
  const beatPos = frame / beatLen;
  const beat = Math.floor(beatPos);
  const phase = beatPos - beat;
  // Vertikal Short'da (ingichka baland yo'lak) kamera pastroq va yaqinroq
  const vertical = height > width * 2.5;
  const horizon = height * (vertical ? 0.36 : 0.3);
  const focal = vertical ? 560 : FOCAL;
  const camH = vertical ? (height * 0.86 - horizon) / (focal / PLAYER_Z) : CAM_H;
  const cx = width / 2;
  const level = Math.floor(beat / BEATS_PER_LEVEL);
  const levelStart = level > 0 && beat % BEATS_PER_LEVEL === 0;

  const project = (x: number, z: number) => {
    const s = focal / z;
    return { x: cx + x * s, y: horizon + camH * s, s };
  };

  // Ko'rinadigan plitkalar va ulardagi yulduzchalar
  const tiles: React.ReactNode[] = [];
  const stars: React.ReactNode[] = [];
  for (let n = beat + 16; n >= beat - 1; n--) {
    const z = PLAYER_Z + (n - beatPos) * TILE_SPACING;
    const near = z - TILE_D / 2;
    if (near <= 0.5) continue;
    const far = z + TILE_D / 2;
    const x = COLUMNS[column(seed, index, n)];
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
        key={`t${n}`}
        points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`}
        fill={landed ? `rgba(255,255,255,${0.35 + flash * 0.6})` : `${lane.color}55`}
        stroke={landed ? "#FFFFFF" : lane.color}
        strokeWidth={Math.max(1.5, (4 * (focal / z)) / 150)}
        opacity={fade}
        style={{ filter: `drop-shadow(0 0 ${6 + flash * 18}px ${lane.color})` }}
      />,
    );
    if (hasStar(seed, index, n) && n >= beat) {
      const center = project(x, z);
      const r = 0.22 * center.s;
      if (landed) {
        // yig'ib olindi: kattalashib yo'qoladi
        if (phase < 0.5) {
          stars.push(
            <StarShape key={`s${n}`} cx={center.x} cy={center.y - 0.9 * center.s - phase * 80} r={r * (1 + phase * 2)} opacity={1 - phase * 2} />,
          );
        }
      } else {
        stars.push(
          <StarShape
            key={`s${n}`}
            cx={center.x}
            cy={center.y - 0.5 * center.s - Math.sin(frame / 6 + n) * 0.08 * center.s}
            r={r}
            rotate={(frame * 4 + n * 30) % 360}
            opacity={fade}
          />,
        );
      }
    }
  }

  // Qahramon: hozirgi plitkadan keyingisiga parabola bo'ylab sakraydi
  const fromX = COLUMNS[column(seed, index, beat)];
  const toX = COLUMNS[column(seed, index, beat + 1)];
  const ease = phase < 0.5 ? 2 * phase * phase : 1 - Math.pow(-2 * phase + 2, 2) / 2;
  const worldX = fromX + (toX - fromX) * ease;
  const ground = project(worldX, PLAYER_Z);
  const jump = Math.sin(phase * Math.PI) * height * 0.13;
  const squash = phase < 0.08 ? 1 - (0.08 - phase) * 2.5 : 1;
  const charSize = width * (vertical ? 0.46 : 0.34);
  const nameSize = vertical ? 84 : 54;
  const starCount = starsUpTo(seed, index, Math.max(0, beat));
  const gotStar = hasStar(seed, index, beat) && phase < 0.6;
  const levelPop = levelStart ? Math.exp(-phase * 2) : 0;

  return (
    <div style={{ position: "absolute", left: index * width, top: 0, width, height, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 30%, ${lane.color}66 0%, #0A0418 55%, #05020C 100%)`,
        }}
      />
      <Environment level={level} color={lane.color} width={width} height={height} horizon={horizon} index={index} frame={frame} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {tiles}
        <ellipse cx={ground.x} cy={ground.y + 4} rx={charSize * 0.28 * (1 - jump / (height * 0.3))} ry={10} fill="rgba(0,0,0,0.45)" />
        {stars}
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
      {gotStar ? (
        <div
          style={{
            position: "absolute",
            left: ground.x - 40,
            top: ground.y - charSize * 1.5 - jump - phase * 60,
            width: 80,
            textAlign: "center",
            fontFamily: TITLE_FONT,
            fontSize: 40,
            color: "#FFE600",
            WebkitTextStroke: "4px black",
            paintOrder: "stroke fill",
            opacity: 1 - phase / 0.6,
          }}
        >
          +1
        </div>
      ) : null}

      {/* sarlavha va yulduzlar hisobi */}
      <div
        style={{
          position: "absolute",
          top: vertical ? 30 : 22,
          width: "100%",
          textAlign: "center",
          fontFamily: TITLE_FONT,
          fontSize: nameSize,
          color: lane.color,
          WebkitTextStroke: "5px black",
          paintOrder: "stroke fill",
          textShadow: `0 0 20px ${lane.color}`,
        }}
      >
        {member.name.toUpperCase()}
      </div>
      <div style={{ position: "absolute", top: vertical ? 120 : 88, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, transform: vertical ? "scale(1.5)" : "none" }}>
        <svg width={40} height={40}>
          <StarShape cx={20} cy={21} r={18} />
        </svg>
        <span
          style={{
            fontFamily: TITLE_FONT,
            fontSize: 42,
            color: "white",
            WebkitTextStroke: "4px black",
            paintOrder: "stroke fill",
            transform: `scale(${gotStar ? 1 + (0.6 - phase) * 0.4 : 1})`,
            display: "inline-block",
          }}
        >
          {starCount}
        </span>
      </div>
      {levelPop > 0.05 ? (
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
            opacity: levelPop,
            transform: `scale(${1 + (1 - levelPop) * 0.4})`,
          }}
        >
          LEVEL {level + 1}!
        </div>
      ) : null}

      {/* final: g'olib yo'lak yonadi, qolganlari xiralashadi */}
      {finale > 0 && !winner ? <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", opacity: finale }} /> : null}
      {finale > 0 && winner ? (
        <div style={{ position: "absolute", inset: 0, border: "10px solid #FFE600", boxShadow: "inset 0 0 60px #FFE600", opacity: finale }} />
      ) : null}
      {index > 0 ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#000" }} /> : null}
    </div>
  );
};

export const NeonHop: React.FC<HopProps> = ({ lanes, bpm, seed, music, channelName }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const laneW = width / lanes.length;
  const beatLen = (fps * 60) / bpm;
  const lastBeat = Math.floor((durationInFrames - 1) / beatLen);

  // G'olib: oxirida eng ko'p yulduz yig'gan yo'lak
  const winnerIndex = useMemo(() => {
    const totals = lanes.map((_, i) => starsUpTo(seed, i, lastBeat));
    return totals.indexOf(Math.max(...totals));
  }, [lanes, seed, lastBeat]);

  const finaleStart = durationInFrames - fps * 5;
  const finale = interpolate(frame, [finaleStart, finaleStart + fps * 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const winnerName = memberById(lanes[winnerIndex].member).name.toUpperCase();

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {lanes.map((lane, i) => (
        <Lane key={i} lane={lane} index={i} width={laneW} height={height} seed={seed} bpm={bpm} winner={i === winnerIndex} finale={finale} />
      ))}
      {finale > 0 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: finale }}>
          <div
            style={{
              fontFamily: TITLE_FONT,
              fontSize: 130,
              color: "#FFE600",
              WebkitTextStroke: "10px black",
              paintOrder: "stroke fill",
              textShadow: "0 12px 0 rgba(0,0,0,0.5)",
              transform: `scale(${0.7 + finale * 0.3})`,
            }}
          >
            WINNER: {winnerName}!
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: TITLE_FONT,
              fontSize: 54,
              color: "white",
              WebkitTextStroke: "6px black",
              paintOrder: "stroke fill",
            }}
          >
            WHO DID YOU CHEER FOR? COMMENT!
          </div>
        </AbsoluteFill>
      ) : null}
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
