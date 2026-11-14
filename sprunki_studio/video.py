"""FFmpeg bilan montaj: rasm + ovoz -> harakatli sahna -> yagona video + subtitr + musiqa."""

from __future__ import annotations

import math
import random
import shutil
import subprocess
from pathlib import Path

from PIL import ImageFont

from .config import settings

AUDIO_PAD = 0.30  # har sahna oxirida qisqa pauza (soniya)


def run(cmd: list[str], cwd: Path | None = None) -> None:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg xatosi:\n{' '.join(cmd)}\n{result.stderr[-3000:]}")


def check_ffmpeg() -> None:
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("FFmpeg topilmadi. O'rnating: https://ffmpeg.org/download.html")


def media_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def scene_duration(audio_seconds: float, fps: int) -> float:
    """Kadrlar soniga to'g'ri keladigan aniq davomiylik (ovoz va video mos bo'lishi uchun)."""
    return math.ceil((audio_seconds + AUDIO_PAD) * fps) / fps


EFFECTS = ["zoom_in", "pan_right", "zoom_out", "pan_left"]


def _zoompan(effect: str, frames: int, width: int, height: int, fps: int) -> str:
    progress = f"(on/{max(frames - 1, 1)})"
    center_x, center_y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    if effect == "zoom_in":
        z, x, y = f"1+0.18*{progress}", center_x, center_y
    elif effect == "zoom_out":
        z, x, y = f"1.18-0.18*{progress}", center_x, center_y
    elif effect == "pan_right":
        z, x, y = "1.15", f"(iw-iw/zoom)*{progress}", center_y
    else:  # pan_left
        z, x, y = "1.15", f"(iw-iw/zoom)*(1-{progress})", center_y
    return f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={width}x{height}:fps={fps}"


def render_scene(image: Path, audio: Path, duration: float, effect: str, out_file: Path,
                 width: int, height: int, fps: int) -> Path:
    frames = round(duration * fps)
    video_filter = f"[0:v]{_zoompan(effect, frames, width, height, fps)},setsar=1,format=yuv420p[v]"
    audio_filter = f"[1:a]aresample=48000,apad,atrim=0:{duration:.3f}[a]"
    run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(image), "-i", str(audio),
        "-filter_complex", f"{video_filter};{audio_filter}",
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(fps),
        "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
        "-t", f"{duration:.3f}", str(out_file),
    ])
    return out_file


def concat(clips: list[Path], out_file: Path) -> Path:
    list_file = out_file.with_suffix(".txt")
    list_file.write_text("".join(f"file '{c.resolve().as_posix()}'\n" for c in clips), encoding="utf-8")
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
         "-i", str(list_file), "-c", "copy", str(out_file)])
    return out_file


def subtitle_font(work_dir: Path) -> str:
    """Shrift nomini aniqlaydi va assets/fonts ni ish papkasiga nusxalaydi."""
    fonts_dir = work_dir / "fonts"
    fonts_dir.mkdir(exist_ok=True)
    family = ""
    for path in sorted((settings.assets_dir / "fonts").glob("*.[ot]tf")):
        shutil.copy(path, fonts_dir / path.name)
        if not family:
            family = ImageFont.truetype(str(path), 20).getname()[0]
    return settings.sub_font or family or "Arial"


def pick_music() -> Path | None:
    tracks = [p for p in (settings.assets_dir / "music").glob("*") if p.suffix.lower() in {".mp3", ".wav", ".m4a", ".ogg"}]
    return random.choice(tracks) if tracks else None


def finalize(joined: Path, subtitles: Path | None, out_file: Path, work_dir: Path) -> Path:
    """Subtitrni yopishtiradi va fon musiqasini qo'shadi."""
    inputs = ["-i", str(joined.resolve())]
    music = pick_music()
    if music:
        inputs += ["-stream_loop", "-1", "-i", str(music.resolve())]

    filters = []
    if subtitles:
        # Fayl nomini nisbiy beramiz - Windows yo'llaridagi ":" muammosidan qochish uchun
        filters.append(f"[0:v]subtitles={subtitles.name}:fontsdir=fonts[v]")
        video_map = "[v]"
    else:
        video_map = "0:v"

    if music:
        filters.append(
            f"[1:a]volume={settings.music_volume},aresample=48000[m];"
            "[0:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,apad[a]"
        )
        audio_map = "[a]"
    else:
        audio_map = "0:a"

    cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs]
    if filters:
        cmd += ["-filter_complex", ";".join(filters)]
    cmd += [
        "-map", video_map, "-map", audio_map,
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        "-t", f"{media_duration(joined):.3f}", str(out_file.resolve()),
    ]
    run(cmd, cwd=work_dir)
    return out_file
