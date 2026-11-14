// Butun jarayon: mavzu -> ssenariy -> ovoz -> rasmlar -> Remotion render -> (YouTube)
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { BAND_IDS, CREW, memberById } from "../src/crew/characters";
import { CREW_BEATS, type CrewProps, type CrewStyle } from "../src/crew/types";
import { FPS, SIZES, type SceneProps, type VideoFormat, type VideoProps } from "../src/types";
import { log, settings } from "./config";
import { characterLibrary, sceneImage } from "./images";
import { generateMusic } from "./music";
import { renderJob } from "./render";
import { ScriptWriter, wordCount, type VideoScript } from "./script-writer";
import { audioDurationSeconds, synthesize } from "./tts";

const HISTORY_FILE = path.join(settings.dataDir, "history.json");
const QUEUE_FILE = path.join(settings.dataDir, "topics.json");
const SCENE_PAD_SECONDS = 0.3;
export const MAX_MINUTES: Record<VideoFormat, number> = { short: 0.95, long: 30 };

type QueueItem = { topic: string; format: VideoFormat };
type HistoryItem = { topic: string; format: VideoFormat | "crew"; title: string; folder: string; created: string; videoId: string | null };

const load = async <T>(file: string): Promise<T[]> =>
  existsSync(file) ? (JSON.parse(await fs.readFile(file, "utf8")) as T[]) : [];

const save = async (file: string, data: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
};

const usedTopics = async (): Promise<string[]> => (await load<HistoryItem>(HISTORY_FILE)).map((h) => h.topic);

const nextTopic = async (format: VideoFormat, writer: ScriptWriter): Promise<string> => {
  const queue = await load<QueueItem>(QUEUE_FILE);
  const index = queue.findIndex((item) => (item.format ?? format) === format);
  if (index !== -1) {
    const [item] = queue.splice(index, 1);
    await save(QUEUE_FILE, queue);
    return item.topic;
  }
  const [idea] = await writer.ideas(1, format, [...(await usedTopics()), ...queue.map((q) => q.topic)]);
  if (!idea) throw new Error("Mavzu topilmadi");
  return idea;
};

export const addIdeas = async (format: VideoFormat, count: number): Promise<string[]> => {
  const writer = new ScriptWriter();
  const queue = await load<QueueItem>(QUEUE_FILE);
  const ideas = await writer.ideas(count, format, [...(await usedTopics()), ...queue.map((q) => q.topic)]);
  await save(QUEUE_FILE, [...queue, ...ideas.map((topic) => ({ topic, format }))]);
  return ideas;
};

const slug = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "video";

/**
 * Fon musiqasi:
 *   MUSIC_MODE=generated - har safar yangi original beat (standart, agar assets/music bo'sh bo'lsa)
 *   MUSIC_MODE=assets    - assets/music dagi treklardan biri
 *   MUSIC_MODE=off       - musiqasiz
 */
const pickMusic = async (jobDir: string, seedText: string): Promise<string | null> => {
  if (settings.musicMode === "off") return null;
  const dir = path.join(settings.assetsDir, "music");
  const files = (await fs.readdir(dir).catch(() => [] as string[])).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f));
  if (settings.musicMode !== "generated" && files.length) {
    const file = files[Math.floor(Math.random() * files.length)];
    const rel = `music${path.extname(file).toLowerCase()}`;
    await fs.copyFile(path.join(dir, file), path.join(jobDir, rel));
    return rel;
  }
  const seed = parseInt(crypto.createHash("md5").update(seedText).digest("hex").slice(0, 8), 16);
  const { bpm } = await generateMusic(path.join(jobDir, "music.wav"), seed);
  log(`Original musiqa yaratildi (${bpm} BPM)`);
  return "music.wav";
};

/** Ssenariydan ovoz va rasmlarni tayyorlab, Remotion props'ini qaytaradi. */
export const prepareAssets = async (
  script: VideoScript,
  format: VideoFormat,
  jobDir: string,
  synth: typeof synthesize = synthesize,
): Promise<VideoProps> => {
  const { width, height } = SIZES[format];
  const library = await characterLibrary();
  const scenes: SceneProps[] = [];

  for (const [i, scene] of script.scenes.entries()) {
    const index = i + 1;
    log(`Sahna ${index}/${script.scenes.length}: ovoz + rasm`);
    const folder = `scenes/${String(index).padStart(3, "0")}`;
    const { audio, words } = await synth(scene.narration, path.join(jobDir, folder));
    const seconds = await audioDurationSeconds(audio);
    const visual = await sceneImage({
      index,
      prompt: scene.imagePrompt,
      character: scene.character,
      width,
      height,
      jobDir,
      library,
    });
    scenes.push({
      audio: path.relative(jobDir, audio).split(path.sep).join("/"),
      durationInFrames: Math.ceil((seconds + SCENE_PAD_SECONDS) * FPS),
      ...visual,
      character: scene.character,
      words,
    });
  }

  return {
    format,
    channelName: settings.channelName,
    title: script.title,
    thumbnailText: script.thumbnailText,
    music: await pickMusic(jobDir, `${script.title}-${Date.now()}`),
    musicVolume: settings.musicVolume,
    host: settings.host,
    scenes,
  };
};

export const make = async (opts: {
  topic?: string | null;
  format: VideoFormat;
  minutes: number;
  /** Faqat short uchun: uzunlik soniyada (standart SHORT_SECONDS) */
  seconds?: number;
  upload?: boolean;
  privacy?: "private" | "unlisted" | "public";
  publishAt?: string | null;
}): Promise<HistoryItem> => {
  const { format } = opts;
  const minutes = Math.min(opts.minutes, MAX_MINUTES[format]);
  const writer = new ScriptWriter();
  const topic = opts.topic || (await nextTopic(format, writer));
  log(`Mavzu: ${topic}`);

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const jobDir = path.join(settings.outputDir, `${stamp}-${format}-${slug(topic)}`);
  await fs.mkdir(jobDir, { recursive: true });

  log("Ssenariy yozilmoqda (OpenAI)");
  const script = await writer.write(topic, format, minutes, opts.seconds);
  if (!script.scenes.length) throw new Error("Ssenariy bo'sh qaytdi");
  await save(path.join(jobDir, "script.json"), script);
  log(`Ssenariy tayyor: ${script.scenes.length} sahna, ${wordCount(script)} so'z`);

  const props = await prepareAssets(script, format, jobDir);
  const result = await renderJob(jobDir, props, { thumbnail: format === "long" });
  const seconds = props.scenes.reduce((s, x) => s + x.durationInFrames, 0) / FPS;
  log(`Video tayyor: ${result.video} (${(seconds / 60).toFixed(1)} daqiqa)`);

  const record: HistoryItem = {
    topic,
    format,
    title: script.title,
    folder: path.relative(settings.outputDir, jobDir),
    created: new Date().toISOString(),
    videoId: null,
  };

  if (opts.upload) {
    const { upload } = await import("./youtube");
    log("YouTube'ga yuklanmoqda");
    const description =
      `${script.description.trim()}\n\n` +
      `Subscribe to ${settings.channelHandle} for more Sprunki videos!\n` +
      `https://www.youtube.com/${settings.channelHandle}?sub_confirmation=1\n\n` +
      "This is a fan-made channel and is not affiliated with the official Sprunki or Incredibox creators.";
    record.videoId = await upload({
      video: result.video,
      title: script.title,
      description,
      tags: script.tags,
      privacy: opts.privacy,
      publishAt: opts.publishAt,
      thumbnail: result.thumbnail,
    });
    log(`Yuklandi: https://youtu.be/${record.videoId}`);
  }

  await save(HISTORY_FILE, [...(await load<HistoryItem>(HISTORY_FILE)), record]);
  return record;
};

// ------------------------------------------------------------------ Coree Crew (ovozsiz, OpenAI kerak emas)
export const CREW_STYLES: CrewStyle[] = ["party", "horror", "pick"];

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const shuffle = <T>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5);

const crewMeta = (style: CrewStyle, props: CrewProps) => {
  const [a, b, c] = props.members.slice(0, 3).map((id) => memberById(id).name);
  const star = memberById(props.featured).name;
  const titles: Record<CrewStyle, string[]> = {
    party: [`Everyone Turns Into ${star}! 🎨`, `${star} Color Party! Which Color Wins?`, `What If Everyone Became ${star}? 🎵`],
    horror: [`${a} Normal vs HORROR ⚡`, `Normal vs Horror: Who Is Scariest? 😱`, `${a}, ${b} & More: Horror Versions ⚡`],
    pick: [`Pick One: ${a}, ${b} or ${c}? 🤔`, `Who Would You Pick? ${a} vs ${b} vs ${c}`, `Only ONE Can Win! Pick Fast! ⏱️`],
  };
  const title = `${pick(titles[style])} #shorts`;
  const description =
    `Meet the Coree Crew, ${settings.channelName}'s own music-loving characters! ` +
    (style === "party"
      ? `Watch everyone turn into ${star}. Which color is your favorite?`
      : style === "horror"
        ? "Normal or horror version, which one do you like more?"
        : `${a}, ${b} or ${c}? Comment who you picked!`) +
    `\n\nSubscribe to ${settings.channelHandle} for new Coree Crew Shorts every day!\n` +
    `https://www.youtube.com/${settings.channelHandle}?sub_confirmation=1\n\n` +
    "#shorts #coreecrew #animation #funny #musicgame";
  const tags = [
    "coree crew", "sprunki style", "incredibox style", "color swap", "normal vs horror", "pick one",
    "animation shorts", "funny animation", "music game", "cute characters", "satisfying", star, a, b, c,
  ];
  return { title, description, tags: [...new Set(tags.map((t) => t.toLowerCase()))] };
};

export const makeCrew = async (opts: {
  style?: CrewStyle | "random";
  upload?: boolean;
  privacy?: "private" | "unlisted" | "public";
  publishAt?: string | null;
}): Promise<HistoryItem> => {
  const style: CrewStyle = !opts.style || opts.style === "random" ? pick(CREW_STYLES) : opts.style;
  const seed = Math.floor(Math.random() * 1_000_000);
  // Band (saksofon, ukulele, daraxt, pishloq) har doim birinchi o'rinda, qolgan Crew ulardan keyin
  const band = shuffle(BAND_IDS);
  const others = shuffle(CREW.map((m) => m.id).filter((id) => !BAND_IDS.includes(id)));
  const members = [...band, ...others];
  const featured = band[0];

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const jobDir = path.join(settings.outputDir, `${stamp}-crew-${style}`);
  await fs.mkdir(jobDir, { recursive: true });

  const { bpm } = await generateMusic(path.join(jobDir, "music.wav"), seed);
  log(`Coree Crew: ${style}, ${bpm} BPM`);

  const props: CrewProps = {
    style,
    featured,
    members,
    bpm,
    seed,
    music: "music.wav",
    musicVolume: 0.9,
    channelName: settings.channelName,
    durationInFrames: Math.ceil(((CREW_BEATS[style] * 60) / bpm) * FPS),
    pickIndex: seed % 3,
  };
  const meta = crewMeta(style, props);
  await save(path.join(jobDir, "script.json"), { ...meta, style });

  const result = await renderJob(jobDir, props, { thumbnail: false, composition: "CrewShort" });
  log(`Video tayyor: ${result.video} (${(props.durationInFrames / FPS).toFixed(1)} s)`);

  const record: HistoryItem = {
    topic: `crew:${style}:${featured}`,
    format: "crew",
    title: meta.title,
    folder: path.relative(settings.outputDir, jobDir),
    created: new Date().toISOString(),
    videoId: null,
  };
  if (opts.upload) {
    const { upload } = await import("./youtube");
    log("YouTube'ga yuklanmoqda");
    record.videoId = await upload({
      video: result.video,
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      privacy: opts.privacy,
      publishAt: opts.publishAt,
    });
    log(`Yuklandi: https://youtu.be/${record.videoId}`);
  }
  await save(HISTORY_FILE, [...(await load<HistoryItem>(HISTORY_FILE)), record]);
  return record;
};
