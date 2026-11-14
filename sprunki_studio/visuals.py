"""Har bir sahna uchun rasm tayyorlash.

Tartib:
  1. assets/characters/ ichida personaj rasmi bo'lsa (masalan oren.png) - shu ishlatiladi
  2. Aks holda Pollinations.ai orqali bepul AI rasm yaratiladi
  3. Hammasi ishlamasa - rangli fon (video baribir chiqadi)
"""

from __future__ import annotations

import hashlib
import random
import re
import time
import urllib.parse
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .config import settings

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
# Zoom/pan effekti uchun rasm kadrdan biroz kattaroq tayyorlanadi
OVERSCAN = 1.25

PALETTES = [
    ((255, 0, 128), (40, 0, 90)),
    ((0, 200, 255), (20, 0, 80)),
    ((255, 150, 0), (120, 0, 60)),
    ((120, 255, 80), (0, 60, 90)),
    ((180, 80, 255), (10, 10, 40)),
]


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def character_library() -> dict[str, list[Path]]:
    """assets/characters dagi rasmlar: {"oren": [oren.png, oren_2.png], ...}"""
    library: dict[str, list[Path]] = {}
    folder = settings.assets_dir / "characters"
    for path in sorted(folder.rglob("*")):
        if path.suffix.lower() in IMAGE_EXTS:
            name = re.sub(r"[_\-\s]*\d+$", "", path.stem)  # oren_2 -> oren
            library.setdefault(_slug(name), []).append(path)
    return library


def find_character_image(character: str, library: dict[str, list[Path]]) -> Path | None:
    key = _slug(character.replace("sprunki", "").replace("Sprunki", ""))
    if not key:
        return None
    for name, paths in library.items():
        if name and (name == key or name in key or key in name):
            return random.choice(paths)
    return None


# ---------------------------------------------------------------- compositing
def gradient(size: tuple[int, int], seed: int) -> Image.Image:
    top, bottom = PALETTES[seed % len(PALETTES)]
    width, height = size
    base = Image.new("RGB", (1, 256))
    for y in range(256):
        t = y / 255
        base.putpixel((0, y), tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)))
    return base.resize(size, Image.BICUBIC)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Rasmni kadrni to'liq to'ldiradigan qilib kesadi."""
    image = image.convert("RGB")
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def place_character(path: Path, size: tuple[int, int], seed: int) -> Image.Image:
    """Personaj rasmini rangli fon ustiga chiroyli joylashtiradi."""
    source = Image.open(path)
    has_alpha = source.mode in ("RGBA", "LA") or "transparency" in source.info
    source = source.convert("RGBA")

    if not has_alpha:
        # Oddiy rasm: orqa fonda xira nusxa, oldida to'liq rasm
        background = cover(source, size).filter(ImageFilter.GaussianBlur(40))
        background = Image.blend(background, Image.new("RGB", size, (0, 0, 0)), 0.35)
    else:
        background = gradient(size, seed)

    max_w, max_h = int(size[0] * 0.85), int(size[1] * 0.72)
    scale = min(max_w / source.width, max_h / source.height)
    sprite = source.resize((round(source.width * scale), round(source.height * scale)), Image.LANCZOS)
    x = (size[0] - sprite.width) // 2
    y = (size[1] - sprite.height) // 2

    if has_alpha:
        glow = Image.new("RGBA", size, (0, 0, 0, 0))
        mask = sprite.split()[3].point(lambda a: 255 if a > 10 else 0)
        glow.paste((255, 255, 255, 180), (x, y), mask)
        glow = glow.filter(ImageFilter.GaussianBlur(30))
        background = Image.alpha_composite(background.convert("RGBA"), glow)

    canvas = background.convert("RGBA")
    canvas.alpha_composite(sprite, (x, y))
    return canvas.convert("RGB")


def fallback_card(size: tuple[int, int], label: str, seed: int) -> Image.Image:
    image = gradient(size, seed)
    draw = ImageDraw.Draw(image)
    rng = random.Random(seed)
    for _ in range(40):  # "musiqa" nuqtalari
        r = rng.randint(size[0] // 80, size[0] // 25)
        cx, cy = rng.randint(0, size[0]), rng.randint(0, size[1])
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255))
    image = image.filter(ImageFilter.GaussianBlur(6))
    if label:
        draw = ImageDraw.Draw(image)
        font = ImageFont.truetype(_bold_font(), size[0] // 10)
        draw.text(
            (size[0] / 2, size[1] / 2), label.upper(), font=font, anchor="mm",
            fill="white", stroke_width=size[0] // 120, stroke_fill="black",
        )
    return image


def _bold_font() -> str:
    for path in sorted((settings.assets_dir / "fonts").glob("*.[ot]tf")):
        return str(path)
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ):
        if Path(candidate).exists():
            return candidate
    return "DejaVuSans-Bold.ttf"


# ---------------------------------------------------------------- AI images
def pollinations(prompt: str, size: tuple[int, int], seed: int, retries: int = 4) -> Image.Image | None:
    full_prompt = f"{prompt}. {settings.image_style}. no text, no watermark"
    # Pollinations katta rasmlarni sekin beradi, shuning uchun o'rtacha o'lchamda so'raymiz
    scale = 1280 / max(size)
    width, height = round(size[0] * scale), round(size[1] * scale)
    url = (
        "https://image.pollinations.ai/prompt/"
        + urllib.parse.quote(full_prompt[:900])
        + f"?width={width}&height={height}&seed={seed}&nologo=true&model=flux"
    )
    for attempt in range(retries):
        try:
            response = requests.get(url, timeout=120)
            if response.ok and response.headers.get("content-type", "").startswith("image"):
                from io import BytesIO

                return Image.open(BytesIO(response.content)).convert("RGB")
        except requests.RequestException:
            pass
        time.sleep(5 * (attempt + 1))
    return None


# ---------------------------------------------------------------- public API
def scene_image(
    index: int,
    image_prompt: str,
    character: str,
    frame: tuple[int, int],
    out_file: Path,
    library: dict[str, list[Path]],
) -> Path:
    """Sahna uchun rasm yaratadi (kadrdan OVERSCAN marta katta) va yo'lini qaytaradi."""
    size = (round(frame[0] * OVERSCAN), round(frame[1] * OVERSCAN))
    seed = int(hashlib.md5(f"{image_prompt}{index}".encode()).hexdigest()[:8], 16)

    image: Image.Image | None = None
    local = find_character_image(character, library) if character else None
    if local:
        image = place_character(local, size, seed)
    elif settings.image_provider == "pollinations":
        generated = pollinations(image_prompt, frame, seed)
        if generated is not None:
            image = cover(generated, size)

    if image is None:
        image = fallback_card(size, character or "", seed)

    image.save(out_file, quality=92)
    return out_file
