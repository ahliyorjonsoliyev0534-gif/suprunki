"""OpenAI yordamida ssenariy, sarlavha, tavsif va teglar yozish."""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, field

from openai import OpenAI

from .config import settings

WORDS_PER_MINUTE = 150

SYSTEM_PROMPT = f"""You are the head writer of the YouTube channel "{settings.channel_name}".
Niche: {settings.niche}.
Audience: English-speaking kids and teens (8-15) who love Sprunki.

Rules:
- Write in simple, energetic, natural spoken English. Short sentences. No emojis in narration.
- The first sentence must be a strong hook that creates curiosity.
- Be ORIGINAL: give your own explanations, fun theories, comparisons and rankings.
  Never copy song lyrics. Never claim to be the official creators of Sprunki or Incredibox.
- Clearly mark fan theories as theories ("one theory says...").
- Keep it kid-safe: spooky "horror phase" topics are fine, but no gore, violence details or scary jump-scare wording.
- Characters you can mention include Oren, Raddy, Clukr, Fun Bot, Vineria, Gray, Brud, Garnold,
  Simon, Tunner, Durple, Jevin, Wenda, Sky, Mr. Sun, Mr. Tree, Pinki, OWAKCX, Black (Sprunki Black).
- Always return valid JSON only.
"""


@dataclass
class Scene:
    narration: str
    image_prompt: str
    character: str = ""


@dataclass
class VideoScript:
    title: str
    description: str
    tags: list[str]
    thumbnail_text: str
    scenes: list[Scene] = field(default_factory=list)

    @property
    def word_count(self) -> int:
        return sum(len(s.narration.split()) for s in self.scenes)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "VideoScript":
        return cls(
            title=data["title"],
            description=data["description"],
            tags=list(data.get("tags", [])),
            thumbnail_text=data.get("thumbnail_text", ""),
            scenes=[Scene(**s) for s in data.get("scenes", [])],
        )


class ScriptWriter:
    def __init__(self) -> None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY topilmadi. .env fayliga yozing.")
        self.client = OpenAI(api_key=settings.openai_api_key)

    # ------------------------------------------------------------------ helpers
    def _ask(self, prompt: str, temperature: float = 0.9) -> dict:
        response = self.client.chat.completions.create(
            model=settings.openai_model,
            temperature=temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        return json.loads(response.choices[0].message.content)

    @staticmethod
    def _scenes(raw: list[dict]) -> list[Scene]:
        scenes = []
        for item in raw:
            text = str(item.get("narration", "")).strip()
            if not text:
                continue
            scenes.append(
                Scene(
                    narration=text,
                    image_prompt=str(item.get("image_prompt", "")).strip() or text,
                    character=str(item.get("character", "")).strip(),
                )
            )
        return scenes

    _SCENE_SCHEMA = (
        '"scenes": [{"narration": "spoken text for this scene", '
        '"image_prompt": "visual description of ONE image for this scene, no text in image", '
        '"character": "main Sprunki character name shown, or empty"}]'
    )

    # ------------------------------------------------------------------ ideas
    def ideas(self, count: int, fmt: str, avoid: list[str]) -> list[str]:
        kind = "YouTube Shorts (under 60 seconds)" if fmt == "short" else "5-10 minute YouTube videos"
        avoid_text = "\n".join(f"- {t}" for t in avoid[-80:]) or "- (none)"
        data = self._ask(
            f"Give {count} fresh, highly clickable topic ideas for {kind} on this channel. "
            f"Mix lore, character facts, theories, phase comparisons, rankings and 'which Sprunki are you' quizzes. "
            f"Do NOT repeat these already used topics:\n{avoid_text}\n"
            'Return JSON: {"ideas": ["topic 1", "topic 2"]}'
        )
        return [str(i).strip() for i in data.get("ideas", []) if str(i).strip()][:count]

    # ------------------------------------------------------------------ scripts
    def write(self, topic: str, fmt: str, minutes: float) -> VideoScript:
        if fmt == "short":
            return self._write_short(topic)
        return self._write_long(topic, minutes)

    def _write_short(self, topic: str) -> VideoScript:
        data = self._ask(
            f"Write a YouTube Short about: {topic}\n"
            "Length: 110-140 words of narration in total (about 45-55 seconds).\n"
            "Split it into 8-12 scenes; each scene is 1-2 short sentences.\n"
            "End with a quick question to the viewer (for engagement), e.g. 'Which one is your favorite?'\n"
            "Return JSON with keys: "
            '"title" (max 70 chars, must include #shorts and the word Sprunki), '
            '"description" (2-3 sentences + 5 hashtags), '
            '"tags" (12-15 search keywords), '
            '"thumbnail_text" (max 4 words), '
            + self._SCENE_SCHEMA
        )
        return VideoScript(
            title=str(data.get("title", topic))[:100],
            description=str(data.get("description", "")),
            tags=list(data.get("tags", [])),
            thumbnail_text=str(data.get("thumbnail_text", "")),
            scenes=self._scenes(data.get("scenes", [])),
        )

    def _write_long(self, topic: str, minutes: float) -> VideoScript:
        total_words = int(minutes * WORDS_PER_MINUTE)
        sections = max(3, math.ceil(minutes / 1.5))
        words_per_section = total_words // sections

        outline = self._ask(
            f"Plan a {minutes:g}-minute YouTube video about: {topic}\n"
            f"Create exactly {sections} sections. Section 1 is a hook + intro, the last section is a wrap-up "
            f"that asks viewers to comment and subscribe to {settings.channel_name}.\n"
            "Return JSON with keys: "
            '"title" (max 70 chars, curiosity-driven, includes the word Sprunki), '
            '"description" (4-6 sentences for YouTube SEO + 6 hashtags), '
            '"tags" (15-20 search keywords), '
            '"thumbnail_text" (max 4 punchy words), '
            '"sections": [{"heading": "...", "points": ["key point", "..."]}]',
            temperature=0.8,
        )

        scenes: list[Scene] = []
        previous = ""
        for index, section in enumerate(outline.get("sections", [])[:sections], start=1):
            data = self._ask(
                f"Video topic: {topic}\nVideo title: {outline.get('title')}\n"
                f"Write section {index} of {sections}: {section.get('heading')}\n"
                f"Key points: {json.dumps(section.get('points', []))}\n"
                f"Length: about {words_per_section} words of narration.\n"
                f"Split into scenes of 2-3 sentences each (about 25-40 words per scene).\n"
                f"Continue naturally from the previous section, do not re-introduce the video.\n"
                f"Previous section ended with: {previous[-400:] or '(this is the start)'}\n"
                "Return JSON: {" + self._SCENE_SCHEMA + "}",
                temperature=0.85,
            )
            new_scenes = self._scenes(data.get("scenes", []))
            scenes.extend(new_scenes)
            if new_scenes:
                previous = " ".join(s.narration for s in new_scenes)

        return VideoScript(
            title=str(outline.get("title", topic))[:100],
            description=str(outline.get("description", "")),
            tags=list(outline.get("tags", [])),
            thumbnail_text=str(outline.get("thumbnail_text", "")),
            scenes=scenes,
        )
