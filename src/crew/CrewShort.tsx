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

// ------------------------------------------------------------------ 4. GUESS THE SHADOW
const BigCountdown: React.FC<{ value: number | null; bump: number }> = ({ value, bump }) => {
  const { width } = useVideoConfig();
  if (!value) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: TITLE_FONT,
          fontSize: width * 0.42,
          color: "white",
          WebkitTextStroke: `${width * 0.012}px black`,
          paintOrder: "stroke fill",
          transform: `scale(${0.6 + bump * 0.6})`,
          opacity: 0.95,
        }}
      >
        {value}
      </div>
    </AbsoluteFill>
  );
};

const BottomText: React.FC<{ text: string; from: number }> = ({ text, from }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        bottom: height * 0.08,
        width: "100%",
        textAlign: "center",
        fontFamily: TITLE_FONT,
        fontSize: width * 0.062,
        color: "white",
        WebkitTextStroke: `${width * 0.006}px black`,
        paintOrder: "stroke fill",
        padding: "0 6%",
        opacity: interpolate(frame, [from, from + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      {text}
    </div>
  );
};

const Shadow: React.FC<CrewProps> = ({ featured, members, bpm, seed, pickIndex }) => {
  const { frame, beatLen, index, bump } = useBeat(bpm);
  const { width, height, fps } = useVideoConfig();
  const answer = memberById(featured);
  const decoys = members.filter((id) => id !== featured).slice(0, 2).map(memberById);
  const options = [...decoys];
  options.splice(pickIndex % 3, 0, answer);
  const revealBeat = 9;
  const revealFrame = Math.round(revealBeat * beatLen);
  const revealed = index >= revealBeat;
  const hover = index < 6 ? index % 3 : -1;
  const countdown = index >= 6 && index < revealBeat ? 3 - (index - 6) : null;
  const pop = revealed ? spring({ frame: frame - revealFrame, fps, config: { damping: 8 } }) : 0;
  const bigSize = width * 0.46;
  const cardW = width * 0.28;

  return (
    <AbsoluteFill>
      <Background seed={seed + 5} />
      <Title text={revealed ? `IT'S ${answer.name.toUpperCase()}!` : "GUESS THE SHADOW!"} top={height * 0.04} size={width * 0.085} />
      <div style={{ position: "absolute", top: height * 0.13, width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: bigSize * 1.15,
            height: bigSize * 1.35,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.15) 70%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `translateY(${-bump * 18}px) scale(${1 + pop * 0.08})`,
          }}
        >
          <div style={{ filter: revealed ? "none" : "brightness(0)" }}>
            <CrewSvg member={answer} size={bigSize} mouthOpen={revealed ? bump : 0} mood={revealed ? "smile" : "flat"} />
          </div>
        </div>
      </div>
      {!revealed ? (
        <div
          style={{
            position: "absolute",
            top: height * 0.13 + bigSize * 0.5,
            width: "100%",
            textAlign: "center",
            fontFamily: TITLE_FONT,
            fontSize: width * 0.22,
            color: "#FFE600",
            WebkitTextStroke: `${width * 0.01}px black`,
            paintOrder: "stroke fill",
            transform: `scale(${1 + bump * 0.12})`,
          }}
        >
          ?
        </div>
      ) : null}
      <div style={{ position: "absolute", top: height * 0.6, width: "100%", display: "flex", justifyContent: "space-evenly" }}>
        {options.map((m, i) => {
          const correct = i === pickIndex % 3;
          const lost = revealed && !correct;
          const active = hover === i || (revealed && correct);
          return (
            <div
              key={m.id}
              style={{
                width: cardW,
                height: cardW * 1.5,
                borderRadius: 32,
                background: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)",
                border: `9px solid ${revealed && correct ? "#7CFF4F" : active ? "#FFE600" : "rgba(0,0,0,0.25)"}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${active ? 1.06 + (revealed && correct ? bump * 0.06 : 0) : 0.94})`,
                position: "relative",
              }}
            >
              <div style={{ filter: lost ? "grayscale(1) brightness(0.7)" : "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <CrewSvg member={m} size={cardW * 0.72} mouthOpen={active ? bump : 0} mood={lost ? "flat" : "smile"} />
                <div style={{ fontFamily: TITLE_FONT, fontSize: width * 0.045, color: "#222", marginTop: 6 }}>{m.name}</div>
              </div>
              {lost ? (
                <div style={{ position: "absolute", fontSize: cardW * 0.85, color: "#FF2E2E", fontFamily: TITLE_FONT, lineHeight: 1, WebkitTextStroke: "8px black", paintOrder: "stroke fill" }}>X</div>
              ) : null}
            </div>
          );
        })}
      </div>
      <BigCountdown value={countdown} bump={bump} />
      <Confetti start={revealFrame} seed={seed} />
      <BottomText text="DID YOU GUESS RIGHT? COMMENT!" from={revealFrame} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 5. FIND THE ODD ONE
const Odd: React.FC<CrewProps> = ({ featured, bpm, seed }) => {
  const { frame, beatLen, index, bump } = useBeat(bpm);
  const { width, height, fps } = useVideoConfig();
  const star = memberById(featured);
  const cols = 4;
  const rows = 4;
  const total = cols * rows;
  const oddCell = seed % total;
  // Boshqacha qahramonning rangi asl rangdan sezilarli farq qilishi kerak
  const hue = (hex: string) => {
    const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === min) return 0;
    const d = max - min;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const far = PARTY_COLORS.filter((c) => {
    const diff = Math.abs(hue(c) - hue(star.color));
    return Math.min(diff, 360 - diff) > 60;
  });
  const pool = far.length ? far : PARTY_COLORS;
  const oddColor = pool[seed % pool.length];
  const revealBeat = 10;
  const revealFrame = Math.round(revealBeat * beatLen);
  const revealed = index >= revealBeat;
  const countdown = index >= 7 && index < revealBeat ? 3 - (index - 7) : null;
  const gridTop = height * 0.2;
  const cell = width / cols;
  const cellH = (height * 0.62) / rows;
  const charSize = Math.min(cell, cellH) * 0.82;
  const ring = revealed ? spring({ frame: frame - revealFrame, fps, config: { damping: 10 } }) : 0;

  return (
    <AbsoluteFill>
      <Background seed={seed + 9} />
      <Title text={revealed ? "FOUND IT!" : "FIND THE ODD ONE!"} top={height * 0.04} size={width * 0.09} />
      {new Array(total).fill(0).map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const isOdd = i === oddCell;
        const dance = Math.sin((frame / beatLen) * Math.PI * 2 + i * 0.7) * 5;
        const cx = col * cell + cell / 2;
        const cy = gridTop + row * cellH + cellH / 2;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: cx - charSize / 2,
                top: cy - charSize * 0.65,
                transform: `translateY(${dance}px) scale(${revealed && isOdd ? 1 + ring * 0.25 : 1})`,
                filter: revealed && !isOdd ? "grayscale(0.8) brightness(0.55)" : "none",
              }}
            >
              <CrewSvg member={star} size={charSize} colorOverride={isOdd ? oddColor : undefined} mouthOpen={bump * 0.5} blink={(frame + i * 7) % 80 < 3 ? 1 : 0} />
            </div>
            {revealed && isOdd ? (
              <div
                style={{
                  position: "absolute",
                  left: cx - charSize * 0.75,
                  top: cy - charSize * 0.8,
                  width: charSize * 1.5,
                  height: charSize * 1.6,
                  borderRadius: "50%",
                  border: `${width * 0.014}px solid #FF2E2E`,
                  boxShadow: "0 0 30px #FF2E2E",
                  transform: `scale(${ring})`,
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
      <BigCountdown value={countdown} bump={bump} />
      <Confetti start={revealFrame} seed={seed} />
      <BottomText text="DID YOU FIND IT? COMMENT YOUR TIME!" from={revealFrame} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 6. BUILD THE BAND
export const BAND_SIZE = 6;
/** Qahramon har 2 zarbda bittadan qo'shiladi: 1-zarbdan boshlab */
const bandJoined = (index: number) => Math.max(0, Math.min(BAND_SIZE, Math.floor((index + 1) / 2)));

const Band: React.FC<CrewProps> = ({ members, bpm, seed }) => {
  const { frame, beatLen, index, bump } = useBeat(bpm);
  const { width, height, fps } = useVideoConfig();
  const band = members.slice(0, BAND_SIZE).map(memberById);
  const joined = bandJoined(index);
  const full = joined >= BAND_SIZE;
  const fullFrame = Math.round((BAND_SIZE * 2 - 1) * beatLen);
  const cols = 3;
  const slotW = width / cols;
  const charSize = slotW * 0.8;
  const rowY = [height * 0.3, height * 0.56];

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 20%, #3B1D6E 0%, #12061F 70%)" }} />
      {/* sahna chiroqlari */}
      {new Array(5).fill(0).map((_, i) => {
        const angle = Math.sin(frame / 20 + i * 1.3) * 18;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: -height * 0.05,
              left: (i + 0.5) * (width / 5) - width * 0.08,
              width: width * 0.16,
              height: height * 0.95,
              background: `linear-gradient(180deg, ${PARTY_COLORS[(i + joined) % PARTY_COLORS.length]}88 0%, transparent 85%)`,
              transformOrigin: "50% 0%",
              transform: `rotate(${angle}deg)`,
              opacity: 0.25 + (full ? bump * 0.35 : 0.1) + joined * 0.04,
              filter: "blur(6px)",
            }}
          />
        );
      })}
      {/* sahna */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.18, background: "linear-gradient(180deg, #5B2C1A 0%, #2A1209 100%)", borderTop: "10px solid #FFB347" }} />
      <Title text={full ? "FULL BAND!" : "BUILD THE BAND!"} top={height * 0.035} size={width * 0.095} />
      <div
        style={{
          position: "absolute",
          top: height * 0.135,
          width: "100%",
          textAlign: "center",
          fontFamily: TITLE_FONT,
          fontSize: width * 0.07,
          color: "white",
          WebkitTextStroke: `${width * 0.005}px black`,
          paintOrder: "stroke fill",
        }}
      >
        {joined}/{BAND_SIZE}
      </div>
      {band.map((m, i) => {
        if (i >= joined) return null;
        const joinFrame = Math.round((i * 2 + 1) * beatLen);
        const drop = spring({ frame: frame - joinFrame, fps, config: { damping: 9 } });
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * slotW + (slotW - charSize) / 2;
        const y = rowY[row];
        const groove = Math.sin((frame / beatLen) * Math.PI * (full ? 2 : 1) + i) * (full ? 14 : 6);
        return (
          <React.Fragment key={m.id}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: `translateY(${(1 - drop) * -height * 0.5 + groove - bump * 12}px) rotate(${full ? Math.sin(frame / 6 + i) * 6 : 0}deg)`,
              }}
            >
              <CrewSvg member={m} size={charSize} mouthOpen={bump} blink={(frame + i * 11) % 90 < 3 ? 1 : 0} />
            </div>
            <div
              style={{
                position: "absolute",
                left: x,
                width: charSize,
                top: y + charSize * 1.42,
                textAlign: "center",
                fontFamily: TITLE_FONT,
                fontSize: width * 0.045,
                color: PARTY_COLORS[i % PARTY_COLORS.length],
                WebkitTextStroke: `${width * 0.004}px black`,
                paintOrder: "stroke fill",
                opacity: drop,
              }}
            >
              {m.name}
            </div>
          </React.Fragment>
        );
      })}
      {full ? <Confetti start={fullFrame} seed={seed} /> : null}
      <BottomText text="WHO IS THE BEST MEMBER? COMMENT!" from={fullFrame} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 7. MIX THE BEAT
export const MIX_SIZE = 5;
/** Har 2 zarbda bitta qahramon uyg'onib, o'z ovozini qo'shadi */
const mixAwake = (index: number) => Math.max(0, Math.min(MIX_SIZE, Math.floor((index + 1) / 2)));

const MIX_COLORS = ["#FF4D6D", "#36E27B", "#4DA3FF", "#FFD23F", "#C86BFF"];

const Mix: React.FC<CrewProps> = ({ members, bpm, seed }) => {
  const { frame, beatLen, index, bump, phase } = useBeat(bpm);
  const { width, height, fps } = useVideoConfig();
  const crew = members.slice(0, MIX_SIZE).map(memberById);
  const awake = mixAwake(index);
  const full = awake >= MIX_SIZE;
  const fullFrame = Math.round((MIX_SIZE * 2 - 1) * beatLen);
  // 3 ta yuqori qatorda, 2 ta pastki qatorda
  const charSize = width * 0.27;
  const rows = [
    { y: height * 0.27, items: [0, 1, 2] },
    { y: height * 0.56, items: [3, 4] },
  ];
  const posOf = (i: number) => {
    const row = rows.find((r) => r.items.includes(i))!;
    const n = row.items.length;
    const k = row.items.indexOf(i);
    const gap = width / n;
    return { x: k * gap + (gap - charSize) / 2, y: row.y };
  };

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: full ? "radial-gradient(circle at 50% 45%, #2B0F4D 0%, #07020F 75%)" : "radial-gradient(circle at 50% 45%, #1A1A2E 0%, #050509 75%)" }} />
      {crew.map((_, i) => {
        if (i >= awake) return null;
        const { x, y } = posOf(i);
        return (
          <div
            key={`glow-${i}`}
            style={{
              position: "absolute",
              left: x + charSize / 2 - width * 0.3,
              top: y + charSize * 0.55 - width * 0.3,
              width: width * 0.6,
              height: width * 0.6,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${MIX_COLORS[i]}66 0%, transparent 65%)`,
              transform: `scale(${0.8 + bump * 0.35})`,
            }}
          />
        );
      })}
      <Title text={full ? "FULL MIX!" : "MIX THE BEAT!"} top={height * 0.04} size={width * 0.1} />
      <div style={{ position: "absolute", top: height * 0.135, width: "100%", textAlign: "center", fontFamily: TITLE_FONT, fontSize: width * 0.06, color: "white", WebkitTextStroke: `${width * 0.005}px black`, paintOrder: "stroke fill" }}>
        {awake}/{MIX_SIZE} SOUNDS
      </div>
      {crew.map((m, i) => {
        const on = i < awake;
        const wakeFrame = Math.round((i * 2 + 1) * beatLen);
        const pop = on ? spring({ frame: frame - wakeFrame, fps, config: { damping: 8 } }) : 0;
        const color = MIX_COLORS[i];
        const { x, y } = posOf(i);
        const sway = on ? Math.sin((frame / beatLen) * Math.PI + i) * (full ? 8 : 4) : 0;
        const bars = new Array(4).fill(0).map((_, b) => (on ? (0.25 + 0.75 * Math.abs(Math.sin(frame / (4 + b) + i * 2 + b))) * (0.6 + bump * 0.4) : 0.08));
        return (
          <React.Fragment key={m.id}>
            <div style={{ position: "absolute", left: x + charSize * 0.15, top: y - charSize * 0.42, width: charSize * 0.7, height: charSize * 0.34, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              {bars.map((h, b) => (
                <div key={b} style={{ width: "20%", height: `${h * 100}%`, background: on ? color : "#33334A", borderRadius: 6, boxShadow: on ? `0 0 14px ${color}` : "none" }} />
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: `translateY(${on ? -bump * 22 - pop * 10 + 10 : 0}px) rotate(${sway}deg) scale(${on ? 0.92 + pop * 0.08 : 0.9})`,
                transformOrigin: "50% 100%",
                filter: on ? "none" : "grayscale(1) brightness(0.55)",
              }}
            >
              <CrewSvg member={m} size={charSize} mouthOpen={on ? bump : 0} blink={on ? ((frame + i * 13) % 80 < 3 ? 1 : 0) : 1} mood={on ? "smile" : "flat"} />
            </div>
            {!on ? (
              <div style={{ position: "absolute", left: x + charSize * 0.62, top: y - charSize * 0.05 - phase * 22, fontFamily: TITLE_FONT, fontSize: width * 0.06, color: "#9AA0C8", opacity: 0.85 }}>z</div>
            ) : null}
            <div style={{ position: "absolute", left: x, width: charSize, top: y + charSize * 1.34, textAlign: "center", fontFamily: TITLE_FONT, fontSize: width * 0.045, color: on ? color : "#55557A", WebkitTextStroke: `${width * 0.003}px black`, paintOrder: "stroke fill" }}>
              {m.name}
            </div>
          </React.Fragment>
        );
      })}
      {full ? <Confetti start={fullFrame} seed={seed} /> : null}
      <BottomText text="WHICH SOUND IS YOUR FAVORITE? COMMENT!" from={fullFrame} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ root
export const CrewShort: React.FC<CrewProps> = (props) => {
  const { durationInFrames, fps } = useVideoConfig();
  const content = useMemo(() => {
    if (props.style === "horror") return <Horror {...props} />;
    if (props.style === "pick") return <Pick {...props} />;
    if (props.style === "shadow") return <Shadow {...props} />;
    if (props.style === "odd") return <Odd {...props} />;
    if (props.style === "band") return <Band {...props} />;
    if (props.style === "mix") return <Mix {...props} />;
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
            // band formatida musiqa har bir yangi a'zo bilan kuchayadi
            (props.style === "band"
              ? 0.3 + (0.7 * bandJoined(Math.floor(f / ((fps * 60) / props.bpm)))) / BAND_SIZE
              : props.style === "mix"
                ? 0.25 + (0.75 * mixAwake(Math.floor(f / ((fps * 60) / props.bpm)))) / MIX_SIZE
                : 1) *
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
