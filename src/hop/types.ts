// Neon Hop formati uchun umumiy turlar (Node pipeline ham import qiladi, shuning uchun React/CSS yo'q).

export type HopLane = {
  /** CREW dagi personaj id si */
  member: string;
  /** Yo'lakning neon rangi */
  color: string;
  /** Sarlavhadagi rang nomi (masalan "Purple") */
  colorName: string;
};

export type HopProps = {
  lanes: HopLane[];
  bpm: number;
  seed: number;
  music: string | null;
  durationInFrames: number;
  channelName: string;
};

export const HOP_COLORS: { color: string; colorName: string }[] = [
  { color: "#B44CFF", colorName: "Purple" },
  { color: "#3D9BFF", colorName: "Blue" },
  { color: "#3DFF7A", colorName: "Green" },
  { color: "#FF4FD8", colorName: "Pink" },
  { color: "#FFB03D", colorName: "Orange" },
  { color: "#3DF2FF", colorName: "Cyan" },
];
