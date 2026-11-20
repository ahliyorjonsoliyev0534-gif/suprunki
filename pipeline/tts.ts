// Bepul ovoz: Microsoft Edge-TTS. So'zlarning vaqtini ham qaytaradi (subtitr uchun).
import fs from "node:fs/promises";
import path from "node:path";
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Word } from "../src/types";
import { settings } from "./config";

const TICKS_PER_MS = 10_000; // Edge vaqtni 100 nanosekundlarda beradi

type Metadata = {
  Metadata: { Type: string; Data: { Offset: number; Duration: number; text: { Text: string } } }[];
};

const escapeXml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const audioDurationSeconds = async (file: string): Promise<number> => {
  const result = await parseMedia({ src: file, reader: nodeReader, fields: { slowDurationInSeconds: true }, acknowledgeRemotionLicense: true });
  return result.slowDurationInSeconds;
};

/** Narration sahnasi uchun mp3 yaratadi. Natija: audio fayl yo'li va so'zlar vaqti. */
export const synthesize = async (text: string, dir: string, retries = 4): Promise<{ audio: string; words: Word[] }> => {
  await fs.mkdir(dir, { recursive: true });
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(settings.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
        wordBoundaryEnabled: true,
      });
      const { audioFilePath, metadataFilePath } = await tts.toFile(dir, escapeXml(text), {
        rate: settings.voiceRate,
        pitch: settings.voicePitch,
      });
      const words: Word[] = [];
      if (metadataFilePath) {
        const meta = JSON.parse(await fs.readFile(metadataFilePath, "utf8")) as Metadata;
        for (const item of meta.Metadata) {
          if (item.Type !== "WordBoundary") continue;
          const startMs = item.Data.Offset / TICKS_PER_MS;
          words.push({ text: item.Data.text.Text, startMs, endMs: startMs + item.Data.Duration / TICKS_PER_MS });
        }
      }
      const audio = path.join(dir, "audio.mp3");
      if (audioFilePath !== audio) await fs.rename(audioFilePath, audio);
      return { audio, words: attachPunctuation(text, words) };
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    } finally {
      tts.close();
    }
  }
  // Oxirgi chora: so'z vaqtlarisiz ovoz olamiz va vaqtlarni so'z uzunligiga qarab taxminlaymiz
  try {
    return await synthesizeWithoutTimings(text, dir);
  } catch (error) {
    throw new Error(`Ovoz yaratib bo'lmadi: ${String(lastError)} / ${String(error)}`);
  }
};

const synthesizeWithoutTimings = async (text: string, dir: string): Promise<{ audio: string; words: Word[] }> => {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(settings.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioFilePath } = await tts.toFile(dir, escapeXml(text), { rate: settings.voiceRate, pitch: settings.voicePitch });
    const audio = path.join(dir, "audio.mp3");
    if (audioFilePath !== audio) await fs.rename(audioFilePath, audio);
    return { audio, words: estimateWords(text, (await audioDurationSeconds(audio)) * 1000) };
  } finally {
    tts.close();
  }
};

/** So'zlar vaqtini taxminlash: har so'zga uzunligiga mos ulush beriladi */
export const estimateWords = (text: string, totalMs: number): Word[] => {
  const tokens = text.split(/\s+/).filter(Boolean);
  const weights = tokens.map((t) => t.replace(/[^a-z0-9]/gi, "").length + 2);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const usable = Math.max(0, totalMs - 150);
  let cursor = 0;
  return tokens.map((token, i) => {
    const length = (weights[i] / sum) * usable;
    const word = { text: token, startMs: cursor, endMs: cursor + length * 0.9 };
    cursor += length;
    return word;
  });
};

/** Edge so'zlarni tinish belgilarisiz qaytaradi; asl matndagi vergul/nuqtalarni qaytarib qo'yamiz. */
export const attachPunctuation = (text: string, words: Word[]): Word[] => {
  const tokens = text.split(/\s+/).filter(Boolean);
  let cursor = 0;
  return words.map((word) => {
    const clean = word.text.toLowerCase().replace(/[^a-z0-9']/g, "");
    for (let i = cursor; i < Math.min(tokens.length, cursor + 4); i++) {
      if (tokens[i].toLowerCase().replace(/[^a-z0-9']/g, "") === clean) {
        cursor = i + 1;
        return { ...word, text: tokens[i] };
      }
    }
    return word;
  });
};
