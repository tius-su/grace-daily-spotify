import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/auth";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { queryD1 } from "@/lib/server/d1";
import zlib from "zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin Data API — reads ALL admin panel data from R2/D1 (NOT Firebase directly).
 * This ensures the admin panel works even when Firebase quota is exhausted (429).
 * Firebase is only used for writes, not reads.
 */

async function downloadJsonFromR2(key: string): Promise<any | null> {
  if (!R2_BUCKET_NAME) return null;
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key.startsWith("backup/") ? key : `backup/${key}`,
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
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

export async function GET(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "all";

  const result: Record<string, any> = {};

  try {
    // ── Blog Posts ────────────────────────────────────────────────────────
    if (tab === "all" || tab === "blog") {
      try {
        // Try D1 first (fastest, indexed)
        const d1Posts = await queryD1<any>(
          "SELECT id, title, category, image_url as imageUrl, excerpt, created_at as createdAt FROM articles ORDER BY created_at DESC LIMIT 200"
        );
        if (d1Posts && d1Posts.length > 0) {
          result.posts = d1Posts.map(p => ({ ...p, status: "published" }));
        } else {
          // Fallback to R2
          const r2Posts = await downloadJsonFromR2("blog_posts.json");
          result.posts = Array.isArray(r2Posts) ? r2Posts.slice(0, 200) : [];
        }
      } catch (e) {
        result.posts = [];
      }
    }

    // ── Daily Devotions ───────────────────────────────────────────────────
    if (tab === "all" || tab === "devotions") {
      try {
        const r2Devotions = await downloadJsonFromR2("renungan.json");
        if (Array.isArray(r2Devotions)) {
          // Sort by ID desc (format: golden-YYYY-MM-DD-HH)
          const sorted = r2Devotions.sort((a: any, b: any) =>
            String(b.id || b.dateId || "").localeCompare(String(a.id || a.dateId || ""))
          );
          result.devotions = sorted.slice(0, 50);
        } else {
          result.devotions = [];
        }
      } catch (e) {
        result.devotions = [];
      }
    }

    // ── Encyclopedia ──────────────────────────────────────────────────────
    if (tab === "all" || tab === "encyclopedia") {
      try {
        const d1Ensi = await queryD1<any>(
          "SELECT id, slug, keyword, title, kategori, banner_url as bannerUrl FROM encyclopedia ORDER BY updated_at DESC LIMIT 1000"
        );
        if (d1Ensi && d1Ensi.length > 0) {
          result.encyclopedia = d1Ensi;
        } else {
          // Fallback: read from R2 backup per category
          const categories = ["tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi"];
          const allEnsi: any[] = [];
          await Promise.allSettled(
            categories.map(async (cat) => {
              const data = await downloadJsonFromR2(`${cat}.json`);
              if (Array.isArray(data)) allEnsi.push(...data);
            })
          );
          result.encyclopedia = allEnsi;
        }
      } catch (e) {
        result.encyclopedia = [];
      }
    }

    // ── Settings (google_codes, ads, bulletin, blog_categories) ──────────
    if (tab === "all" || tab === "settings") {
      try {
        const r2Settings = await downloadJsonFromR2("settings.json");
        if (Array.isArray(r2Settings)) {
          const settingsMap: Record<string, any> = {};
          for (const s of r2Settings) {
            settingsMap[s.id] = s;
          }
          result.settings = settingsMap;
        } else {
          result.settings = {};
        }
      } catch (e) {
        result.settings = {};
      }
    }

    // ── Plans ─────────────────────────────────────────────────────────────
    if (tab === "all" || tab === "plans") {
      try {
        const r2Plans = await downloadJsonFromR2("plans.json");
        result.plans = Array.isArray(r2Plans) ? r2Plans : [];
      } catch (e) {
        result.plans = [];
      }
    }

    // ── Songs ─────────────────────────────────────────────────────────────
    if (tab === "all" || tab === "songs") {
      try {
        const r2Songs = await downloadJsonFromR2("songs.json");
        result.songs = Array.isArray(r2Songs) ? r2Songs.slice(0, 50) : [];
      } catch (e) {
        result.songs = [];
      }
    }

    // ── D1 Counts (for admin stats) ───────────────────────────────────────
    if (tab === "all" || tab === "stats") {
      try {
        const artCount = await queryD1<{ count: number }>("SELECT COUNT(*) as count FROM articles");
        const ensiCount = await queryD1<{ count: number }>("SELECT COUNT(*) as count FROM encyclopedia");
        result.d1Stats = {
          articles: artCount?.[0]?.count ?? 0,
          encyclopedia: ensiCount?.[0]?.count ?? 0,
        };
      } catch (e) {
        result.d1Stats = { articles: 0, encyclopedia: 0 };
      }
    }

    result.source = "R2+D1";
    result.timestamp = new Date().toISOString();

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Admin Data API] Failed:", err);
    return NextResponse.json({ error: err.message || "Failed to load admin data" }, { status: 500 });
  }
}
