// YouTube Data API v3: rasmiy, xavfsiz yuklash (parol kerak emas, OAuth token ishlatiladi).
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { google } from "googleapis";
import type { Credentials, OAuth2Client } from "google-auth-library";
import { settings } from "./config";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube"];

type ClientSecret = { installed?: { client_id: string; client_secret: string }; web?: { client_id: string; client_secret: string } };

const clientSecret = (): { client_id: string; client_secret: string } => {
  const raw = process.env.YT_CLIENT_SECRET_JSON ?? (fs.existsSync(settings.clientSecretFile) ? fs.readFileSync(settings.clientSecretFile, "utf8") : null);
  if (!raw) {
    throw new Error(
      "client_secret.json topilmadi. Google Cloud Console'dan OAuth (Desktop app) faylini yuklab, loyiha papkasiga qo'ying.",
    );
  }
  const parsed = JSON.parse(raw) as ClientSecret;
  const value = parsed.installed ?? parsed.web;
  if (!value) throw new Error("client_secret.json formati noto'g'ri");
  return value;
};

type StoredToken = Credentials & { client_id?: string; client_secret?: string };

const readToken = (): StoredToken | null => {
  const raw = process.env.YT_TOKEN_JSON ?? (fs.existsSync(settings.tokenFile) ? fs.readFileSync(settings.tokenFile, "utf8") : null);
  return raw ? (JSON.parse(raw) as StoredToken) : null;
};

/** Bir martalik: brauzerda kanalingizni tanlab "Allow" bosasiz. Token token.json ga yoziladi. */
export const authorize = async (): Promise<string> => {
  const { client_id, client_secret } = clientSecret();

  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const redirect = `http://127.0.0.1:${port}`;
  const client = new google.auth.OAuth2(client_id, client_secret, redirect);

  const url = client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
  console.log("\nShu havolani brauzerda oching va SprunkiCoreee kanalini tanlang:\n");
  console.log(url + "\n");

  const code = await new Promise<string>((resolve, reject) => {
    server.on("request", (req, res) => {
      const params = new URL(req.url ?? "/", redirect).searchParams;
      const value = params.get("code");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(value ? "<h1>Tayyor! Bu oynani yopishingiz mumkin.</h1>" : "<h1>Xato: ruxsat berilmadi</h1>");
      if (value) resolve(value);
      else reject(new Error(params.get("error") ?? "Ruxsat berilmadi"));
    });
  });
  server.close();

  const { tokens } = await client.getToken(code);
  const stored: StoredToken = { ...tokens, client_id, client_secret };
  fs.writeFileSync(settings.tokenFile, JSON.stringify(stored, null, 2));
  return settings.tokenFile;
};

const authClient = (): OAuth2Client => {
  const token = readToken();
  if (!token) throw new Error("YouTube'ga ulanmagan. Avval ishga tushiring: npm run auth");
  const id = token.client_id ?? clientSecret().client_id;
  const secret = token.client_secret ?? clientSecret().client_secret;
  const client = new google.auth.OAuth2(id, secret);
  client.setCredentials(token);
  return client;
};

const youtube = () => google.youtube({ version: "v3", auth: authClient() });

export const channelInfo = async (): Promise<{ title: string; subscribers: string }> => {
  const res = await youtube().channels.list({ part: ["snippet", "statistics"], mine: true });
  const item = res.data.items?.[0];
  if (!item) throw new Error("Bu Google akkauntda YouTube kanal topilmadi.");
  return { title: item.snippet?.title ?? "?", subscribers: item.statistics?.subscriberCount ?? "?" };
};

export const upload = async (opts: {
  video: string;
  title: string;
  description: string;
  tags: string[];
  privacy?: "private" | "unlisted" | "public";
  publishAt?: string | null;
  thumbnail?: string | null;
}): Promise<string> => {
  const api = youtube();

  // Teglarning umumiy uzunligi 500 belgidan oshmasligi kerak
  const tags: string[] = [];
  let total = 0;
  for (const raw of opts.tags) {
    const tag = raw.replace(/#/g, "").trim().slice(0, 60);
    if (tag && total + tag.length + 1 <= 480) {
      tags.push(tag);
      total += tag.length + 1;
    }
  }

  const size = fs.statSync(opts.video).size;
  let lastPercent = -1;
  const res = await api.videos.insert(
    {
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: opts.title.slice(0, 100),
          description: opts.description.slice(0, 4900),
          tags,
          categoryId: settings.categoryId,
          defaultLanguage: "en",
          defaultAudioLanguage: "en",
        },
        status: {
          privacyStatus: opts.publishAt ? "private" : opts.privacy ?? settings.defaultPrivacy,
          publishAt: opts.publishAt ?? undefined,
          selfDeclaredMadeForKids: settings.madeForKids,
          embeddable: true,
        },
      },
      media: { body: fs.createReadStream(opts.video) },
    },
    {
      onUploadProgress: (event: { bytesRead: number }) => {
        const percent = Math.floor((event.bytesRead / size) * 10) * 10;
        if (percent !== lastPercent) {
          lastPercent = percent;
          console.log(`  Yuklanmoqda: ${percent}%`);
        }
      },
    },
  );

  const id = res.data.id;
  if (!id) throw new Error("YouTube video ID qaytarmadi");

  if (opts.thumbnail && fs.existsSync(opts.thumbnail)) {
    try {
      await api.thumbnails.set({ videoId: id, media: { mimeType: "image/jpeg", body: fs.createReadStream(opts.thumbnail) } });
    } catch (error) {
      // Kanal telefon orqali tasdiqlanmagan bo'lsa custom thumbnail ruxsat etilmaydi
      console.log(`  Thumbnail qo'yilmadi: ${(error as Error).message}`);
    }
  }
  return id;
};
