// Pipeline (Node) va Remotion (React) o'rtasida almashinadigan ma'lumotlar.

export type VideoFormat = "short" | "long";

export type Word = {
  text: string;
  /** Sahna boshidan millisekundlarda */
  startMs: number;
  endMs: number;
};

export type SceneProps = {
  /** staticFile() uchun yo'l, masalan "scenes/001/audio.mp3". null = ovozsiz (faqat Studio namunasi) */
  audio: string | null;
  durationInFrames: number;
  /** staticFile() uchun yo'l yoki null */
  image: string | null;
  /** photo = to'liq ekranli AI rasm, character = shaffof personaj rasmi, none = faqat animatsion fon */
  imageKind: "photo" | "character" | "none";
  character: string;
  words: Word[];
};

export type VideoProps = {
  format: VideoFormat;
  channelName: string;
  title: string;
  thumbnailText: string;
  music: string | null;
  musicVolume: number;
  scenes: SceneProps[];
};

export const FPS = 30;

export const SIZES: Record<VideoFormat, { width: number; height: number }> = {
  short: { width: 1080, height: 1920 },
  long: { width: 1920, height: 1080 },
};

export const PALETTES: [string, string, string][] = [
  ["#ff2e93", "#7b2ff7", "#2a0845"],
  ["#00d2ff", "#3a47d5", "#120136"],
  ["#ff9a00", "#ff1f6b", "#3d0030"],
  ["#7cff4f", "#00a3a3", "#002b3a"],
  ["#b44cff", "#ff4fd8", "#14002e"],
];
