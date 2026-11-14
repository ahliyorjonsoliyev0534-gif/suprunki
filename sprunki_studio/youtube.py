"""YouTube Data API v3: rasmiy, xavfsiz yuklash (parol kerak emas, OAuth token ishlatiladi)."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from .config import settings

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]


def _client_config() -> dict:
    raw = os.getenv("YT_CLIENT_SECRET_JSON")
    if raw:
        return json.loads(raw)
    if settings.client_secret_file.exists():
        return json.loads(settings.client_secret_file.read_text())
    raise RuntimeError(
        f"{settings.client_secret_file.name} topilmadi. Google Cloud Console'dan OAuth "
        "(Desktop app) faylini yuklab, loyiha papkasiga qo'ying."
    )


def authorize() -> Path:
    """Bir martalik: brauzer ochiladi, siz kanalingizni tanlab 'Allow' bosasiz."""
    flow = InstalledAppFlow.from_client_config(_client_config(), SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")
    settings.token_file.write_text(creds.to_json())
    return settings.token_file


def _credentials() -> Credentials:
    raw = os.getenv("YT_TOKEN_JSON")
    if raw:
        creds = Credentials.from_authorized_user_info(json.loads(raw), SCOPES)
    elif settings.token_file.exists():
        creds = Credentials.from_authorized_user_file(str(settings.token_file), SCOPES)
    else:
        raise RuntimeError("YouTube'ga ulanmagan. Avval ishga tushiring: python -m sprunki_studio auth")
    if not creds.valid:
        creds.refresh(Request())
        if not raw:
            settings.token_file.write_text(creds.to_json())
    return creds


def service():
    return build("youtube", "v3", credentials=_credentials(), cache_discovery=False)


def channel_info() -> dict:
    response = service().channels().list(part="snippet,statistics", mine=True).execute()
    items = response.get("items", [])
    if not items:
        raise RuntimeError("Bu Google akkauntda YouTube kanal topilmadi.")
    return items[0]


def upload(
    video: Path,
    title: str,
    description: str,
    tags: list[str],
    privacy: str | None = None,
    publish_at: str | None = None,
    thumbnail: Path | None = None,
) -> str:
    """Videoni yuklaydi va video ID sini qaytaradi.

    publish_at: ISO vaqt (masalan 2026-11-20T15:00:00Z) - berilsa video shu vaqtda o'zi ochiladi.
    """
    youtube = service()

    # YouTube teglarining umumiy uzunligi 500 belgidan oshmasligi kerak
    clean_tags, total = [], 0
    for tag in tags:
        tag = str(tag).replace("#", "").strip()[:60]
        if tag and total + len(tag) + 1 <= 480:
            clean_tags.append(tag)
            total += len(tag) + 1

    status = {
        "privacyStatus": "private" if publish_at else (privacy or settings.default_privacy),
        "selfDeclaredMadeForKids": settings.made_for_kids,
        "embeddable": True,
    }
    if publish_at:
        status["publishAt"] = publish_at

    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:4900],
            "tags": clean_tags,
            "categoryId": settings.category_id,
            "defaultLanguage": "en",
            "defaultAudioLanguage": "en",
        },
        "status": status,
    }

    media = MediaFileUpload(str(video), mimetype="video/mp4", chunksize=8 * 1024 * 1024, resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    retries = 0
    while response is None:
        try:
            progress, response = request.next_chunk()
            if progress:
                print(f"  Yuklanmoqda: {int(progress.progress() * 100)}%")
        except HttpError as error:
            if error.resp.status in (500, 502, 503, 504) and retries < 6:
                retries += 1
                time.sleep(2 ** retries)
                continue
            raise

    video_id = response["id"]

    if thumbnail and thumbnail.exists():
        try:
            youtube.thumbnails().set(videoId=video_id, media_body=MediaFileUpload(str(thumbnail))).execute()
        except HttpError as error:
            # Kanal telefon orqali tasdiqlanmagan bo'lsa custom thumbnail ruxsat etilmaydi
            print(f"  Thumbnail qo'yilmadi: {error.reason if hasattr(error, 'reason') else error}")

    return video_id
