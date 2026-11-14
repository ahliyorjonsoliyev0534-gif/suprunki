# SprunkiCoreee — avtomatik video zavodi (Remotion)

Bu tizim ingliz tilida Sprunki videolarini o'zi yasaydi va YouTube'ga o'zi yuklaydi. Loyiha `npx create-video` (**Remotion**) asosida qurilgan: videolar React komponentlari sifatida yoziladi va kadrma-kadr render qilinadi.

```
Mavzu → Ssenariy (OpenAI) → Ovoz (Edge-TTS) → Rasmlar (sizniki yoki AI)
      → Remotion: animatsiya, sakrovchi subtitrlar, musiqa → video.mp4 + thumbnail → YouTube
```

| Narsa | Vosita | Narxi |
|---|---|---|
| Ssenariy, sarlavha, teglar | OpenAI `gpt-4o-mini` | Bir video taxminan $0.01–0.05 |
| Ovoz | Edge-TTS (`msedge-tts`) | Bepul |
| Rasmlar | `assets/characters` dagi rasmlaringiz va Pollinations.ai | Bepul |
| Montaj, animatsiya, subtitr, thumbnail | Remotion | Bepul (3 kishigacha bo'lgan jamoa uchun) |
| Yuklash | YouTube Data API v3 | Bepul (kuniga taxminan 6 ta yuklash) |
| Har kuni avtomatik ishlash | GitHub Actions | Bepul |

**Formatlar:**
- `short`: vertikal 1080×1920, taxminan 50 soniya. Pastda TikTok uslubidagi subtitr, tepada progress chizig'i.
- `long`: gorizontal 1920×1080, uzunligini o'zingiz berasiz (3, 10, 20 daqiqa). Thumbnail ham avtomatik yasaladi.

**Videoda nimalar bor:**
- Personaj sakrab chiqadi va musiqa ritmida tebranadi.
- AI rasmlarda zoom va pan harakati bo'ladi.
- Sahnalar oq chaqnash bilan almashadi.
- Aytilayotgan so'z sariq bo'lib sakraydi.
- Fon musiqasi boshida asta kuchayadi va oxirida pasayadi.

---

## 1. Kompyuterga o'rnatish

1. **Node.js 22** ni o'rnating: https://nodejs.org
2. Loyihani yuklab oling va kutubxonalarni o'rnating:
   ```bash
   git clone https://github.com/ahliyorjonsoliyev0534-gif/suprunki.git
   cd suprunki
   npm install
   ```
3. `.env.example` faylini `.env` deb nusxalang va `OPENAI_API_KEY` ni yozing.

FFmpeg yoki Chrome'ni alohida o'rnatish shart emas, Remotion ularni o'zi oladi.

## 2. YouTube'ga ulash (bir marta, parol kerak emas)

1. https://console.cloud.google.com saytiga kiring va yangi loyiha yarating.
2. **APIs & Services → Library** bo'limida **YouTube Data API v3** ni yoqing.
3. **OAuth consent screen** ni sozlang:
   - User type: External.
   - Ilova nomi va emailingizni yozing.
   - **Test users** ga o'z Gmail'ingizni qo'shing.
4. **Credentials → Create credentials → OAuth client ID → Desktop app** ni tanlang. Yaratilgan JSON faylni yuklab oling va loyiha papkasiga `client_secret.json` nomi bilan qo'ying.
5. Ulanish buyrug'ini ishga tushiring:
   ```bash
   npm run auth
   ```
   Terminalda havola chiqadi. Uni brauzerda oching, **SprunkiCoreee** kanalini tanlab "Allow" ni bosing. `token.json` fayli saqlanadi.
6. Hammasi joyidaligini tekshiring:
   ```bash
   npm run check
   ```

> ⚠️ **Token 7 kundan keyin o'chib qolmasligi uchun** OAuth consent screen sahifasida **"Publish app"** tugmasini bosing. Ilova faqat sizniki bo'lgani uchun Google tekshiruvi shart emas. Kirishda "unverified" ogohlantirishi chiqsa, **Advanced → Continue** orqali o'tasiz.

## 3. Video yasash

```bash
# 1 ta Short, mavzuni o'zi tanlaydi (tekshirish uchun yuklamaydi)
npm run make -- --format short

# O'zingiz bergan mavzuda 10 daqiqalik video
npm run make -- --format long --minutes 10 --topic "Every Sprunki Character Explained"

# Yasab, darhol YouTube'ga yuklash
npm run make -- --format short --upload --privacy public

# Oldindan mavzular tayyorlab qo'yish (data/topics.json ga yoziladi, xohlasangiz tahrirlang)
npm run ideas -- --format short -n 20

# Avtopilot: 3 ta Short va 1 ta uzun video, har biri 4 soat oralig'ida ochiladi
npm run auto -- --shorts 3 --long 1 --minutes 8 --spread-hours 4

# Tayyor videoni Remotion Studio'da ko'rish va dizaynini sozlash
npm run preview -- output/<video-papkasi>

# Dizaynni namunaviy ma'lumot bilan tahrirlash (http://localhost:3000)
npm run dev
```

Natija `output/<sana>-<mavzu>/` papkasiga tushadi. Ichida `video.mp4`, `thumbnail.jpg`, `script.json` va `props.json` bo'ladi.

**Sifatni oshirish uchun:**
- `assets/characters/` papkasiga personaj rasmlarini qo'ying (masalan `oren.png`, `raddy.png`). Shunda videolar haqiqiy Sprunki ko'rinishida chiqadi.
- `assets/music/` papkasiga mualliflik huquqidan xoli musiqa qo'ying.

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
  - Videoni YouTube Studio'da ko'rib chiqib, qo'lda Public qilasiz.
  - Yoki bepul audit uchun ariza berasiz: https://support.google.com/youtube/contact/yt_api_form
- **Made for Kids:** standart holatda `true`, chunki Sprunki auditoriyasi bolalar.
- **Mualliflik huquqi:** Incredibox yoki Sprunki'ning asl treklarini ishlatmang.
- **Sifat > miqdor.** YouTube bir xil shablonda ommaviy yasalgan kontentni monetizatsiya qilmaydi.
- **Parolingizni hech qayerga yozmang.** Tizimga faqat `token.json` kerak. Uni bekor qilish: https://myaccount.google.com/permissions
- **Remotion litsenziyasi:** shaxslar va 3 kishigacha bo'lgan jamoalar uchun bepul. Kattaroq kompaniyaga aylansangiz, https://remotion.dev/license sahifasini o'qing.

## Loyiha tuzilmasi

```
src/                    Remotion (video dizayni, React)
  Root.tsx              kompozitsiyalar: SprunkiVideo, Thumbnail
  SprunkiVideo.tsx      sahnalar ketma-ketligi, musiqa, progress chizig'i
  Thumbnail.tsx         1280x720 thumbnail
  components/
    SceneVisual.tsx     personaj sahnasi / AI rasm (Ken Burns) / nom kartasi
    Captions.tsx        TikTok uslubidagi subtitr
    Background.tsx      animatsion gradient fon
pipeline/               Node (avtomatlashtirish)
  script-writer.ts      OpenAI: mavzular, ssenariy, sarlavha, tavsif, teglar
  tts.ts                Edge-TTS ovoz va so'zlar vaqti
  images.ts             personaj rasmlari va Pollinations AI
  render.ts             Remotion render (video + thumbnail)
  youtube.ts            OAuth va yuklash
  pipeline.ts           hammasini bog'laydi
  cli.ts                npm run buyruqlari
assets/                 characters/, music/
data/                   topics.json (navbat), history.json (yuklanganlar)
```

## Keyinchalik pullik versiyaga o'tish

| Modul | Hozir (bepul) | Pullik variant |
|---|---|---|
| `pipeline/tts.ts` | Edge-TTS | ElevenLabs |
| `pipeline/images.ts` | Pollinations | DALL·E / Flux, AI video (Kling, Runway) |
| Render | GitHub Actions | Remotion Lambda (bir necha daqiqada 20 daqiqalik video) |
