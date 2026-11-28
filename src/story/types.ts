// Sprunki Core Studio: hikoya (dialogli multfilm) videolari uchun turlar
export type StoryAspect = "short" | "long";
export type Emotion = "happy" | "excited" | "sad" | "angry" | "shock" | "scared" | "calm" | "funny";
export type Action = "none" | "jump" | "dance" | "shake" | "spin" | "walkIn" | "bow" | "float";
export type Location = "stage" | "forest" | "city" | "space" | "beach" | "castle" | "cave" | "studio" | "candy";
export type Camera = "wide" | "closeup" | "pan" | "zoomIn" | "zoomOut" | "shake";
export type Mood = "happy" | "tense" | "sad" | "epic" | "funny" | "mystery";
export type Sfx = "whoosh" | "pop" | "boing" | "ding" | "drum" | "thunder" | "magic" | "crash" | "cheer" | "gasp";

/** Ssenariydagi bitta gap */
export type ScriptLine = {
  /** Qahramon id si (coree, zappi, ...) yoki "narrator" */
  speaker: string;
  text: string;
  emotion: Emotion;
  action?: Action;
  sfx?: Sfx;
};

export type ScriptScene = {
  location: Location;
  time: "day" | "night";
  camera: Camera;
  mood: Mood;
  /** Sahnada turgan qahramonlar (chapdan o'ngga) */
  cast: string[];
  description: string;
  lines: ScriptLine[];
  /** Tashqi AI (rasm/video generator) uchun promptlar */
  imagePrompt: string;
  videoPrompt: string;
  transition?: "fade" | "wipe" | "iris" | "flash";
};

export type StoryScript = {
  title: string;
  hook: string;
  category: string;
  topic: string;
  aspect: StoryAspect;
  targetSeconds: number;
  description: string;
  tags: string[];
  musicNotes: string;
  scenes: ScriptScene[];
};

// ------------------------------------------------------------------ Remotion props (vaqtlar hisoblangan)
export type TimedWord = { text: string; startMs: number; endMs: number };

export type TimedLine = ScriptLine & {
  audio: string | null;
  /** Sahna boshidan kadr hisobida */
  from: number;
  durationInFrames: number;
  words: TimedWord[];
};

export type TimedScene = Omit<ScriptScene, "lines"> & {
  from: number;
  durationInFrames: number;
  lines: TimedLine[];
  sfx: { name: Sfx; from: number }[];
};

export type StoryProps = {
  aspect: StoryAspect;
  title: string;
  hook: string;
  channelName: string;
  music: string | null;
  musicVolume: number;
  scenes: TimedScene[];
  /** Ovoz effektlari fayllari: sfx/<nom>.wav */
  sfxEnabled: boolean;
  subtitles: boolean;
  colors: Record<string, string>;
  names: Record<string, string>;
  durationInFrames: number;
  width: number;
  height: number;
};
