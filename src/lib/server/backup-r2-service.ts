import zlib from "zlib";
import { getAdminDb } from "./firebase-admin";
import { s3Client, R2_BUCKET_NAME } from "./r2";
import { PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { sendEmail } from "./email";
import { logFirestoreRead, logFirestoreWrite } from "./firestore-monitor";
import { FieldValue } from "firebase-admin/firestore";
import { queryD1 } from "./d1";
import path from "path";


function chunkText(text: string, maxLen = 2000): string[] {
  if (text.length <= maxLen) return [text];
  
  const chunks: string[] = [];
  const lines = text.split("\n");
  let currentChunk: string[] = [];
  let currentLen = 0;
  
  for (const line of lines) {
    if (currentLen + line.length + 1 > maxLen) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n"));
        currentChunk = [];
        currentLen = 0;
      }
      if (line.length > maxLen) {
        // Split by sentences if a single line is too long
        const sentences = line.split(". ");
        for (const sent of sentences) {
          if (currentLen + sent.length + 2 > maxLen) {
            if (currentChunk.length > 0) {
              chunks.push(currentChunk.join(". ") + ".");
              currentChunk = [];
              currentLen = 0;
            }
            chunks.push(sent);
          } else {
            currentChunk.push(sent);
            currentLen += sent.length + 2;
          }
        }
      } else {
        currentChunk.push(line);
        currentLen += line.length + 1;
      }
    } else {
      currentChunk.push(line);
      currentLen += line.length + 1;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n"));
  }
  
  return chunks;
}

async function translateSingleTextNode(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return text;
  const gtLang = targetLang === "zh" ? "zh-CN" : targetLang;
  const chunks = chunkText(text, 2000);
  const translatedChunks: string[] = [];
  
  for (const chunk of chunks) {
    if (!chunk.trim()) {
      translatedChunks.push(chunk);
      continue;
    }
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=${gtLang}&dt=t`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0"
        },
        body: `q=${encodeURIComponent(chunk)}`
      });
      
      if (!res.ok) {
        console.error(`[translateSingleTextNode] API response error: ${res.status}`);
        translatedChunks.push(chunk);
        continue;
      }
      
      const data: any = await res.json();
      const translated = (data[0] as any[]).map((c: any) => c[0] ?? "").join("");
      translatedChunks.push(translated || chunk);
    } catch (err: any) {
      console.error(`[translateSingleTextNode] Failed to translate chunk:`, err.message);
      translatedChunks.push(chunk);
    }
  }
  
  return translatedChunks.join("\n");
}

// Helper: Node.js HTTP fallback for translation using Google Translate free web API
async function translateTextsNode(texts: string[], targetLang: string): Promise<string[]> {
  if (!texts || texts.length === 0) return [];
  const results: string[] = [];
  for (const text of texts) {
    results.push(await translateSingleTextNode(text, targetLang));
  }
  return results;
}

// Helper function to call translate.py (Python), with async Node fallback
export async function translateTexts(texts: string[], targetLang: string): Promise<string[]> {
  if (!texts || texts.length === 0) return [];
  // Try Python first (works locally and on servers with Python installed)
  try {
    const pythonTarget = targetLang === "zh" ? "zh-CN" : targetLang;
    const { spawnSync } = await import("child_process");
    const result = spawnSync("python3", [
      path.join(process.cwd(), "scripts", "translate.py"),
      "--source", "id",
      "--target", pythonTarget
    ], {
      input: JSON.stringify(texts),
      encoding: "utf8",
      timeout: 30000,
    });
    if (result.status === 0 && !result.error && result.stdout) {
      const parsed = JSON.parse(result.stdout);
      if (Array.isArray(parsed) && parsed.length === texts.length) {
        console.log(`[translateTexts] Python translated ${texts.length} text(s) to ${targetLang}`);
        return parsed;
      }
    }
    console.warn(`[translateTexts] Python unavailable or failed for ${targetLang}, using Node HTTP fallback.`);
  } catch (err: any) {
    console.warn(`[translateTexts] Python exception for ${targetLang}: ${err.message}. Using Node HTTP fallback.`);
  }
  // Node.js HTTP fallback (works on Vercel/serverless)
  return translateTextsNode(texts, targetLang);
}

function translateCategory(cat: string, lang: string): string {
  if (!cat) return "";
  const normalized = cat.trim().toLowerCase();
  
  const map: Record<string, Record<string, string>> = {
    "renungan": { en: "Devotion", zh: "灵修" },
    "artikel": { en: "Article", zh: "文章" },
    "alkitab": { en: "Bible", zh: "圣经" },
    "ensiklopedia": { en: "Encyclopedia", zh: "百科全书" },
    "inspirasi": { en: "Inspiration", zh: "灵感" },
    "khotbah": { en: "Sermon", zh: "讲道" },
    "gaya hidup": { en: "Lifestyle", zh: "生活方式" },
    "komunitas": { en: "Community", zh: "社区" }
  };
  
  return map[normalized]?.[lang] || cat;
}



export type BackupFileInfo = {
  name: string;
  sizeBytes: number;
  docCount: number;
  gzipped: boolean;
};

export type BackupInfo = {
  lastBackupAt: string;
  status: "success" | "failed";
  error?: string;
  files: BackupFileInfo[];
};

// General helper to upload content to R2
export async function uploadToR2Path(key: string, content: string, contentType = "application/json"): Promise<{ sizeBytes: number; gzipped: boolean }> {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  let body = Buffer.from(content, "utf8");
  let gzipped = false;

  // Compress if size is larger than 50KB
  if (body.length > 50000) {
    body = zlib.gzipSync(body);
    gzipped = true;
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentEncoding: gzipped ? "gzip" : undefined,
    CacheControl: "public, max-age=300, must-revalidate",
  });

  await s3Client.send(command);
  return { sizeBytes: body.length, gzipped };
}

// Helper to upload a JSON string to Cloudflare R2 backup key
async function uploadToR2(fileName: string, content: string): Promise<{ sizeBytes: number; gzipped: boolean }> {
  return uploadToR2Path(`backup/${fileName}`, content);
}

// Download and decompress a file from Cloudflare R2
export async function downloadFromR2(fileName: string): Promise<string> {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const key = fileName.includes("/") ? fileName : `backup/${fileName}`;
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const body = response.Body;
  if (!body) {
    throw new Error(`Empty body returned from R2 for ${fileName}`);
  }

  const buffer = Buffer.from(await body.transformToByteArray());

  if (response.ContentEncoding === "gzip") {
    const decompressed = zlib.gunzipSync(buffer);
    return decompressed.toString("utf8");
  }

  return buffer.toString("utf8");
}

// Counts files under encyclopedia/ prefix in R2
export async function getR2FileCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {
    tokoh: 0,
    tempat: 0,
    kamus: 0,
    mukjizat: 0,
    perumpamaan: 0,
    kitab: 0,
    kronologi: 0,
    silsilah: 0,
    teologi: 0,
    "teologi-2": 0,
    topikal_alkitab: 0,
    peristiwa: 0,
    "peristiwa-2": 0,
  };

  if (!R2_BUCKET_NAME) return counts;

  try {
    let isTruncated = true;
    let continuationToken: string | undefined = undefined;

    while (isTruncated) {
      const listCommand = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: "encyclopedia/",
        ContinuationToken: continuationToken,
      });

      const response: any = await s3Client.send(listCommand);
      const contents = response.Contents || [];

      for (const item of contents) {
        const key = item.Key || "";
        const parts = key.split("/");
        if (parts.length === 3 && parts[0] === "encyclopedia") {
          const cat = parts[1].toLowerCase();
          const file = parts[2];
          if (file.endsWith(".json") && file !== "index.json" && file !== "migration-report.json") {
            const mappedCat = cat === "istilah" ? "kamus" : cat;
            if (mappedCat in counts) {
              counts[mappedCat]++;
            }
          }
        }
      }

      isTruncated = response.IsTruncated || false;
      continuationToken = response.NextContinuationToken;
    }
  } catch (err) {
    console.error("[Backup R2] Failed to list R2 objects for counting:", err);
  }

  return counts;
}

// Generate the validation report comparing Firestore counts vs. R2 file counts
export async function generateValidationReport(): Promise<any[]> {
  const db = getAdminDb();
  if (!db) return [];

  // 1. Get Firestore counts for each category
  const firestoreCounts: Record<string, number> = {
    tokoh: 0,
    tempat: 0,
    kamus: 0,
    mukjizat: 0,
    perumpamaan: 0,
    kitab: 0,
    kronologi: 0,
    silsilah: 0,
    teologi: 0,
    "teologi-2": 0,
    topikal_alkitab: 0,
    peristiwa: 0,
    "peristiwa-2": 0,
  };

  try {
    const snap = await db.collection("ensiklopedia_cache").get();
    logFirestoreRead(snap.size || 1);

    snap.forEach((doc) => {
      const data = doc.data();
      const cat = (data.kategori || "").toLowerCase();
      const mappedCat = cat === "istilah" ? "kamus" : cat;
      if (mappedCat in firestoreCounts) {
        firestoreCounts[mappedCat]++;
      }
    });
  } catch (e) {
    console.error("[Validation Report] Failed to fetch Firestore counts:", e);
  }

  // 2. Get R2 counts
  const r2Counts = await getR2FileCounts();

  // 3. Compare and compile report
  const report = Object.keys(firestoreCounts).map((category) => {
    const firebaseCount = firestoreCounts[category];
    const r2Count = r2Counts[category];
    const status = firebaseCount === r2Count ? "match" : "error";
    return {
      category,
      firebase: firebaseCount,
      r2: r2Count,
      status,
    };
  });

  return report;
}

// Run the backup and synchronization process
export async function runR2Backup(): Promise<BackupInfo> {
  const db = getAdminDb();
  if (!db) {
    const err = "Firebase Admin DB is not initialized (getAdminDb returned null)";
    console.error("[Backup R2] Failed:", err);
    await notifyAdminOfFailure(err);
    return {
      lastBackupAt: new Date().toISOString(),
      status: "failed",
      error: err,
      files: [],
    };
  }

  console.log("[Backup R2] Starting backup process...");
  const filesInfo: BackupFileInfo[] = [];
  const errors: string[] = [];

  try {
    // 1. Backup: daily_devotions -> renungan.json and devotions/
    try {
      const snap = await db.collection("daily_devotions").get();
      logFirestoreRead(snap.size || 1);

      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Upload bulk JSON (legacy)
      const { sizeBytes, gzipped } = await uploadToR2("renungan.json", JSON.stringify(docs));
      filesInfo.push({ name: "renungan.json", sizeBytes, docCount: docs.length, gzipped });
      console.log(`[Backup R2] Backed up daily_devotions bulk (${docs.length} docs)`);

      // Fetch existing translations from D1 to avoid re-translation
      const existingTranslations = await queryD1<any>(
        "SELECT devotion_id, language_code FROM devotion_translations"
      ).catch(() => null);
      
      const translatedIds = new Set<string>();
      if (existingTranslations) {
        existingTranslations.forEach((t: any) => {
          translatedIds.add(`${t.devotion_id}_${t.language_code}`);
        });
      }

      // Upload individual devotions under devotions/ prefix
      let latestDevotion: any = null;
      for (const devotion of docs) {
        const key = `devotions/${devotion.id}.json`;
        await uploadToR2Path(key, JSON.stringify(devotion));

        const hasEn = translatedIds.has(`${devotion.id}_en`);
        const hasZh = translatedIds.has(`${devotion.id}_zh`);

        if (hasEn && hasZh) {
          // Already translated, skip translation logic
          console.log(`[Backup R2] Devotion ${devotion.id} already translated. Skipping translation.`);
        } else {
          // Translate and save EN/ZH versions
          const enKey = `devotions/${devotion.id}_en.json`;
          const zhKey = `devotions/${devotion.id}_zh.json`;

          try {
            const enTexts = await translateTexts([devotion.title || "", devotion.body || "", devotion.prayer || "", devotion.reflection || "", devotion.verseRef || "", devotion.verseText || ""], "en");
            const enDevotion = {
              ...devotion,
              title: enTexts[0],
              body: enTexts[1],
              prayer: enTexts[2],
              reflection: enTexts[3],
              verseRef: enTexts[4],
              verseText: enTexts[5],
            };
            await uploadToR2Path(enKey, JSON.stringify(enDevotion));

            const zhTexts = await translateTexts([devotion.title || "", devotion.body || "", devotion.prayer || "", devotion.reflection || "", devotion.verseRef || "", devotion.verseText || ""], "zh");
            const zhDevotion = {
              ...devotion,
              title: zhTexts[0],
              body: zhTexts[1],
              prayer: zhTexts[2],
              reflection: zhTexts[3],
              verseRef: zhTexts[4],
              verseText: zhTexts[5],
            };
            await uploadToR2Path(zhKey, JSON.stringify(zhDevotion));

            // Save translations in D1 devotion_translations table
            await queryD1(
              "INSERT INTO devotion_translations (devotion_id, language_code, title, excerpt) VALUES (?, ?, ?, ?) ON CONFLICT(devotion_id, language_code) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt",
              [devotion.id, "id", devotion.title, (devotion.body || "").substring(0, 150)]
            );
            await queryD1(
              "INSERT INTO devotion_translations (devotion_id, language_code, title, excerpt) VALUES (?, ?, ?, ?) ON CONFLICT(devotion_id, language_code) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt",
              [devotion.id, "en", enDevotion.title, (enDevotion.body || "").substring(0, 150)]
            );
            await queryD1(
              "INSERT INTO devotion_translations (devotion_id, language_code, title, excerpt) VALUES (?, ?, ?, ?) ON CONFLICT(devotion_id, language_code) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt",
              [devotion.id, "zh", zhDevotion.title, (zhDevotion.body || "").substring(0, 150)]
            );
          } catch (transErr) {
            console.error(`[Backup Devotion i18n] Failed for ${devotion.id}:`, transErr);
          }
        }
        
        if (!latestDevotion || devotion.id > latestDevotion.id) {
          latestDevotion = devotion;
        }
      }

      if (latestDevotion) {
        await uploadToR2Path("devotions/latest.json", JSON.stringify(latestDevotion));
        try {
          const enLatest = await translateTexts([latestDevotion.title || "", latestDevotion.body || "", latestDevotion.prayer || "", latestDevotion.reflection || "", latestDevotion.verseRef || "", latestDevotion.verseText || ""], "en");
          const zhLatest = await translateTexts([latestDevotion.title || "", latestDevotion.body || "", latestDevotion.prayer || "", latestDevotion.reflection || "", latestDevotion.verseRef || "", latestDevotion.verseText || ""], "zh");
          await uploadToR2Path("devotions/latest_en.json", JSON.stringify({
            ...latestDevotion,
            title: enLatest[0],
            body: enLatest[1],
            prayer: enLatest[2],
            reflection: enLatest[3],
            verseRef: enLatest[4],
            verseText: enLatest[5],
          }));
          await uploadToR2Path("devotions/latest_zh.json", JSON.stringify({
            ...latestDevotion,
            title: zhLatest[0],
            body: zhLatest[1],
            prayer: zhLatest[2],
            reflection: zhLatest[3],
            verseRef: zhLatest[4],
            verseText: zhLatest[5],
          }));
        } catch {}
      }
    } catch (e) {
      errors.push(`daily_devotions: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2. Backup: plans -> plans.json
    try {
      const snap = await db.collection("plans").get();
      logFirestoreRead(snap.size || 1);

      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const { sizeBytes, gzipped } = await uploadToR2("plans.json", JSON.stringify(docs));
      filesInfo.push({ name: "plans.json", sizeBytes, docCount: docs.length, gzipped });
      console.log(`[Backup R2] Backed up plans (${docs.length} docs)`);
    } catch (e) {
      errors.push(`plans: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 3. Backup: songs -> songs.json and songs/songs-index.json
    try {
      const snap = await db.collection("songs").get();
      logFirestoreRead(snap.size || 1);

      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const { sizeBytes, gzipped } = await uploadToR2("songs.json", JSON.stringify(docs));
      filesInfo.push({ name: "songs.json", sizeBytes, docCount: docs.length, gzipped });
      
      // Upload songs index
      await uploadToR2Path("songs/songs-index.json", JSON.stringify(docs));
      console.log(`[Backup R2] Backed up songs (${docs.length} docs)`);
    } catch (e) {
      errors.push(`songs: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 4. Backup: pastoral_questions -> tanya-pendeta.json
    try {
      const snap = await db.collection("pastoral_questions").get();
      logFirestoreRead(snap.size || 1);

      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const { sizeBytes, gzipped } = await uploadToR2("tanya-pendeta.json", JSON.stringify(docs));
      filesInfo.push({ name: "tanya-pendeta.json", sizeBytes, docCount: docs.length, gzipped });
      console.log(`[Backup R2] Backed up pastoral_questions (${docs.length} docs)`);
    } catch (e) {
      errors.push(`pastoral_questions: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 5. Backup: blog_posts -> blog_posts.json and articles/
    try {
      const snap = await db.collection("blog_posts").get();
      logFirestoreRead(snap.size || 1);

      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Fetch existing articles from D1 to check if translations are cached
      const existingArticles = await queryD1<any>(
        "SELECT id, title_en, title_zh FROM articles"
      ).catch(() => null);
      
      const articleTranslations = new Map<string, { en: string; zh: string }>();
      if (existingArticles) {
        existingArticles.forEach((a: any) => {
          if (a.title_en || a.title_zh) {
            articleTranslations.set(a.id, { en: a.title_en, zh: a.title_zh });
          }
        });
      }

      const translatedDocs: any[] = [];

      for (const post of docs) {
        let enPost = null;
        let zhPost = null;
        
        const hasTranslation = articleTranslations.has(post.id);

        if (hasTranslation) {
          try {
            // Attempt to fetch already translated content from R2
            const enRaw = await downloadFromR2(`articles/${post.id}_en.json`);
            enPost = JSON.parse(enRaw);
            
            const zhRaw = await downloadFromR2(`articles/${post.id}_zh.json`);
            zhPost = JSON.parse(zhRaw);
          } catch (downloadErr) {
            console.warn(`[Backup R2] Failed to download existing translation files for article ${post.id}, will re-translate:`, downloadErr);
          }
        }

        if (!enPost || !zhPost) {
          try {
            const enTexts = await translateTexts([post.title || "", post.excerpt || "", post.body || ""], "en");
            enPost = {
              ...post,
              title: enTexts[0],
              excerpt: enTexts[1],
              body: enTexts[2],
              category: translateCategory(post.category, "en"),
            };
            await uploadToR2Path(`articles/${post.id}_en.json`, JSON.stringify(enPost));
            
            const zhTexts = await translateTexts([post.title || "", post.excerpt || "", post.body || ""], "zh");
            zhPost = {
              ...post,
              title: zhTexts[0],
              excerpt: zhTexts[1],
              body: zhTexts[2],
              category: translateCategory(post.category, "zh"),
            };
            await uploadToR2Path(`articles/${post.id}_zh.json`, JSON.stringify(zhPost));
          } catch (err) {
            console.error(`Failed to translate article ${post.id}:`, err);
          }
        }

        translatedDocs.push({
          ...post,
          title_en: enPost ? enPost.title : "",
          excerpt_en: enPost ? enPost.excerpt : "",
          title_zh: zhPost ? zhPost.title : "",
          excerpt_zh: zhPost ? zhPost.excerpt : "",
          category_en: translateCategory(post.category, "en"),
          category_zh: translateCategory(post.category, "zh"),
        });

        await uploadToR2Path(`articles/${post.id}.json`, JSON.stringify(post));
      }

      // Compile bulk JSON (with translations) and upload to R2
      const { sizeBytes, gzipped } = await uploadToR2("blog_posts.json", JSON.stringify(translatedDocs));
      filesInfo.push({ name: "blog_posts.json", sizeBytes, docCount: translatedDocs.length, gzipped });

      // Compile article summaries index
      const articleSummary = translatedDocs.map((d: any) => ({
        id: d.id,
        slug: d.slug || d.id,
        title: d.title,
        title_en: d.title_en || "",
        title_zh: d.title_zh || "",
        category: d.category,
        category_en: d.category_en || "",
        category_zh: d.category_zh || "",
        excerpt: d.excerpt,
        excerpt_en: d.excerpt_en || "",
        excerpt_zh: d.excerpt_zh || "",
        imageUrl: d.imageUrl,
        bannerUrl: d.bannerUrl || d.imageUrl || null,
        authorName: d.authorName,
        createdAt: d.createdAt,
      }));

      await uploadToR2Path("articles/index.json", JSON.stringify(articleSummary));
      
      console.log(`[Backup R2] Backed up blog_posts and articles (${translatedDocs.length} docs)`);
      try {
        await populateD1Articles(translatedDocs);
      } catch (d1Err) {
        console.error("[Backup R2] Failed to bulk sync articles to D1:", d1Err);
      }
    } catch (e) {
      errors.push(`blog_posts: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 6. Backup: settings -> settings.json
    try {
      const snap = await db.collection("settings").get();
      logFirestoreRead(snap.size || 1);

      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const { sizeBytes, gzipped } = await uploadToR2("settings.json", JSON.stringify(docs));
      filesInfo.push({ name: "settings.json", sizeBytes, docCount: docs.length, gzipped });
      console.log(`[Backup R2] Backed up settings (${docs.length} docs)`);
    } catch (e) {
      errors.push(`settings: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 7. Backup: users -> users.json
    try {
      const usersSnap = await db.collection("users").get();
      logFirestoreRead(usersSnap.size || 1);

      const users = [];
      for (const doc of usersSnap.docs) {
        const data = doc.data();
        const sanitizedUser: any = {
          uid: doc.id,
          displayName: data.displayName || "",
          email: data.email || "",
          role: data.role || "user",
          createdAt: data.createdAt || null,
          premiumExpiresAt: data.premiumExpiresAt || null,
          selectedPlan: data.selectedPlan || null,
          biblePlanDay: data.biblePlanDay || 1,
        };

        // Subcollections limits to avoid huge backups
        const activitiesSnap = await doc.ref.collection("activities").orderBy("createdAt", "desc").limit(50).get();
        logFirestoreRead(activitiesSnap.size || 1);
        sanitizedUser._activities = activitiesSnap.docs.map(a => ({ id: a.id, ...a.data() }));

        const notesSnap = await doc.ref.collection("bible_plan_notes").get();
        logFirestoreRead(notesSnap.size || 1);
        sanitizedUser._bible_plan_notes = notesSnap.docs.map(n => ({ id: n.id, ...n.data() }));

        const journalsSnap = await doc.ref.collection("journals").get();
        logFirestoreRead(journalsSnap.size || 1);
        sanitizedUser._journals = journalsSnap.docs.map(j => ({ id: j.id, ...j.data() }));

        users.push(sanitizedUser);
        
        // Also upload user favorites/notes individually to user backup prefix (Cloudflare R2 Private)
        const userBackupPrefix = `users/${doc.id}/`;
        await uploadToR2Path(`${userBackupPrefix}favorites.json`, JSON.stringify(sanitizedUser._activities.filter((a: any) => a.type === "favorite")));
        await uploadToR2Path(`${userBackupPrefix}notes.json`, JSON.stringify(sanitizedUser._bible_plan_notes));
        await uploadToR2Path(`${userBackupPrefix}bookmarks.json`, JSON.stringify(sanitizedUser._activities.filter((a: any) => a.type === "bookmark")));
      }

      const { sizeBytes, gzipped } = await uploadToR2("users.json", JSON.stringify(users));
      filesInfo.push({ name: "users.json", sizeBytes, docCount: users.length, gzipped });
      console.log(`[Backup R2] Backed up users and private directories (${users.length} users)`);
    } catch (e) {
      errors.push(`users: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 8. Backup: ensiklopedia_cache -> individual keys + bulk file split
    try {
      const ensiklopediaSnap = await db.collection("ensiklopedia_cache").get();
      logFirestoreRead(ensiklopediaSnap.size || 1);

      const ensiklopediaDocs = ensiklopediaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      // Upload individual documents
      const translatedEnsiDocs = [];
      for (const doc of ensiklopediaDocs) {
        const cat = (doc.kategori || "").toLowerCase();
        const slug = doc.slug || doc.id.substring(cat.length + 1);
        if (cat && slug) {
          const key = `encyclopedia/${cat}/${slug}.json`;
          await uploadToR2Path(key, JSON.stringify(doc));
          
          let enDoc = null;
          let zhDoc = null;
          try {
            // Use isi_artikel (main content field for encyclopedia)
            const enTexts = await translateTexts([doc.keyword || "", doc.title || "", doc.isi_artikel || ""], "en");
            enDoc = {
              ...doc,
              keyword: enTexts[0],
              title: enTexts[1],
              isi_artikel: enTexts[2],
            };
            await uploadToR2Path(`encyclopedia/${cat}/${slug}_en.json`, JSON.stringify(enDoc));
            
            const zhTexts = await translateTexts([doc.keyword || "", doc.title || "", doc.isi_artikel || ""], "zh");
            zhDoc = {
              ...doc,
              keyword: zhTexts[0],
              title: zhTexts[1],
              isi_artikel: zhTexts[2],
            };
            await uploadToR2Path(`encyclopedia/${cat}/${slug}_zh.json`, JSON.stringify(zhDoc));
          } catch (err) {
            console.error(`Failed to translate encyclopedia ${doc.id}:`, err);
          }

          translatedEnsiDocs.push({
            ...doc,
            title_en: enDoc ? enDoc.title : "",
            title_zh: zhDoc ? zhDoc.title : ""
          });
        }
      }

      // Legacy bulk backups for backwards compatibility
      // Include all categories: tokoh, tempat, istilah/kamus, mukjizat, perumpamaan, kitab, kronologi, silsilah, teologi, teologi-2, topikal_alkitab, peristiwa, peristiwa-2
      const categories = [
        "tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi",
        "silsilah", "teologi", "teologi-2", "topikal_alkitab", "peristiwa", "peristiwa-2"
      ];
      
      for (const cat of categories) {
        let docs = ensiklopediaDocs.filter(d => d.kategori === cat);
        
        // Handle special cases
        if (cat === "istilah") {
          docs = ensiklopediaDocs.filter(d => d.kategori === "istilah" || d.kategori === "kamus");
        }
        
        const fileName = `${cat}.json`;
        const { sizeBytes, gzipped } = await uploadToR2(fileName, JSON.stringify(docs));
        filesInfo.push({ name: fileName, sizeBytes, docCount: docs.length, gzipped });
      }

      // Index of categories
      const { sizeBytes, gzipped } = await uploadToR2("kategori.json", JSON.stringify(categories));
      filesInfo.push({ name: "kategori.json", sizeBytes, docCount: categories.length, gzipped });
      console.log(`[Backup R2] Sync and back up of encyclopedia complete (${ensiklopediaDocs.length} total docs)`);
      try {
        await populateD1Encyclopedia(translatedEnsiDocs);
      } catch (d1Err) {
        console.error("[Backup R2] Failed to bulk sync encyclopedia to D1:", d1Err);
      }
    } catch (e) {
      errors.push(`ensiklopedia_cache: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 9. Backup: emailSubscribers -> emailSubscribers.json
    try {
      const snap = await db.collection("emailSubscribers").get();
      logFirestoreRead(snap.size || 1);

      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const { sizeBytes, gzipped } = await uploadToR2("emailSubscribers.json", JSON.stringify(docs));
      filesInfo.push({ name: "emailSubscribers.json", sizeBytes, docCount: docs.length, gzipped });
      console.log(`[Backup R2] Backed up emailSubscribers (${docs.length} docs)`);
    } catch (e) {
      errors.push(`emailSubscribers: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 10. Backup: pushSubscribers -> pushSubscribers.json
    try {
      const snap = await db.collection("pushSubscribers").get();
      logFirestoreRead(snap.size || 1);

      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const { sizeBytes, gzipped } = await uploadToR2("pushSubscribers.json", JSON.stringify(docs));
      filesInfo.push({ name: "pushSubscribers.json", sizeBytes, docCount: docs.length, gzipped });
      console.log(`[Backup R2] Backed up pushSubscribers (${docs.length} docs)`);
    } catch (e) {
      errors.push(`pushSubscribers: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Generate validation report and upload to R2
    const validationReport = await generateValidationReport();
    await uploadToR2Path("encyclopedia/migration-report.json", JSON.stringify(validationReport, null, 2));

    // Determine final status
    const status = errors.length > 0 ? "failed" : "success";
    const backupResult: BackupInfo = {
      lastBackupAt: new Date().toISOString(),
      status,
      error: errors.length > 0 ? errors.join("; ") : undefined,
      files: filesInfo,
    };

    // Update backup_metadata in Firebase settings collection
    try {
      await db.collection("settings").doc("backup_metadata").set({
        lastBackupAt: backupResult.lastBackupAt,
        status: backupResult.status,
        error: backupResult.error || null,
        filesCount: backupResult.files.length,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      logFirestoreWrite(1);
    } catch (dbErr) {
      console.error("[Backup R2] Failed to save backup_metadata in Firestore settings:", dbErr);
    }

    // Save metadata summary file: backup-info.json
    await uploadToR2("backup-info.json", JSON.stringify(backupResult));

    if (status === "failed") {
      await notifyAdminOfFailure(backupResult.error || "Unknown error occurred during collections backup");
    }

    return backupResult;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Backup R2] Critical Failure:", errMsg);
    await notifyAdminOfFailure(errMsg);
    
    const failedResult: BackupInfo = {
      lastBackupAt: new Date().toISOString(),
      status: "failed",
      error: errMsg,
      files: [],
    };
    
    try {
      await uploadToR2("backup-info.json", JSON.stringify(failedResult));
    } catch (e) {
      console.error("[Backup R2] Failed to write backup-info.json status:", e);
    }
    
    return failedResult;
  }
}

// Fast incremental sync for a single encyclopedia item to avoid slow full-database uploads
export async function syncSingleEncyclopediaItem(
  id: string,
  data: any,
  action: "upsert" | "delete" = "upsert"
): Promise<void> {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const cat = (data.kategori || id.split("-")[0] || "").toLowerCase();
  const slug = data.slug || (id.startsWith(`${cat}-`) ? id.substring(cat.length + 1) : id);
  if (!cat || !slug) return;

  const individualKey = `encyclopedia/${cat}/${slug}.json`;

  if (action === "delete") {
    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: individualKey,
      });
      await s3Client.send(command);
      console.log(`[Backup R2] Deleted individual R2 file: ${individualKey}`);
    } catch (e) {
      console.warn(`[Backup R2] Failed to delete individual R2 file ${individualKey}:`, e);
    }
  } else {
    await uploadToR2Path(individualKey, JSON.stringify({ id, ...data }));
    console.log(`[Backup R2] Uploaded individual R2 file: ${individualKey}`);
  }

  // Update bulk category file (tokoh.json, tempat.json, istilah.json, etc.)
  const mappedCat = cat === "istilah" || cat === "kamus" ? "istilah" : cat;
  const bulkFileName = `${mappedCat}.json`;

  let bulkDocs: any[] = [];
  try {
    const currentBulk = await downloadFromR2(bulkFileName);
    if (currentBulk) {
      const parsed = JSON.parse(currentBulk);
      if (Array.isArray(parsed)) {
        bulkDocs = parsed;
      }
    }
  } catch (err) {
    console.warn(`[Backup R2] Failed to download bulk file ${bulkFileName}, creating new:`, err);
  }

  // Filter out existing item
  bulkDocs = bulkDocs.filter((doc: any) => doc.id !== id);

  if (action === "upsert") {
    bulkDocs.push({ id, ...data });
  }

  await uploadToR2Path(`backup/${bulkFileName}`, JSON.stringify(bulkDocs));
  console.log(`[Backup R2] Updated bulk file backup/${bulkFileName} with item ${id}`);

  // NOTE: Validation report is intentionally NOT generated here per-item save
  // because generateValidationReport() reads the full Firestore collection + lists all R2 files,
  // which takes 60-90+ seconds. Reports are only regenerated during full backups.
}

// Lightweight sync function for only the encyclopedia cache to preserve Firestore Spark quotas
export async function syncEncyclopediaOnly(): Promise<{ status: "success" | "failed"; error?: string; count?: number }> {
  const db = getAdminDb();
  if (!db) {
    return { status: "failed", error: "Firebase Admin DB is not initialized" };
  }

  try {
    console.log("[Backup R2] Starting lightweight encyclopedia sync...");
    const ensiklopediaSnap = await db.collection("ensiklopedia_cache").get();
    const docCount = ensiklopediaSnap.size;
    logFirestoreRead(docCount || 1);

    const ensiklopediaDocs = ensiklopediaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    // 1. Upload individual documents
    for (const doc of ensiklopediaDocs) {
      const cat = (doc.kategori || "").toLowerCase();
      const slug = doc.slug || doc.id.substring(cat.length + 1);
      if (cat && slug) {
        const key = `encyclopedia/${cat}/${slug}.json`;
        await uploadToR2Path(key, JSON.stringify(doc));
      }
    }

    // 2. Legacy bulk backups untuk semua kategori
    const categories = [
      "tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi",
      "silsilah", "teologi", "topikal_alkitab", "peristiwa",
    ];
    for (const cat of categories) {
      let docs = ensiklopediaDocs.filter(d => d.kategori === cat);
      if (cat === "istilah") {
        docs = ensiklopediaDocs.filter(d => d.kategori === "istilah" || d.kategori === "kamus");
      }
      
      const fileName = `${cat}.json`;
      await uploadToR2(fileName, JSON.stringify(docs));
    }

    // 3. Index of categories
    await uploadToR2("kategori.json", JSON.stringify(categories));

    // 4. Generate validation report and upload to R2
    const validationReport = await generateValidationReport();
    await uploadToR2Path("encyclopedia/migration-report.json", JSON.stringify(validationReport, null, 2));

     console.log(`[Backup R2] Lightweight encyclopedia sync complete (${docCount} docs synced)`);
    try {
      await populateD1Encyclopedia(ensiklopediaDocs);
    } catch (d1Err) {
      console.error("[Backup R2] Failed to bulk sync encyclopedia to D1 in lightweight mode:", d1Err);
    }
    return { status: "success", count: docCount };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Backup R2] Lightweight encyclopedia sync failed:", errMsg);
    return { status: "failed", error: errMsg };
  }
}


// Notify admin on backup failures via email
async function notifyAdminOfFailure(errorMsg: string) {
  const adminEmail = process.env.SMTP_FROM || "no-reply@gracedaily.com";
  const subject = `⚠️ [ALERT] Backup Firestore ke Cloudflare R2 Gagal!`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ffcccc; background-color: #fff5f5; border-radius: 8px;">
      <h2 style="color: #d9534f; margin-top: 0;">Peringatan Sistem: Kegagalan Backup</h2>
      <p>Proses backup otomatis harian Firestore ke Cloudflare R2 mengalami kegagalan.</p>
      <p><strong>Detail Kesalahan:</strong></p>
      <pre style="background: #f8f9fa; padding: 15px; border-radius: 4px; border: 1px solid #dee2e6; white-space: pre-wrap; font-size: 14px; color: #333;">${errorMsg}</pre>
      <p style="margin-top: 20px; font-size: 12px; color: #777;">Email ini dikirim otomatis oleh Grace Daily Backup Monitor.</p>
    </div>
  `;
  try {
    await sendEmail({
      to: adminEmail,
      subject,
      html,
    });
    console.log("[Backup R2] Failure email notification sent to admin");
  } catch (e) {
    console.error("[Backup R2] Failed to send failure email to admin:", e);
  }
}

// Bulk sync helper for articles to Cloudflare D1
export async function populateD1Articles(docs: any[]): Promise<boolean> {
  if (!docs || docs.length === 0) return true;
  try {
    console.log(`[D1 Sync] Starting bulk sync of ${docs.length} articles to D1...`);
    const chunkSize = 10;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      
      let sql = `INSERT INTO articles (id, title, category, r2_path, created_at, tags, image_url, excerpt, title_en, title_zh, excerpt_en, excerpt_zh) VALUES `;
      const params: any[] = [];
      
      const valuePlaceholders = chunk.map((d, _index) => {
        // createdAt may be Firestore Timestamp, string, or number
        let createdAtStr = new Date().toISOString();
        if (d.createdAt) {
          if (typeof d.createdAt.toDate === "function") {
            createdAtStr = d.createdAt.toDate().toISOString();
          } else if (typeof d.createdAt._seconds === "number") {
            createdAtStr = new Date(d.createdAt._seconds * 1000).toISOString();
          } else if (typeof d.createdAt.seconds === "number") {
            createdAtStr = new Date(d.createdAt.seconds * 1000).toISOString();
          } else if (typeof d.createdAt === "string" || typeof d.createdAt === "number") {
            const parsed = new Date(d.createdAt);
            if (!isNaN(parsed.getTime())) createdAtStr = parsed.toISOString();
          }
        }
        params.push(
          d.id,
          d.title || "",
          d.category || "",
          `articles/${d.id}.json`,
          createdAtStr,
          d.tags ? (typeof d.tags === 'string' ? d.tags : JSON.stringify(d.tags)) : "",
          d.imageUrl || d.bannerUrl || "",
          d.excerpt || "",
          d.title_en || "",
          d.title_zh || "",
          d.excerpt_en || "",
          d.excerpt_zh || ""
        );
        return `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      }).join(", ");
      
      sql += valuePlaceholders;
      sql += ` ON CONFLICT(id) DO UPDATE SET
               title=excluded.title,
               category=excluded.category,
               r2_path=excluded.r2_path,
               created_at=excluded.created_at,
               tags=excluded.tags,
               image_url=excluded.image_url,
               excerpt=excluded.excerpt,
               title_en=excluded.title_en,
               title_zh=excluded.title_zh,
               excerpt_en=excluded.excerpt_en,
               excerpt_zh=excluded.excerpt_zh`;
               
      await queryD1(sql, params);
    }
    console.log(`[D1 Sync] Bulk sync of articles to D1 complete.`);
    return true;
  } catch (err) {
    console.error("[D1 Sync] Failed to bulk populate articles to D1:", err);
    return false;
  }
}

// Bulk sync helper for encyclopedia items to Cloudflare D1
export async function populateD1Encyclopedia(docs: any[]): Promise<boolean> {
  if (!docs || docs.length === 0) return true;
  try {
    console.log(`[D1 Sync] Starting bulk sync of ${docs.length} encyclopedia entries to D1...`);
    const chunkSize = 10;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      
      let sql = `INSERT INTO encyclopedia (id, slug, keyword, title, kategori, r2_path, updated_at, banner_url, title_en, title_zh) VALUES `;
      const params: any[] = [];
      
      const valuePlaceholders = chunk.map((d, _index) => {
        const cat = (d.kategori || "").toLowerCase();
        const slug = d.slug || (d.id.startsWith(`${cat}-`) ? d.id.substring(cat.length + 1) : d.id);
        
        // updatedAt may be Firestore Timestamp, string, or number
        let updatedAtStr = new Date().toISOString();
        if (d.updatedAt) {
          if (typeof d.updatedAt.toDate === "function") {
            updatedAtStr = d.updatedAt.toDate().toISOString();
          } else if (typeof d.updatedAt._seconds === "number") {
            updatedAtStr = new Date(d.updatedAt._seconds * 1000).toISOString();
          } else if (typeof d.updatedAt.seconds === "number") {
            updatedAtStr = new Date(d.updatedAt.seconds * 1000).toISOString();
          } else if (typeof d.updatedAt === "string" || typeof d.updatedAt === "number") {
            const parsed = new Date(d.updatedAt);
            if (!isNaN(parsed.getTime())) updatedAtStr = parsed.toISOString();
          }
        }
        
        params.push(
          d.id,
          slug,
          d.keyword || "",
          d.title || "",
          d.kategori || cat,
          `encyclopedia/${cat}/${slug}.json`,
          updatedAtStr,
          d.bannerUrl || d.imageUrl || d.illustrationUrl || "",
          d.title_en || "",
          d.title_zh || ""
        );
        return `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      }).join(", ");
      
      sql += valuePlaceholders;
      sql += ` ON CONFLICT(id) DO UPDATE SET
               slug=excluded.slug,
               keyword=excluded.keyword,
               title=excluded.title,
               kategori=excluded.kategori,
               r2_path=excluded.r2_path,
               updated_at=excluded.updated_at,
               banner_url=excluded.banner_url,
               title_en=excluded.title_en,
               title_zh=excluded.title_zh`;
               
      await queryD1(sql, params);
    }
    console.log(`[D1 Sync] Bulk sync of encyclopedia entries to D1 complete.`);
    return true;
  } catch (err) {
    console.error("[D1 Sync] Failed to bulk populate encyclopedia to D1:", err);
    return false;
  }
}

// Incremental sync for a single blog article to prevent timeouts
export async function syncSingleBlogArticle(
  id: string,
  post: any,
  action: "upsert" | "delete" = "upsert"
): Promise<void> {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const individualKey = `articles/${id}.json`;
  const enKey = `articles/${id}_en.json`;
  const zhKey = `articles/${id}_zh.json`;

  if (action === "delete") {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: individualKey }));
      await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: enKey }));
      await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: zhKey }));
    } catch (e) {
      console.warn(`[Backup R2] Failed to delete blog R2 files for ${id}:`, e);
    }

    try {
      await queryD1("DELETE FROM articles WHERE id = ?", [id]);
    } catch (e) {
      console.error("[Backup R2] Failed to delete article from D1:", e);
    }
  } else {
    // 1. Translate ONLY the new article
    let enPost = null;
    let zhPost = null;
    try {
      const enTexts = await translateTexts([post.title || "", post.excerpt || "", post.body || ""], "en");
      enPost = {
        ...post,
        title: enTexts[0],
        excerpt: enTexts[1],
        body: enTexts[2],
        category: translateCategory(post.category, "en"),
      };
      await uploadToR2Path(enKey, JSON.stringify(enPost));

      const zhTexts = await translateTexts([post.title || "", post.excerpt || "", post.body || ""], "zh");
      zhPost = {
        ...post,
        title: zhTexts[0],
        excerpt: zhTexts[1],
        body: zhTexts[2],
        category: translateCategory(post.category, "zh"),
      };
      await uploadToR2Path(zhKey, JSON.stringify(zhPost));
    } catch (err) {
      console.error(`Failed to translate article ${id}:`, err);
    }

    const finalPost = {
      ...post,
      title_en: enPost ? enPost.title : "",
      excerpt_en: enPost ? enPost.excerpt : "",
      title_zh: zhPost ? zhPost.title : "",
      excerpt_zh: zhPost ? zhPost.excerpt : "",
      category_en: translateCategory(post.category, "en"),
      category_zh: translateCategory(post.category, "zh"),
    };

    // Upload individual article to R2
    await uploadToR2Path(individualKey, JSON.stringify(post));

    // 2. Sync to Cloudflare D1
    try {
      let createdAtStr = new Date().toISOString();
      if (post.createdAt) {
        if (typeof post.createdAt.toDate === "function") {
          createdAtStr = post.createdAt.toDate().toISOString();
        } else if (typeof post.createdAt._seconds === "number") {
          createdAtStr = new Date(post.createdAt._seconds * 1000).toISOString();
        } else if (typeof post.createdAt.seconds === "number") {
          createdAtStr = new Date(post.createdAt.seconds * 1000).toISOString();
        } else if (typeof post.createdAt === "string" || typeof post.createdAt === "number") {
          const parsed = new Date(post.createdAt);
          if (!isNaN(parsed.getTime())) createdAtStr = parsed.toISOString();
        }
      }

      await queryD1(
        `INSERT INTO articles (id, title, category, r2_path, created_at, tags, image_url, excerpt, title_en, title_zh, excerpt_en, excerpt_zh) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title,
           category=excluded.category,
           r2_path=excluded.r2_path,
           created_at=excluded.created_at,
           tags=excluded.tags,
           image_url=excluded.image_url,
           excerpt=excluded.excerpt,
           title_en=excluded.title_en,
           title_zh=excluded.title_zh,
           excerpt_en=excluded.excerpt_en,
           excerpt_zh=excluded.excerpt_zh`,
        [
          id,
          post.title || "",
          post.category || "",
          `articles/${id}.json`,
          createdAtStr,
          post.tags ? (typeof post.tags === "string" ? post.tags : JSON.stringify(post.tags)) : "",
          post.imageUrl || post.bannerUrl || "",
          post.excerpt || "",
          finalPost.title_en || "",
          finalPost.title_zh || "",
          finalPost.excerpt_en || "",
          finalPost.excerpt_zh || ""
        ]
      );
      console.log(`[Backup R2] Incremental D1 sync complete for article: ${id}`);
    } catch (d1Err) {
      console.error("[Backup R2] Failed to sync article to D1:", d1Err);
    }

    // 3. Update R2 bulk backups
    try {
      let bulkPosts: any[] = [];
      const currentBulk = await downloadFromR2("blog_posts.json").catch(() => null);
      if (currentBulk) {
        const parsed = JSON.parse(currentBulk);
        if (Array.isArray(parsed)) bulkPosts = parsed;
      }
      bulkPosts = bulkPosts.filter((p: any) => p.id !== id);
      bulkPosts.push(finalPost);
      await uploadToR2("blog_posts.json", JSON.stringify(bulkPosts));
    } catch (e) {
      console.error("[Backup R2] Failed to update R2 blog_posts.json:", e);
    }

    try {
      let indexPosts: any[] = [];
      const currentIndex = await downloadFromR2("articles/index.json").catch(() => null);
      if (currentIndex) {
        const parsed = JSON.parse(currentIndex);
        if (Array.isArray(parsed)) indexPosts = parsed;
      }
      indexPosts = indexPosts.filter((p: any) => p.id !== id);
      indexPosts.push({
        id: finalPost.id,
        slug: finalPost.slug || finalPost.id,
        title: finalPost.title,
        title_en: finalPost.title_en || "",
        title_zh: finalPost.title_zh || "",
        category: finalPost.category,
        category_en: finalPost.category_en || "",
        category_zh: finalPost.category_zh || "",
        excerpt: finalPost.excerpt,
        excerpt_en: finalPost.excerpt_en || "",
        excerpt_zh: finalPost.excerpt_zh || "",
        imageUrl: finalPost.imageUrl,
        bannerUrl: finalPost.bannerUrl || finalPost.imageUrl || null,
        authorName: finalPost.authorName,
        createdAt: finalPost.createdAt,
      });
      await uploadToR2Path("articles/index.json", JSON.stringify(indexPosts));
    } catch (e) {
      console.error("[Backup R2] Failed to update R2 articles/index.json:", e);
    }
  }
}

// Incremental sync for a single daily devotion to prevent timeouts
export async function syncSingleDevotion(
  id: string,
  devotion: any,
  action: "upsert" | "delete" = "upsert"
): Promise<void> {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const individualKey = `devotions/${id}.json`;
  const enKey = `devotions/${id}_en.json`;
  const zhKey = `devotions/${id}_zh.json`;

  if (action === "delete") {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: individualKey }));
      await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: enKey }));
      await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: zhKey }));
    } catch (e) {
      console.warn(`[Backup R2] Failed to delete devotion R2 files for ${id}:`, e);
    }

    try {
      await queryD1("DELETE FROM devotion_translations WHERE devotion_id = ?", [id]);
    } catch (e) {
      console.error("[Backup R2] Failed to delete devotion translations from D1:", e);
    }
  } else {
    // 1. Translate ONLY the new devotion
    let enDevotion = null;
    let zhDevotion = null;

    try {
      const enTexts = await translateTexts(
        [
          devotion.title || "",
          devotion.body || "",
          devotion.prayer || "",
          devotion.reflection || "",
          devotion.verseRef || "",
          devotion.verseText || ""
        ],
        "en"
      );
      enDevotion = {
        ...devotion,
        title: enTexts[0],
        body: enTexts[1],
        prayer: enTexts[2],
        reflection: enTexts[3],
        verseRef: enTexts[4],
        verseText: enTexts[5],
      };
      await uploadToR2Path(enKey, JSON.stringify(enDevotion));

      const zhTexts = await translateTexts(
        [
          devotion.title || "",
          devotion.body || "",
          devotion.prayer || "",
          devotion.reflection || "",
          devotion.verseRef || "",
          devotion.verseText || ""
        ],
        "zh"
      );
      zhDevotion = {
        ...devotion,
        title: zhTexts[0],
        body: zhTexts[1],
        prayer: zhTexts[2],
        reflection: zhTexts[3],
        verseRef: zhTexts[4],
        verseText: zhTexts[5],
      };
      await uploadToR2Path(zhKey, JSON.stringify(zhDevotion));
    } catch (err) {
      console.error(`Failed to translate devotion ${id}:`, err);
    }

    // Upload individual devotion to R2
    await uploadToR2Path(individualKey, JSON.stringify(devotion));

    // Upload latest
    await uploadToR2Path("devotions/latest.json", JSON.stringify(devotion));
    if (enDevotion) await uploadToR2Path("devotions/latest_en.json", JSON.stringify(enDevotion));
    if (zhDevotion) await uploadToR2Path("devotions/latest_zh.json", JSON.stringify(zhDevotion));

    // 2. Sync translations to D1
    try {
      await queryD1(
        "INSERT INTO devotion_translations (devotion_id, language_code, title, excerpt) VALUES (?, ?, ?, ?) ON CONFLICT(devotion_id, language_code) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt",
        [id, "id", devotion.title, (devotion.body || "").substring(0, 150)]
      );
      if (enDevotion) {
        await queryD1(
          "INSERT INTO devotion_translations (devotion_id, language_code, title, excerpt) VALUES (?, ?, ?, ?) ON CONFLICT(devotion_id, language_code) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt",
          [id, "en", enDevotion.title, (enDevotion.body || "").substring(0, 150)]
        );
      }
      if (zhDevotion) {
        await queryD1(
          "INSERT INTO devotion_translations (devotion_id, language_code, title, excerpt) VALUES (?, ?, ?, ?) ON CONFLICT(devotion_id, language_code) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt",
          [id, "zh", zhDevotion.title, (zhDevotion.body || "").substring(0, 150)]
        );
      }
      console.log(`[Backup R2] Incremental D1 sync complete for devotion translations: ${id}`);
    } catch (d1Err) {
      console.error("[Backup R2] Failed to sync devotion translations to D1:", d1Err);
    }

    // 3. Update R2 bulk backups
    try {
      let bulkDevotions: any[] = [];
      const currentBulk = await downloadFromR2("renungan.json").catch(() => null);
      if (currentBulk) {
        const parsed = JSON.parse(currentBulk);
        if (Array.isArray(parsed)) bulkDevotions = parsed;
      }
      bulkDevotions = bulkDevotions.filter((d: any) => d.id !== id);
      bulkDevotions.push(devotion);
      await uploadToR2("renungan.json", JSON.stringify(bulkDevotions));
    } catch (e) {
      console.error("[Backup R2] Failed to update R2 renungan.json:", e);
    }
  }
}
