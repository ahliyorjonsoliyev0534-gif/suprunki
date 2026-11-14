// Original fon musiqasi generatori: har video uchun yangi beat (baraban + bas + akkord + melodiya).
// Hech qanday tayyor trek ishlatilmaydi, shuning uchun mualliflik huquqi muammosi yo'q.
import fs from "node:fs/promises";

const SAMPLE_RATE = 44_100;

/** Takrorlanadigan (seed asosidagi) tasodifiy sonlar */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const midiToHz = (note: number): number => 440 * Math.pow(2, (note - 69) / 12);

// Mashhur, quvnoq akkord ketma-ketliklari (pog'onalar, mazhor gamma bo'yicha)
const PROGRESSIONS = [
  [0, 4, 5, 3], // I V vi IV
  [5, 3, 0, 4], // vi IV I V
  [0, 5, 3, 4], // I vi IV V
  [3, 4, 0, 5], // IV V I vi
  [0, 3, 5, 4], // I IV vi V
];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

const chordNotes = (root: number, degree: number): number[] =>
  [0, 2, 4].map((step) => {
    const index = degree + step;
    return root + MAJOR[index % 7] + 12 * Math.floor(index / 7);
  });

type Track = Float32Array;

const addTone = (
  track: Track,
  start: number,
  duration: number,
  freq: number,
  volume: number,
  wave: "square" | "triangle" | "sine" | "saw",
  attack = 0.005,
  release = 0.08,
): void => {
  const from = Math.floor(start * SAMPLE_RATE);
  const length = Math.floor((duration + release) * SAMPLE_RATE);
  for (let i = 0; i < length && from + i < track.length; i++) {
    const t = i / SAMPLE_RATE;
    const phase = (t * freq) % 1;
    let value: number;
    if (wave === "square") value = phase < 0.5 ? 1 : -1;
    else if (wave === "triangle") value = 4 * Math.abs(phase - 0.5) - 1;
    else if (wave === "saw") value = 2 * phase - 1;
    else value = Math.sin(2 * Math.PI * phase);
    const env =
      t < attack ? t / attack : t < duration ? 1 - 0.3 * ((t - attack) / Math.max(duration, 1e-3)) : 0.7 * Math.max(0, 1 - (t - duration) / release);
    track[from + i] += value * env * volume;
  }
};

const addKick = (track: Track, start: number, volume: number): void => {
  const from = Math.floor(start * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < SAMPLE_RATE * 0.35 && from + i < track.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 50 + 110 * Math.exp(-t * 30);
    phase += freq / SAMPLE_RATE;
    track[from + i] += Math.sin(2 * Math.PI * phase) * Math.exp(-t * 9) * volume;
  }
};

const addNoise = (track: Track, start: number, length: number, decay: number, volume: number, rand: () => number, highpass: boolean): void => {
  const from = Math.floor(start * SAMPLE_RATE);
  let previous = 0;
  for (let i = 0; i < SAMPLE_RATE * length && from + i < track.length; i++) {
    const t = i / SAMPLE_RATE;
    const white = rand() * 2 - 1;
    const sample = highpass ? white - previous : white;
    previous = white;
    track[from + i] += sample * Math.exp(-t * decay) * volume;
  }
};

const toWav = (samples: Track): Buffer => {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return buffer;
};

/** 8 taktlik, takrorlanishga mos (loop) original beat yaratadi va .wav qilib yozadi. */
export const generateMusic = async (out: string, seed: number): Promise<{ bpm: number; key: number }> => {
  const rand = mulberry32(seed);
  const bpm = 96 + Math.floor(rand() * 30);
  const beat = 60 / bpm;
  const bars = 8;
  const total = bars * 4 * beat;
  const track: Track = new Float32Array(Math.ceil(total * SAMPLE_RATE));

  const key = 48 + Math.floor(rand() * 8); // C3..G3
  const progression = PROGRESSIONS[Math.floor(rand() * PROGRESSIONS.length)];
  const leadWave = rand() < 0.5 ? "square" : "triangle";
  // 8 qadamli melodiya naqshi (akkord tovushlari indekslari, -1 = pauza)
  const motif = Array.from({ length: 8 }, () => (rand() < 0.25 ? -1 : Math.floor(rand() * 4)));

  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * 4 * beat;
    const chord = chordNotes(key, progression[bar % progression.length]);

    // Baraban: kick 1 va 3, snare 2 va 4, hi-hat har sakkizlikda
    for (let b = 0; b < 4; b++) {
      const t = barStart + b * beat;
      if (b % 2 === 0) addKick(track, t, 0.9);
      else addNoise(track, t, 0.18, 22, 0.35, rand, false);
      addNoise(track, t, 0.05, 80, 0.12, rand, true);
      addNoise(track, t + beat / 2, 0.05, 80, 0.09, rand, true);
      if (b === 3 && bar % 2 === 1) addKick(track, t + beat / 2, 0.6);
    }

    // Bas: akkord asosiy tovushi, sakkizliklarda sakrab
    for (let s = 0; s < 8; s++) {
      const note = chord[0] - 12 + (s % 4 === 3 ? 12 : 0);
      addTone(track, barStart + (s * beat) / 2, beat * 0.4, midiToHz(note), 0.16, "triangle");
    }

    // Akkord (yumshoq fon)
    for (const note of chord) addTone(track, barStart, beat * 3.8, midiToHz(note + 12), 0.035, "saw", 0.05, 0.2);

    // Melodiya: har 2-taktda naqsh biroz o'zgaradi
    for (let s = 0; s < 8; s++) {
      const step = motif[(s + (bar % 2) * 3) % motif.length];
      if (step < 0) continue;
      const note = step === 3 ? chord[0] + 24 : chord[step] + 12;
      addTone(track, barStart + (s * beat) / 2, beat * 0.35, midiToHz(note), 0.07, leadWave);
    }
  }

  // Normalizatsiya
  let peak = 0;
  for (const v of track) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < track.length; i++) track[i] = (track[i] / peak) * 0.85;

  await fs.writeFile(out, toWav(track));
  return { bpm, key };
};
