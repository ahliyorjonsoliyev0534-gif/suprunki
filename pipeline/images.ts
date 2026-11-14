// Har bir sahna uchun rasm:
//   1. assets/characters ichida personaj rasmi bo'lsa (masalan oren.png) - shu ishlatiladi
//   2. Aks holda Pollinations.ai orqali bepul AI rasm
//   3. Hammasi ishlamasa - animatsion fon (video baribir chiqadi)
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { SceneProps } from "../src/types";
import { settings } from "./config";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const slug = (text: string): string => text.toLowerCase().replace(/sprunki/g, "").replace(/[^a-z0-9]+/g, "");

export type CharacterLibrary = Map<string, string[]>;

/** assets/characters: {"oren" => [oren.png, oren_2.png], ...} */
export const characterLibrary = async (): Promise<CharacterLibrary> => {
  const library: CharacterLibrary = new Map();
  const dir = path.join(settings.assetsDir, "characters");
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  for (const file of files.sort()) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    const name = slug(path.basename(file, ext).replace(/[_\-\s]*\d+$/, ""));
    if (!name) continue;
    library.set(name, [...(library.get(name) ?? []), path.join(dir, file)]);
  }
  return library;
};

export const findCharacter = (character: string, library: CharacterLibrary): string | null => {
  const key = slug(character);
  if (!key) return null;
  for (const [name, files] of library) {
    if (name === key || key.includes(name) || name.includes(key)) {
      return files[Math.floor(Math.random() * files.length)];
    }
  }
  return null;
};

const pollinations = async (prompt: string, width: number, height: number, seed: number, out: string, retries = 4): Promise<boolean> => {
  const scale = 1280 / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const fullPrompt = `${prompt}. ${settings.imageStyle}. no text, no watermark`.slice(0, 900);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}` +
    `?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (response.ok && (response.headers.get("content-type") ?? "").startsWith("image")) {
        await fs.writeFile(out, Buffer.from(await response.arrayBuffer()));
        return true;
      }
    } catch {
      // tarmoq xatosi - qayta urinamiz
    }
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  return false;
};

/**
 * Sahna rasmini ish papkasiga joylaydi.
 * Qaytaradi: Remotion uchun nisbiy yo'l (staticFile) va rasm turi.
 */
export const sceneImage = async (opts: {
  index: number;
  prompt: string;
  character: string;
  width: number;
  height: number;
  jobDir: string;
  library: CharacterLibrary;
}): Promise<Pick<SceneProps, "image" | "imageKind">> => {
  const folder = `scenes/${String(opts.index).padStart(3, "0")}`;
  await fs.mkdir(path.join(opts.jobDir, folder), { recursive: true });

  const local = findCharacter(opts.character, opts.library);
  if (local) {
    const rel = `${folder}/character${path.extname(local).toLowerCase()}`;
    await fs.copyFile(local, path.join(opts.jobDir, rel));
    return { image: rel, imageKind: "character" };
  }

  if (settings.imageProvider === "pollinations") {
    const seed = parseInt(crypto.createHash("md5").update(`${opts.prompt}${opts.index}`).digest("hex").slice(0, 8), 16);
    const rel = `${folder}/image.jpg`;
    if (await pollinations(opts.prompt, opts.width, opts.height, seed, path.join(opts.jobDir, rel))) {
      return { image: rel, imageKind: "photo" };
    }
  }

  return { image: null, imageKind: "none" };
};
