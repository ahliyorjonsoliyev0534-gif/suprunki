// Buyruqlar:
//   npm run auth                                     bir marta: YouTube'ga ulanish
//   npm run check                                    sozlamalarni tekshirish
//   npm run ideas -- --format short -n 20            mavzular navbatini to'ldirish
//   npm run make -- --format short                   1 ta Short (mavzu avtomatik, SHORT_SECONDS uzunlikda)
//   npm run make -- --format short --seconds 45      45 soniyalik Short
//   npm run make -- --format long --minutes 10 --topic "Every Sprunki Character Explained"
//   npm run make -- --format short --upload --privacy public
//   npm run make -- --format hop --minutes 3.5 --first uku,saxo,brie,barky   yo'laklar tartibi
//   npm run make -- --format hopshort --first saxo,uku  Neon Hop Short: 2 yo'lakli vertikal duel (~45 s)
//   npm run make -- --format hop --minutes 3.5        Neon Hop: 4 yo'lakli uzun EDM video (OpenAI kerak emas)
//   npm run make -- --format crew --style party --featured zappi            bosh qahramonni tanlash
//   npm run make -- --format crew --style pick --first saxo,uku,barky       pick variantlarini tanlash
//   npm run make -- --format crew --style shadow --featured leafy  "Guess the Shadow": javob shu qahramon
//   npm run make -- --format crew --style odd --featured moxi      "Find the Odd One": 16 ta qahramondan bittasi boshqa rangda
//   npm run make -- --format crew --style band --first saxo,uku,barky,brie,coree,zappi  "Build the Band": 6 ta a'zo birin-ketin qo'shiladi
//   npm run make -- --format story --kind short --seconds 30 --topic "the lost golden beat" --category mystery   dialogli multfilm
//   npm run make -- --format story --kind long --minutes 10 --topic "..." --4k     16:9 epizod (+4K)
//   npm run make -- --format story --script output/<papka>/script.json             tahrirlangan ssenariydan render
//   npm run make -- --format crew --style party      Coree Crew Short (party | pick | shadow | odd | horror | random), OpenAI kerak emas
//   npm run auto -- --crew 2 --shorts 1 --long 0     avtopilot: yasab yuklaydi
//   npm run preview -- output/<papka>                tayyor videoni Remotion Studio'da ochish
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import type { VideoFormat } from "../src/types";
import { ROOT, settings } from "./config";

const [command, ...rest] = process.argv.slice(2);

const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    format: { type: "string", default: "short" },
    topic: { type: "string" },
    minutes: { type: "string", default: "8" },
    seconds: { type: "string" },
    upload: { type: "boolean", default: false },
    privacy: { type: "string" },
    "publish-at": { type: "string" },
    n: { type: "string", short: "n", default: "20" },
    shorts: { type: "string", default: "2" },
    long: { type: "string", default: "0" },
    "spread-hours": { type: "string", default: "0" },
    style: { type: "string", default: "random" },
    crew: { type: "string", default: "0" },
    featured: { type: "string" },
    first: { type: "string" },
    kind: { type: "string", default: "short" },
    category: { type: "string", default: "adventure" },
    script: { type: "string" },
    voice: { type: "string" },
    writer: { type: "string", default: "auto" },
    cast: { type: "string" },
    "4k": { type: "boolean", default: false },
    "no-subtitles": { type: "boolean", default: false },
    "script-only": { type: "boolean", default: false },
    out: { type: "string" },
  },
});

const format = values.format as VideoFormat;
const privacy = values.privacy as "private" | "unlisted" | "public" | undefined;

const main = async (): Promise<void> => {
  if (!["short", "long", "crew", "hop", "hopshort", "story"].includes(format)) throw new Error("--format short, long, crew, hop yoki hopshort bo'lishi kerak");
  switch (command) {
    case "auth": {
      const { authorize, channelInfo } = await import("./youtube");
      const file = await authorize();
      const info = await channelInfo();
      console.log(`Ulandi: ${info.title} (${info.subscribers} obunachi)`);
      console.log(`Token saqlandi: ${file}`);
      console.log("GitHub Actions uchun shu fayl ichidagini YT_TOKEN_JSON secret'iga qo'ying.");
      return;
    }

    case "check": {
      let ok = true;
      const line = (name: string, good: boolean, hint = "") => {
        ok &&= good;
        console.log(`  [${good ? "OK" : "!!"}] ${name}${good ? "" : `  -> ${hint}`}`);
      };
      console.log("Tekshiruv:");
      line("OPENAI_API_KEY", Boolean(settings.openaiApiKey), ".env fayliga yozing");
      const { characterLibrary } = await import("./images");
      const chars = [...(await characterLibrary()).keys()];
      console.log(`  [i] Personaj rasmlari: ${chars.length} ta (${chars.join(", ") || "yo'q - AI rasm ishlatiladi"})`);
      const music = existsSync(path.join(settings.assetsDir, "music"))
        ? readdirSync(path.join(settings.assetsDir, "music")).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f))
        : [];
      console.log(`  [i] Fon musiqasi: ${music.length} ta`);
      try {
        const { channelInfo } = await import("./youtube");
        const info = await channelInfo();
        line(`YouTube kanal: ${info.title} (${info.subscribers} obunachi)`, true);
      } catch (error) {
        line("YouTube ulanish", false, (error as Error).message);
      }
      process.exitCode = ok ? 0 : 1;
      return;
    }

    case "ideas": {
      const { addIdeas } = await import("./pipeline");
      for (const idea of await addIdeas(format, Number(values.n))) console.log(`  + ${idea}`);
      return;
    }

    case "make": {
      if ((format as string) === "hop" || (format as string) === "hopshort") {
        const { makeHop } = await import("./pipeline");
        await makeHop({
          minutes: Number(values.minutes),
          short: (format as string) === "hopshort",
          members: values.first ? values.first.split(",").map((x) => x.trim()) : undefined,
          upload: values.upload,
          privacy,
          publishAt: values["publish-at"],
        });
        return;
      }
      if ((format as string) === "story") {
        // Sprunki Core Studio: mavzu -> dialogli multfilm (--kind short|long, --seconds 15|30|45|60, --minutes 3|10|20|30|60)
        const { makeStory } = await import("./story");
        const kind = values.kind === "long" ? "long" : "short";
        await makeStory({
          topic: values.topic,
          category: values.category as never,
          aspect: kind,
          seconds: kind === "long" ? Number(values.minutes) * 60 : Number(values.seconds ?? 30),
          scriptFile: values.script,
          voice: values.voice as never,
          writer: values.writer as never,
          cast: values.cast ? values.cast.split(",").map((x) => x.trim()) : undefined,
          uhd: values["4k"],
          subtitles: !values["no-subtitles"],
          scriptOnly: values["script-only"],
          out: values.out,
        });
        return;
      }
      if ((format as string) === "crew") {
        const { makeCrew } = await import("./pipeline");
        await makeCrew({
          style: values.style as "party" | "horror" | "pick" | "shadow" | "odd" | "band" | "mix" | "hero" | "levels" | "survive" | "game" | "random",
          featured: values.featured,
          first: values.first ? values.first.split(",").map((x) => x.trim()) : undefined,
          upload: values.upload,
          privacy,
          publishAt: values["publish-at"],
        });
        return;
      }
      const { make } = await import("./pipeline");
      await make({
        topic: values.topic,
        format,
        minutes: Number(values.minutes),
        seconds: values.seconds ? Number(values.seconds) : undefined,
        upload: values.upload,
        privacy,
        publishAt: values["publish-at"],
      });
      return;
    }

    case "voice-test": {
      // Studio "AI Voice Studio": bitta qahramon ovozini sinash
      const { createVoices } = await import("./story-audio");
      const { loadProfiles } = await import("./story-writer");
      const id = values.cast ?? "coree";
      const out = values.out ?? path.join(settings.outputDir, "voice-tests");
      const [v] = await createVoices(
        [{ speaker: id, text: values.topic ?? "Hi! I'm ready for a brand new adventure!", emotion: (values.category as never) ?? "happy" }],
        await loadProfiles(),
        path.join(out, `${id}-${Date.now()}`),
        (values.voice as never) ?? "auto",
      );
      console.log(`Ovoz: ${v.audio} (${v.seconds.toFixed(1)} s)`);
      return;
    }

    case "auto": {
      // Bir nechta video yasaydi; --spread-hours berilsa, har biri shuncha soat oralig'ida ochiladi
      const { make, makeCrew } = await import("./pipeline");
      type Job = VideoFormat | "crew";
      let jobs: Job[] = [
        ...Array<Job>(Number(values.crew)).fill("crew"),
        ...Array<Job>(Number(values.shorts)).fill("short"),
        ...Array<Job>(Number(values.long)).fill("long"),
      ];
      if (!settings.openaiApiKey && jobs.some((j) => j !== "crew")) {
        console.warn("OPENAI_API_KEY yo'q: ovozli videolar o'tkazib yuboriladi, faqat Coree Crew Shorts yasaladi.");
        jobs = jobs.filter((j) => j === "crew");
      }
      const spread = Number(values["spread-hours"]);
      const start = Date.now() + 60 * 60 * 1000;
      let failures = 0;
      for (const [i, jobFormat] of jobs.entries()) {
        const publishAt = spread > 0 ? new Date(start + i * spread * 3600_000).toISOString().replace(/\.\d+Z$/, "Z") : null;
        try {
          if (jobFormat === "crew") await makeCrew({ style: "random", upload: true, privacy, publishAt });
          else await make({ format: jobFormat, minutes: Number(values.minutes), upload: true, privacy, publishAt });
        } catch (error) {
          failures++;
          console.error(error);
        }
      }
      if (jobs.length && failures === jobs.length) process.exitCode = 1;
      return;
    }

    case "preview": {
      const folder = positionals[0];
      if (!folder || !existsSync(path.join(folder, "props.json"))) {
        throw new Error("Foydalanish: npm run preview -- output/<video papkasi>");
      }
      spawnSync(
        "npx",
        ["remotion", "studio", "src/index.ts", `--public-dir=${path.resolve(folder)}`, `--props=${path.resolve(folder, "props.json")}`],
        { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
      );
      return;
    }

    default:
      console.log("Buyruqlar: auth | check | ideas | make | auto | preview  (batafsil: README.md)");
  }
};

main().catch((error) => {
  console.error(`\nXato: ${(error as Error).message}`);
  process.exit(1);
});
