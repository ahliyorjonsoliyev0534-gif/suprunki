// Kanalning o'z ovoz effektlari kutubxonasi: hammasi kod bilan sintez qilinadi (mualliflik huquqisiz).
// Har bir effekt bir necha qatlamdan iborat (ton + filtrlangan shovqin + konvert), shuning uchun "bip" emas, tabiiy eshitiladi.
import fs from "node:fs/promises";
import path from "node:path";

const SR = 44_100;
type Buf = Float32Array;

const wav = (samples: Buf): Buffer => {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  // yumshoq limiter
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.tanh(samples[i] * 1.2) * 0.92 * 32767), 44 + i * 2);
  return b;
};

let seed = 12345;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const buf = (sec: number): Buf => new Float32Array(Math.ceil(sec * SR));

/** Holat-o'zgaruvchan filtr (SVF): lp/bp/hp; chastota va rezonans har namunada o'zgarishi mumkin */
const svf = () => {
  let low = 0, band = 0;
  return (x: number, f: number, q = 0.7) => {
    const k = 2 * Math.sin((Math.PI * Math.min(f, SR / 6)) / SR);
    low += k * band;
    const high = x - low - q * band;
    band += k * high;
    return { low, band, high };
  };
};

const mix = (out: Buf, src: Buf, at = 0, gain = 1) => {
  const o = Math.floor(at * SR);
  for (let i = 0; i < src.length && o + i < out.length; i++) out[o + i] += src[i] * gain;
  return out;
};

const normalize = (b: Buf, peak = 0.9): Buf => {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m;
  // boshi/oxirida "chirt" bo'lmasin
  const fade = Math.min(200, b.length / 4);
  for (let i = 0; i < fade; i++) { b[i] *= i / fade; b[b.length - 1 - i] *= i / fade; }
  return b;
};

// ------------------------------------------------------------------ effektlar
/** Pufakcha "pop": ohangi n ga qarab ko'tariladi (pentatonik), ketma-ket chalinsa yoqimli melodiya bo'ladi */
const pop = (n: number): Buf => {
  const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const base = 520 * 2 ** (scale[n % scale.length] / 12);
  const b = buf(0.22);
  let ph = 0;
  const f = svf();
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const fr = base * (1 + 1.4 * Math.exp(-t * 55));
    ph += (2 * Math.PI * fr) / SR;
    const body = Math.sin(ph) * Math.exp(-t * 22);
    const click = f(noise(), 3500, 0.5).band * Math.exp(-t * 300) * 0.6;
    b[i] = body + click + Math.sin(ph * 2) * 0.15 * Math.exp(-t * 40);
  }
  return normalize(b, 0.8);
};

/** Yog'och "tick" (sanoq uchun); hi = oxirgi, balandroq zarb */
const tick = (hi = false): Buf => {
  const b = buf(0.12);
  const f = svf();
  const base = hi ? 2400 : 1700;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const tone = (Math.sin(2 * Math.PI * base * t) + 0.5 * Math.sin(2 * Math.PI * base * 1.58 * t)) * Math.exp(-t * 70);
    b[i] = tone + f(noise(), base, 0.3).band * Math.exp(-t * 200) * 0.8;
  }
  return normalize(b, hi ? 0.9 : 0.7);
};

/** Qo'ng'iroq "ding": haqiqiy qo'ng'iroq partiallari */
const ding = (): Buf => {
  const b = buf(1.6);
  const parts: [number, number, number][] = [[1, 1, 2.2], [2.76, 0.5, 4], [5.4, 0.3, 6], [8.93, 0.15, 9], [2, 0.25, 3]];
  const f0 = 1046;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [r, a, d] of parts) v += Math.sin(2 * Math.PI * f0 * r * t) * a * Math.exp(-t * d);
    b[i] = v * (1 - Math.exp(-t * 800));
  }
  return normalize(b, 0.75);
};

/** "Whoosh": shovqin + suriladigan band-pass filtr */
const whoosh = (sec = 0.7, up = false): Buf => {
  const b = buf(sec);
  const f = svf();
  for (let i = 0; i < b.length; i++) {
    const x = i / b.length;
    const env = Math.sin(Math.PI * x) ** 1.5;
    const fr = up ? 300 + 4000 * x * x : 300 + 3500 * Math.sin(Math.PI * x);
    b[i] = f(noise(), fr, 0.35).band * env;
  }
  return normalize(b, 0.8);
};

/** Ko'tariluvchi "riser" (reveal oldidan taranglik) */
const riser = (): Buf => {
  const sec = 1.4;
  const b = whoosh(sec, true);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const x = i / b.length;
    ph += (2 * Math.PI * (200 + 900 * x * x)) / SR;
    b[i] = b[i] * 0.7 + Math.sin(ph) * 0.25 * x * x;
  }
  return normalize(b, 0.7);
};

/** Bas zarbasi "impact" (katta ochilish) */
const impact = (): Buf => {
  const b = buf(1.2);
  let ph = 0;
  const f = svf();
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (40 + 120 * Math.exp(-t * 18))) / SR;
    b[i] = Math.sin(ph) * Math.exp(-t * 3.5) + f(noise(), 900, 0.6).low * Math.exp(-t * 9) * 0.8;
  }
  return normalize(b, 0.95);
};

const drum = (): Buf => {
  const b = buf(0.45);
  let ph = 0;
  const f = svf();
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (55 + 110 * Math.exp(-t * 30))) / SR;
    b[i] = Math.sin(ph) * Math.exp(-t * 9) + f(noise(), 2500, 0.5).band * Math.exp(-t * 120) * 0.5;
  }
  return normalize(b, 0.9);
};

/** Olomon xursandchiligi: ko'p "ovoz" formantlari + qarsaklar */
const cheer = (): Buf => {
  const sec = 2.2;
  const b = buf(sec);
  const voices = Array.from({ length: 8 }, (_, k) => ({ f: svf(), fr: 500 + k * 230, wob: 3 + k }));
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 6) * Math.exp(-Math.max(0, t - 0.8) * 1.6);
    let v = 0;
    const n = noise();
    for (const vo of voices) v += vo.f(n, vo.fr * (1 + 0.08 * Math.sin(t * vo.wob * 6)), 0.15).band;
    b[i] = v * env * 0.25;
  }
  // qarsaklar
  for (let c = 0; c < 70; c++) {
    const at = Math.abs(noise()) * (sec - 0.3);
    const clap = buf(0.05);
    const f = svf();
    for (let i = 0; i < clap.length; i++) clap[i] = f(noise(), 1800, 0.6).band * Math.exp(-(i / SR) * 90);
    mix(b, clap, at, 0.5 * Math.exp(-Math.max(0, at - 1) * 1.2));
  }
  return normalize(b, 0.85);
};

const boing = (): Buf => {
  const b = buf(0.8);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const fr = 160 + 240 * Math.exp(-t * 5) * (1 + 0.35 * Math.sin(t * 2 * Math.PI * 14));
    ph += (2 * Math.PI * fr) / SR;
    b[i] = (Math.sin(ph) + 0.3 * Math.sin(ph * 2)) * Math.exp(-t * 4);
  }
  return normalize(b, 0.8);
};

/** Sehrli "sparkle" arpedjio */
const magic = (): Buf => {
  const b = buf(1.3);
  const notes = [0, 4, 7, 11, 12, 16, 19, 24];
  notes.forEach((n, k) => {
    const s = buf(0.6);
    const fr = 1046 * 2 ** (n / 12);
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      s[i] = (Math.sin(2 * Math.PI * fr * t) + 0.3 * Math.sin(2 * Math.PI * fr * 3 * t)) * Math.exp(-t * 7);
    }
    mix(b, s, k * 0.07, 0.5);
  });
  const f = svf();
  for (let i = 0; i < b.length; i++) b[i] += f(noise(), 8000, 0.4).high * 0.05 * Math.exp(-(i / SR) * 3);
  return normalize(b, 0.7);
};

const crash = (): Buf => {
  const b = buf(1.4);
  const f = svf();
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const metal = [3200, 4700, 6100].reduce((a, fr) => a + Math.sin(2 * Math.PI * fr * t + noise() * 0.3), 0) * 0.08;
    b[i] = (f(noise(), 5000, 0.5).high + metal) * Math.exp(-t * 3);
  }
  return normalize(b, 0.7);
};

const gasp = (): Buf => {
  const b = buf(0.45);
  const f = svf();
  for (let i = 0; i < b.length; i++) {
    const x = i / b.length;
    b[i] = f(noise(), 900 + 1400 * x, 0.25).band * Math.sin(Math.PI * x) ** 0.7;
  }
  return normalize(b, 0.7);
};

const thunder = (): Buf => {
  const b = buf(2.2);
  const f = svf();
  let brown = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    brown = brown * 0.985 + noise() * 0.15;
    b[i] = f(brown, 180, 0.5).low * (Math.exp(-t * 1.6) + 0.5 * Math.exp(-Math.abs(t - 0.5) * 6));
  }
  return normalize(b, 0.9);
};

/** Barcha effektlar: nom -> sintez */
export const SFX_LIBRARY: Record<string, () => Buf> = {
  ...Object.fromEntries(Array.from({ length: 11 }, (_, n) => [`pop${n}`, () => pop(n)])),
  pop: () => pop(3),
  tick: () => tick(false),
  tick_hi: () => tick(true),
  ding,
  whoosh: () => whoosh(),
  riser,
  impact,
  drum,
  cheer,
  boing,
  magic,
  crash,
  gasp,
  thunder,
};

/** Effektlarni papkaga .wav qilib yozadi (har bir video uchun; bir necha soniya oladi) */
export const writeSfxLibrary = async (dir: string, names?: string[]): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
  seed = 12345;
  for (const name of names ?? Object.keys(SFX_LIBRARY)) {
    const make = SFX_LIBRARY[name];
    if (make) await fs.writeFile(path.join(dir, `${name}.wav`), wav(make()));
  }
};
