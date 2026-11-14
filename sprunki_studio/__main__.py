"""Buyruqlar:

  python -m sprunki_studio auth                       # bir marta: YouTube'ga ulanish
  python -m sprunki_studio check                      # sozlamalarni tekshirish
  python -m sprunki_studio ideas --format short -n 20 # mavzular ro'yxatini to'ldirish
  python -m sprunki_studio make --format short        # 1 ta Short (mavzu avtomatik)
  python -m sprunki_studio make --format long --minutes 8 --topic "Every Sprunki Character Explained"
  python -m sprunki_studio make --format short --upload --privacy public
  python -m sprunki_studio auto --shorts 2 --long 0   # avtopilot: bir nechta video yasab yuklaydi
"""

from __future__ import annotations

import argparse
import shutil
import sys
import traceback
from datetime import datetime, timedelta, timezone

from .config import settings


def cmd_auth(_: argparse.Namespace) -> None:
    from .youtube import authorize, channel_info

    path = authorize()
    info = channel_info()
    print(f"Ulandi: {info['snippet']['title']} ({info['statistics'].get('subscriberCount')} obunachi)")
    print(f"Token saqlandi: {path}")
    print("GitHub Actions uchun shu fayl ichidagini YT_TOKEN_JSON secret'iga qo'ying.")


def cmd_check(_: argparse.Namespace) -> None:
    ok = True

    def line(name: str, good: bool, hint: str = "") -> None:
        nonlocal ok
        ok &= good
        print(f"  [{'OK' if good else '!!'}] {name}" + ("" if good else f"  -> {hint}"))

    print("Tekshiruv:")
    line("FFmpeg", bool(shutil.which("ffmpeg")), "https://ffmpeg.org/download.html dan o'rnating")
    line("OPENAI_API_KEY", bool(settings.openai_api_key), ".env fayliga yozing")
    from .visuals import character_library

    chars = character_library()
    print(f"  [i] Personaj rasmlari: {len(chars)} ta ({', '.join(sorted(chars)) or 'yo`q - AI rasm ishlatiladi'})")
    music = list((settings.assets_dir / 'music').glob('*.mp3'))
    print(f"  [i] Fon musiqasi: {len(music)} ta")
    try:
        from .youtube import channel_info

        info = channel_info()
        line(f"YouTube kanal: {info['snippet']['title']}", True)
    except Exception as error:  # noqa: BLE001
        line("YouTube ulanish", False, str(error))
    sys.exit(0 if ok else 1)


def cmd_ideas(args: argparse.Namespace) -> None:
    from .pipeline import add_ideas

    for idea in add_ideas(args.format, args.n):
        print(f"  + {idea}")


def cmd_make(args: argparse.Namespace) -> None:
    from .pipeline import make

    make(args.topic, args.format, args.minutes, upload=args.upload,
         privacy=args.privacy, publish_at=args.publish_at)


def cmd_auto(args: argparse.Namespace) -> None:
    """Avtopilot. Videolarni yasaydi va bir necha soat oralig'ida ochiladigan qilib rejalashtiradi."""
    from .pipeline import make

    jobs = ["short"] * args.shorts + ["long"] * args.long
    failures = 0
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    for index, fmt in enumerate(jobs):
        publish_at = None
        if args.spread_hours > 0:
            when = start + timedelta(hours=index * args.spread_hours)
            publish_at = when.replace(microsecond=0).isoformat().replace("+00:00", "Z")
        try:
            make(None, fmt, args.minutes, upload=True, privacy=args.privacy, publish_at=publish_at)
        except Exception:  # noqa: BLE001 - bitta video xatosi qolganlarini to'xtatmasin
            failures += 1
            traceback.print_exc()
    if failures == len(jobs):
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(prog="sprunki_studio", description="Sprunki Core uchun avtomatik video zavodi")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("auth", help="YouTube kanalga ulanish (bir marta)").set_defaults(func=cmd_auth)
    sub.add_parser("check", help="Sozlamalarni tekshirish").set_defaults(func=cmd_check)

    p = sub.add_parser("ideas", help="Yangi mavzular yaratish")
    p.add_argument("--format", choices=["short", "long"], default="short")
    p.add_argument("-n", type=int, default=20)
    p.set_defaults(func=cmd_ideas)

    p = sub.add_parser("make", help="Bitta video yasash")
    p.add_argument("--format", choices=["short", "long"], default="short")
    p.add_argument("--topic", default=None, help="Bo'sh qolsa avtomatik tanlanadi")
    p.add_argument("--minutes", type=float, default=8, help="long uchun: 3, 10, 20 ...")
    p.add_argument("--upload", action="store_true", help="Tayyor bo'lgach YouTube'ga yuklash")
    p.add_argument("--privacy", choices=["private", "unlisted", "public"], default=None)
    p.add_argument("--publish-at", default=None, help="Rejalashtirish, masalan 2026-11-20T15:00:00Z")
    p.set_defaults(func=cmd_make)

    p = sub.add_parser("auto", help="Avtopilot: bir nechta videoni yasab yuklash")
    p.add_argument("--shorts", type=int, default=2)
    p.add_argument("--long", type=int, default=0)
    p.add_argument("--minutes", type=float, default=8)
    p.add_argument("--privacy", choices=["private", "unlisted", "public"], default=None)
    p.add_argument("--spread-hours", type=float, default=0,
                   help="Videolar orasidagi soat. 0 = darhol ochiladi")
    p.set_defaults(func=cmd_auto)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
