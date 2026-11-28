// Sprunki Core Studio: dialogli multfilm sahnalari (lip-sync, his-tuyg'ular, kamera, o'tishlar, subtitr)
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TITLE_FONT } from "../fonts";
import { memberById } from "../crew/characters";
import { CrewSvg } from "../crew/CrewSvg";
import { FLOOR_Y, SceneBackground } from "./Backgrounds";
import type { Emotion, StoryProps, TimedLine, TimedScene } from "./types";

const moodOf = (e: Emotion): "smile" | "shock" | "flat" =>
  e === "shock" || e === "scared" ? "shock" : e === "sad" || e === "angry" || e === "calm" ? "flat" : "smile";

const activeLine = (scene: TimedScene, f: number): TimedLine | null =>
  scene.lines.find((l) => f >= l.from && f < l.from + l.durationInFrames) ?? null;

const lastSpeakerIndex = (scene: TimedScene, f: number): number => {
  let idx = -1;
  for (const l of scene.lines) {
    if (l.from > f) break;
    const i = scene.cast.indexOf(l.speaker);
    if (i >= 0) idx = i;
  }
  return idx;
};

// ------------------------------------------------------------------ bitta qahramon
const Actor: React.FC<{
  id: string;
  x: number;
  floor: number;
  size: number;
  scene: TimedScene;
  index: number;
  speakerX: number | null;
}> = ({ id, x, floor, size, scene, index, speakerX }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const member = memberById(id);
  const line = activeLine(scene, f);
  const speaking = line?.speaker === id;
  // bu qahramonning oxirgi gapi (his-tuyg'u keyingi gapigacha saqlanadi)
  const own = [...scene.lines].reverse().find((l) => l.speaker === id && l.from <= f);
  const emotion: Emotion = own?.emotion ?? "happy";
  const lf = speaking && line ? f - line.from : 999;

  // lip-sync: so'z ichida og'iz ochiladi/yopiladi
  let mouth = 0.05;
  if (speaking && line) {
    const ms = (lf / fps) * 1000;
    const inWord = line.words.some((w) => ms >= w.startMs && ms <= w.endMs);
    if (inWord) mouth = 0.3 + 0.65 * Math.abs(Math.sin(lf * 0.85 + index));
  }
  const action = speaking ? line?.action ?? "none" : "none";
  let dx = 0, dy = 0, rot = 0, sx = 1, sy = 1;
  const bob = Math.sin(f / 9 + index * 1.3) * 5;
  dy += bob;
  if (action === "jump") dy -= Math.abs(Math.sin(lf / 6)) * size * 0.22 * Math.max(0, 1 - lf / 60);
  if (action === "dance") { rot = Math.sin(lf / 5) * 10; dx = Math.sin(lf / 10) * size * 0.08; }
  if (action === "shake" || emotion === "scared") dx += Math.sin(f * 2.1) * (action === "shake" ? 10 : 4);
  if (action === "spin") sx = Math.cos(Math.min(lf, 24) / 24 * Math.PI * 2);
  if (action === "bow") sy = 1 - 0.18 * Math.sin(Math.min(lf, 30) / 30 * Math.PI);
  if (action === "float") dy -= size * 0.12 * Math.sin(Math.min(lf, 30) / 30 * Math.PI / 2);
  if (action === "walkIn") dx += interpolate(lf, [0, 14], [x < 0 ? -size * 2 : size * 2, 0], { extrapolateRight: "clamp" });
  if (emotion === "excited" && !speaking) dy -= Math.abs(Math.sin(f / 7)) * 8;
  if (emotion === "sad") sy *= 0.96;
  const enter = spring({ frame: f - index * 3, fps, config: { damping: 12 } });
  const look = speakerX === null || speaking ? 0 : Math.max(-1, Math.min(1, (speakerX - x) / (size * 1.5)));
  const talkPop = speaking ? 1 + 0.03 * Math.sin(lf / 3) : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2 + dx,
        top: floor - size * 1.02 + dy,
        width: size,
        transform: `rotate(${rot}deg) scale(${sx * enter * talkPop}, ${sy * enter * talkPop})`,
        transformOrigin: "50% 100%",
        filter: speaking ? `drop-shadow(0 0 ${size * 0.08}px ${member.color})` : "drop-shadow(0 12px 0 rgba(0,0,0,0.25))",
      }}
    >
      <CrewSvg member={member} size={size} mouthOpen={mouth} blink={(f + index * 13) % 95 < 4 ? 1 : 0} lookX={look} mood={moodOf(emotion)} />
      {emotion === "sad" ? (
        <div style={{ position: "absolute", left: size * 0.3, top: size * 0.45 + ((f * 3) % (size * 0.3)), width: size * 0.06, height: size * 0.09, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: "#6BC8FF", border: "3px solid black" }} />
      ) : null}
      {emotion === "angry" ? (
        <div style={{ position: "absolute", right: size * 0.05, top: -size * 0.05, fontSize: size * 0.22, fontFamily: TITLE_FONT, color: "#FF2E2E", WebkitTextStroke: "3px black", transform: `scale(${1 + 0.15 * Math.sin(f / 3)})` }}>#</div>
      ) : null}
      {emotion === "shock" || emotion === "scared" ? (
        <div style={{ position: "absolute", left: size * 0.4, top: -size * 0.32, fontSize: size * 0.3, fontFamily: TITLE_FONT, color: "#FFE14D", WebkitTextStroke: "4px black" }}>!</div>
      ) : null}
      {emotion === "funny" && speaking ? (
        <div style={{ position: "absolute", right: -size * 0.05, top: -size * 0.15, fontSize: size * 0.16, fontFamily: TITLE_FONT, color: "white", WebkitTextStroke: "3px black", transform: `rotate(${Math.sin(f / 4) * 15}deg)` }}>HA!</div>
      ) : null}
    </div>
  );
};

// ------------------------------------------------------------------ subtitr
const Subtitle: React.FC<{ line: TimedLine; color: string; name: string; vertical: boolean }> = ({ line, color, name, vertical }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ms = ((f - line.from) / fps) * 1000;
  const narrator = line.speaker === "narrator";
  const fs = vertical ? width * 0.058 : height * 0.046;
  const pop = spring({ frame: f - line.from, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: "absolute",
        left: "6%",
        right: "6%",
        ...(vertical ? { top: height * 0.3 } : { bottom: height * 0.035 }),
        textAlign: "center",
        transform: `scale(${0.9 + 0.1 * pop})`,
        opacity: pop,
      }}
    >
      {narrator ? null : (
        <div
          style={{
            display: vertical ? "inline-block" : "none",
            padding: `${fs * 0.1}px ${fs * 0.45}px`,
            marginBottom: fs * 0.2,
            borderRadius: fs,
            background: color,
            border: "5px solid black",
            fontFamily: TITLE_FONT,
            fontSize: fs * 0.62,
            color: "black",
          }}
        >
          {name}
        </div>
      )}
      <div
        style={{
          fontFamily: TITLE_FONT,
          fontSize: fs,
          lineHeight: 1.15,
          color: "white",
          WebkitTextStroke: `${fs * 0.11}px black`,
          paintOrder: "stroke fill",
          fontStyle: narrator ? "italic" : "normal",
        }}
      >
        {!vertical && !narrator ? <span style={{ color }}>{name}: </span> : null}
        {line.words.map((w, i) => (
          <span key={i} style={{ color: ms >= w.startMs - 40 && ms <= w.endMs + 60 ? "#FFE14D" : narrator ? "#D9D2FF" : "white" }}>
            {w.text}{" "}
          </span>
        ))}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ bitta sahna
const Scene: React.FC<{ scene: TimedScene; props: StoryProps; first: boolean }> = ({ scene, props, first }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const vertical = props.aspect === "short";
  const floor = height * FLOOR_Y;
  const n = Math.max(1, scene.cast.length);
  const size = vertical ? Math.min(width * 0.52, (width * 1.25) / n) : Math.min(height * 0.36, (width * 0.8) / n);
  const span = vertical ? Math.min(width * 0.7, size * (n - 1) * 0.95) : Math.min(width * 0.7, size * (n - 1) * 1.25);
  const xs = scene.cast.map((_, i) => (n === 1 ? width / 2 : width / 2 - span / 2 + (span / (n - 1)) * i));
  const line = activeLine(scene, f);
  const spk = lastSpeakerIndex(scene, f);
  const speakerX = spk >= 0 ? xs[spk] : null;

  // kamera
  const t = f / scene.durationInFrames;
  let scale = 1, tx = 0, ty = 0;
  if (scene.camera === "zoomIn") scale = 1 + 0.18 * t;
  if (scene.camera === "zoomOut") scale = 1.22 - 0.22 * t;
  if (scene.camera === "pan") tx = interpolate(t, [0, 1], [width * 0.05, -width * 0.05]);
  if (scene.camera === "closeup" && speakerX !== null) {
    // gapirayotgan qahramonga yumshoq yaqinlashish
    const lineStart = line?.from ?? 0;
    const ease = spring({ frame: f - lineStart, fps, config: { damping: 20 } });
    scale = vertical ? 1.2 : 1.35;
    // gapirayotganni markazga olib kelish, lekin sahna chetidan chiqib ketmaslik
    const maxShift = (width * (scale - 1)) / 2;
    const want = (width / 2 - speakerX) * scale;
    tx = Math.max(-maxShift, Math.min(maxShift, want)) * (line ? ease : 1);
  }
  if (scene.camera === "shake" && line) tx += Math.sin(f * 1.7) * 8 * Math.max(0, 1 - (f - line.from) / 12);
  if (vertical && scene.camera !== "closeup") scale *= 1.08;

  // sahnaga kirish (transition)
  const tIn = Math.min(1, f / 12);
  let overlay: React.ReactNode = null;
  if (!first || scene.transition === "iris") {
    if (scene.transition === "wipe") overlay = <div style={{ position: "absolute", inset: 0, background: "#FF3DB4", transform: `translateX(${tIn * 105}%)` }} />;
    else if (scene.transition === "flash") overlay = <AbsoluteFill style={{ background: "white", opacity: 0.85 * (1 - tIn) }} />;
    else if (scene.transition !== "iris") overlay = <AbsoluteFill style={{ background: "black", opacity: 1 - tIn }} />;
  }
  const clip = scene.transition === "iris" && f < 14 ? `circle(${tIn * 80}% at 50% 55%)` : undefined;
  const out = interpolate(f, [scene.durationInFrames - 6, scene.durationInFrames], [0, scene.transition === "flash" ? 0.6 : 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "black" }}>
      <AbsoluteFill style={{ clipPath: clip }}>
        <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: `50% ${FLOOR_Y * 100}%` }}>
          <SceneBackground location={scene.location} time={scene.time} />
          {scene.cast.map((id, i) => (
            <Actor key={id} id={id} x={xs[i]} floor={floor} size={size} scene={scene} index={i} speakerX={speakerX} />
          ))}
        </AbsoluteFill>
        {props.subtitles && line && f - line.from < line.durationInFrames - 3 ? (
          <Subtitle line={line} color={props.colors[line.speaker] ?? "#FFFFFF"} name={props.names[line.speaker] ?? line.speaker} vertical={vertical} />
        ) : null}
      </AbsoluteFill>
      {overlay}
      <AbsoluteFill style={{ background: "black", opacity: out, pointerEvents: "none" }} />
      {/* ovozlar */}
      {scene.lines.map((l, i) =>
        l.audio ? (
          <Sequence key={`a${i}`} from={l.from} durationInFrames={l.durationInFrames + 30} layout="none">
            <Audio src={staticFile(l.audio)} />
          </Sequence>
        ) : null,
      )}
      {props.sfxEnabled
        ? scene.sfx.map((s, i) => (
            <Sequence key={`s${i}`} from={Math.max(0, s.from - 2)} durationInFrames={60} layout="none">
              <Audio src={staticFile(`sfx/${s.name}.wav`)} volume={0.45} />
            </Sequence>
          ))
        : null}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ boshlanish: hook / sarlavha
const HookCard: React.FC<{ text: string; vertical: boolean }> = ({ text, vertical }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 9 } });
  const fade = interpolate(f, [fps * 2.2, fps * 2.6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: vertical ? height * 0.09 : height * 0.06, opacity: fade, pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: "88%",
          textAlign: "center",
          fontFamily: TITLE_FONT,
          fontSize: vertical ? width * 0.088 : height * 0.085,
          lineHeight: 1.05,
          color: "#FFE14D",
          WebkitTextStroke: `${(vertical ? width : height) * 0.01}px black`,
          paintOrder: "stroke fill",
          textShadow: "0 10px 0 rgba(0,0,0,0.45)",
          transform: `scale(${pop}) rotate(${Math.sin(f / 8) * 2}deg)`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const StoryVideo: React.FC<StoryProps> = (props) => {
  const { durationInFrames, fps } = useVideoConfig();
  const vertical = props.aspect === "short";
  // musiqa dialog paytida pasayadi (ducking)
  const talking = useMemo(() => {
    const ranges: [number, number][] = [];
    for (const s of props.scenes) for (const l of s.lines) ranges.push([s.from + l.from, s.from + l.from + l.durationInFrames]);
    return ranges;
  }, [props.scenes]);
  const isTalking = (f: number) => {
    let lo = 0, hi = talking.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (f < talking[mid][0]) hi = mid - 1;
      else if (f >= talking[mid][1]) lo = mid + 1;
      else return true;
    }
    return false;
  };
  return (
    <AbsoluteFill style={{ background: "black" }}>
      {props.scenes.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.durationInFrames}>
          <Scene scene={s} props={props} first={i === 0} />
        </Sequence>
      ))}
      {props.hook ? (
        <Sequence durationInFrames={Math.round(fps * 2.6)}>
          <HookCard text={props.hook} vertical={vertical} />
        </Sequence>
      ) : null}
      {props.music ? (
        <Audio
          src={staticFile(props.music)}
          loop
          volume={(f) =>
            props.musicVolume *
            (isTalking(f) ? 0.55 : 1) *
            interpolate(f, [0, 10, durationInFrames - fps, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const storyDemo: StoryProps = {
  aspect: "short",
  title: "Demo",
  hook: "SOMEONE STOLE THE BEAT!",
  channelName: "Sprunki Core Studio",
  music: null,
  musicVolume: 0.14,
  sfxEnabled: false,
  subtitles: true,
  colors: { coree: "#3DF2FF", zappi: "#FFE14D", moxi: "#A04DFF" },
  names: { coree: "Coree", zappi: "Zappi", moxi: "Moxi", narrator: "Narrator" },
  width: 1080,
  height: 1920,
  durationInFrames: 150,
  scenes: [
    {
      location: "stage", time: "night", camera: "closeup", mood: "mystery", cast: ["coree", "zappi", "moxi"], description: "", imagePrompt: "", videoPrompt: "", transition: "iris",
      from: 0, durationInFrames: 150, sfx: [],
      lines: [
        { speaker: "coree", text: "The beat is gone!", emotion: "shock", action: "shake", audio: null, from: 12, durationInFrames: 60, words: "The beat is gone!".split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 })) },
        { speaker: "zappi", text: "Zap-zap, I have an idea!", emotion: "excited", action: "jump", audio: null, from: 72, durationInFrames: 70, words: "Zap-zap, I have an idea!".split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 })) },
      ],
    },
  ],
};
