import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { translateTexts } from "@/lib/server/backup-r2-service";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TranslatePayload = {
  text: string | string[];
  to: string; // "en" | "zh"
  type?: "blog" | "devotion" | "encyclopedia";
  id?: string; // ID dari konten untuk di-cache
};

async function translateTextGoogle(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return text;
  
  const gtLang = targetLang === "zh" ? "zh-CN" : targetLang;
  const encoded = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=${gtLang}&dt=t&q=${encoded}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Translate API returned status ${res.status}`);
  }
  
  const data = await res.json();
  const translated = (data[0] as any[]).map((chunk: any) => chunk[0] ?? "").join("");
  return translated || text;
}

function cleanChineseText(text: string): string {
  if (!text) return text;
  if (text.startsWith("Hanzi:")) {
    const parts = text.split(/\nPinyin:/i);
    const hanziPart = parts[0];
    return hanziPart.substring(6).trim(); // Remove "Hanzi:" prefix
  }
  return text;
}

async function saveToR2(
  type: string,
  id: string,
  targetLang: string,
  originalTexts: string[],
  translatedTexts: string[]
) {
  if (!s3Client || !R2_BUCKET_NAME) return;

  try {
    let key = "";
    let bodyObj: any = {};

    if (type === "encyclopedia") {
      const hyphenIdx = id.indexOf("-");
      if (hyphenIdx > 0) {
        const kategori = id.substring(0, hyphenIdx);
        const slug = id.substring(hyphenIdx + 1);
        key = `encyclopedia/${kategori}/${slug}_${targetLang}.json`;
        bodyObj = {
          title: translatedTexts[0] || "",
          isi_artikel: translatedTexts[1] || ""
        };
      }
    } else if (type === "devotion") {
      key = `devotions/${id}_${targetLang}.json`;
      bodyObj = {
        id,
        title: translatedTexts[0] || "",
        verseRef: translatedTexts[1] || "",
        verseText: translatedTexts[2] || "",
        body: translatedTexts[3] || "",
        prayer: translatedTexts[4] || ""
      };
    } else if (type === "blog") {
      key = `articles/${id}_${targetLang}.json`;
      bodyObj = {
        id,
        title: translatedTexts[0] || "",
        excerpt: translatedTexts[1] || "",
        body: translatedTexts[2] || ""
      };
    }

    if (key && Object.keys(bodyObj).length > 0) {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(bodyObj),
        ContentType: "application/json; charset=utf-8",
        CacheControl: "public, max-age=31536000",
      });

      await s3Client.send(command);
      console.log(`[Translate API] Automatically cached ${key} in Cloudflare R2.`);
    }
  } catch (err) {
    console.error(`[Translate API] Failed to upload translated JSON to R2 for ${id}:`, err);
  }
}

const TRANSLATION_OVERRIDES: Record<string, Record<string, string>> = {
  "ayub": { zh: "约伯", en: "Job" },
  "yusuf": { zh: "约瑟", en: "Joseph" },
  "musa": { zh: "摩西", en: "Moses" },
  "daud": { zh: "大卫", en: "David" },
  "saul": { zh: "扫罗", en: "Saul" },
  "yosua": { zh: "约书亚", en: "Joshua" },
  "petrus": { zh: "彼得", en: "Peter" },
  "paulus": { zh: "保罗", en: "Paul" },
  "abraham": { zh: "亚伯拉罕", en: "Abraham" },
  "habel": { zh: "亚伯", en: "Abel" },
  "kain": { zh: "该隐", en: "Cain" },
  "bileam": { zh: "巴兰", en: "Balaam" },
  "bileaam": { zh: "巴兰", en: "Balaam" }
};

function getOverrideTranslation(text: string, targetLang: string): string | null {
  if (!text) return null;
  const clean = text.trim().toLowerCase();
  const match = TRANSLATION_OVERRIDES[clean];
  if (match) {
    return match[targetLang] || null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TranslatePayload;
    const { text, to, type, id } = body;

    if (!text || !to) {
      return NextResponse.json(
        { error: "Teks dan target bahasa ('to') wajib diisi." },
        { status: 400 }
      );
    }

    const targetLang = to.toLowerCase();
    if (targetLang !== "en" && targetLang !== "zh") {
      return NextResponse.json(
        { error: "Bahasa target hanya mendukung 'en' atau 'zh'." },
        { status: 400 }
      );
    }

    // 1. Cek cache database jika ID & Type disediakan
    const db = getAdminDb();
    
    if (Array.isArray(text)) {
      // Terapkan override terlebih dahulu
      let cachedTexts: (string | null)[] = text.map((item) => getOverrideTranslation(item, targetLang));
      
      const hasUnresolved = cachedTexts.some((t) => t === null);
      if (hasUnresolved && db && id && type) {
        const collectionName =
          type === "blog"
            ? "blog_posts"
            : type === "devotion"
            ? "daily_devotions"
            : "ensiklopedia_cache";

        const docRef = db.collection(collectionName).doc(id);
        const docSnap = await docRef.get().catch(() => null);
        
        if (docSnap && docSnap.exists) {
          const data = docSnap.data();
          const cachedTitle = data?.[`title_${targetLang}`];
          const cachedContent = data?.[`content_${targetLang}`] || data?.[`body_${targetLang}`] || data?.[`isi_artikel_${targetLang}`];

          cachedTexts = text.map((item, index) => {
            if (cachedTexts[index] !== null) return cachedTexts[index];
            
            if (item === data?.title || item === data?.keyword) {
              if (targetLang === "zh" && cachedTitle === "工作" && item.toLowerCase() === "ayub") {
                return "约伯";
              }
              return cachedTitle || null;
            }
            if (item === data?.content || item === data?.body || item === data?.isi_artikel) return cachedContent || null;
            return null;
          });
        }
      }

      if (cachedTexts.every((t) => t !== null)) {
        if (id && type) {
          saveToR2(type, id, targetLang, text, cachedTexts as string[]).catch((err) => {
            console.error("Gagal mempromosikan cache ke R2:", err);
          });
        }
        return NextResponse.json({ translated: cachedTexts, source: "db_cache" });
      }

      // Terjemahkan elemen yang tidak terselesaikan oleh override/cache
      const indicesToTranslate: number[] = [];
      const textsToTranslate: string[] = [];
      text.forEach((item, index) => {
        if (cachedTexts[index] === null) {
          indicesToTranslate.push(index);
          textsToTranslate.push(item);
        }
      });

      const translatedUnresolved = await translateTexts(textsToTranslate, targetLang);
      const cleanedTranslated = targetLang === "zh"
        ? translatedUnresolved.map(cleanChineseText)
        : translatedUnresolved;

      const finalTranslated = [...cachedTexts];
      indicesToTranslate.forEach((origIndex, index) => {
        finalTranslated[origIndex] = cleanedTranslated[index];
      });

      // Simpan ke Cache Database secara asinkron agar tidak memblokir respon
      if (db && id && type) {
        const collectionName =
          type === "blog"
            ? "blog_posts"
            : type === "devotion"
            ? "daily_devotions"
            : "ensiklopedia_cache";

        const docRef = db.collection(collectionName).doc(id);
        const docSnap = await docRef.get().catch(() => null);
        
        if (docSnap && docSnap.exists) {
          const data = docSnap.data();
          const updateData: Record<string, any> = {};

          text.forEach((originalText, index) => {
            const translatedVal = finalTranslated[index];
            if (!translatedVal) return;

            if (originalText === data?.title) {
              updateData[`title_${targetLang}`] = translatedVal;
            } else if (originalText === data?.content || originalText === data?.body || originalText === data?.isi_artikel) {
              const fieldName = data?.body ? `body_${targetLang}` : data?.isi_artikel ? `isi_artikel_${targetLang}` : `content_${targetLang}`;
              updateData[fieldName] = translatedVal;
            } else if (originalText === data?.excerpt) {
              updateData[`excerpt_${targetLang}`] = translatedVal;
            } else if (originalText === data?.prayer) {
              updateData[`prayer_${targetLang}`] = translatedVal;
            } else if (originalText === data?.verseText) {
              updateData[`verseText_${targetLang}`] = translatedVal;
            }
          });

          if (Object.keys(updateData).length > 0) {
            updateData[`translated_at_${targetLang}`] = new Date().toISOString();
            await docRef.update(updateData).catch((err) => {
              console.error("Gagal menyimpan cache terjemahan array ke Firestore:", err);
            });
          }
        }
      }

      // Simpan cache ke Cloudflare R2 agar request berikutnya langsung melompati Firestore & API translate
      if (id && type) {
        saveToR2(type, id, targetLang, text, finalTranslated as string[]).catch((err) => {
          console.error("Gagal menyimpan cache terjemahan baru ke R2:", err);
        });
      }
      
      return NextResponse.json({ translated: finalTranslated, source: "google_api" });
    } else {
      const override = getOverrideTranslation(text, targetLang);
      if (override) {
        return NextResponse.json({ translated: override, source: "override" });
      }

      // Cek cache database
      if (db && id && type) {
        const collectionName =
          type === "blog"
            ? "blog_posts"
            : type === "devotion"
            ? "daily_devotions"
            : "ensiklopedia_cache";

        const docRef = db.collection(collectionName).doc(id);
        const docSnap = await docRef.get().catch(() => null);
        
        if (docSnap && docSnap.exists) {
          const data = docSnap.data();
          const cachedTitle = data?.[`title_${targetLang}`];
          const cachedContent = data?.[`content_${targetLang}`] || data?.[`body_${targetLang}`] || data?.[`isi_artikel_${targetLang}`];

          if (text === data?.title && cachedTitle) {
            if (targetLang === "zh" && cachedTitle === "工作" && text.toLowerCase() === "ayub") {
              // Abaikan bad cache
            } else {
              return NextResponse.json({ translated: cachedTitle, source: "db_cache" });
            }
          }
          if ((text === data?.content || text === data?.body || text === data?.isi_artikel) && cachedContent) {
            return NextResponse.json({ translated: cachedContent, source: "db_cache" });
          }
        }
      }

      const translatedTextList = await translateTexts([text], targetLang);
      const translatedText = translatedTextList[0] || text;
      const finalTranslatedText = targetLang === "zh"
        ? cleanChineseText(translatedText)
        : translatedText;
      
      // 3. Simpan ke Cache Database secara asinkron agar tidak memblokir respon
      if (db && id && type) {
        const collectionName =
          type === "blog"
            ? "blog_posts"
            : type === "devotion"
            ? "daily_devotions"
            : "ensiklopedia_cache";

        const docRef = db.collection(collectionName).doc(id);
        const docSnap = await docRef.get().catch(() => null);
        
        if (docSnap && docSnap.exists) {
          const data = docSnap.data();
          const updateData: Record<string, any> = {};

          if (text === data?.title) {
            updateData[`title_${targetLang}`] = finalTranslatedText;
          } else if (text === data?.content || text === data?.body || text === data?.isi_artikel) {
            const fieldName = data?.body ? `body_${targetLang}` : data?.isi_artikel ? `isi_artikel_${targetLang}` : `content_${targetLang}`;
            updateData[fieldName] = finalTranslatedText;
          } else if (text === data?.excerpt) {
            updateData[`excerpt_${targetLang}`] = finalTranslatedText;
          } else if (text === data?.prayer) {
            updateData[`prayer_${targetLang}`] = finalTranslatedText;
          } else if (text === data?.verseText) {
            updateData[`verseText_${targetLang}`] = finalTranslatedText;
          }

          if (Object.keys(updateData).length > 0) {
            updateData[`translated_at_${targetLang}`] = new Date().toISOString();
            await docRef.update(updateData).catch((err) => {
              console.error("Gagal menyimpan cache terjemahan ke Firestore:", err);
            });
          }
        }
      }

      return NextResponse.json({ translated: finalTranslatedText, source: "google_api" });
    }
  } catch (error: any) {
    console.error("[Translate API] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menerjemahkan." },
      { status: 500 }
    );
  }
}
