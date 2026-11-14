// OpenAI yordamida ssenariy, sarlavha, tavsif va teglar yozish.
import OpenAI from "openai";
import type { VideoFormat } from "../src/types";
import { settings } from "./config";

const WORDS_PER_MINUTE = 150;

const HOST = settings.hostName;

const SYSTEM_PROMPT = `You are the head writer of the YouTube channel "${settings.channelName}" (${settings.channelHandle}).
Niche: ${settings.niche}.
Audience: English-speaking kids and teens (8-15) who love Sprunki.

The narrator is ${HOST}, the channel's own mascot host: a cheerful, music-loving blob with headphones.
${HOST} speaks in first person, has real opinions ("honestly, my favorite is..."), reacts with surprise and humor,
and talks directly to the viewer ("you"). ${HOST} is NOT a Sprunki character, just the host of this channel.

Originality rules (very important, YouTube rejects repetitive mass-produced content):
- Every video needs a unique angle: ${HOST}'s own ranking, own reasoning, own fan theory, own comparison or a fun mini-story.
- Add at least 2 specific details or observations (colors, sounds, phase changes, how characters interact) and explain WHY they matter.
- Vary sentence openings and hooks. Do not start with "Did you know" or "Hey guys". No generic filler like "in this video we will".
- Include one small personal moment from ${HOST} (an opinion, a joke, a reaction).
- Never copy song lyrics, wiki text or other creators' scripts. Never claim to be the official creators of Sprunki or Incredibox.
- Clearly mark fan theories as theories ("one theory says..." / "my theory is...").

Style rules:
- Simple, energetic, natural spoken English. Short sentences. No emojis in narration.
- The first sentence must be a strong hook that creates curiosity.
- Kid-safe: spooky "horror phase" topics are fine, but no gore, violence details or jump-scare wording.
- Characters you can mention include Oren, Raddy, Clukr, Fun Bot, Vineria, Gray, Brud, Garnold,
  Simon, Tunner, Durple, Jevin, Wenda, Sky, Mr. Sun, Mr. Tree, Pinki, OWAKCX, Black (Sprunki Black).
- Always return valid JSON only.`;

/** Har video uchun turli format - kanal bir xil shablonda ko'rinmasligi uchun */
export const STYLES = [
  "Top ranking: count down from the lowest to the highest, with a surprise at number one",
  "Fan theory: present clues one by one like a detective, then give the host's own conclusion",
  "What if story: a short imaginative mini-story about the characters, with a twist ending",
  "Quiz: ask the viewer questions, pause with 'think about it...', then reveal the answers",
  "Myth or fact: test popular claims about Sprunki one by one and judge each one",
  "Versus battle: compare two characters or phases in rounds and pick a winner",
  "Character spotlight: everything about one character, from looks and sound to hidden details",
  "Before and after: how something changes between phases, and why that change is interesting",
];

const pickStyle = (): string => STYLES[Math.floor(Math.random() * STYLES.length)];

const SCENE_SCHEMA =
  '"scenes": [{"narration": "spoken text for this scene", ' +
  '"image_prompt": "visual description of ONE image for this scene, no text in image", ' +
  '"character": "main Sprunki character name shown (just the name, e.g. Oren), or empty"}]';

export type Scene = { narration: string; imagePrompt: string; character: string };

export type VideoScript = {
  title: string;
  description: string;
  tags: string[];
  thumbnailText: string;
  /** Tanlangan format (STYLES dan biri) */
  style: string;
  scenes: Scene[];
};

type Json = Record<string, unknown>;

const str = (value: unknown, fallback = ""): string => (typeof value === "string" ? value.trim() : fallback);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : []);

export const wordCount = (script: VideoScript): number =>
  script.scenes.reduce((sum, s) => sum + s.narration.split(/\s+/).filter(Boolean).length, 0);

export class ScriptWriter {
  private client: OpenAI;

  constructor() {
    if (!settings.openaiApiKey) throw new Error("OPENAI_API_KEY topilmadi. .env fayliga yozing.");
    this.client = new OpenAI({ apiKey: settings.openaiApiKey });
  }

  private async ask(prompt: string, temperature = 0.9): Promise<Json> {
    const response = await this.client.chat.completions.create({
      model: settings.openaiModel,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });
    return JSON.parse(response.choices[0]?.message?.content ?? "{}") as Json;
  }

  private static scenes(raw: unknown): Scene[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item: Json) => ({
        narration: str(item.narration),
        imagePrompt: str(item.image_prompt) || str(item.narration),
        character: str(item.character),
      }))
      .filter((scene) => scene.narration.length > 0);
  }

  async ideas(count: number, format: VideoFormat, avoid: string[]): Promise<string[]> {
    const kind = format === "short" ? "YouTube Shorts (under 60 seconds)" : "5-10 minute YouTube videos";
    const avoidText = avoid.slice(-80).map((t) => `- ${t}`).join("\n") || "- (none)";
    const data = await this.ask(
      `Give ${count} fresh, highly clickable topic ideas for ${kind} on this channel. ` +
        "Mix lore, character facts, theories, phase comparisons, rankings and 'which Sprunki are you' quizzes. " +
        `Do NOT repeat these already used topics:\n${avoidText}\n` +
        'Return JSON: {"ideas": ["topic 1", "topic 2"]}',
    );
    return list(data.ideas).slice(0, count);
  }

  write(topic: string, format: VideoFormat, minutes: number): Promise<VideoScript> {
    return format === "short" ? this.writeShort(topic) : this.writeLong(topic, minutes);
  }

  private async writeShort(topic: string): Promise<VideoScript> {
    const style = pickStyle();
    const data = await this.ask(
      `Write a YouTube Short about: ${topic}\n` +
        `Format: ${style}\n` +
        "Length: 110-140 words of narration in total (about 45-55 seconds).\n" +
        "Split it into 8-12 scenes; each scene is 1-2 short sentences.\n" +
        "End with a quick question to the viewer (for engagement), e.g. 'Which one is your favorite?'\n" +
        "Return JSON with keys: " +
        '"title" (max 70 chars, must include #shorts and the word Sprunki), ' +
        '"description" (2-3 sentences + 5 hashtags), ' +
        '"tags" (12-15 search keywords), ' +
        '"thumbnail_text" (max 4 words), ' +
        SCENE_SCHEMA,
    );
    return {
      title: str(data.title, topic).slice(0, 100),
      description: str(data.description),
      tags: list(data.tags),
      thumbnailText: str(data.thumbnail_text),
      style,
      scenes: ScriptWriter.scenes(data.scenes),
    };
  }

  private async writeLong(topic: string, minutes: number): Promise<VideoScript> {
    const totalWords = Math.round(minutes * WORDS_PER_MINUTE);
    const sectionCount = Math.max(3, Math.ceil(minutes / 1.5));
    const wordsPerSection = Math.round(totalWords / sectionCount);

    const style = pickStyle();
    const outline = await this.ask(
      `Plan a ${minutes}-minute YouTube video about: ${topic}\n` +
        `Format: ${style}\n` +
        `Create exactly ${sectionCount} sections. Section 1 is a hook + intro, the last section is a wrap-up ` +
        `that asks viewers to comment and subscribe to ${settings.channelName}.\n` +
        "Return JSON with keys: " +
        '"title" (max 70 chars, curiosity-driven, includes the word Sprunki), ' +
        '"description" (4-6 sentences for YouTube SEO + 6 hashtags), ' +
        '"tags" (15-20 search keywords), ' +
        '"thumbnail_text" (max 4 punchy words), ' +
        '"sections": [{"heading": "...", "points": ["key point", "..."]}]',
      0.8,
    );

    const sections = (Array.isArray(outline.sections) ? outline.sections : []).slice(0, sectionCount) as Json[];
    const scenes: Scene[] = [];
    let previous = "";
    for (const [i, section] of sections.entries()) {
      const data = await this.ask(
        `Video topic: ${topic}\nVideo title: ${str(outline.title)}\n` +
          `Format of the whole video: ${style}\n` +
          `Write section ${i + 1} of ${sections.length}: ${str(section.heading)}\n` +
          `Key points: ${JSON.stringify(section.points ?? [])}\n` +
          `Length: about ${wordsPerSection} words of narration.\n` +
          "Split into scenes of 2-3 sentences each (about 25-40 words per scene).\n" +
          "Continue naturally from the previous section, do not re-introduce the video.\n" +
          `Previous section ended with: ${previous.slice(-400) || "(this is the start)"}\n` +
          `Return JSON: {${SCENE_SCHEMA}}`,
        0.85,
      );
      const newScenes = ScriptWriter.scenes(data.scenes);
      scenes.push(...newScenes);
      if (newScenes.length) previous = newScenes.map((s) => s.narration).join(" ");
    }

    return {
      title: str(outline.title, topic).slice(0, 100),
      description: str(outline.description),
      tags: list(outline.tags),
      thumbnailText: str(outline.thumbnail_text),
      style,
      scenes,
    };
  }
}
