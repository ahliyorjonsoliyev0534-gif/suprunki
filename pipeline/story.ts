// Sprunki Core Studio: mavzu -> ssenariy -> ovozlar -> animatsiya (Remotion) -> FFmpeg -> video.mp4 + subtitles.srt
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { CREW } from "../src/crew/characters";
import type { StoryProps, StoryScript, TimedScene } from "../src/story/types";
import { log, settings } from "./config";
import { generateLongTrack, generateMusic } from "./music";
import { renderJob } from "./render";
import { createSfx, createVoices, type VoiceProvider } from "./story-audio";
import { type Category, loadProfiles, writeStory } from "./story-writer";

const FPS = 30;
const SCENE_IN = 12; // sahna boshida o'tish (transition) uchun kadrlar
const SCENE_OUT = 10;
const GAP = 5; // gaplar orasidagi pauza

export type StoryOptions = {
  topic?: string;
  category?: Category;
  aspect?: "short" | "long";
  seconds?: number;
  scriptFile?: string;
  voice?: VoiceProvider;
  writer?: "auto" | "openai" | "offline";
  cast?: string[];
  uhd?: boolean;
  subtitles?: boolean;
  /** Faqat ssenariy yozish (render qilmasdan) */
  scriptOnly?: boolean;
  out?: string;
};

const srtTime = (ms: number) => {
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(Math.floor(ms % 1000)).padStart(3, "0")}`;
};

export const makeStory = async (opts: StoryOptions): Promise<{ folder: string; video: string | null; script: StoryScript }> => {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const jobDir = opts.out ? path.resolve(opts.out) : path.join(settings.outputDir, `${stamp}-story`);
  await fs.mkdir(jobDir, { recursive: true });

  const script: StoryScript = opts.scriptFile
    ? (JSON.parse(await fs.readFile(opts.scriptFile, "utf8")) as StoryScript)
    : await writeStory({
        topic: opts.topic || "the lost golden beat",
        category: opts.category ?? "adventure",
        aspect: opts.aspect ?? "short",
        seconds: opts.seconds ?? 30,
        cast: opts.cast,
        writer: opts.writer,
      });
  await fs.writeFile(path.join(jobDir, "script.json"), JSON.stringify(script, null, 2));
  log(`Ssenariy: "${script.title}" · ${script.scenes.length} sahna · ${script.scenes.reduce((n, s) => n + s.lines.length, 0)} gap`);
  if (opts.scriptOnly) return { folder: jobDir, video: null, script };

  const profiles = await loadProfiles();
  const allLines = script.scenes.flatMap((s) => s.lines);
  const voices = await createVoices(allLines, profiles, path.join(jobDir, "voice"), opts.voice ?? (process.env.VOICE_PROVIDER as VoiceProvider) ?? "auto");
  await createSfx(path.join(jobDir, "sfx"));

  // vaqt jadvali
  let cursor = 0;
  let k = 0;
  const scenes: TimedScene[] = script.scenes.map((sc) => {
    let local = SCENE_IN;
    const lines = sc.lines.map((l) => {
      const v = voices[k++];
      const dur = Math.ceil(v.seconds * FPS) + GAP;
      const line = { ...l, audio: path.relative(jobDir, v.audio).split(path.sep).join("/"), from: local, durationInFrames: dur, words: v.words };
      local += dur;
      return line;
    });
    const durationInFrames = local + SCENE_OUT;
    const scene: TimedScene = {
      ...sc,
      from: cursor,
      durationInFrames,
      lines,
      sfx: lines.filter((l) => l.sfx).map((l) => ({ name: l.sfx!, from: l.from })),
    };
    cursor += durationInFrames;
    return scene;
  });
  const total = cursor + FPS; // oxirida 1 s
  const seconds = total / FPS;

  // musiqa: original, kanalning o'zi uchun sintez qilingan
  // eslint-disable-next-line @remotion/deterministic-randomness -- Node tomoni, render emas
  const seed = Math.floor(Math.random() * 1e6);
  if (seconds > 40) await generateLongTrack(path.join(jobDir, "music.wav"), seed, seconds + 2, [96, 112]);
  else await generateMusic(path.join(jobDir, "music.wav"), seed);

  const vertical = script.aspect === "short";
  const props: StoryProps = {
    aspect: script.aspect,
    title: script.title,
    hook: script.hook,
    channelName: "Sprunki Core Studio",
    music: "music.wav",
    musicVolume: Number(process.env.STORY_MUSIC_VOLUME ?? "0.14"),
    scenes,
    sfxEnabled: process.env.STORY_SFX !== "0",
    subtitles: opts.subtitles ?? true,
    colors: Object.fromEntries(CREW.map((c) => [c.id, c.color])),
    names: Object.fromEntries(Object.entries(profiles).map(([id, p]) => [id, p.name])),
    durationInFrames: total,
    width: vertical ? 1080 : 1920,
    height: vertical ? 1920 : 1080,
  };
  log(`Animatsiya: ${vertical ? "9:16" : "16:9"} · ${seconds.toFixed(1)} s`);
  const { video } = await renderJob(jobDir, props, { thumbnail: false, composition: "StoryVideo" });

  // subtitrlar (.srt) — YouTube'ga alohida yuklash uchun
  const srt: string[] = [];
  let n = 1;
  for (const sc of scenes) for (const l of sc.lines) {
    const start = ((sc.from + l.from) / FPS) * 1000;
    const end = start + ((l.durationInFrames - GAP) / FPS) * 1000;
    const who = l.speaker === "narrator" ? "" : `${props.names[l.speaker] ?? l.speaker}: `;
    srt.push(`${n++}\n${srtTime(start)} --> ${srtTime(end)}\n${who}${l.text}\n`);
  }
  await fs.writeFile(path.join(jobDir, "subtitles.srt"), srt.join("\n"));

  let final = video;
  if (opts.uhd) {
    // 4K: FFmpeg lanczos bilan kattalashtirish (vektor grafika bo'lgani uchun sifat yaxshi saqlanadi)
    final = path.join(jobDir, "video_4k.mp4");
    const size = vertical ? "2160:3840" : "3840:2160";
    const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-vf", `scale=${size}:flags=lanczos`, "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "copy", final]);
    if (r.status !== 0) {
      log("4K eksport ishlamadi, 1080p qoldi");
      final = video;
    }
  }
  await fs.writeFile(
    path.join(jobDir, "youtube.json"),
    JSON.stringify({ title: `${script.title}${vertical ? " #shorts" : ""}`.slice(0, 100), description: `${script.description}\n\n#coreecrew #animation #cartoon${vertical ? " #shorts" : ""}`, tags: script.tags }, null, 2),
  );
  log(`Video tayyor: ${final}`);
  return { folder: jobDir, video: final, script };
};
