/**
 * Grace Daily — Podcast RSS Feed Proxy (English)
 * GET /api/podcast-en.xml → English podcast feed
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
    const feedUrl = `${R2_PUBLIC_URL}/podcasts/podcast-en.xml`;
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
      console.warn("[api/podcast-en.xml] Public HTTP fetch failed, falling back to S3 SDK...", fetchErr);
    }

    if (!xml) {
      const { s3Client, R2_BUCKET_NAME } = await import("@/lib/server/r2");
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      if (s3Client && R2_BUCKET_NAME) {
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: "podcasts/podcast-en.xml",
        });
        const res = await s3Client.send(command);
        xml = (await res.Body?.transformToString()) || "";
      }
    }

    if (!xml) {
      return new Response(
        "English podcast feed not yet generated. Please try again after 06:00 WIB.",
        { status: 404, headers: { "Content-Type": "text/plain" } }
      );
    }

    xml = xml.replace(
      /<atom:link[^>]*>/g,
      `<atom:link href="${APP_URL}/api/podcast-en.xml" rel="self" type="application/rss+xml"/>`
    );

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=UTF-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Content-Language": "en-us",
        "X-Podcast-Feed": "Grace Daily (English)",
      },
    });
  } catch (err) {
    console.error("[api/podcast-en.xml] Error:", err);
    return new Response("Failed to fetch English podcast feed.", { status: 500 });
  }
}
