import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = (name: string, fallback = ""): string => {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
};

const bool = (name: string, fallback: boolean): boolean => {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "ha", "on"].includes(value);
};

export const settings = {
  channelName: env("CHANNEL_NAME", "SprunkiCoreee"),
  channelHandle: env("CHANNEL_HANDLE", "@SprunkiCoreee"),
  niche: env(
    "CHANNEL_NICHE",
    "Sprunki (the Incredibox fan mod): characters, phases, lore, theories and rankings",
  ),

  openaiApiKey: env("OPENAI_API_KEY"),
  openaiModel: env("OPENAI_MODEL", "gpt-4o-mini"),

  voice: env("TTS_VOICE", "en-US-AndrewMultilingualNeural"),
  voiceRate: env("TTS_RATE", "+8%"),
  voicePitch: env("TTS_PITCH", "+0Hz"),

  imageProvider: env("IMAGE_PROVIDER", "pollinations") as "pollinations" | "none",
  imageStyle: env(
    "IMAGE_STYLE",
    "Sprunki style cartoon character, simple rounded mascot body, big expressive eyes, vivid neon colors, " +
      "bold black outlines, playful music stage background, 2D vector art, high detail",
  ),

  musicVolume: Number(env("MUSIC_VOLUME", "0.12")),
  musicMode: env("MUSIC_MODE", "auto") as "auto" | "generated" | "assets" | "off",

  /** Kanal maskoti "Coree" videolarda boshlovchi bo'lib chiqadi */
  host: bool("HOST_MASCOT", true),
  hostName: env("HOST_NAME", "Coree"),

  madeForKids: bool("MADE_FOR_KIDS", true),
  defaultPrivacy: env("YT_PRIVACY", "private") as "private" | "unlisted" | "public",
  categoryId: env("YT_CATEGORY_ID", "20"),
  clientSecretFile: path.join(ROOT, env("YT_CLIENT_SECRET_FILE", "client_secret.json")),
  tokenFile: path.join(ROOT, env("YT_TOKEN_FILE", "token.json")),

  /** Ixtiyoriy: o'z Chrome/Chromium yo'lingiz (odatda kerak emas, Remotion o'zi yuklab oladi) */
  browserExecutable: env("REMOTION_BROWSER_EXECUTABLE") || null,

  assetsDir: path.join(ROOT, "assets"),
  outputDir: path.join(ROOT, env("OUTPUT_DIR", "output")),
  dataDir: path.join(ROOT, "data"),
};

export const log = (message: string): void => {
  const time = new Date().toTimeString().slice(0, 8);
  console.log(`[${time}] ${message}`);
};
