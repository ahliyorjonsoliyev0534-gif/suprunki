"""Butun jarayon: mavzu -> ssenariy -> ovoz -> rasmlar -> montaj -> thumbnail -> (yuklash)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from . import video as vid
from .config import FORMATS, settings
from .script_writer import ScriptWriter, VideoScript
from .subtitles import write_ass
from .thumbnail import make_thumbnail
from .tts import Word, synthesize
from .visuals import character_library, scene_image

HISTORY_FILE = settings.data_dir / "history.json"
QUEUE_FILE = settings.data_dir / "topics.json"


def log(message: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {message}", flush=True)


# ------------------------------------------------------------------ topics
def _load(path: Path) -> list:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def _save(path: Path, data: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def used_topics() -> list[str]:
    return [item["topic"] for item in _load(HISTORY_FILE)]


def next_topic(fmt: str, writer: ScriptWriter) -> str:
    queue = _load(QUEUE_FILE)
    for item in queue:
        if item.get("format", fmt) == fmt:
            queue.remove(item)
            _save(QUEUE_FILE, queue)
            return item["topic"]
    ideas = writer.ideas(1, fmt, used_topics() + [q["topic"] for q in queue])
    if not ideas:
        raise RuntimeError("Mavzu topilmadi")
    return ideas[0]


def add_ideas(fmt: str, count: int) -> list[str]:
    writer = ScriptWriter()
    queue = _load(QUEUE_FILE)
    ideas = writer.ideas(count, fmt, used_topics() + [q["topic"] for q in queue])
    queue.extend({"topic": idea, "format": fmt} for idea in ideas)
    _save(QUEUE_FILE, queue)
    return ideas


# ------------------------------------------------------------------ build
def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "video"


def build_video(script: VideoScript, fmt: str, work_dir: Path) -> dict:
    """Ssenariydan tayyor mp4 yasaydi."""
    vid.check_ffmpeg()
    spec = FORMATS[fmt]
    width, height, fps = spec["width"], spec["height"], spec["fps"]
    for sub in ("audio", "images", "clips"):
        (work_dir / sub).mkdir(parents=True, exist_ok=True)

    library = character_library()
    clips: list[Path] = []
    all_words: list[Word] = []
    offset = 0.0
    total = len(script.scenes)

    for i, scene in enumerate(script.scenes, start=1):
        log(f"Sahna {i}/{total}: ovoz + rasm")
        audio = work_dir / "audio" / f"{i:03d}.mp3"
        words = synthesize(scene.narration, audio)
        duration = vid.scene_duration(vid.media_duration(audio), fps)

        image = scene_image(i, scene.image_prompt, scene.character, (width, height),
                            work_dir / "images" / f"{i:03d}.jpg", library)
        clip = work_dir / "clips" / f"{i:03d}.mp4"
        vid.render_scene(image, audio, duration, vid.EFFECTS[(i - 1) % len(vid.EFFECTS)],
                         clip, width, height, fps)
        clips.append(clip)

        all_words.extend(Word(w.text, w.start + offset, w.end + offset) for w in words)
        offset += duration

    log("Sahnalar birlashtirilmoqda")
    joined = vid.concat(clips, work_dir / "joined.mp4")

    log("Subtitr va musiqa qo'shilmoqda")
    font = vid.subtitle_font(work_dir)
    subs = write_ass(all_words, work_dir / "subs.ass", width, height, font, spec["words_per_line"])
    final = work_dir / "video.mp4"
    vid.finalize(joined, subs if all_words else None, final, work_dir)

    thumb = None
    if fmt == "long":
        thumb = make_thumbnail(work_dir / "images" / "001.jpg", script.thumbnail_text,
                               work_dir / "thumbnail.jpg", settings.channel_name)

    return {"video": final, "thumbnail": thumb, "duration": offset}


def make(topic: str | None, fmt: str, minutes: float, upload: bool = False,
         privacy: str | None = None, publish_at: str | None = None) -> dict:
    if fmt not in FORMATS:
        raise ValueError("format: short yoki long bo'lishi kerak")
    minutes = min(minutes, FORMATS[fmt]["max_minutes"])

    writer = ScriptWriter()
    topic = topic or next_topic(fmt, writer)
    log(f"Mavzu: {topic}")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    work_dir = settings.output_dir / f"{stamp}-{fmt}-{_slug(topic)}"
    work_dir.mkdir(parents=True, exist_ok=True)

    log("Ssenariy yozilmoqda (OpenAI)")
    script = writer.write(topic, fmt, minutes)
    if not script.scenes:
        raise RuntimeError("Ssenariy bo'sh qaytdi")
    (work_dir / "script.json").write_text(json.dumps(script.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"Ssenariy tayyor: {len(script.scenes)} sahna, {script.word_count} so'z")

    result = build_video(script, fmt, work_dir)
    log(f"Video tayyor: {result['video']} ({result['duration'] / 60:.1f} daqiqa)")

    record = {
        "topic": topic,
        "format": fmt,
        "title": script.title,
        "folder": str(work_dir),
        "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "video_id": None,
    }

    if upload:
        from .youtube import upload as yt_upload

        log("YouTube'ga yuklanmoqda")
        description = script.description.strip()
        description += f"\n\nSubscribe to {settings.channel_name} for more Sprunki videos!"
        description += "\n\nThis is a fan-made channel and is not affiliated with the official Sprunki or Incredibox creators."
        record["video_id"] = yt_upload(
            result["video"], script.title, description, script.tags,
            privacy=privacy, publish_at=publish_at, thumbnail=result["thumbnail"],
        )
        log(f"Yuklandi: https://youtu.be/{record['video_id']}")

    history = _load(HISTORY_FILE)
    history.append(record)
    _save(HISTORY_FILE, history)
    return record
