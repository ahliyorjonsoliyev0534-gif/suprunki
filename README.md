# Sprunki Core — avtomatik video zavodi

Ingliz tilidagi Sprunki videolarini o'zi yasab, YouTube'ga o'zi yuklaydigan tizim.

```
Mavzu → Ssenariy (OpenAI) → Ovoz (Edge-TTS) → Rasmlar (sizniki yoki AI) → Montaj (FFmpeg)
      → Subtitr (so'zma-so'z yonadi) → Musiqa → Thumbnail → YouTube (rasmiy API)
```

| Narsa | Vosita | Narxi |
|---|---|---|
| Ssenariy, sarlavha, teglar | OpenAI `gpt-4o-mini` | Bir video taxminan $0.01–0.05 |
| Ovoz | Edge-TTS | Bepul |
| Rasmlar | `assets/characters` dagi rasmlaringiz va Pollinations.ai | Bepul |
| Montaj va subtitr | FFmpeg | Bepul |
| Yuklash | YouTube Data API v3 | Bepul (kuniga taxminan 6 ta yuklash) |
| Har kuni avtomatik ishlash | GitHub Actions | Bepul |

**Formatlar:**
- `short`: vertikal 1080×1920, taxminan 50 soniya
- `long`: gorizontal 1920×1080, uzunligini o'zingiz berasiz (3, 10, 20 daqiqa)

---

## 1. Kompyuterga o'rnatish

1. **Python 3.11+** va **FFmpeg** ni o'rnating.
   - Windows: `winget install Python.Python.3.12` va `winget install Gyan.FFmpeg`
2. Loyihani yuklab oling va kutubxonalarni o'rnating:
   ```bash
   git clone https://github.com/ahliyorjonsoliyev0534-gif/suprunki.git
   cd suprunki
   pip install -r requirements.txt
   ```
3. `.env.example` faylini `.env` deb nusxalang va `OPENAI_API_KEY` ni yozing.

## 2. YouTube'ga ulash (bir marta, parol kerak emas)

1. https://console.cloud.google.com saytiga kiring va yangi loyiha yarating.
2. **APIs & Services → Library** bo'limida **YouTube Data API v3** ni yoqing (Enable).
3. **OAuth consent screen** ni sozlang:
   - User type: External.
   - Ilova nomi va emailingizni yozing.
   - **Test users** ga o'z Gmail'ingizni qo'shing.
4. **Credentials → Create credentials → OAuth client ID → Desktop app** ni tanlang. Yaratilgan JSON faylni yuklab oling va loyiha papkasiga `client_secret.json` nomi bilan qo'ying.
5. Ulanish buyrug'ini ishga tushiring:
   ```bash
   python -m sprunki_studio auth
   ```
   Brauzer ochiladi. **Sprunki Core** kanalini tanlab, "Allow" ni bosing. `token.json` fayli saqlanadi.
6. Hammasi joyidaligini tekshiring:
   ```bash
   python -m sprunki_studio check
   ```

> ⚠️ **Token 7 kundan keyin o'chib qolmasligi uchun:** OAuth consent screen sahifasida **"Publish app"** tugmasini bosing (In production holatiga o'tadi). Ilova faqat sizniki bo'lgani uchun Google tekshiruvi shart emas, faqat kirishda "unverified" ogohlantirishi chiqadi. Uni **Advanced → Continue** orqali o'tib ketasiz.

## 3. Video yasash

```bash
# 1 ta Short, mavzuni o'zi tanlaydi (tekshirish uchun yuklamaydi)
python -m sprunki_studio make --format short

# O'zingiz bergan mavzuda 10 daqiqalik video
python -m sprunki_studio make --format long --minutes 10 --topic "Every Sprunki Character Explained"

# Yasab, darhol YouTube'ga yuklash
python -m sprunki_studio make --format short --upload --privacy public

# Oldindan 20 ta mavzu tayyorlab qo'yish (data/topics.json ga yoziladi, xohlasangiz tahrirlang)
python -m sprunki_studio ideas --format short -n 20
python -m sprunki_studio ideas --format long -n 10

# Avtopilot: 3 ta Short va 1 ta uzun video, har biri 4 soat oralig'ida ochiladi
python -m sprunki_studio auto --shorts 3 --long 1 --minutes 8 --spread-hours 4
```

Natija `output/<sana>-<mavzu>/` papkasiga tushadi. Ichida `video.mp4`, `thumbnail.jpg` va `script.json` bo'ladi.

**Sifatni oshirish uchun:**
- `assets/characters/` papkasiga personaj rasmlarini qo'ying (masalan `oren.png`, `raddy.png`). Shunda videolar haqiqiy Sprunki ko'rinishida chiqadi.
- `assets/music/` papkasiga mualliflik huquqidan xoli musiqa qo'ying.
- `assets/fonts/` papkasiga qalin shrift qo'ying (masalan Luckiest Guy).

## 4. To'liq avtomatik rejim: GitHub Actions (bepul, kompyuter yoqiq turishi shart emas)

1. GitHub'da repo sahifasini oching: **Settings → Secrets and variables → Actions → New repository secret**. Ikkita secret qo'shing:
   - `OPENAI_API_KEY`: OpenAI kalitingiz.
   - `YT_TOKEN_JSON`: `token.json` faylining **butun ichidagi matni**.
2. Ixtiyoriy: **Variables** bo'limida `YT_PRIVACY` (`public`), `TTS_VOICE`, `MADE_FOR_KIDS` ni sozlashingiz mumkin.
3. Bu kod `main` branchiga qo'shilgach, tizim har kuni 19:23 da (Toshkent vaqti) 2 ta Short yasab yuklaydi. Qo'lda ishga tushirish: **Actions → Sprunki Autopilot → Run workflow**.
4. Tayyor videolarni Actions sahifasidan 3 kun davomida yuklab olib ko'rishingiz mumkin.

---

## Muhim qoidalar

- **Videolar avval "Private" bo'lib yuklanadi.** Google yangi API loyihalardan yuklangan videolarni loyiha **audit**dan o'tmaguncha private qilib qo'yadi. Ikkita yo'l bor:
  - Videoni YouTube Studio'da ko'rib chiqib, qo'lda Public qilasiz. Bu qo'shimcha xavfsizlik ham beradi.
  - Yoki bepul audit uchun ariza berasiz: https://support.google.com/youtube/contact/yt_api_form
- **Made for Kids:** standart holatda `true`, chunki Sprunki auditoriyasi bolalar. YouTube qoidasi shuni talab qiladi.
- **Mualliflik huquqi:** Incredibox yoki Sprunki'ning asl treklarini ishlatmang. Tizim o'z ovozi va bepul musiqani ishlatadi.
- **Sifat > miqdor.** YouTube bir xil shablonda ommaviy yasalgan kontentni monetizatsiya qilmaydi. Kuniga 1–3 ta yaxshi video 10 ta o'rtachasidan ko'ra foydaliroq.
- **Parolingizni hech qayerga yozmang.** Tizimga faqat `token.json` kerak. Uni bekor qilish: https://myaccount.google.com/permissions

## Loyiha tuzilmasi

```
sprunki_studio/
  script_writer.py  OpenAI: mavzular, ssenariy, sarlavha, tavsif, teglar
  tts.py            Edge-TTS ovoz + so'zlar vaqti
  visuals.py        personaj rasmlari / Pollinations AI / zaxira fon
  subtitles.py      so'zma-so'z yonadigan subtitrlar (ASS)
  video.py          FFmpeg: zoom/pan harakat, birlashtirish, musiqa
  thumbnail.py      1280x720 thumbnail
  youtube.py        OAuth va yuklash
  pipeline.py       hammasini bog'laydi
assets/             characters/, music/, fonts/
data/               topics.json (navbat), history.json (yuklanganlar)
```

## Keyinchalik pullik versiyaga o'tish

| Modul | Hozir (bepul) | Pullik variant |
|---|---|---|
| `tts.py` | Edge-TTS | ElevenLabs |
| `visuals.py` | Pollinations | DALL·E / Flux / Midjourney, AI video (Kling, Runway) |
| Server | GitHub Actions | VPS: ko'proq va uzunroq videolar |
