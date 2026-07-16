import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/auth";
import { queryD1 } from "@/lib/server/d1";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import zlib from "zlib";
import { populateD1Articles, populateD1Encyclopedia } from "@/lib/server/backup-r2-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes - may need to process many entries

/**
 * Admin API: Sync D1 database from R2 backup files.
 * This allows re-populating D1 without reading from Firestore,
 * which is important when Firestore is rate-limited (429).
 */

async function downloadFromR2(key: string): Promise<any[] | null> {
  if (!R2_BUCKET_NAME) return null;
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    const response = await s3Client.send(command);
    const body = response.Body;
    if (!body) return null;

    const buffer = Buffer.from(await body.transformToByteArray());
    let content: string;
    if (response.ContentEncoding === "gzip") {
      content = zlib.gunzipSync(buffer).toString("utf8");
    } else {
      content = buffer.toString("utf8");
    }

    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.warn(`[Sync D1] Failed to download ${key} from R2:`, err);
    return null;
  }
}

export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {
    articles: { status: "pending", count: 0 },
    encyclopedia: { status: "pending", count: 0 },
  };

  try {
    const body = await request.json().catch(() => ({}));
    const target = body.target || "all"; // "articles", "encyclopedia", or "all"

    // ── 1. Sync Articles from R2 ──────────────────────────────────────────
    if (target === "all" || target === "articles") {
      try {
        console.log("[Sync D1] Downloading blog_posts.json from R2...");
        const articles = await downloadFromR2("backup/blog_posts.json");
        if (articles && articles.length > 0) {
          console.log(`[Sync D1] Found ${articles.length} articles in R2, syncing to D1...`);
          const success = await populateD1Articles(articles);
          results.articles = { 
            status: success ? "success" : "partial",
            count: articles.length 
          };
        } else {
          results.articles = { status: "empty", count: 0, note: "No articles found in R2 backup" };
        }
      } catch (err: any) {
        console.error("[Sync D1] Articles sync failed:", err);
        results.articles = { status: "failed", error: err.message };
      }
    }

    // ── 2. Sync Encyclopedia from R2 ──────────────────────────────────────
    if (target === "all" || target === "encyclopedia") {
      try {
        const categories = [
          "tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi",
          "silsilah", "teologi", "teologi-2", "topikal_alkitab", "peristiwa", "peristiwa-2",
        ];

        let allEnsiDocs: any[] = [];
        for (const cat of categories) {
          const docs = await downloadFromR2(`backup/${cat}.json`);
          if (docs) {
            allEnsiDocs.push(...docs);
          }
        }

        if (allEnsiDocs.length > 0) {
          console.log(`[Sync D1] Found ${allEnsiDocs.length} encyclopedia entries in R2, syncing to D1...`);
          const success = await populateD1Encyclopedia(allEnsiDocs);
          results.encyclopedia = { 
            status: success ? "success" : "partial",
            count: allEnsiDocs.length 
          };
        } else {
          results.encyclopedia = { status: "empty", count: 0, note: "No encyclopedia entries found in R2 backup" };
        }
      } catch (err: any) {
        console.error("[Sync D1] Encyclopedia sync failed:", err);
        results.encyclopedia = { status: "failed", error: err.message };
      }
    }

    // ── 3. Verify D1 counts ───────────────────────────────────────────────
    let d1ArticleCount = 0;
    let d1EnsiCount = 0;
    try {
      const artCountResult = await queryD1<{ count: number }>("SELECT COUNT(*) as count FROM articles");
      d1ArticleCount = artCountResult?.[0]?.count ?? 0;
      const ensiCountResult = await queryD1<{ count: number }>("SELECT COUNT(*) as count FROM encyclopedia");
      d1EnsiCount = ensiCountResult?.[0]?.count ?? 0;
    } catch (e) {
      console.warn("[Sync D1] Failed to get D1 verification counts:", e);
    }

    return NextResponse.json({
      success: true,
      results,
      d1Verification: {
        articles: d1ArticleCount,
        encyclopedia: d1EnsiCount,
      },
      message: `Sync selesai. D1 sekarang berisi ${d1ArticleCount} artikel dan ${d1EnsiCount} entri ensiklopedia.`,
    });
  } catch (err: any) {
    console.error("[Sync D1] Critical failure:", err);
    return NextResponse.json(
      { error: err.message || "Sync D1 gagal" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return current D1 counts
  try {
    const artCountResult = await queryD1<{ count: number }>("SELECT COUNT(*) as count FROM articles");
    const ensiCountResult = await queryD1<{ count: number }>("SELECT COUNT(*) as count FROM encyclopedia");
    
    return NextResponse.json({
      d1Articles: artCountResult?.[0]?.count ?? 0,
      d1Encyclopedia: ensiCountResult?.[0]?.count ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
