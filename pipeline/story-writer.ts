// Sprunki Core Studio: hikoya ssenariysi. OpenAI kaliti bo'lsa AI yozadi, bo'lmasa bepul oflayn generator.
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import type {
  Action, Camera, Emotion, Location, Mood, ScriptLine, ScriptScene, Sfx, StoryAspect, StoryScript,
} from "../src/story/types";
import { log, ROOT, settings } from "./config";

export const CATEGORIES = [
  "adventure", "friendship", "mystery", "comedy", "musical", "emotional", "twist", "battle",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SHORT_SECONDS = [15, 30, 45, 60];
export const LONG_MINUTES = [3, 10, 20, 30, 60];

/** Dialog tezligi: so'z/soniya (pauzalar bilan) */
const WORDS_PER_SECOND = 2.6;

export type Profile = {
  name: string;
  personality: string;
  speakingStyle: string;
  catchphrase: string;
  behavior?: string;
  voice: { edge: string; rate: string; pitch: string; openai: string; instructions: string; babble: number };
};

export const loadProfiles = async (): Promise<Record<string, Profile>> => {
  const raw = JSON.parse(await fs.readFile(path.join(ROOT, "data", "characters.json"), "utf8")) as Record<string, Profile | string>;
  return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_"))) as Record<string, Profile>;
};

const LOCATIONS: Location[] = ["stage", "forest", "city", "space", "beach", "castle", "cave", "studio", "candy"];
const EMOTIONS: Emotion[] = ["happy", "excited", "sad", "angry", "shock", "scared", "calm", "funny"];
const ACTIONS: Action[] = ["none", "jump", "dance", "shake", "spin", "walkIn", "bow", "float"];
const CAMERAS: Camera[] = ["wide", "closeup", "pan", "zoomIn", "zoomOut", "shake"];
const MOODS: Mood[] = ["happy", "tense", "sad", "epic", "funny", "mystery"];
const SFX: Sfx[] = ["whoosh", "pop", "boing", "ding", "drum", "thunder", "magic", "crash", "cheer", "gasp"];

const STYLE_PROMPT =
  "Original 'Sprunki Core' style: simple 2D vector cartoon, rounded capsule-shaped music creatures with big glossy eyes, " +
  "bold black outlines, flat vivid neon colors, playful music-stage world. Original Coree Crew characters only.";

// ------------------------------------------------------------------ yordamchilar
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const words = (s: StoryScript | Pick<ScriptScene, "lines">[]): number =>
  (Array.isArray(s) ? s : s.scenes).reduce((n, sc) => n + sc.lines.reduce((m, l) => m + l.text.split(/\s+/).length, 0), 0);

const pickOne = <T,>(r: () => number, items: readonly T[]): T => items[Math.floor(r() * items.length)];

const sanitize = (script: StoryScript, ids: string[]): StoryScript => {
  const okId = (id: string) => (id === "narrator" || ids.includes(id) ? id : ids[0]);
  const scenes = script.scenes
    .filter((s) => s && Array.isArray(s.lines) && s.lines.length)
    .map((s) => {
      const cast = [...new Set((s.cast ?? []).map((c) => String(c).toLowerCase()).filter((c) => ids.includes(c)))].slice(0, 5);
      const lines: ScriptLine[] = s.lines
        .filter((l) => l && l.text)
        .map((l) => ({
          speaker: okId(String(l.speaker).toLowerCase()),
          text: String(l.text).trim().replace(/(^|[.!?]\s+)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase()),
          emotion: EMOTIONS.includes(l.emotion) ? l.emotion : "happy",
          action: ACTIONS.includes(l.action as Action) ? l.action : "none",
          sfx: SFX.includes(l.sfx as Sfx) ? l.sfx : undefined,
        }));
      for (const l of lines) if (l.speaker !== "narrator" && !cast.includes(l.speaker) && cast.length < 5) cast.push(l.speaker);
      return {
        location: LOCATIONS.includes(s.location) ? s.location : "stage",
        time: s.time === "night" ? "night" : "day",
        camera: CAMERAS.includes(s.camera) ? s.camera : "wide",
        mood: MOODS.includes(s.mood) ? s.mood : "happy",
        cast: cast.length ? cast : [ids[0]],
        description: s.description ?? "",
        lines,
        imagePrompt: s.imagePrompt || `${STYLE_PROMPT} ${s.description ?? ""}`,
        videoPrompt: s.videoPrompt || `${STYLE_PROMPT} ${s.description ?? ""}, smooth character animation`,
        transition: s.transition ?? "fade",
      } as ScriptScene;
    });
  return { ...script, scenes };
};

// ------------------------------------------------------------------ OpenAI
const SYSTEM = (profiles: Record<string, Profile>) => `You are the head writer of the animated YouTube channel "Sprunki Core Studio".
You write ORIGINAL animated stories starring the channel's own music-creature characters, the Coree Crew.
Never use characters, names, songs or lore from Incredibox, official Sprunki mods or any other franchise. No GTA, no realistic gameplay.
Visual identity: ${STYLE_PROMPT}
Audience: kids and teens, English. Kid-safe: no gore, no real violence, no scary jump-scares. Battles are music/dance battles or silly contests.

CHARACTERS (keep personalities and speaking styles consistent; each must sound clearly different):
${Object.entries(profiles)
  .map(([id, p]) => `- ${id} (${p.name}): ${p.personality} Speaks: ${p.speakingStyle}. Catchphrase: "${p.catchphrase}".`)
  .join("\n")}

Story rules: strong hook in the FIRST line (curiosity or a shocking moment), interesting middle, exciting climax, satisfying ending.
Short natural spoken lines (4-18 words). Mostly dialogue; narrator only to set scenes. Show emotions with the emotion field.
Allowed values: location ${LOCATIONS.join("|")}; time day|night; camera ${CAMERAS.join("|")}; mood ${MOODS.join("|")};
emotion ${EMOTIONS.join("|")}; action ${ACTIONS.join("|")}; sfx ${SFX.join("|")}; transition fade|wipe|iris|flash.
Return JSON only.`;

const SCENE_JSON =
  '{"location":"","time":"day","camera":"wide","mood":"happy","cast":["coree","zappi"],"description":"what happens visually",' +
  '"lines":[{"speaker":"coree","text":"","emotion":"excited","action":"jump","sfx":"pop"}],' +
  '"imagePrompt":"detailed prompt for an image generator","videoPrompt":"detailed prompt for an AI video generator (camera move, motion)","transition":"fade"}';

const aiJson = async <T,>(client: OpenAI, system: string, user: string): Promise<T> => {
  const res = await client.chat.completions.create({
    model: settings.openaiModel,
    response_format: { type: "json_object" },
    temperature: 0.95,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  return JSON.parse(res.choices[0].message.content ?? "{}") as T;
};

const writeWithOpenAI = async (opts: WriteOptions, profiles: Record<string, Profile>): Promise<StoryScript> => {
  const client = new OpenAI({ apiKey: settings.openaiApiKey });
  const system = SYSTEM(profiles);
  const targetWords = Math.round(opts.seconds * WORDS_PER_SECOND);
  const vertical = opts.aspect === "short";
  const head = await aiJson<{ title: string; hook: string; description: string; tags: string[]; musicNotes: string; chapters: { summary: string; cast: string[] }[] }>(
    client,
    system,
    `Topic: "${opts.topic}". Category: ${opts.category}. Format: ${vertical ? "YouTube Short, vertical 9:16, fast-paced" : "YouTube long episode 16:9"}.
Length: ${Math.round(opts.seconds)} seconds (~${targetWords} spoken words).
Plan the story. Return {"title":"catchy YouTube title under 70 chars","hook":"3-6 word on-screen hook","description":"YouTube description 2-3 sentences",
"tags":["10 tags"],"musicNotes":"background music and sound design instructions",
"chapters":[{"summary":"what happens","cast":["ids"]}]} with ${Math.max(1, Math.ceil(opts.seconds / 150))} chapters.`,
  );
  const scenes: ScriptScene[] = [];
  const perChapter = Math.ceil(targetWords / Math.max(1, head.chapters.length));
  for (const [i, ch] of head.chapters.entries()) {
    log(`  AI ssenariy: bob ${i + 1}/${head.chapters.length}`);
    const part = await aiJson<{ scenes: ScriptScene[] }>(
      client,
      system,
      `Story "${head.title}" (${opts.category}). Previous: ${scenes.slice(-2).map((s) => s.description).join(" / ") || "start of the story"}.
Write chapter ${i + 1} of ${head.chapters.length}: ${ch.summary}
${i === 0 ? `The very first line must be the hook. ` : ""}${i === head.chapters.length - 1 ? "End with a satisfying ending and a final line asking viewers to comment. " : ""}
About ${perChapter} spoken words, ${Math.max(2, Math.round(perChapter / 45))} scenes. Return {"scenes":[${SCENE_JSON}]}`,
    );
    scenes.push(...(part.scenes ?? []));
  }
  return {
    title: head.title,
    hook: head.hook,
    category: opts.category,
    topic: opts.topic,
    aspect: opts.aspect,
    targetSeconds: opts.seconds,
    description: head.description,
    tags: head.tags ?? [],
    musicNotes: head.musicNotes ?? "",
    scenes,
  };
};

// ------------------------------------------------------------------ oflayn (bepul) generator
type Beat = (c: string[], t: string, r: () => number, p: Record<string, Profile>) => Omit<ScriptScene, "imagePrompt" | "videoPrompt">;

const L = (speaker: string, text: string, emotion: Emotion, action: Action = "none", sfx?: Sfx): ScriptLine => ({ speaker, text, emotion, action, sfx });

const HOOKS: Record<Category, (t: string) => string> = {
  adventure: (t) => `Nobody has ever come back from ${t}... until today.`,
  friendship: (t) => `The Coree Crew is about to break up, all because of ${t}.`,
  mystery: (t) => `Something strange happened tonight, and it all started with ${t}.`,
  comedy: (t) => `This was supposed to be a normal day. Then came ${t}.`,
  musical: (t) => `One song can save the whole music world: ${t}.`,
  emotional: (t) => `Everyone forgot about one little friend, and ${t} changed everything.`,
  twist: (t) => `Everything you think you know about ${t} is wrong.`,
  battle: (t) => `Two crews. One stage. Only one can win ${t}.`,
};

const opening: Beat = (c, t, r, p) => ({
  location: pickOne(r, ["stage", "studio", "city"] as Location[]),
  time: "day",
  camera: "zoomIn",
  mood: "happy",
  cast: c.slice(0, 3),
  description: `The crew is hanging out when news about ${t} arrives.`,
  transition: "iris",
  lines: [
    L(c[0], p[c[0]].catchphrase, "excited", "jump", "drum"),
    L(c[1], `Guys! Did you hear? Everyone is talking about ${t}!`, "shock", "walkIn", "whoosh"),
    L(c[2], `${t}? That sounds like trouble... the fun kind.`, "funny", "none"),
    L(c[0], `Then what are we waiting for? Let's go!`, "excited", "jump", "pop"),
  ],
});

const problem: Record<Category, Beat> = {
  adventure: (c, t, r) => ({
    location: pickOne(r, ["forest", "cave", "space"] as Location[]), time: "night", camera: "pan", mood: "tense", cast: c.slice(0, 3),
    description: `The crew travels into the unknown, searching for ${t}.`, transition: "wipe",
    lines: [
      L("narrator", `The path to ${t} was dark, strange and full of echoes.`, "calm"),
      L(c[1], "Did that rock just... hum a note?", "scared", "shake", "gasp"),
      L(c[2], "Stay close. Whatever is out there, it's listening.", "calm"),
      L(c[0], "Then let's give it something good to listen to!", "excited", "dance", "drum"),
    ],
  }),
  friendship: (c, t) => ({
    location: "studio", time: "day", camera: "closeup", mood: "sad", cast: c.slice(0, 3),
    description: `An argument about ${t} splits the crew.`, transition: "fade",
    lines: [
      L(c[1], `It was MY idea to do ${t}, and nobody even listened!`, "angry", "shake", "crash"),
      L(c[0], "That's not true... we just got excited.", "sad"),
      L(c[2], "Maybe we should take a break from each other.", "sad"),
      L("narrator", "And for the first time ever, the studio went silent.", "calm"),
    ],
  }),
  mystery: (c, t) => ({
    location: "stage", time: "night", camera: "zoomIn", mood: "mystery", cast: c.slice(0, 3),
    description: `The stage is empty, the beat is gone, and only ${t} is left behind.`, transition: "flash",
    lines: [
      L(c[0], "The beat... it's gone! Someone took it!", "shock", "shake", "thunder"),
      L(c[2], `Look at this. ${t}. Right in the middle of the stage.`, "calm", "none", "ding"),
      L(c[1], "So the thief left a clue. Or a trap.", "scared"),
      L(c[0], "Either way, we're solving this tonight.", "angry", "jump", "drum"),
    ],
  }),
  comedy: (c, t, r) => ({
    location: pickOne(r, ["candy", "city", "beach"] as Location[]), time: "day", camera: "shake", mood: "funny", cast: c.slice(0, 3),
    description: `Everything goes hilariously wrong because of ${t}.`, transition: "wipe",
    lines: [
      L(c[1], `Okay, I just need to press this button for ${t}...`, "happy", "none", "pop"),
      L("narrator", "That was not the right button.", "calm", "none", "boing"),
      L(c[2], "Why is everything bouncing?!", "shock", "jump", "boing"),
      L(c[0], "Why am I upside down?!", "funny", "spin", "whoosh"),
    ],
  }),
  musical: (c, t) => ({
    location: "stage", time: "night", camera: "pan", mood: "epic", cast: c.slice(0, 4),
    description: `The music world is losing its colors; only a song about ${t} can fix it.`, transition: "iris",
    lines: [
      L("narrator", "One by one, the colors of the music world began to fade.", "calm", "none", "magic"),
      L(c[2], `The old legend says only a song about ${t} can bring them back.`, "calm"),
      L(c[1], "But nobody knows the melody!", "sad"),
      L(c[0], "Then we'll write it. Together. Note by note.", "excited", "dance", "ding"),
    ],
  }),
  emotional: (c, t) => ({
    location: "beach", time: "night", camera: "closeup", mood: "sad", cast: c.slice(0, 2),
    description: `A lonely crew member feels left out while everyone celebrates ${t}.`, transition: "fade",
    lines: [
      L(c[1], `Everyone is so busy with ${t}... nobody even noticed I was gone.`, "sad"),
      L("narrator", "Far away, the waves played a quiet, lonely song.", "calm"),
      L(c[1], "Maybe they don't need my sound anymore.", "sad"),
    ],
  }),
  twist: (c, t) => ({
    location: "castle", time: "night", camera: "zoomIn", mood: "mystery", cast: c.slice(0, 3),
    description: `The crew investigates the secret of ${t} in an old castle.`, transition: "flash",
    lines: [
      L(c[0], `So this is where ${t} started.`, "calm"),
      L(c[1], "These walls are covered in music notes... and our names!", "shock", "shake", "gasp"),
      L(c[2], "Someone knew we would come here.", "scared", "none", "thunder"),
    ],
  }),
  battle: (c, t) => ({
    location: "stage", time: "night", camera: "zoomIn", mood: "epic", cast: c.slice(0, 4),
    description: `A rival challenges the crew to a music battle for ${t}.`, transition: "flash",
    lines: [
      L(c[3] ?? c[1], `I challenge you to a beat battle! Winner takes ${t}!`, "angry", "bow", "thunder"),
      L(c[0], "Challenge accepted!", "excited", "jump", "drum"),
      L(c[1], "Uh... do we have a plan?", "scared"),
      L(c[2], "Plan? We have rhythm.", "happy", "dance", "pop"),
    ],
  }),
};

const attempt: Beat = (c, t, r, p) => {
  const who = pickOne(r, c);
  const helper = pickOne(r, c.filter((x) => x !== who)) ?? c[0];
  const loc = pickOne(r, LOCATIONS);
  const fail = r() < 0.5;
  return {
    location: loc, time: r() < 0.5 ? "day" : "night", camera: pickOne(r, ["pan", "closeup", "wide"] as Camera[]), mood: fail ? "funny" : "tense",
    cast: [who, helper], description: `${p[who].name} tries a plan in the ${loc}.`, transition: pickOne(r, ["fade", "wipe"] as const),
    lines: [
      L(who, `${p[who].catchphrase} I know how to handle ${t}!`, "excited", "jump", "pop"),
      L(helper, `Are you sure? Last time you said that, we ended up in the ${pickOne(r, LOCATIONS)}.`, "funny"),
      L(who, fail ? "Okay... that did NOT work." : "See? It's working! Kind of!", fail ? "shock" : "happy", fail ? "spin" : "dance", fail ? "crash" : "ding"),
      L(helper, fail ? "We need a better plan. And maybe a helmet." : "Keep going, we're almost there!", fail ? "funny" : "excited"),
    ],
  };
};

const climax: Record<Category, Beat> = {
  adventure: (c, t) => ({ location: "space", time: "night", camera: "zoomOut", mood: "epic", cast: c.slice(0, 4), description: `The crew finally reaches ${t}.`, transition: "flash",
    lines: [L("narrator", `At the edge of the sky, ${t} was finally in sight.`, "calm", "none", "magic"), L(c[1], "It's... beautiful.", "shock"), L(c[0], "Everyone, together, on three! One, two, THREE!", "excited", "jump", "drum"), L(c[2], "It's working!", "excited", "dance", "cheer")] }),
  friendship: (c) => ({ location: "stage", time: "night", camera: "closeup", mood: "happy", cast: c.slice(0, 3), description: "The friends say sorry and make music again.", transition: "iris",
    lines: [L(c[0], "I'm sorry. Your idea was amazing, and I should have listened.", "sad"), L(c[1], "I'm sorry too. It's just no fun without you all.", "happy"), L(c[2], "So... one more song?", "happy", "jump", "drum"), L(c[1], "One more song!", "excited", "dance", "cheer")] }),
  mystery: (c) => ({ location: "cave", time: "night", camera: "zoomIn", mood: "mystery", cast: c.slice(0, 3), description: "The thief is revealed.", transition: "flash",
    lines: [L(c[0], "Okay, thief, the game is over! Show yourself!", "angry", "none", "thunder"), L(c[2], "Wait... it's a tiny echo bug! It just wanted to dance!", "shock", "none", "gasp"), L(c[1], "It took the beat because it was lonely.", "sad"), L(c[0], "Then let's share it. Music is better with friends.", "happy", "dance", "ding")] }),
  comedy: (c) => ({ location: "city", time: "day", camera: "shake", mood: "funny", cast: c.slice(0, 3), description: "The chaos ends in the silliest way.", transition: "wipe",
    lines: [L(c[2], "Quick, press the OTHER button!", "shock", "shake"), L("narrator", "It was a pizza button.", "calm", "none", "pop"), L(c[1], "Best. Mistake. Ever.", "funny", "dance", "cheer")] }),
  musical: (c) => ({ location: "stage", time: "night", camera: "zoomOut", mood: "epic", cast: c.slice(0, 5), description: "The crew sings and colors burst back.", transition: "flash",
    lines: [L(c[0], "Bass, go!", "excited", "dance", "drum"), L(c[1], "Melody, go!", "excited", "dance", "ding"), L(c[2], "Everybody, NOW!", "excited", "jump", "magic"), L("narrator", "And the colors came back brighter than ever.", "happy", "none", "cheer")] }),
  emotional: (c) => ({ location: "stage", time: "night", camera: "closeup", mood: "happy", cast: c.slice(0, 3), description: "The crew finds their friend and brings them home.", transition: "iris",
    lines: [L(c[0], "There you are! We searched everywhere!", "shock", "walkIn", "whoosh"), L(c[1], "You... came for me?", "sad"), L(c[2], "The song isn't complete without your sound.", "happy"), L(c[1], "Then let's finish it. Together.", "happy", "dance", "cheer")] }),
  twist: (c, t) => ({ location: "castle", time: "night", camera: "zoomIn", mood: "mystery", cast: c.slice(0, 3), description: "The big twist is revealed.", transition: "flash",
    lines: [L(c[2], "The person who wrote our names here... it was us. From the future!", "shock", "shake", "thunder"), L(c[1], "Future us left a message!", "shock"), L(c[0], `It says: ${t} was never the problem. It was the answer!`, "excited", "jump", "magic")] }),
  battle: (c) => ({ location: "stage", time: "night", camera: "zoomOut", mood: "epic", cast: c.slice(0, 4), description: "The final round of the beat battle.", transition: "flash",
    lines: [L("narrator", "Final round. The crowd held its breath.", "calm", "none", "drum"), L(c[0], "Let's show them what teamwork sounds like!", "excited", "jump", "drum"), L(c[3] ?? c[1], "Impossible... that beat is perfect!", "shock", "shake", "gasp"), L(c[1], "We did it!", "excited", "dance", "cheer")] }),
};

const ending: Beat = (c, t) => ({
  location: "stage", time: "night", camera: "wide", mood: "happy", cast: c.slice(0, 4), description: "Happy ending, the crew celebrates.", transition: "iris",
  lines: [
    L(c[1], `Who knew ${t} could turn into the best day ever?`, "happy", "dance"),
    L(c[0], "Hey, you watching! Who was your favorite today? Tell us in the comments!", "excited", "jump", "pop"),
  ],
});

const writeOffline = (opts: WriteOptions, profiles: Record<string, Profile>): StoryScript => {
  const r = rng(opts.seed ?? Date.now());
  const ids = Object.keys(profiles).filter((k) => k !== "narrator");
  const cast = [...(opts.cast ?? []), ...ids.sort(() => r() - 0.5)].filter((v, i, a) => ids.includes(v) && a.indexOf(v) === i).slice(0, 6);
  const t = opts.topic;
  const cat = opts.category;
  const target = opts.seconds * (opts.aspect === "short" ? 1.7 : WORDS_PER_SECOND);
  const first = opening(cast, t, r, profiles);
  first.lines.unshift(L(cast[0], HOOKS[cat](t), "shock", "shake", "gasp"));
  const scenes = [first];
  if (opts.seconds > 20) scenes.push(problem[cat](cast, t, r, profiles));
  const tail = [climax[cat](cast, t, r, profiles), ending(cast, t, r, profiles)];
  if (opts.seconds <= 45) {
    // Shorts: tez boshlanish — hook + 2 gap
    scenes.splice(0, 1, { ...first, lines: [first.lines[0], first.lines[2], first.lines[4]] });
  }
  if (opts.seconds <= 20) scenes.splice(1);
  while (words([...scenes, ...tail]) < target && scenes.length < 400) {
    const mixed = [...cast].sort(() => r() - 0.5);
    scenes.push(attempt(mixed, t, r, profiles));
  }
  // Shorts: real ovoz tezligi ~2.3 so'z/s; ortiqcha gaplarni muhimligi past joydan qisqartiramiz
  const story = [...scenes, ...tail];
  if (opts.aspect === "short") {
    const limit = opts.seconds * 2.3;
    const order: [number, number][] = [];
    // olib tashlash tartibi: muammo sahnasi, boshlanish (hookdan keyin), kulminatsiya o'rtasi, yakunning birinchi gapi
    const prob = scenes.length > 1 ? 1 : -1;
    if (prob > 0) for (let i = story[prob].lines.length - 1; i >= 1; i--) order.push([prob, i]);
    for (let i = story[0].lines.length - 1; i >= 1; i--) order.push([0, i]);
    const ci = story.length - 2;
    for (let i = story[ci].lines.length - 2; i >= 1; i--) order.push([ci, i]);
    order.push([story.length - 1, 0]);
    const drop = new Set<string>();
    let count = words(story);
    for (const [sc, li] of order) {
      if (count <= limit) break;
      drop.add(`${sc}:${li}`);
      count -= story[sc].lines[li].text.split(/\s+/).length;
    }
    story.forEach((sc, si) => (sc.lines = sc.lines.filter((_, li) => !drop.has(`${si}:${li}`))));
  }
  const all = story.filter((s) => s.lines.length).map((s) => ({
    ...s,
    imagePrompt: `${STYLE_PROMPT} Scene: ${s.description} Location: ${s.location}, ${s.time}. Characters: ${s.cast.map((id) => profiles[id]?.name).join(", ")}.`,
    videoPrompt: `${STYLE_PROMPT} ${s.description} Camera: ${s.camera}. Characters bounce to the beat, expressive faces, smooth 2D animation.`,
  }));
  const full = HOOKS[cat](t).replace(/\.\.\.|\.$/g, "");
  const title = full.length <= 62 ? full : full.slice(0, 62).replace(/\s+\S*$/, "");
  return {
    title: `${title}! | Coree Crew`,
    hook: (HOOKS[cat](t).split(/(?<=[.!?])\s/)[0].split(" ").length <= 8 ? HOOKS[cat](t).split(/(?<=[.!?])\s/)[0] : `${t}!`).toUpperCase(),
    category: cat,
    topic: t,
    aspect: opts.aspect,
    targetSeconds: opts.seconds,
    description: `A new ${cat} story with the Coree Crew: ${t}! Original characters and music made for Sprunki Core Studio.`,
    tags: ["coree crew", "animation", "cartoon", "story", cat, t, "music characters", "funny animation", "sprunki core studio"],
    musicNotes: `${cat === "mystery" || cat === "twist" ? "Mysterious low synth pads" : "Upbeat original EDM groove"}, duck under dialogue, hits on scene changes.`,
    scenes: all,
  };
};

// ------------------------------------------------------------------ asosiy
export type WriteOptions = {
  topic: string;
  category: Category;
  aspect: StoryAspect;
  seconds: number;
  cast?: string[];
  seed?: number;
  /** "auto": kalit bo'lsa OpenAI, aks holda oflayn */
  writer?: "auto" | "openai" | "offline";
};

export const writeStory = async (opts: WriteOptions): Promise<StoryScript> => {
  const profiles = await loadProfiles();
  const ids = Object.keys(profiles).filter((k) => k !== "narrator");
  const useAi = opts.writer === "openai" || (opts.writer !== "offline" && Boolean(settings.openaiApiKey));
  if (useAi && !settings.openaiApiKey) throw new Error("OPENAI_API_KEY yo'q (.env)");
  log(`Ssenariy: ${useAi ? "OpenAI" : "oflayn generator"} · ${opts.category} · ${Math.round(opts.seconds)} s`);
  const script = useAi ? await writeWithOpenAI(opts, profiles) : writeOffline(opts, profiles);
  return sanitize(script, ids);
};
