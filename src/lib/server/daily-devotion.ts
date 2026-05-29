import { FieldValue } from "firebase-admin/firestore";
import { askDeepSeek } from "@/lib/ai";
import { getAdminDb, reportDbFailure } from "@/lib/server/firebase-admin";
import { dailyVerse } from "@/lib/data";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME;
const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

let s3Client: S3Client | null = null;
if (r2AccountId && r2AccessKey && r2SecretKey) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKey,
      secretAccessKey: r2SecretKey,
    },
  });
}

export async function generateDailyImage(devotionId: string, verseRef: string, verseText: string): Promise<string> {
  const key = `daily-images/${devotionId}.jpg`;

  // Generate prompt with AI
  const aiPrompt = `Generate a single short sentence (English) describing a beautiful, peaceful, artistic, symbolic illustration (no text, no letters, cinematic, painterly style) representing this Bible verse: "${verseRef} - ${verseText}"`;
  
  let generatedPrompt = `Biblical scene, artistic illustration, spiritual, peaceful landscape, painting style, high resolution, representing: ${verseRef}`;
  try {
    const aiResponse = await askDeepSeek("devotional", aiPrompt);
    if (aiResponse && aiResponse.answer && aiResponse.provider !== "demo") {
      generatedPrompt = aiResponse.answer.replace(/["']/g, "").trim();
    }
  } catch (e) {
    console.error("Failed to generate AI prompt for image:", e);
  }

  const seed = devotionId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(generatedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

  // If R2 credentials or R2 public URL are not configured, return Pollinations URL directly
  if (!s3Client || !r2BucketName || !r2PublicUrl) {
    return pollinationsUrl;
  }

  const publicUrl = `${r2PublicUrl}/${key}`;

  // Check if the image already exists in R2 first!
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: r2BucketName,
        Key: key,
      })
    );
    return publicUrl;
  } catch (e: any) {
    if (e.name !== "NotFound" && e.$metadata?.httpStatusCode !== 404) {
      console.warn("R2 HeadObject check failed, proceeding to generate:", e);
    }
  }

  try {
    const imgResponse = await fetch(pollinationsUrl);
    if (!imgResponse.ok) {
      return pollinationsUrl;
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: r2BucketName,
        Key: key,
        Body: buffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000",
      })
    );

    return publicUrl;
  } catch (error) {
    console.error("Failed to upload generated daily image to R2, returning Pollinations fallback:", error);
    return pollinationsUrl;
  }
}


type DailyDevotion = {
  id: string;
  title: string;
  verseRef: string;
  verseText: string;
  body: string;
  prayer: string;
  status: string;
  provider?: string;
  illustrationUrl?: string;
};

const scheduledVerses = [
  {
    ref: "Yohanes 3:16",
    text: "Karena Allah sangat mengasihi dunia ini, Ia memberikan Anak-Nya yang tunggal supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan memperoleh hidup yang kekal.",
  },
  {
    ref: "Mazmur 23:1",
    text: "TUHAN adalah gembalaku, aku tidak akan kekurangan.",
  },
  {
    ref: "Filipi 4:6",
    text: "Janganlah khawatir tentang apa pun juga. Namun, dalam segala sesuatu, nyatakan keinginanmu kepada Allah dalam doa dan permohonan dengan ucapan syukur.",
  },
  {
    ref: "Roma 8:28",
    text: "Kita tahu bahwa Allah turut bekerja dalam segala sesuatu untuk mendatangkan kebaikan bagi mereka yang mengasihi Dia.",
  },
  {
    ref: "Yesaya 41:10",
    text: "Jangan takut sebab Aku menyertai engkau; jangan bimbang sebab Aku ini Allahmu.",
  },
  {
    ref: "Matius 6:33",
    text: "Carilah dahulu Kerajaan Allah dan kebenarannya, dan semuanya itu akan ditambahkan kepadamu.",
  },
  {
    ref: "Amsal 3:5",
    text: "Percayalah kepada TUHAN dengan segenap hatimu, dan jangan bersandar kepada pengertianmu sendiri.",
  },
];

function jakartaDateId(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const jakartaDay = formatter.format(date);
  const start = new Date("2026-01-01T00:00:00+07:00").getTime();
  const current = new Date(`${jakartaDay}T00:00:00+07:00`).getTime();
  const dayIndex = Math.max(0, Math.floor((current - start) / 86_400_000));
  const bucket = Math.floor(dayIndex / 3);

  return `golden-${bucket}-${jakartaDay}`;
}

function verseForDate(dateId: string) {
  const seed = dateId
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);

  return scheduledVerses[seed % scheduledVerses.length];
}

function fallbackDevotion(id: string): DailyDevotion {
  const verse = verseForDate(id);
  return {
    id,
    title: "Renungan Hari Ini",
    verseRef: verse.ref,
    verseText: verse.text,
    body:
      "Ambil waktu singkat hari ini untuk membaca ayat, mengucap syukur, dan menyerahkan satu kekhawatiran kepada Tuhan.",
    prayer:
      "Tuhan, tuntun aku menjalani hari ini dengan hati yang percaya, rendah hati, dan siap mengasihi sesama.",
    status: "published",
    provider: "fallback",
  };
}

const memoryCache: { [dateId: string]: DailyDevotion } = {};

async function getFallbackDevotionWithAi(dateId: string): Promise<DailyDevotion> {
  if (memoryCache[dateId]) {
    return memoryCache[dateId];
  }

  try {
    const verse = verseForDate(dateId);
    const prompt = [
      `Buat renungan harian Kristen singkat untuk tanggal ${dateId}.`,
      `Ayat: ${verse.ref}`,
      `Teks: ${verse.text}`,
      "Format: Judul, Ayat, Renungan 2 paragraf pendek, Aplikasi praktis, Doa.",
      "Bahasa Indonesia, hangat, alkitabiah, dan pastoral.",
    ].join("\n");

    const result = await askDeepSeek("devotional", prompt);
    if (result && result.answer && result.provider !== "demo") {
      const devotion = parseAiDevotion(
        dateId,
        verse.ref,
        verse.text,
        result.answer,
        result.provider,
      );
      memoryCache[dateId] = devotion;
      return devotion;
    }
  } catch (error) {
    console.error("Gagal membuat fallback dengan AI, menggunakan fallback statis:", error);
  }

  return fallbackDevotion(dateId);
}

function cleanMarkdownAndLabels(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .split("\n")
    .map(line => line.replace(/^(judul|ayat|teks|isi|renungan|doa|aplikasi praktis|aplikasi)\s*:\s*/i, "").trim())
    .filter(Boolean)
    .join("\n");
}

function parseAiDevotion(id: string, verseRef: string, verseText: string, answer: string, provider: string): DailyDevotion {
  const lines = answer
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let title = "Renungan Hari Ini";
  let extractedVerseRef = verseRef;
  let extractedVerseText = verseText;
  let bodyParagraphs: string[] = [];
  let prayerParagraphs: string[] = [];
  
  let currentSection: "none" | "title" | "verse" | "body" | "prayer" = "none";

  for (const line of lines) {
    const cleanLine = line.replace(/\*\*/g, "").replace(/\*/g, "").trim();
    const cleanLower = cleanLine.toLowerCase();
    
    if (cleanLower.startsWith("judul")) {
      title = cleanLine.replace(/^judul\s*:\s*/i, "").replace(/^#+\s*/, "").trim();
      currentSection = "title";
      continue;
    }
    
    if (cleanLower.startsWith("ayat")) {
      const content = cleanLine.replace(/^ayat\s*:\s*/i, "").trim();
      if (content) {
        extractedVerseRef = content.split(/[–\-—"“]/)[0].trim();
      }
      currentSection = "verse";
      continue;
    }
    
    if (cleanLower.startsWith("teks") || cleanLower.startsWith("isi")) {
      currentSection = "verse";
      continue;
    }

    if (cleanLower.startsWith("renungan") || cleanLower.startsWith("aplikasi")) {
      currentSection = "body";
      const content = cleanLine.replace(/^(renungan|aplikasi praktis|aplikasi)\s*:\s*/i, "").trim();
      if (content) {
        bodyParagraphs.push(content);
      }
      continue;
    }

    if (cleanLower.startsWith("doa")) {
      currentSection = "prayer";
      const content = cleanLine.replace(/^doa\s*:\s*/i, "").trim();
      if (content) {
        prayerParagraphs.push(content);
      }
      continue;
    }

    // Append to current section
    if (currentSection === "title") {
      title += " " + cleanLine;
    } else if (currentSection === "prayer") {
      prayerParagraphs.push(cleanLine);
    } else if (currentSection === "body") {
      bodyParagraphs.push(cleanLine);
    } else {
      if (bodyParagraphs.length === 0 && title === "Renungan Hari Ini") {
        title = cleanLine;
      } else {
        bodyParagraphs.push(cleanLine);
      }
    }
  }

  const cleanTitle = cleanMarkdownAndLabels(title);
  const cleanBody = cleanMarkdownAndLabels(bodyParagraphs.join("\n\n"));
  const cleanPrayer = cleanMarkdownAndLabels(prayerParagraphs.join("\n\n"));

  return {
    id,
    title: cleanTitle || "Renungan Hari Ini",
    verseRef: cleanMarkdownAndLabels(extractedVerseRef || verseRef),
    verseText: cleanMarkdownAndLabels(extractedVerseText || verseText),
    body: cleanBody || "Renungan belum tersedia.",
    prayer: cleanPrayer || "Tuhan, ajar aku menerima firman-Mu dan melakukannya hari ini.",
    status: "published",
    provider,
  };
}

export async function getLatestDevotion(): Promise<DailyDevotion> {
  const db = getAdminDb();
  const dateId = jakartaDateId();

  if (!db) {
    return await getFallbackDevotionWithAi(dateId);
  }

  try {
    let doc = null;
    try {
      const snapshot = await db
        .collection("daily_devotions")
        .where("status", "==", "published")
        .orderBy("dateId", "desc")
        .limit(1)
        .get();

      if (!snapshot.empty) {
        doc = snapshot.docs[0];
      }
    } catch (indexError) {
      console.warn("Kueri dengan indeks gagal atau belum diindeks. Mencoba fallback memori:", indexError);
    }

    if (!doc) {
      // Fallback: get other published devotions and sort them in-memory to catch docs without dateId
      const fallbackSnapshot = await db
        .collection("daily_devotions")
        .where("status", "==", "published")
        .limit(50)
        .get();

      if (!fallbackSnapshot.empty) {
        const docs = [...fallbackSnapshot.docs];
        docs.sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          const aDate = aData.dateId || "";
          const bDate = bData.dateId || "";
          if (aDate && bDate) {
            return bDate.localeCompare(aDate);
          }
          if (aDate) return -1;
          if (bDate) return 1;

          const aTime = aData.updatedAt?.toMillis ? aData.updatedAt.toMillis() : (aData.updatedAt ? new Date(aData.updatedAt).getTime() : 0);
          const bTime = bData.updatedAt?.toMillis ? bData.updatedAt.toMillis() : (bData.updatedAt ? new Date(bData.updatedAt).getTime() : 0);
          return bTime - aTime;
        });
        doc = docs[0];
      }
    }

    if (!doc) {
      return await getFallbackDevotionWithAi(dateId);
    }

    const data = doc.data() as Partial<DailyDevotion>;

    return {
      id: doc.id,
      title: cleanMarkdownAndLabels(data.title ?? "Renungan Hari Ini"),
      verseRef: cleanMarkdownAndLabels(data.verseRef ?? `${dailyVerse.book} ${dailyVerse.chapter}:${dailyVerse.verse}`),
      verseText: cleanMarkdownAndLabels(data.verseText ?? dailyVerse.text),
      body: cleanMarkdownAndLabels(data.body ?? "Renungan belum tersedia."),
      prayer: cleanMarkdownAndLabels(data.prayer ?? "Tuhan, tuntun aku hari ini."),
      status: data.status ?? "published",
      provider: data.provider,
      illustrationUrl: data.illustrationUrl,
    };
  } catch (error) {
    console.error("Gagal mengambil renungan terbaru, menggunakan fallback:", error);
    reportDbFailure();
    return await getFallbackDevotionWithAi(dateId);
  }
}

export async function generateDailyDevotion(date = new Date()) {
  const db = getAdminDb();

  if (!db) {
    throw new Error("Firebase Admin belum dikonfigurasi.");
  }

  const dateId = jakartaDateId(date);
  const existing = await db.collection("daily_devotions").doc(dateId).get();

  if (existing.exists) {
    return { id: dateId, created: false };
  }

  const verse = verseForDate(dateId);
  const prompt = [
    `Buat renungan harian Kristen untuk tanggal ${dateId}.`,
    `Ayat: ${verse.ref}`,
    `Teks: ${verse.text}`,
    "Format: Judul, Ayat, Renungan 3 paragraf pendek, Aplikasi praktis, Doa.",
    "Bahasa Indonesia, hangat, alkitabiah, dan pastoral.",
  ].join("\n");

  const result = await askDeepSeek("devotional", prompt);
  const devotion = parseAiDevotion(
    dateId,
    verse.ref,
    verse.text,
    result.answer,
    result.provider,
  );

  let illustrationUrl = "";
  try {
    illustrationUrl = await generateDailyImage(dateId, devotion.verseRef, devotion.verseText);
  } catch (e) {
    console.error("Failed to generate illustration image during devotion creation:", e);
  }

  await db.collection("daily_devotions").doc(dateId).set({
    ...devotion,
    ...(illustrationUrl ? { illustrationUrl } : {}),
    dateId,
    generatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { id: dateId, created: true, provider: result.provider };
}
