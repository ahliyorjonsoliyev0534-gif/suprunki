// Remotion bilan render: props.json + ish papkasidagi fayllar -> video.mp4 (+ thumbnail.jpg)
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import type { CrewProps } from "../src/crew/types";
import type { HopProps } from "../src/hop/types";
import type { StoryProps } from "../src/story/types";
import type { VideoProps } from "../src/types";
import { log, ROOT, settings } from "./config";

export const renderJob = async (
  jobDir: string,
  props: VideoProps | CrewProps | HopProps | StoryProps,
  opts: { thumbnail: boolean; composition?: "SprunkiVideo" | "CrewShort" | "NeonHop" | "NeonHopShort" | "StoryVideo" },
): Promise<{ video: string; thumbnail: string | null }> => {
  await fs.writeFile(path.join(jobDir, "props.json"), JSON.stringify(props, null, 2));

  log("Remotion loyihasi tayyorlanmoqda (bundle)");
  // Ish papkasi "public" papka sifatida beriladi: staticFile("scenes/001/audio.mp3") shu yerdan o'qiladi
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    publicDir: jobDir,
    outDir: path.join(os.tmpdir(), `sprunki-bundle-${path.basename(jobDir)}`),
  });

  const inputProps = props as unknown as Record<string, unknown>;
  const browserExecutable = settings.browserExecutable;

  const composition = await selectComposition({ serveUrl, id: opts.composition ?? "SprunkiVideo", inputProps, browserExecutable });
  const video = path.join(jobDir, "video.mp4");
  let lastPercent = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    outputLocation: video,
    inputProps,
    browserExecutable,
    audioBitrate: "192k",
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== lastPercent) {
        lastPercent = percent;
        log(`  Render: ${percent}%`);
      }
    },
  });

  let thumbnail: string | null = null;
  if (opts.thumbnail) {
    const still = await selectComposition({ serveUrl, id: "Thumbnail", inputProps, browserExecutable });
    thumbnail = path.join(jobDir, "thumbnail.jpg");
    await renderStill({
      composition: still,
      serveUrl,
      output: thumbnail,
      inputProps,
      imageFormat: "jpeg",
      jpegQuality: 92,
      browserExecutable,
    });
  }

  await fs.rm(serveUrl, { recursive: true, force: true });
  return { video, thumbnail };
};

/** Ovoz balandligini YouTube standartiga (-14 LUFS) keltiradi; video qayta kodlanmaydi */
export const loudnorm = async (video: string): Promise<void> => {
  const tmp = video.replace(/\.mp4$/, ".norm.mp4");
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", tmp]);
  if (r.status === 0) await fs.rename(tmp, video);
  else log("Ovoz normalizatsiyasi o'tkazib yuborildi (FFmpeg)");
};
