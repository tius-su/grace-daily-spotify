import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");

  if (!file) {
    return NextResponse.json({ error: "File parameter is required" }, { status: 400 });
  }

  // Sanitize path to prevent directory traversal
  const safeFile = file.replace(/[^a-zA-Z0-9_\-\.\/]/g, "");

  const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev";
  const targetUrl = `${R2_PUBLIC_URL}/${safeFile}`;

  let res;
  try {
    res = await fetch(targetUrl, {
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });
  } catch (fetchErr: any) {
    console.warn(`[api/backup] Network fetch failed for ${targetUrl}: ${fetchErr.message}. Attempting database fallback...`);
    const fallbackData = await getDatabaseFallback(safeFile);
    if (fallbackData) {
      return NextResponse.json(fallbackData);
    }
    return NextResponse.json({ error: `Network fetch failed: ${fetchErr.message}` }, { status: 502 });
  }

  if (!res.ok) {
    console.warn(`[api/backup] Failed to fetch R2 file: ${targetUrl}, status: ${res.status}. Attempting database fallback...`);
    const fallbackData = await getDatabaseFallback(safeFile);
    if (fallbackData) {
      return NextResponse.json(fallbackData);
    }
    return NextResponse.json({ error: `Failed to fetch from R2: ${res.statusText}` }, { status: res.status });
  }

  try {
    const data = await res.json();
    return NextResponse.json(data);
  } catch (parseErr: any) {
    console.warn(`[api/backup] Failed to parse R2 response as JSON: ${parseErr.message}. Attempting database fallback...`);
    const fallbackData = await getDatabaseFallback(safeFile);
    if (fallbackData) {
      return NextResponse.json(fallbackData);
    }
    return NextResponse.json({ error: "Failed to parse R2 response as JSON" }, { status: 500 });
  }
}

async function getDatabaseFallback(safeFile: string): Promise<any[] | null> {
  try {
    const { queryD1 } = await import("@/lib/server/d1");
    const { getAdminDb } = await import("@/lib/server/firebase-admin");

    // 1. Articles fallback (articles/index.json or backup/blog_posts.json)
    if (safeFile === "articles/index.json" || safeFile === "backup/blog_posts.json") {
      // Try D1 first
      try {
        const d1Result = await queryD1<any>(
          "SELECT id, title, category, excerpt, excerpt_en, excerpt_zh, image_url as imageUrl, created_at as createdAt, title_en, title_zh FROM articles ORDER BY created_at DESC"
        );
        if (d1Result && d1Result.length > 0) {
          console.log(`[api/backup fallback] Loaded ${d1Result.length} articles from D1.`);
          return d1Result.map(a => ({
            ...a,
            slug: a.id,
            bannerUrl: a.imageUrl || null,
            authorName: "Grace Daily"
          }));
        }
      } catch (d1Err) {
        console.error("[api/backup fallback] D1 articles query failed:", d1Err);
      }

      // Try Firestore fallback
      try {
        const db = getAdminDb();
        if (db) {
          const snap = await db.collection("blog_posts").orderBy("createdAt", "desc").get();
          if (snap.size > 0) {
            console.log(`[api/backup fallback] Loaded ${snap.size} articles from Firestore.`);
            return snap.docs.map(doc => {
              const d = doc.data();
              let createdAtStr = new Date().toISOString();
              if (d.createdAt) {
                if (typeof d.createdAt.toDate === "function") createdAtStr = d.createdAt.toDate().toISOString();
                else if (typeof d.createdAt._seconds === "number") createdAtStr = new Date(d.createdAt._seconds * 1000).toISOString();
                else if (typeof d.createdAt.seconds === "number") createdAtStr = new Date(d.createdAt.seconds * 1000).toISOString();
              }
              return {
                id: doc.id,
                slug: d.slug || doc.id,
                title: d.title || "",
                title_en: d.title_en || "",
                title_zh: d.title_zh || "",
                category: d.category || "Umum",
                category_en: d.category_en || "",
                category_zh: d.category_zh || "",
                excerpt: d.excerpt || "",
                excerpt_en: d.excerpt_en || "",
                excerpt_zh: d.excerpt_zh || "",
                imageUrl: d.imageUrl || "",
                bannerUrl: d.bannerUrl || d.imageUrl || null,
                authorName: d.authorName || "Grace Daily",
                createdAt: createdAtStr
              };
            });
          }
        }
      } catch (fsErr) {
        console.error("[api/backup fallback] Firestore articles fallback failed:", fsErr);
      }
    }

    // 2. Encyclopedia category fallback (backup/tokoh.json, backup/istilah.json, etc.)
    const ensiMatch = safeFile.match(/^backup\/(.*)\.json$/);
    if (ensiMatch) {
      const rawCat = ensiMatch[1];
      const cat = rawCat === "istilah" ? "kamus" : rawCat;
      
      // Try D1 first
      try {
        let d1Result: any[] | null = null;
        if (rawCat === "istilah") {
          d1Result = await queryD1<any>(
            "SELECT id, slug, keyword, title, kategori, updated_at as updatedAt, banner_url as bannerUrl, title_en, title_zh FROM encyclopedia WHERE kategori IN ('istilah', 'kamus') ORDER BY updated_at DESC"
          );
        } else {
          d1Result = await queryD1<any>(
            "SELECT id, slug, keyword, title, kategori, updated_at as updatedAt, banner_url as bannerUrl, title_en, title_zh FROM encyclopedia WHERE kategori = ? ORDER BY updated_at DESC",
            [cat]
          );
        }
        
        if (d1Result && d1Result.length > 0) {
          console.log(`[api/backup fallback] Loaded ${d1Result.length} entries for category ${cat} from D1.`);
          return d1Result.map(e => ({
            id: e.id,
            slug: e.slug || "",
            keyword: e.keyword || "",
            title: e.title || "",
            kategori: e.kategori || "",
            updatedAt: e.updatedAt || new Date().toISOString(),
            bannerUrl: e.bannerUrl || "",
            title_en: e.title_en || "",
            title_zh: e.title_zh || "",
            illustrationUrl: "",
            status: "published"
          }));
        }
      } catch (d1Err) {
        console.error(`[api/backup fallback] D1 encyclopedia query failed for ${cat}:`, d1Err);
      }

      // Try Firestore fallback
      try {
        const db = getAdminDb();
        if (db) {
          let query = db.collection("ensiklopedia_cache");
          if (rawCat === "istilah") {
            query = query.where("kategori", "in", ["istilah", "kamus"]) as any;
          } else {
            query = query.where("kategori", "==", cat) as any;
          }
          const snap = await query.get();
          if (snap.size > 0) {
            console.log(`[api/backup fallback] Loaded ${snap.size} entries for category ${cat} from Firestore.`);
            return snap.docs.map(doc => {
              const d = doc.data();
              let updatedAtStr = new Date().toISOString();
              if (d.updatedAt) {
                if (typeof d.updatedAt.toDate === "function") updatedAtStr = d.updatedAt.toDate().toISOString();
                else if (typeof d.updatedAt._seconds === "number") updatedAtStr = new Date(d.updatedAt._seconds * 1000).toISOString();
                else if (typeof d.updatedAt.seconds === "number") updatedAtStr = new Date(d.updatedAt.seconds * 1000).toISOString();
              }
              return {
                id: doc.id,
                slug: d.slug || "",
                keyword: d.keyword || "",
                title: d.title || "",
                kategori: d.kategori || "",
                updatedAt: updatedAtStr,
                bannerUrl: d.bannerUrl || d.imageUrl || "",
                title_en: d.title_en || "",
                title_zh: d.title_zh || "",
                illustrationUrl: d.illustrationUrl || "",
                status: d.status || "published"
              };
            });
          }
        }
      } catch (fsErr) {
        console.error(`[api/backup fallback] Firestore encyclopedia fallback failed for ${cat}:`, fsErr);
      }
    }

    // 3. Devotions fallback (backup/renungan.json)
    if (safeFile === "backup/renungan.json") {
      try {
        const db = getAdminDb();
        if (db) {
          const snap = await db.collection("daily_devotions").orderBy("dateId", "desc").limit(100).get();
          if (snap.size > 0) {
            console.log(`[api/backup fallback] Loaded ${snap.size} devotions from Firestore.`);
            return snap.docs.map(doc => {
              const d = doc.data();
              return {
                id: doc.id,
                ...d
              };
            });
          }
        }
      } catch (fsErr) {
        console.error("[api/backup fallback] Firestore devotions fallback failed:", fsErr);
      }
    }
  } catch (globalFallbackErr) {
    console.error("[api/backup fallback] Global fallback logic failed:", globalFallbackErr);
  }
  return null;
}
