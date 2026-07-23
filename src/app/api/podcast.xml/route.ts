/**
 * Grace Daily — Podcast RSS Feed Proxy (Indonesian / Default)
 *
 * Endpoints:
 *   GET /api/podcast.xml          → Bahasa Indonesia feed (legacy compatible)
 *   GET /podcast.xml              → Redirected here via vercel.json rewrite
 *
 * Why this proxy exists:
 *   Apple Podcast and Spotify require the feed URL to be from a recognized domain.
 *   Cloudflare R2's pub-*.r2.dev URLs are often blocked by Apple's validator.
 *   Serving through gracedaily.my.id resolves this issue.
 *
 * Features:
 *   - Proxies podcast-id.xml from Cloudflare R2
 *   - Sets correct Content-Type: application/rss+xml
 *   - Sets CORS headers for podcast aggregators
 *   - No caching — always returns latest feed
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const R2_PUBLIC_URL = (
  process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ""
).replace(/\/$/, "");

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

export async function GET() {
  if (!R2_PUBLIC_URL) {
    return new Response("Podcast feed URL not configured.", { status: 503 });
  }

  try {
    const feedUrl = `${R2_PUBLIC_URL}/podcasts/podcast-id.xml`;
    let xml = "";

    try {
      const r2Response = await fetch(feedUrl, {
        headers: { "Cache-Control": "no-cache" },
        cache: "no-store",
      });
      if (r2Response.ok) {
        xml = await r2Response.text();
      }
    } catch (fetchErr) {
      console.warn("[api/podcast.xml] Public HTTP fetch failed, falling back to S3 SDK...", fetchErr);
    }

    if (!xml) {
      const { s3Client, R2_BUCKET_NAME } = await import("@/lib/server/r2");
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      if (s3Client && R2_BUCKET_NAME) {
        try {
          const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: "podcasts/podcast-id.xml",
          });
          const res = await s3Client.send(command);
          xml = (await res.Body?.transformToString()) || "";
        } catch {
          // Try legacy podcast.xml as fallback
          const legacyCommand = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: "podcasts/podcast.xml",
          });
          const res = await s3Client.send(legacyCommand);
          xml = (await res.Body?.transformToString()) || "";
        }
      }
    }

    if (!xml) {
      return new Response("Podcast feed not yet generated. Please try again later.", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    xml = xml.replace(
      /<atom:link[^>]*>/g,
      `<atom:link href="${APP_URL}/api/podcast.xml" rel="self" type="application/rss+xml"/>`
    );

    return new Response(xml, {
      status: 200,
      headers: podcastHeaders("id-id"),
    });
  } catch (err) {
    console.error("[api/podcast.xml] Error:", err);
    return new Response("Failed to fetch podcast feed.", { status: 500 });
  }
}

function podcastHeaders(lang: string): Record<string, string> {
  return {
    "Content-Type": "application/rss+xml; charset=UTF-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Content-Language": lang,
    "X-Podcast-Feed": "Grace Daily",
  };
}
