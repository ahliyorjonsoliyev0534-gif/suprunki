"""YouTube thumbnail (1280x720): yorqin rasm + katta matn."""

from __future__ import annotations

import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

from .visuals import _bold_font, cover

SIZE = (1280, 720)


def make_thumbnail(background: Path, text: str, out_file: Path, channel: str) -> Path:
    image = cover(Image.open(background), SIZE)
    image = ImageEnhance.Color(image).enhance(1.35)
    image = ImageEnhance.Contrast(image).enhance(1.15)

    # Matn o'qilishi uchun chap tomonni qoraytiramiz
    shade = Image.new("L", SIZE, 0)
    draw_shade = ImageDraw.Draw(shade)
    for x in range(SIZE[0]):
        draw_shade.line([(x, 0), (x, SIZE[1])], fill=int(max(0, 200 - x * 0.28)))
    image = Image.composite(Image.new("RGB", SIZE, (0, 0, 0)), image, shade)

    draw = ImageDraw.Draw(image)
    words = (text or "").upper().strip()
    if words:
        lines = textwrap.wrap(words, width=12)[:3]
        font_size = 150 if len(lines) == 1 else 125 if len(lines) == 2 else 100
        font = ImageFont.truetype(_bold_font(), font_size)
        y = SIZE[1] // 2 - (len(lines) * font_size * 1.05) / 2
        colors = ["#FFE600", "#FFFFFF", "#FF3DB4"]
        for i, line in enumerate(lines):
            draw.text((50, y), line, font=font, fill=colors[i % len(colors)],
                      stroke_width=12, stroke_fill="black")
            y += font_size * 1.05

    badge_font = ImageFont.truetype(_bold_font(), 34)
    draw.rounded_rectangle((40, 30, 60 + draw.textlength(channel.upper(), font=badge_font), 85),
                           radius=14, fill="#FF0055")
    draw.text((50, 38), channel.upper(), font=badge_font, fill="white")

    image.save(out_file, quality=95)
    return out_file
