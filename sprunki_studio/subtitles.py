"""So'z vaqtlaridan ASS subtitr yaratish (har bir aytilayotgan so'z sariq bo'lib yonadi)."""

from __future__ import annotations

from pathlib import Path

from .tts import Word


def _ts(seconds: float) -> str:
    seconds = max(0.0, seconds)
    hours = int(seconds // 3600)
    minutes = int(seconds % 3600 // 60)
    secs = seconds % 60
    return f"{hours}:{minutes:02d}:{secs:05.2f}"


def _escape(text: str) -> str:
    return text.replace("\\", "").replace("{", "(").replace("}", ")")


def group_words(words: list[Word], per_line: int) -> list[list[Word]]:
    """So'zlarni qatorlarga bo'ladi; gap tugaganda yangi qator boshlanadi."""
    lines: list[list[Word]] = []
    current: list[Word] = []
    for word in words:
        current.append(word)
        ends_sentence = word.text.rstrip()[-1:] in ".!?,;:"
        if len(current) >= per_line or ends_sentence:
            lines.append(current)
            current = []
    if current:
        lines.append(current)
    return lines


def write_ass(words: list[Word], out_file: Path, width: int, height: int, font: str, per_line: int) -> Path:
    vertical = height > width
    font_size = round(width * (0.095 if vertical else 0.045))
    margin_v = round(height * (0.30 if vertical else 0.07))
    outline = max(3, font_size // 12)

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,{font},{font_size},&H00FFFFFF,&H0000FFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,{outline},{max(2, outline // 2)},2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    lines = group_words(words, per_line)
    for line_index, line in enumerate(lines):
        line_end = line[-1].end
        # Keyingi qator boshlanguncha ko'rinib tursin (lekin 0.6 soniyadan ko'p emas)
        if line_index + 1 < len(lines):
            line_end = min(lines[line_index + 1][0].start, line_end + 0.6)
        for word_index, word in enumerate(line):
            start = word.start
            end = line[word_index + 1].start if word_index + 1 < len(line) else line_end
            if end <= start:
                continue
            parts = []
            for i, other in enumerate(line):
                text = _escape(other.text.upper() if vertical else other.text)
                if i == word_index:
                    pop = r"\fscx112\fscy112" if vertical else ""
                    parts.append(r"{\c&H00FFFF&" + pop + "}" + text + r"{\r}")
                else:
                    parts.append(text)
            intro = r"{\fad(60,0)}" if word_index == 0 else ""
            events.append(f"Dialogue: 0,{_ts(start)},{_ts(end)},Main,,0,0,0,,{intro}{' '.join(parts)}")

    out_file.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return out_file
