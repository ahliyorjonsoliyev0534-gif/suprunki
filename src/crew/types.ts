// Pipeline (Node) va Remotion o'rtasida umumiy turlar. Bu faylga React yoki CSS import qilmang.

export type CrewStyle = "party" | "horror" | "pick" | "shadow" | "odd";

export type CrewProps = {
  style: CrewStyle;
  featured: string;
  members: string[];
  bpm: number;
  seed: number;
  music: string | null;
  musicVolume: number;
  channelName: string;
  durationInFrames: number;
  /** pick/shadow formati: qaysi variant to'g'ri (0..2); odd formatida boshqacha qahramon katakchasi (0..14) */
  pickIndex: number;
};

/** Har bir format necha zarbdan (beat) iborat */
export const CREW_BEATS: Record<CrewStyle, number> = { party: 17, horror: 16, pick: 14, shadow: 14, odd: 14 };
