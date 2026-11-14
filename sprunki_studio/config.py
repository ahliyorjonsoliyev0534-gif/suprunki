"""Barcha sozlamalar .env faylidan (yoki muhit o'zgaruvchilaridan) o'qiladi."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes", "ha", "on"}


@dataclass(frozen=True)
class Settings:
    # --- Kanal ---
    channel_name: str = _env("CHANNEL_NAME", "Sprunki Core")
    niche: str = _env("CHANNEL_NICHE", "Sprunki (the Incredibox fan mod): characters, phases, lore, theories and rankings")

    # --- OpenAI (ssenariy) ---
    openai_api_key: str = _env("OPENAI_API_KEY")
    openai_model: str = _env("OPENAI_MODEL", "gpt-4o-mini")

    # --- Ovoz (Edge-TTS, bepul) ---
    voice: str = _env("TTS_VOICE", "en-US-AndrewMultilingualNeural")
    voice_rate: str = _env("TTS_RATE", "+8%")
    voice_pitch: str = _env("TTS_PITCH", "+0Hz")

    # --- Rasmlar ---
    image_provider: str = _env("IMAGE_PROVIDER", "pollinations")  # pollinations | none
    image_style: str = _env(
        "IMAGE_STYLE",
        "Sprunki style cartoon character, simple rounded mascot body, big expressive eyes, "
        "vivid neon colors, bold black outlines, playful music stage background, 2D vector art, high detail",
    )

    # --- Subtitr ---
    sub_font: str = _env("SUB_FONT", "")  # bo'sh bo'lsa assets/fonts ichidagi birinchi shrift

    # --- Musiqa ---
    music_volume: float = float(_env("MUSIC_VOLUME", "0.10"))

    # --- YouTube ---
    made_for_kids: bool = _bool("MADE_FOR_KIDS", True)
    default_privacy: str = _env("YT_PRIVACY", "private")  # private | unlisted | public
    category_id: str = _env("YT_CATEGORY_ID", "20")  # 20 = Gaming, 24 = Entertainment
    client_secret_file: Path = ROOT / _env("YT_CLIENT_SECRET_FILE", "client_secret.json")
    token_file: Path = ROOT / _env("YT_TOKEN_FILE", "token.json")

    # --- Papkalar ---
    assets_dir: Path = ROOT / "assets"
    output_dir: Path = ROOT / _env("OUTPUT_DIR", "output")
    data_dir: Path = ROOT / "data"


settings = Settings()


# Har bir format uchun o'lcham va uslub
FORMATS = {
    "short": {"width": 1080, "height": 1920, "fps": 30, "words_per_line": 3, "max_minutes": 0.95},
    "long": {"width": 1920, "height": 1080, "fps": 30, "words_per_line": 6, "max_minutes": 30},
}
