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
- `short`: vertikal 1080×1920, standart uzunligi 20 soniya (`SHORT_SECONDS` yoki `--seconds` bilan o'zgartiriladi). 30 soniyadan qisqa Shorts'ning oxiri boshiga ulanib ketadi (loop), shuning uchun qayta-qayta ko'riladi. Pastda TikTok uslubidagi subtitr, tepada progress chizig'i.
- `long`: gorizontal 1920×1080, uzunligini o'zingiz berasiz (3, 10, 20 daqiqa). Thumbnail ham avtomatik yasaladi.

**Coree Crew Shorts (ovozsiz, OpenAI kerak emas, butunlay bepul):**
Kanalingizda eng ko'p ko'rilgan Shorts turlari bo'yicha, lekin **original** personajlar bilan yasaladi. Bosh rolda doim **Band** chiqadi: jonli musiqa asboblari 🎷 Saxo, 🎸 Uku, 🌳 Barky va 🧀 Brie. Ularga 12 ta Crew personaji qo'shiladi: Coree, Zappi, Moxi, Leafy, Bloop, Rexo, Tiko, Pluma, Nova, Grimm, Mintz, Bongo. Har bir video 7–10 soniya davom etadi, original beat bilan va loop qilib ko'rishga mos.
- `party`: "Color Party", hamma birma-bir bitta personajga aylanadi, har biri o'z rangida.
- `horror`: "Normal vs Horror", ekran chaqmoq bilan ikkiga bo'lingan, neon ranglar. Qon yo'q, bolalar uchun xavfsiz.
- `pick`: "Pick One", 3 ta personaj, 3-2-1 sanash, g'olib tanlanadi va konfetti tushadi.

```bash
npm run make -- --format crew                  # tasodifiy format
npm run make -- --format crew --style party --upload --privacy public
```

**Kontent original bo'lishi uchun:**
- **Coree.** Kanalning o'z maskot-boshlovchisi, noldan chizilgan original personaj. Har videoda ekran burchagida turadi, gapirganda og'zi qimirlaydi, ko'zlarini pirpiratadi. Thumbnail'da ham chiqadi. Ssenariy Coree nomidan, birinchi shaxsda, o'z fikri va hazillari bilan yoziladi.
- **Original musiqa.** Har video uchun yangi beat avtomatik yaratiladi: tempo, tonallik, akkordlar va melodiya har safar boshqacha. Tayyor trek ishlatilmaydi, shuning uchun Content ID muammosi bo'lmaydi.
- **8 xil format.** Top-ro'yxat, fan nazariya, "what if" hikoya, viktorina, "mif yoki fakt", versus jang, personaj haqida batafsil, "oldin va keyin". Har video uchun tasodifiy biri tanlanadi, shuning uchun kanal bir xil shablonda ko'rinmaydi.

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

# 45 soniyalik Short
npm run make -- --format short --seconds 45

# O'zingiz bergan mavzuda 10 daqiqalik video
npm run make -- --format long --minutes 10 --topic "Every Sprunki Character Explained"

# Yasab, darhol YouTube'ga yuklash
npm run make -- --format short --upload --privacy public

# Oldindan mavzular tayyorlab qo'yish (data/topics.json ga yoziladi, xohlasangiz tahrirlang)
npm run ideas -- --format short -n 20

# Avtopilot: 2 ta Crew Short, 1 ta ovozli Short va 1 ta uzun video, har biri 4 soat oralig'ida ochiladi
npm run auto -- --crew 2 --shorts 1 --long 1 --minutes 8 --spread-hours 4

# Tayyor videoni Remotion Studio'da ko'rish va dizaynini sozlash
npm run preview -- output/<video-papkasi>

# Dizaynni namunaviy ma'lumot bilan tahrirlash (http://localhost:3000)
npm run dev
```

Natija `output/<sana>-<mavzu>/` papkasiga tushadi. Ichida `video.mp4`, `thumbnail.jpg`, `script.json` va `props.json` bo'ladi.

**Sifatni oshirish uchun:**
- `assets/characters/` papkasiga personaj rasmlarini qo'ying (masalan `oren.png`, `raddy.png`). Shunda videolar haqiqiy Sprunki ko'rinishida chiqadi.
- O'z musiqangizni ishlatmoqchi bo'lsangiz, `assets/music/` papkasiga qo'ying. Bo'sh qolsa, original beat yaratiladi.

## 4. To'liq avtomatik rejim: GitHub Actions (bepul, kompyuter yoqiq turishi shart emas)

1. GitHub'da repo sahifasini oching: **Settings → Secrets and variables → Actions → New repository secret**. Ikkita secret qo'shing:
   - `OPENAI_API_KEY`: OpenAI kalitingiz.
   - `YT_TOKEN_JSON`: `token.json` faylining **butun ichidagi matni**.
2. Ixtiyoriy: **Variables** bo'limida `YT_PRIVACY` (`public`), `TTS_VOICE`, `MADE_FOR_KIDS` ni sozlashingiz mumkin.
3. Bu kod `main` branchiga qo'shilgach, tizim har kuni 19:23 da (Toshkent vaqti) 2 ta Coree Crew Short va 1 ta ovozli Short yasab yuklaydi. `OPENAI_API_KEY` qo'shilmagan bo'lsa ham Crew Shorts ishlayveradi, buning uchun faqat `YT_TOKEN_JSON` kifoya. Qo'lda ishga tushirish: **Actions → Sprunki Autopilot → Run workflow**.
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
    Mascot.tsx          Coree, kanal maskoti (SVG, gapirganda og'zi qimirlaydi)
  crew/                 Coree Crew: Band (asboblar) va 12 ta personaj, 3 ta Shorts formati
    Background.tsx      animatsion gradient fon
pipeline/               Node (avtomatlashtirish)
  script-writer.ts      OpenAI: mavzular, ssenariy, sarlavha, tavsif, teglar
  tts.ts                Edge-TTS ovoz va so'zlar vaqti
  images.ts             personaj rasmlari va Pollinations AI
  music.ts              original fon musiqasi generatori
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
