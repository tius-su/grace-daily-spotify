import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { downloadFromR2, syncSingleEncyclopediaItem, translateTexts } from "@/lib/server/backup-r2-service";
import { queryD1 } from "@/lib/server/d1";
import zlib from "zlib";


export const dynamic = "force-dynamic";

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

async function uploadToR2Path(key: string, content: string, contentType = "application/json") {
  if (!R2_BUCKET_NAME) return;
  let body = Buffer.from(content, "utf8");
  let gzipped = false;

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
  });
  await s3Client.send(command);
}

async function deleteFromR2Path(key: string) {
  if (!R2_BUCKET_NAME) return;
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  try {
    await s3Client.send(command);
  } catch (err) {
    console.warn(`[SyncDoc API] Failed to delete from R2: ${key}`, err);
  }
}

export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { collection, id, action = "upsert", data: bodyData } = body;

    if (!collection || !id) {
      return NextResponse.json({ error: "Collection and ID are required" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firestore Admin is not initialized" }, { status: 500 });
    }

    if (action === "delete") {
      // 1. Determine key to delete from R2 and execute D1 cleanups
      let keyToDelete = "";
      if (collection === "ensiklopedia_cache") {
        try {
          const cat = id.split("-")[0] || "tokoh";
          const slug = id.startsWith(`${cat}-`) ? id.substring(cat.length + 1) : id;
          await syncSingleEncyclopediaItem(id, { kategori: cat }, "delete");
          await deleteFromR2Path(`encyclopedia/${cat}/${slug}_en.json`);
          await deleteFromR2Path(`encyclopedia/${cat}/${slug}_zh.json`);
          await queryD1("DELETE FROM encyclopedia WHERE id = ?", [id]);
        } catch (syncErr) {
          console.error("[SyncDoc API] Failed to sync encyclopedia after deletion:", syncErr);
        }
      } else if (collection === "blog_posts") {
        keyToDelete = `articles/${id}.json`;
        await deleteFromR2Path(`articles/${id}_en.json`);
        await deleteFromR2Path(`articles/${id}_zh.json`);
        await queryD1("DELETE FROM articles WHERE id = ?", [id]);
      } else if (collection === "daily_devotions") {
        keyToDelete = `devotions/${id}.json`;
        await deleteFromR2Path(`devotions/${id}_en.json`);
        await deleteFromR2Path(`devotions/${id}_zh.json`);
        await queryD1("DELETE FROM devotion_translations WHERE devotion_id = ?", [id]);
        
        // Rebuild backup/renungan.json index
        try {
          let docs: any[] = [];
          try {
            const snap = await db.collection("daily_devotions").get();
            docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          } catch (e) {
            console.warn("[SyncDoc API] Firestore read failed, falling back to R2 index reconstruction:", e);
            try {
              const currentIndexStr = await downloadFromR2("renungan.json");
              const currentIndex = JSON.parse(currentIndexStr);
              if (Array.isArray(currentIndex)) {
                docs = currentIndex.filter((item: any) => item.id !== id);
              }
            } catch (r2Err) {
              console.error("[SyncDoc API] R2 index rebuild failed:", r2Err);
            }
          }
          docs = docs.filter((item: any) => item.id !== id);
          await uploadToR2Path("backup/renungan.json", JSON.stringify(docs));
        } catch (renunganIndexErr) {
          console.error("[SyncDoc API] Failed to rebuild backup/renungan.json index:", renunganIndexErr);
        }

        // Rebuild latest.json
        try {
          let latestDevotion: any = null;
          try {
            const snap = await db.collection("daily_devotions").get();
            const docs = snap.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter(doc => doc.id !== id);
            for (const devotion of docs) {
              if (!latestDevotion || devotion.id > latestDevotion.id) {
                latestDevotion = devotion;
              }
            }
          } catch (e) {
            console.warn("[SyncDoc API] Firestore read failed during latest devotion delete, trying R2 check:", e);
            try {
              const currentLatestStr = await downloadFromR2("devotions/latest.json");
              const currentLatest = JSON.parse(currentLatestStr);
              if (currentLatest && currentLatest.id !== id) {
                latestDevotion = currentLatest;
              } else {
                // Look back up to 7 days to find the next latest
                let searchDate = new Date();
                for (let dayOffset = 0; dayOffset < 7 && !latestDevotion; dayOffset++) {
                  const checkDate = new Date();
                  checkDate.setDate(searchDate.getDate() - dayOffset);
                  
                  const y = checkDate.getFullYear();
                  const m = String(checkDate.getMonth() + 1).padStart(2, '0');
                  const d = String(checkDate.getDate()).padStart(2, '0');
                  
                  const slots = [`golden-${y}-${m}-${d}-15`, `golden-${y}-${m}-${d}-05`];
                  for (const slotId of slots) {
                    if (slotId !== id) {
                      try {
                        const checkStr = await downloadFromR2(`devotions/${slotId}.json`);
                        if (checkStr) {
                          latestDevotion = JSON.parse(checkStr);
                          break;
                        }
                      } catch {}
                    }
                  }
                }
              }
            } catch (r2Err) {
              console.error("[SyncDoc API] R2 latest recalculation failed:", r2Err);
            }
          }

          if (latestDevotion) {
            await uploadToR2Path("devotions/latest.json", JSON.stringify(latestDevotion));
          } else {
            await deleteFromR2Path("devotions/latest.json");
          }
        } catch (latestRebuildErr) {
          console.error("[SyncDoc API] Failed to rebuild latest devotion:", latestRebuildErr);
        }
      }

      if (keyToDelete) {
        await deleteFromR2Path(keyToDelete);
      }

      // Rebuild Indexes
      if (collection === "blog_posts") {
        try {
          const d1Articles = await queryD1<any>("SELECT * FROM articles");
          if (d1Articles) {
            const articleSummary = d1Articles.map((d: any) => ({
              id: d.id,
              slug: d.id,
              title: d.title,
              title_en: d.title_en || "",
              title_zh: d.title_zh || "",
              category: d.category,
              category_en: translateCategory(d.category, "en"),
              category_zh: translateCategory(d.category, "zh"),
              excerpt: d.excerpt,
              excerpt_en: d.excerpt_en || "",
              excerpt_zh: d.excerpt_zh || "",
              imageUrl: d.image_url,
              bannerUrl: d.image_url,
              authorName: "",
              createdAt: d.created_at,
            }));
            await uploadToR2Path("articles/index.json", JSON.stringify(articleSummary));
            await uploadToR2Path("backup/blog_posts.json", JSON.stringify(d1Articles));
          }
        } catch (rebuildErr) {
          console.error("[SyncDoc API] Failed to rebuild article index on deletion:", rebuildErr);
        }
      } else if (collection === "songs") {
        let docs: any[] = [];
        try {
          const snap = await db.collection("songs").get();
          docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
          console.warn("[SyncDoc API] Firestore songs read failed, falling back to R2 index reconstruction:", e);
          try {
            const currentIndexStr = await downloadFromR2("songs/songs-index.json");
            const currentIndex = JSON.parse(currentIndexStr);
            if (Array.isArray(currentIndex)) {
              docs = currentIndex.filter((item: any) => item.id !== id);
            }
          } catch (r2Err) {
            console.error("[SyncDoc API] R2 songs index rebuild failed:", r2Err);
          }
        }
        await uploadToR2Path("songs/songs-index.json", JSON.stringify(docs));
      }

      return NextResponse.json({ success: true, message: `Deleted and synced ${collection}/${id}` });
    }

    // Upsert Action
    let data = bodyData;
    if (!data) {
      try {
        const docSnap = await db.collection(collection).doc(id).get();
        if (docSnap.exists) {
          data = docSnap.data();
        }
      } catch (dbErr) {
        console.warn("[SyncDoc API] Firestore doc fetch failed:", dbErr);
      }
    }

    if (!data) {
      return NextResponse.json({ error: "Document data could not be fetched from Firestore or payload" }, { status: 404 });
    }

    if (collection === "ensiklopedia_cache") {
      try {
        await syncSingleEncyclopediaItem(id, data, "upsert");
        
        // On-the-fly: translate and upload EN/ZH versions to R2
        const cat = (data.kategori || id.split("-")[0] || "").toLowerCase();
        const slug = data.slug || (id.startsWith(`${cat}-`) ? id.substring(cat.length + 1) : id);
        try {
          const enTexts = await translateTexts([data.keyword || "", data.title || "", data.isi_artikel || ""], "en");
          await uploadToR2Path(`encyclopedia/${cat}/${slug}_en.json`, JSON.stringify({
            ...data, id,
            keyword: enTexts[0],
            title: enTexts[1],
            isi_artikel: enTexts[2],
          }));
          const zhTexts = await translateTexts([data.keyword || "", data.title || "", data.isi_artikel || ""], "zh");
          await uploadToR2Path(`encyclopedia/${cat}/${slug}_zh.json`, JSON.stringify({
            ...data, id,
            keyword: zhTexts[0],
            title: zhTexts[1],
            isi_artikel: zhTexts[2],
          }));
          console.log(`[SyncDoc] Encyclopedia ${id} translated to EN/ZH and uploaded to R2`);
        } catch (transErr) {
          console.error(`[SyncDoc] Failed to translate encyclopedia ${id}:`, transErr);
        }

        // Sync to Cloudflare D1
        await queryD1(
          `INSERT INTO encyclopedia (id, slug, keyword, title, kategori, r2_path, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             slug=excluded.slug,
             keyword=excluded.keyword,
             title=excluded.title,
             kategori=excluded.kategori,
             r2_path=excluded.r2_path,
             updated_at=excluded.updated_at`,
          [
            id,
            slug,
            data.keyword || "",
            data.title || "",
            data.kategori || cat,
            `encyclopedia/${cat}/${slug}.json`,
            data.updatedAt || new Date().toISOString()
          ]
        );
      } catch (syncErr) {
        console.error("[SyncDoc API] Failed to sync encyclopedia after upsert:", syncErr);
      }
    } else if (collection === "blog_posts") {
      await uploadToR2Path(`articles/${id}.json`, JSON.stringify({ id, ...data }));

      // On-the-fly: translate and upload EN/ZH versions, then sync to D1
      let enTitle = "", enExcerpt = "", zhTitle = "", zhExcerpt = "";
      try {
        const enTexts = await translateTexts([data.title || "", data.excerpt || "", data.body || ""], "en");
        enTitle = enTexts[0] || "";
        enExcerpt = enTexts[1] || "";
        await uploadToR2Path(`articles/${id}_en.json`, JSON.stringify({
          id, ...data,
          title: enTexts[0],
          excerpt: enTexts[1],
          body: enTexts[2],
          category: translateCategory(data.category, "en"),
        }));
        const zhTexts = await translateTexts([data.title || "", data.excerpt || "", data.body || ""], "zh");
        zhTitle = zhTexts[0] || "";
        zhExcerpt = zhTexts[1] || "";
        await uploadToR2Path(`articles/${id}_zh.json`, JSON.stringify({
          id, ...data,
          title: zhTexts[0],
          excerpt: zhTexts[1],
          body: zhTexts[2],
          category: translateCategory(data.category, "zh"),
        }));
        console.log(`[SyncDoc] Article ${id} translated to EN/ZH and uploaded to R2`);
      } catch (transErr) {
        console.error(`[SyncDoc] Failed to translate article ${id}:`, transErr);
      }

      // Sync to Cloudflare D1 with translation fields
      try {
        await queryD1(
          `INSERT INTO articles (id, title, title_en, title_zh, excerpt, excerpt_en, excerpt_zh, category, r2_path, created_at, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title=excluded.title, title_en=excluded.title_en, title_zh=excluded.title_zh,
             excerpt=excluded.excerpt, excerpt_en=excluded.excerpt_en, excerpt_zh=excluded.excerpt_zh,
             category=excluded.category, r2_path=excluded.r2_path, created_at=excluded.created_at, tags=excluded.tags`,
          [
            id,
            data.title || "",
            enTitle,
            zhTitle,
            data.excerpt || "",
            enExcerpt,
            zhExcerpt,
            data.category || "",
            `articles/${id}.json`,
            data.createdAt || new Date().toISOString(),
            data.tags ? (typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags)) : ""
          ]
        );
      } catch (d1Err) {
        console.error("[SyncDoc API] Failed to sync article to D1:", d1Err);
      }

      // Update main indexes from D1
      try {
        const d1Articles = await queryD1<any>("SELECT * FROM articles");
        if (d1Articles) {
          const articleSummary = d1Articles.map((d: any) => ({
            id: d.id,
            slug: d.id,
            title: d.title,
            title_en: d.title_en || "",
            title_zh: d.title_zh || "",
            category: d.category,
            category_en: translateCategory(d.category, "en"),
            category_zh: translateCategory(d.category, "zh"),
            excerpt: d.excerpt,
            excerpt_en: d.excerpt_en || "",
            excerpt_zh: d.excerpt_zh || "",
            imageUrl: d.image_url,
            bannerUrl: d.image_url,
            authorName: "",
            createdAt: d.created_at,
          }));
          await uploadToR2Path("articles/index.json", JSON.stringify(articleSummary));
          await uploadToR2Path("backup/blog_posts.json", JSON.stringify(d1Articles));
        }
      } catch (rebuildErr) {
        console.error("[SyncDoc API] Failed to rebuild articles index:", rebuildErr);
      }

    } else if (collection === "daily_devotions") {
      await uploadToR2Path(`devotions/${id}.json`, JSON.stringify({ id, ...data }));

      // On-the-fly translate devotion and save to R2 / D1
      try {
        const enTexts = await translateTexts([data.title || "", data.body || "", data.prayer || "", data.reflection || "", data.verseRef || "", data.verseText || ""], "en");
        const enDevotion = {
          ...data, id,
          title: enTexts[0],
          body: enTexts[1],
          prayer: enTexts[2],
          reflection: enTexts[3],
          verseRef: enTexts[4],
          verseText: enTexts[5],
        };
        await uploadToR2Path(`devotions/${id}_en.json`, JSON.stringify(enDevotion));

        const zhTexts = await translateTexts([data.title || "", data.body || "", data.prayer || "", data.reflection || "", data.verseRef || "", data.verseText || ""], "zh");
        const zhDevotion = {
          ...data, id,
          title: zhTexts[0],
          body: zhTexts[1],
          prayer: zhTexts[2],
          reflection: zhTexts[3],
          verseRef: zhTexts[4],
          verseText: zhTexts[5],
        };
        await uploadToR2Path(`devotions/${id}_zh.json`, JSON.stringify(zhDevotion));

        // Save translations in D1 devotion_translations table
        await queryD1(
          "INSERT INTO devotion_translations (devotion_id, language_code, title, excerpt) VALUES (?, ?, ?, ?) ON CONFLICT(devotion_id, language_code) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt",
          [id, "id", data.title, (data.body || "").substring(0, 150)]
        );
        await queryD1(
          "INSERT INTO devotion_translations (devotion_id, language_code, title, excerpt) VALUES (?, ?, ?, ?) ON CONFLICT(devotion_id, language_code) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt",
          [id, "en", enDevotion.title, (enDevotion.body || "").substring(0, 150)]
        );
        await queryD1(
          "INSERT INTO devotion_translations (devotion_id, language_code, title, excerpt) VALUES (?, ?, ?, ?) ON CONFLICT(devotion_id, language_code) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt",
          [id, "zh", zhDevotion.title, (zhDevotion.body || "").substring(0, 150)]
        );
      } catch (transErr) {
        console.error(`[SyncDoc API Devotion i18n] Failed for ${id}:`, transErr);
      }

      // Rebuild backup/renungan.json index
      let devotionDocs: any[] = [];
      try {
        const snap = await db.collection("daily_devotions").get();
        devotionDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.warn("[SyncDoc API] Firestore read failed during devotion upsert index rebuild, trying R2 reconstruction:", e);
        try {
          const currentIndexStr = await downloadFromR2("renungan.json");
          const currentIndex = JSON.parse(currentIndexStr);
          if (Array.isArray(currentIndex)) {
            let updatedIndex = currentIndex.filter((item: any) => item.id !== id);
            updatedIndex.push({ id, ...data });
            devotionDocs = updatedIndex;
          }
        } catch (r2Err) {
          console.error("[SyncDoc API] R2 index rebuild failed:", r2Err);
        }
      }

      if (devotionDocs.length > 0) {
        await uploadToR2Path("backup/renungan.json", JSON.stringify(devotionDocs));
      }

      // Rebuild latest.json
      let latestDevotion: any = null;
      try {
        const snap = await db.collection("daily_devotions").get();
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        for (const devotion of docs) {
          if (!latestDevotion || devotion.id > latestDevotion.id) {
            latestDevotion = devotion;
          }
        }
      } catch (e) {
        console.warn("[SyncDoc API] Firestore devotions read failed, falling back to R2 latest calculation:", e);
        try {
          const currentLatestStr = await downloadFromR2("devotions/latest.json");
          const currentLatest = JSON.parse(currentLatestStr);
          latestDevotion = currentLatest;
          if (!latestDevotion || id > latestDevotion.id) {
            latestDevotion = { id, ...data };
          }
        } catch (r2Err) {
          console.error("[SyncDoc API] R2 latest devotion check failed:", r2Err);
        }
      }

      if (latestDevotion) {
        await uploadToR2Path("devotions/latest.json", JSON.stringify(latestDevotion));
      }

    } else if (collection === "songs") {
      // Rebuild songs index
      let docs: any[] = [];
      try {
        const snap = await db.collection("songs").get();
        docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.warn("[SyncDoc API] Firestore songs read failed, falling back to R2 index reconstruction:", e);
        try {
          const currentIndexStr = await downloadFromR2("songs/songs-index.json");
          const currentIndex = JSON.parse(currentIndexStr);
          if (Array.isArray(currentIndex)) {
            let updatedIndex = currentIndex.filter((item: any) => item.id !== id);
            updatedIndex.push({ id, ...data });
            docs = updatedIndex;
          }
        } catch (r2Err) {
          console.error("[SyncDoc API] R2 songs index rebuild failed:", r2Err);
        }
      }
      await uploadToR2Path("songs/songs-index.json", JSON.stringify(docs));
    } else if (collection === "settings") {
      if (id === "ads_config") {
        try {
          await uploadToR2Path("ads_config.json", JSON.stringify({ id, ...data }));
          console.log("[SyncDoc API] Saved ads_config.json to R2 root.");
        } catch (adsErr) {
          console.error("[SyncDoc API] Failed to write ads_config.json to R2:", adsErr);
        }
      }

      let docs: any[] = [];
      try {
        const snap = await db.collection("settings").get();
        docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.warn("[SyncDoc API] Firestore settings read failed, falling back to R2 index reconstruction:", e);
        try {
          const currentIndexStr = await downloadFromR2("settings.json");
          const currentIndex = JSON.parse(currentIndexStr);
          if (Array.isArray(currentIndex)) {
            let updatedIndex = currentIndex.filter((item: any) => item.id !== id);
            updatedIndex.push({ id, ...data });
            docs = updatedIndex;
          }
        } catch (r2Err) {
          console.error("[SyncDoc API] R2 settings index rebuild failed:", r2Err);
        }
      }
      await uploadToR2Path("backup/settings.json", JSON.stringify(docs));
      console.log(`[SyncDoc API] Synced settings collection update to R2 as backup/settings.json`);
    }

    return NextResponse.json({ success: true, message: `Synced ${collection}/${id} to R2` });
  } catch (err: any) {
    console.error("[SyncDoc API] Sync failed:", err);
    return NextResponse.json({ error: err.message || "Failed to sync document" }, { status: 500 });
  }
}
