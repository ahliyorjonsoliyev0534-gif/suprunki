// Butun jarayon: mavzu -> ssenariy -> ovoz -> rasmlar -> Remotion render -> (YouTube)
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { BAND_IDS, CREW, memberById } from "../src/crew/characters";
import { CREW_BEATS, type CrewProps, type CrewStyle } from "../src/crew/types";
import { HOP_COLORS, type HopProps } from "../src/hop/types";
import { FPS, SIZES, type SceneProps, type VideoFormat, type VideoProps } from "../src/types";
import { log, settings } from "./config";
import { characterLibrary, sceneImage } from "./images";
import { generateLongTrack, generateMusic } from "./music";
import { renderJob } from "./render";
import { ScriptWriter, wordCount, type VideoScript } from "./script-writer";
import { audioDurationSeconds, synthesize } from "./tts";

const HISTORY_FILE = path.join(settings.dataDir, "history.json");
const QUEUE_FILE = path.join(settings.dataDir, "topics.json");
const SCENE_PAD_SECONDS = 0.3;
export const MAX_MINUTES: Record<VideoFormat, number> = { short: 0.95, long: 30 };

type QueueItem = { topic: string; format: VideoFormat };
type HistoryItem = { topic: string; format: VideoFormat | "crew" | "hop"; title: string; folder: string; created: string; videoId: string | null };

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
// "horror" faqat qo'lda (--style horror); tasodifiy tanlovda ishlatilmaydi
export const CREW_STYLES: CrewStyle[] = ["party", "pick", "shadow", "odd", "band"];

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const shuffle = <T>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5);

const crewMeta = (style: CrewStyle, props: CrewProps) => {
  const [a, b, c] = props.members.slice(0, 3).map((id) => memberById(id).name);
  const star = memberById(props.featured).name;
  const titles: Record<CrewStyle, string[]> = {
    party: [`Everyone Turns Into ${star}! 🎨`, `${star} Color Party! Which Color Wins?`, `What If Everyone Became ${star}? 🎵`],
    horror: [`${a} Normal vs HORROR ⚡`, `Normal vs Horror: Who Is Scariest? 😱`, `${a}, ${b} & More: Horror Versions ⚡`],
    pick: [`Pick One: ${a}, ${b} or ${c}? 🤔`, `Who Would You Pick? ${a} vs ${b} vs ${c}`, `Only ONE Can Win! Pick Fast! ⏱️`],
    shadow: [`Guess the Shadow! Who Is It? 🕵️`, `Can You Guess This Shadow? 🤔`, `Whose Shadow Is This? 3 Seconds! ⏱️`],
    band: [`Build the Band! Who Joins Next? 🎸`, `${a}, ${b}, ${c} & Friends Form a Band! 🎵`, `Which Band Member Is Best? 🎤`],
    odd: [`Find the Odd ${star}! 👀`, `Only 1% Can Find the Odd ${star}! 🔍`, `Spot the Different ${star}! 👀`],
  };
  const title = `${pick(titles[style])} #shorts`;
  const description =
    `Meet the Coree Crew, ${settings.channelName}'s own music-loving characters! ` +
    (style === "party"
      ? `Watch everyone turn into ${star}. Which color is your favorite?`
      : style === "horror"
        ? "Normal or horror version, which one do you like more?"
        : style === "shadow"
          ? "Can you guess whose shadow it is before the reveal? Comment if you got it right!"
          : style === "band"
            ? `${a}, ${b}, ${c} and friends join the stage one by one and the music gets bigger! Who is the best band member? Comment below!`
            : style === "odd"
            ? `One ${star} is a different color. Can you find it before the countdown ends? Comment your time!`
            : `${a}, ${b} or ${c}? Comment who you picked!`) +
    `\n\nSubscribe to ${settings.channelHandle} for new Coree Crew Shorts every day!\n` +
    `https://www.youtube.com/${settings.channelHandle}?sub_confirmation=1\n\n` +
    "#shorts #coreecrew #animation #colorparty #satisfying #funny #cute #musicgame";
  const tags = [
    "coree crew", "color swap", "pick one", "guess the shadow", "find the odd one", "spot the difference",
    "animation shorts", "funny animation", "music game", "cute characters", "satisfying", star, a, b, c,
  ];
  return { title, description, tags: [...new Set(tags.map((t) => t.toLowerCase()))] };
};

export const makeCrew = async (opts: {
  style?: CrewStyle | "random";
  /** Bosh qahramon (party formatida hamma shunga aylanadi). Bo'sh bo'lsa Band'dan tasodifiy */
  featured?: string;
  /** Birinchi o'rindagi qahramonlar (pick formatida variantlar shular bo'ladi) */
  first?: string[];
  upload?: boolean;
  privacy?: "private" | "unlisted" | "public";
  publishAt?: string | null;
}): Promise<HistoryItem> => {
  const style: CrewStyle = !opts.style || opts.style === "random" ? pick(CREW_STYLES) : opts.style;
  const seed = Math.floor(Math.random() * 1_000_000);
  const ids = CREW.map((m) => m.id);
  for (const id of [opts.featured, ...(opts.first ?? [])].filter(Boolean) as string[]) {
    if (!ids.includes(id)) throw new Error(`Noma'lum qahramon: ${id}. Mavjudlari: ${ids.join(", ")}`);
  }
  // Band (saksofon, ukulele, daraxt, pishloq) birinchi o'rinda, qolgan Crew ulardan keyin
  const first = opts.first ?? [];
  const band = shuffle(BAND_IDS.filter((id) => !first.includes(id)));
  const others = shuffle(ids.filter((id) => !BAND_IDS.includes(id) && !first.includes(id)));
  const members = [...first, ...band, ...others].filter((id) => id !== opts.featured);
  const featured = opts.featured ?? members[0];

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

// ------------------------------------------------------------------ Neon Hop (uzun, gorizontal, OpenAI kerak emas)
export const makeHop = async (opts: {
  minutes: number;
  /** Vertikal Short: 2 ta yo'lak, ~45 soniya, intro'siz musiqa */
  short?: boolean;
  members?: string[];
  upload?: boolean;
  privacy?: "private" | "unlisted" | "public";
  publishAt?: string | null;
}): Promise<HistoryItem> => {
  const seed = Math.floor(Math.random() * 1_000_000);
  const laneCount = opts.short ? 2 : 4;
  const members = opts.members?.length ? opts.members.slice(0, laneCount) : shuffle(BAND_IDS).slice(0, laneCount);
  const colors = opts.short ? shuffle(HOP_COLORS).slice(0, laneCount) : HOP_COLORS.slice(0, 4);
  const lanes = members.map((member, i) => ({ member, ...colors[i] }));

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const jobDir = path.join(settings.outputDir, `${stamp}-hop${opts.short ? "short" : ""}`);
  await fs.mkdir(jobDir, { recursive: true });

  const { bpm, seconds } = opts.short
    ? await generateLongTrack(path.join(jobDir, "music.wav"), seed, 40, [122, 130], { intro: false })
    : await generateLongTrack(path.join(jobDir, "music.wav"), seed, Math.max(30, opts.minutes * 60));
  log(`Neon Hop: ${members.join(", ")} · ${bpm} BPM · ${(seconds / 60).toFixed(1)} daqiqa`);

  const props: HopProps = {
    lanes,
    bpm,
    seed,
    music: "music.wav",
    durationInFrames: Math.ceil(seconds * FPS),
    channelName: settings.hopChannelName,
  };

  const names = lanes.map((l) => memberById(l.member).name);
  const emoji: Record<string, string> = { Purple: "🟣", Blue: "💙", Green: "🟢", Pink: "💗", Orange: "🧡", Cyan: "🩵" };
  // "Kim yutadi?" sarlavhasi tomoshabinni oxirigacha ushlab turadi (g'olib videoning oxirida e'lon qilinadi)
  // Kanal tahlili: rang nomlari bilan boshlangan sarlavhalar "tavsiya etilgan" videolarga ko'proq chiqqan
  const title = opts.short
    ? `${lanes.map((l) => `${emoji[l.colorName] ?? ""} ${l.colorName}`).join(" vs ")} | Who Wins? #shorts`
    : `${lanes.map((l) => `${emoji[l.colorName] ?? ""} ${l.colorName}`).join(" vs ")} | Who Wins? Neon Hop EDM Race`;
  const description =
    `Pick your color and watch till the end to see who wins! 🏆\n\n` +
    lanes.map((l, i) => `${emoji[l.colorName] ?? ""} ${l.colorName}: ${names[i]}`).join("\n") +
    `\n\n${names.join(", ")} race on glowing neon tiles to an original EDM beat. Every tile with a star is +1 point. ` +
    `New backgrounds every level, and only one lane wins. Which color did you pick? Tell us in the comments!\n\n` +
    `🎵 Every track on ${settings.hopChannelName} is original music made for this channel.\n` +
    `🔔 Subscribe to ${settings.hopChannelHandle} for a new Neon Hop race every day!\n` +
    `https://www.youtube.com/${settings.hopChannelHandle}?sub_confirmation=1\n\n` +
    (opts.short ? "#shorts " : "") + `#neonhop #edm #colorrace #whowins #rhythmgame #satisfying #edmmusic #animation`;
  const tags = [
    "neon hop", "who wins", "edm race", "edm", "edm music", "rhythm animation", "hop game", "tile hop style", "music animation",
    "satisfying", "neon", "color lanes", ...names.map((n) => n.toLowerCase()), ...lanes.map((l) => l.colorName.toLowerCase()),
  ];
  await save(path.join(jobDir, "script.json"), { title, description, tags });

  const result = await renderJob(jobDir, props, { thumbnail: false, composition: opts.short ? "NeonHopShort" : "NeonHop" });
  log(`Video tayyor: ${result.video}`);

  const record: HistoryItem = {
    topic: `hop:${members.join("-")}`,
    format: "hop",
    title,
    folder: path.relative(settings.outputDir, jobDir),
    created: new Date().toISOString(),
    videoId: null,
  };
  if (opts.upload) {
    const { upload } = await import("./youtube");
    record.videoId = await upload({ video: result.video, title, description, tags, privacy: opts.privacy, publishAt: opts.publishAt });
    log(`Yuklandi: https://youtu.be/${record.videoId}`);
  }
  await save(HISTORY_FILE, [...(await load<HistoryItem>(HISTORY_FILE)), record]);
  return record;
};
