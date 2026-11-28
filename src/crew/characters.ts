// "Coree Crew" — kanalning o'z (original) personajlari.
// Hammasi oddiy kapsula tanali, katta ko'zli musiqachi jonzotlar; har biri o'z rangi va aksessuari bilan.

export type Accessory =
  | "headphones"
  | "bolt"
  | "curlyHorns"
  | "sprout"
  | "beanie"
  | "crown"
  | "cap"
  | "feather"
  | "halo"
  | "starEars"
  | "visor"
  | "bowtie"
  | "none";

export type CrewShape = "capsule" | "sax" | "ukulele" | "tree" | "cheese";

export type CrewMember = {
  id: string;
  name: string;
  color: string;
  accent: string;
  accessory: Accessory;
  eyes: "round" | "sleepy" | "happy";
  /** Tana shakli: capsule = oddiy Crew, qolganlari = "Band" (jonli asboblar) */
  shape?: CrewShape;
};

export const CREW: CrewMember[] = [
  { id: "coree", name: "Coree", color: "#3DF2FF", accent: "#FF3DB4", accessory: "headphones", eyes: "round" },
  { id: "zappi", name: "Zappi", color: "#FFE14D", accent: "#3D7BFF", accessory: "bolt", eyes: "round" },
  { id: "moxi", name: "Moxi", color: "#A04DFF", accent: "#FFB13D", accessory: "curlyHorns", eyes: "sleepy" },
  { id: "leafy", name: "Leafy", color: "#5BE36B", accent: "#2E9E3E", accessory: "sprout", eyes: "happy" },
  { id: "bloop", name: "Bloop", color: "#3D7BFF", accent: "#FFFFFF", accessory: "beanie", eyes: "round" },
  { id: "rexo", name: "Rexo", color: "#FF4D4D", accent: "#FFD23D", accessory: "crown", eyes: "sleepy" },
  { id: "tiko", name: "Tiko", color: "#FF9A3D", accent: "#1E1E1E", accessory: "cap", eyes: "happy" },
  { id: "pluma", name: "Pluma", color: "#FF8AD8", accent: "#7B2FF7", accessory: "feather", eyes: "round" },
  { id: "nova", name: "Nova", color: "#F4F4F4", accent: "#FFE14D", accessory: "halo", eyes: "sleepy" },
  { id: "grimm", name: "Grimm", color: "#6B6B7B", accent: "#B8B8C8", accessory: "starEars", eyes: "sleepy" },
  { id: "mintz", name: "Mintz", color: "#7FFFD4", accent: "#1E1E1E", accessory: "visor", eyes: "round" },
  { id: "bongo", name: "Bongo", color: "#B07B4F", accent: "#FF3D6B", accessory: "bowtie", eyes: "happy" },
  // --- Band: jonli musiqa asboblari ---
  { id: "saxo", name: "Saxo", color: "#F5C542", accent: "#B8860B", accessory: "none", eyes: "round", shape: "sax" },
  { id: "uku", name: "Uku", color: "#C8743A", accent: "#6B3A12", accessory: "none", eyes: "round", shape: "ukulele" },
  { id: "barky", name: "Barky", color: "#8B5A2B", accent: "#4CCB5A", accessory: "none", eyes: "round", shape: "tree" },
  { id: "brie", name: "Brie", color: "#FFE680", accent: "#D6304A", accessory: "none", eyes: "round", shape: "cheese" },
];

/** Videolarda bosh rolda chiqadigan "Band" personajlari */
export const BAND_IDS = ["saxo", "uku", "barky", "brie"];

/** Rang almashtirish formatlari uchun yorqin palitra */
export const PARTY_COLORS = [
  "#FF4D4D", "#FF9A3D", "#FFE14D", "#5BE36B", "#3DF2FF",
  "#3D7BFF", "#A04DFF", "#FF8AD8", "#F4F4F4", "#6B6B7B",
  "#B07B4F", "#7FFFD4", "#1E1E1E", "#C6FF3D", "#FF3DB4",
];

export const memberById = (id: string): CrewMember => CREW.find((m) => m.id === id) ?? CREW[0];
