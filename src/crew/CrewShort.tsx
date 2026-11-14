import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "../components/Background";
import { TITLE_FONT } from "../fonts";
import { CREW, memberById, PARTY_COLORS } from "./characters";
import { CrewSvg } from "./CrewSvg";
import { CREW_BEATS, type CrewProps } from "./types";

export { CREW_BEATS, type CrewProps, type CrewStyle } from "./types";

const useBeat = (bpm: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatLen = (fps * 60) / bpm;
  const index = Math.floor(frame / beatLen);
  const phase = (frame % beatLen) / beatLen;
  return { frame, fps, beatLen, index, phase, bump: Math.exp(-phase * 5) };
};

const Title: React.FC<{ text: string; top: number; color?: string; size?: number }> = ({ text, top, color = "#FFE600", size }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9 } });
  return (
    <div
      style={{
        position: "absolute",
        top,
        width: "100%",
        textAlign: "center",
        fontFamily: TITLE_FONT,
        fontSize: size ?? width * 0.1,
        color,
        WebkitTextStroke: `${width * 0.009}px black`,
        paintOrder: "stroke fill",
        textShadow: "0 10px 0 rgba(0,0,0,0.45)",
        transform: `scale(${pop}) rotate(${Math.sin(frame / 9) * 2}deg)`,
      }}
    >
      {text}
    </div>
  );
};

// ------------------------------------------------------------------ 1. COLOR PARTY
const Party: React.FC<CrewProps> = ({ featured, members, bpm, seed }) => {
  const { frame, beatLen, index, bump } = useBeat(bpm);
  const { width, height } = useVideoConfig();
  const star = memberById(featured);
  const cols = 5;
  const rows = 3;
  const cell = width / cols;
  const gridTop = height * 0.42;
  const cellH = (height * 0.54) / rows;
  const charSize = cell * 0.86;

  return (
    <AbsoluteFill>
      <Background seed={seed} />
      <Title text="COLOR PARTY!" top={height * 0.035} />
      <div style={{ position: "absolute", top: height * 0.13, width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ transform: `translateY(${-bump * 30}px) scale(${1 + bump * 0.05}, ${1 - bump * 0.05})`, transformOrigin: "50% 100%" }}>
          <CrewSvg member={star} size={width * 0.3} mouthOpen={bump} blink={frame % 90 < 3 ? 1 : 0} />
        </div>
      </div>
      {new Array(cols * rows).fill(0).map((_, i) => {
        const flipBeat = i + 1;
        const flipStart = flipBeat * beatLen;
        const t = (frame - flipStart) / 6; // 6 kadrda aylanadi
        const flipped = t >= 0.5;
        const scaleX = t >= 0 && t <= 1 ? Math.abs(Math.cos(t * Math.PI)) : 1;
        const member = flipped ? star : memberById(members[i % members.length]);
        const color = flipped ? PARTY_COLORS[i % PARTY_COLORS.length] : undefined;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const dance = Math.sin((frame / beatLen) * Math.PI * 2 + i) * 6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: col * cell + (cell - charSize) / 2,
              top: gridTop + row * cellH + (cellH - charSize * 1.3) / 2,
              transform: `translateY(${dance}px) scaleX(${scaleX}) scale(${flipped && index === flipBeat ? 1 + bump * 0.15 : 1})`,
            }}
          >
            <CrewSvg member={member} size={charSize} colorOverride={color} mouthOpen={flipped ? bump * 0.8 : 0} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 2. NORMAL vs HORROR
const Lightning: React.FC<{ x: number; seed: number }> = ({ x, seed }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const tick = Math.floor(frame / 3);
  const points = new Array(18).fill(0).map((_, i) => {
    const y = (i / 17) * height;
    const dx = (random(`l-${seed}-${tick}-${i}`) - 0.5) * 70;
    return `${x + dx},${y}`;
  });
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <polyline points={points.join(" ")} fill="none" stroke="#7FE8FF" strokeWidth={22} opacity={0.35} style={{ filter: "blur(10px)" }} />
      <polyline points={points.join(" ")} fill="none" stroke="#E8FBFF" strokeWidth={7} />
    </svg>
  );
};

const Horror: React.FC<CrewProps> = ({ members, bpm, seed }) => {
  const { frame, index, bump } = useBeat(bpm);
  const { width, height } = useVideoConfig();
  const member = memberById(members[Math.floor(index / 4) % members.length]);
  const size = width * 0.36;
  const shake = (random(`s-${seed}-${frame}`) - 0.5) * 14 * bump;
  const panel = (side: "left" | "right") => {
    const horror = side === "right";
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: horror ? width / 2 : 0,
          width: width / 2,
          background: horror
            ? "radial-gradient(circle at 50% 55%, #5A0010 0%, #120004 70%)"
            : "radial-gradient(circle at 50% 55%, #0E5A2A 0%, #02140A 70%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div style={{ transform: `translateX(${horror ? shake : 0}px) translateY(${-bump * 20}px)` }}>
          <CrewSvg member={member} size={size} look={horror ? "horror" : "normal"} mouthOpen={horror ? 0 : bump} />
        </div>
        <div
          style={{
            position: "absolute",
            top: height * 0.2,
            fontFamily: TITLE_FONT,
            fontSize: width * 0.075,
            color: horror ? "#FF2E2E" : "#7CFF7C",
            textShadow: `0 0 25px ${horror ? "#FF2E2E" : "#7CFF7C"}`,
          }}
        >
          {horror ? "HORROR" : "NORMAL"}
        </div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {panel("left")}
      {panel("right")}
      <Lightning x={width / 2} seed={seed} />
      <div
        style={{
          position: "absolute",
          bottom: height * 0.16,
          width: "100%",
          textAlign: "center",
          fontFamily: TITLE_FONT,
          fontSize: width * 0.09,
          color: "white",
          WebkitTextStroke: `${width * 0.006}px black`,
          paintOrder: "stroke fill",
        }}
      >
        {member.name.toUpperCase()}
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 3. PICK ONE
const Confetti: React.FC<{ start: number; seed: number }> = ({ start, seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame - start;
  if (t < 0) return null;
  return (
    <AbsoluteFill>
      {new Array(60).fill(0).map((_, i) => {
        const x = random(`cx-${seed}-${i}`) * width;
        const speed = 8 + random(`cs-${seed}-${i}`) * 14;
        const y = -50 + t * speed;
        const rot = t * (5 + i);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.sin(t / 8 + i) * 30,
              top: y % (height + 100),
              width: 22,
              height: 34,
              background: PARTY_COLORS[i % PARTY_COLORS.length],
              transform: `rotate(${rot}deg)`,
              borderRadius: 4,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Pick: React.FC<CrewProps> = ({ members, bpm, seed, pickIndex }) => {
  const { frame, beatLen, index, bump } = useBeat(bpm);
  const { width, height } = useVideoConfig();
  const options = members.slice(0, 3).map(memberById);
  const revealBeat = 9;
  const revealed = index >= revealBeat;
  const hover = index < 6 ? index % 3 : -1;
  const countdown = index >= 6 && index < revealBeat ? 3 - (index - 6) : null;
  const cardW = width * 0.3;

  return (
    <AbsoluteFill>
      <Background seed={seed + 2} />
      <Title text={revealed ? "GOOD CHOICE!" : "PICK ONE!"} top={height * 0.06} />
      <div
        style={{
          position: "absolute",
          top: height * 0.3,
          width: "100%",
          display: "flex",
          justifyContent: "space-evenly",
        }}
      >
        {options.map((m, i) => {
          const chosen = revealed && i === pickIndex;
          const lost = revealed && i !== pickIndex;
          const active = hover === i || chosen;
          return (
            <div
              key={m.id}
              style={{
                width: cardW,
                height: cardW * 1.75,
                borderRadius: 36,
                background: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                border: `10px solid ${chosen ? "#7CFF4F" : active ? "#FFE600" : "rgba(0,0,0,0.25)"}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${active ? 1.06 + (chosen ? bump * 0.06 : 0) : 0.94})`,
                position: "relative",
              }}
            >
              <div style={{ filter: lost ? "grayscale(1) brightness(0.7)" : "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <CrewSvg member={m} size={cardW * 0.78} mouthOpen={active ? bump : 0} mood={lost ? "flat" : "smile"} />
                <div style={{ fontFamily: TITLE_FONT, fontSize: width * 0.05, color: "#222", marginTop: 8 }}>{m.name}</div>
              </div>
              {lost ? (
                <div style={{ position: "absolute", fontSize: cardW * 0.9, color: "#FF2E2E", fontFamily: TITLE_FONT, lineHeight: 1, WebkitTextStroke: "8px black", paintOrder: "stroke fill" }}>X</div>
              ) : null}
            </div>
          );
        })}
      </div>
      {countdown ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div
            style={{
              fontFamily: TITLE_FONT,
              fontSize: width * 0.5,
              color: "white",
              WebkitTextStroke: `${width * 0.012}px black`,
              paintOrder: "stroke fill",
              transform: `scale(${0.6 + bump * 0.6})`,
              opacity: 0.95,
            }}
          >
            {countdown}
          </div>
        </AbsoluteFill>
      ) : null}
      <Confetti start={Math.round(revealBeat * beatLen)} seed={seed} />
      <div
        style={{
          position: "absolute",
          bottom: height * 0.12,
          width: "100%",
          textAlign: "center",
          fontFamily: TITLE_FONT,
          fontSize: width * 0.065,
          color: "white",
          WebkitTextStroke: `${width * 0.006}px black`,
          paintOrder: "stroke fill",
          padding: "0 6%",
          opacity: interpolate(frame, [revealBeat * beatLen, revealBeat * beatLen + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        WHO DID YOU PICK? COMMENT!
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ root
export const CrewShort: React.FC<CrewProps> = (props) => {
  const { durationInFrames, fps } = useVideoConfig();
  const content = useMemo(() => {
    if (props.style === "horror") return <Horror {...props} />;
    if (props.style === "pick") return <Pick {...props} />;
    return <Party {...props} />;
  }, [props]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {content}
      {props.music ? (
        <Audio
          src={staticFile(props.music)}
          loop
          volume={(f) =>
            props.musicVolume *
            interpolate(f, [0, 3, durationInFrames - fps * 0.3, durationInFrames], [0, 1, 1, 0.6], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const crewDemo: CrewProps = {
  style: "party",
  featured: "coree",
  members: CREW.map((m) => m.id),
  bpm: 110,
  seed: 1,
  music: null,
  musicVolume: 0.9,
  channelName: "SprunkiCoreee",
  durationInFrames: Math.ceil(((CREW_BEATS.party * 60) / 110) * 30),
  pickIndex: 1,
};
