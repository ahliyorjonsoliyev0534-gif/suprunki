"""Bepul ovoz: Microsoft Edge-TTS. So'zlarning vaqtini ham qaytaradi (subtitr uchun)."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from pathlib import Path

import edge_tts

from .config import settings

TICKS_PER_SECOND = 10_000_000  # edge-tts vaqtni 100 nanosekundlarda beradi


@dataclass
class Word:
    text: str
    start: float  # soniya
    end: float


async def _synthesize(text: str, out_file: Path) -> list[Word]:
    communicate = edge_tts.Communicate(
        text,
        settings.voice,
        rate=settings.voice_rate,
        pitch=settings.voice_pitch,
        boundary="WordBoundary",
    )
    words: list[Word] = []
    with open(out_file, "wb") as audio:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / TICKS_PER_SECOND
                end = start + chunk["duration"] / TICKS_PER_SECOND
                words.append(Word(chunk["text"], start, end))
    return words


def synthesize(text: str, out_file: Path, retries: int = 4) -> list[Word]:
    """Matnni mp3 ga aylantiradi va so'zlar vaqtini qaytaradi."""
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            words = asyncio.run(_synthesize(text, out_file))
            if out_file.exists() and out_file.stat().st_size > 0:
                return words
        except Exception as error:  # tarmoq xatolari
            last_error = error
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Ovoz yaratib bo'lmadi: {last_error}")
