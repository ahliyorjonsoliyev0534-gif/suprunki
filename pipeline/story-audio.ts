// Sprunki Core Studio: qahramonlar ovozi (Edge bepul / OpenAI pullik / oflayn "babble") va ovoz effektlari
import fs from "node:fs/promises";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { HttpsProxyAgent } from "https-proxy-agent";
import OpenAI from "openai";
import type { Emotion, ScriptLine, Sfx, TimedWord } from "../src/story/types";
import { log, settings } from "./config";
import type { Profile } from "./story-writer";
import { audioDurationSeconds, estimateWords } from "./tts";

const SR = 44_100;

/** Proksi orqali ishlaydigan tarmoqlarda (HTTPS_PROXY) Edge ovoz serveriga ulanish */
export const edgeOptions = () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  return proxy ? { agent: new HttpsProxyAgent(proxy) } : undefined;
};
export type VoiceProvider = "auto" | "edge" | "openai" | "babble";

const wav = (samples: Float32Array): Buffer => {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
};

const EMO: Record<Emotion, { rate: number; pitch: number }> = {
  happy: { rate: 4, pitch: 4 }, excited: { rate: 12, pitch: 10 }, sad: { rate: -12, pitch: -8 }, angry: { rate: 6, pitch: -4 },
  shock: { rate: 8, pitch: 14 }, scared: { rate: 10, pitch: 12 }, calm: { rate: -6, pitch: -2 }, funny: { rate: 6, pitch: 8 },
};

const num = (s: string) => Number(String(s).replace(/[^-+\d.]/g, "")) || 0;
const xml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ------------------------------------------------------------------ Edge (bepul)
const edgeLine = async (line: ScriptLine, p: Profile, out: string): Promise<TimedWord[]> => {
  const e = EMO[line.emotion] ?? EMO.happy;
  const tts = new MsEdgeTTS(edgeOptions());
  try {
    await tts.setMetadata(p.voice.edge, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
    const dir = path.dirname(out);
    const rate = `${num(p.voice.rate) + e.rate >= 0 ? "+" : ""}${num(p.voice.rate) + e.rate}%`;
    const pitch = `${num(p.voice.pitch) + e.pitch >= 0 ? "+" : ""}${num(p.voice.pitch) + e.pitch}Hz`;
    const tmp = path.join(dir, `tmp-${path.basename(out, ".mp3")}`);
    await fs.mkdir(tmp, { recursive: true });
    const { audioFilePath, metadataFilePath } = await tts.toFile(tmp, xml(line.text), { rate, pitch });
    await fs.rename(audioFilePath, out);
    const words: TimedWord[] = [];
    if (metadataFilePath) {
      const meta = JSON.parse(await fs.readFile(metadataFilePath, "utf8")) as { Metadata: { Type: string; Data: { Offset: number; Duration: number; text: { Text: string } } }[] };
      for (const m of meta.Metadata) if (m.Type === "WordBoundary") {
        const s = m.Data.Offset / 10_000;
        words.push({ text: m.Data.text.Text, startMs: s, endMs: s + m.Data.Duration / 10_000 });
      }
    }
    await fs.rm(tmp, { recursive: true, force: true });
    const tokens = line.text.split(/\s+/).filter(Boolean);
    return words.length === tokens.length ? words.map((w, i) => ({ ...w, text: tokens[i] })) : estimateWords(line.text, (await audioDurationSeconds(out)) * 1000);
  } finally {
    tts.close();
  }
};

// ------------------------------------------------------------------ OpenAI (pullik, faqat ruxsat bilan)
const openaiLine = async (line: ScriptLine, p: Profile, out: string): Promise<TimedWord[]> => {
  const client = new OpenAI({ apiKey: settings.openaiApiKey });
  const res = await client.audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    voice: p.voice.openai as "alloy",
    input: line.text,
    instructions: `${p.voice.instructions} Emotion: ${line.emotion}. Character personality: ${p.personality}`,
    response_format: "mp3",
  } as Parameters<typeof client.audio.speech.create>[0]);
  await fs.writeFile(out, Buffer.from(await res.arrayBuffer()));
  return estimateWords(line.text, (await audioDurationSeconds(out)) * 1000);
};

// ------------------------------------------------------------------ oflayn "babble" (internetsiz, bepul)
const babbleLine = async (line: ScriptLine, p: Profile, out: string, seed: number): Promise<TimedWord[]> => {
  const e = EMO[line.emotion] ?? EMO.happy;
  const base = p.voice.babble * (1 + e.pitch / 60);
  const speed = 1 + (num(p.voice.rate) + e.rate) / 100;
  const tokens = line.text.split(/\s+/).filter(Boolean);
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const words: TimedWord[] = [];
  const chunks: { start: number; len: number; f: number }[] = [];
  let t = 0.05;
  for (const tok of tokens) {
    const syl = Math.max(1, Math.round(tok.replace(/[^a-z]/gi, "").length / 3));
    const ws = t;
    for (let k = 0; k < syl; k++) {
      const len = (0.09 + rnd() * 0.05) / speed;
      chunks.push({ start: t, len, f: base * (0.85 + rnd() * 0.35) });
      t += len + 0.02 / speed;
    }
    words.push({ text: tok, startMs: ws * 1000, endMs: t * 1000 });
    t += (/[.!?]$/.test(tok) ? 0.22 : /,$/.test(tok) ? 0.12 : 0.05) / speed;
  }
  const buf = new Float32Array(Math.ceil((t + 0.1) * SR));
  for (const c of chunks) {
    const n = Math.floor(c.len * SR);
    const o = Math.floor(c.start * SR);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const env = Math.sin((Math.PI * i) / n) ** 0.6;
      const f = c.f * (1 + 0.04 * Math.sin(i / 400));
      ph += (2 * Math.PI * f) / SR;
      // "unli" tovush: asosiy ton + formantlar
      const v = Math.sin(ph) * 0.55 + Math.sin(ph * 2) * 0.25 + Math.sin(ph * 3.02) * 0.12;
      buf[o + i] += v * env * 0.5;
    }
  }
  await fs.writeFile(out.replace(/\.mp3$/, ".wav"), wav(buf));
  return words;
};

export type VoicedLine = { audio: string; words: TimedWord[]; seconds: number };

export const createVoices = async (
  lines: ScriptLine[],
  profiles: Record<string, Profile>,
  dir: string,
  provider: VoiceProvider,
): Promise<VoicedLine[]> => {
  await fs.mkdir(dir, { recursive: true });
  let mode: VoiceProvider = provider === "auto" ? "edge" : provider;
  if (mode === "openai" && !settings.openaiApiKey) throw new Error("OpenAI ovozi uchun OPENAI_API_KEY kerak");
  const out: VoicedLine[] = [];
  for (const [i, line] of lines.entries()) {
    const p = profiles[line.speaker] ?? profiles.narrator;
    const file = path.join(dir, `${String(i).padStart(4, "0")}.mp3`);
    let words: TimedWord[];
    try {
      if (mode === "edge") {
        // Edge ba'zan ulanishni uzadi: 3 marta qayta urinamiz
        let tries = 0;
        for (;;) {
          try {
            words = await edgeLine(line, p, file);
            break;
          } catch (e) {
            if (++tries >= 3) throw e;
            await new Promise((r) => setTimeout(r, 1500 * tries));
          }
        }
      }
      else if (mode === "openai") words = await openaiLine(line, p, file);
      else words = await babbleLine(line, p, file, i + 7);
    } catch (error) {
      if (provider !== "auto" || mode === "babble") throw error;
      log(`  Edge ovozi ishlamadi (${String(error).slice(0, 90)}); oflayn babble ovozga o'tildi`);
      mode = "babble";
      words = await babbleLine(line, p, file, i + 7);
    }
    const audio = mode === "babble" ? file.replace(/\.mp3$/, ".wav") : file;
    const seconds = await audioDurationSeconds(audio);
    out.push({ audio, words, seconds });
    if ((i + 1) % 20 === 0) log(`  Ovoz: ${i + 1}/${lines.length}`);
  }
  log(`Ovozlar tayyor (${mode}): ${lines.length} ta gap`);
  return out;
};

// ------------------------------------------------------------------ ovoz effektlari (sintez, mualliflik huquqisiz)
export const createSfx = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
  let seed = 3;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const make = (sec: number, fn: (t: number, i: number) => number) => {
    const b = new Float32Array(Math.floor(sec * SR));
    for (let i = 0; i < b.length; i++) b[i] = fn(i / SR, i);
    return b;
  };
  const tone = (f: (t: number) => number, sec: number, decay: number, vol = 0.6) => {
    let ph = 0;
    return make(sec, (t) => { ph += (2 * Math.PI * f(t)) / SR; return Math.sin(ph) * Math.exp(-t * decay) * vol; });
  };
  let lp = 0;
  const fx: Record<Sfx, Float32Array> = {
    whoosh: make(0.6, (t) => { lp += 0.08 * (rnd() - lp); return lp * Math.sin((Math.PI * t) / 0.6) * 3; }),
    pop: tone((t) => 900 - t * 4000, 0.12, 30),
    boing: tone((t) => 180 + 120 * Math.sin(t * 40) * Math.exp(-t * 4), 0.7, 4),
    ding: make(1.2, (t) => (Math.sin(2 * Math.PI * 1320 * t) + 0.5 * Math.sin(2 * Math.PI * 2640 * t)) * Math.exp(-t * 4) * 0.35),
    drum: tone((t) => 120 * Math.exp(-t * 12) + 45, 0.5, 7, 0.9),
    thunder: make(1.6, (t) => { lp += 0.02 * (rnd() - lp); return lp * Math.exp(-t * 1.8) * 9; }),
    magic: make(1.0, (t) => [0, 4, 7, 12].reduce((a, n, k) => a + (t > k * 0.08 ? Math.sin(2 * Math.PI * 880 * 2 ** (n / 12) * t) * Math.exp(-(t - k * 0.08) * 5) : 0), 0) * 0.18),
    crash: make(0.9, (t) => rnd() * Math.exp(-t * 6) * 0.6),
    cheer: make(1.6, (t) => { lp += 0.15 * (rnd() - lp); return lp * Math.sin((Math.PI * t) / 1.6) * 1.6 * (1 + 0.3 * Math.sin(t * 30)); }),
    gasp: make(0.35, (t) => { lp += 0.3 * (rnd() - lp); return lp * Math.sin((Math.PI * t) / 0.35) * 0.9; }),
  };
  await Promise.all(Object.entries(fx).map(([name, data]) => fs.writeFile(path.join(dir, `${name}.wav`), wav(data))));
};
