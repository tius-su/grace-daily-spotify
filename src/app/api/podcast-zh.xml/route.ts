/**
 * Grace Daily — Podcast RSS Feed Proxy (Mandarin Chinese)
 * GET /api/podcast-zh.xml → 中文 podcast feed
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
    const feedUrl = `${R2_PUBLIC_URL}/podcasts/podcast-zh.xml`;
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
      console.warn("[api/podcast-zh.xml] Public HTTP fetch failed, falling back to S3 SDK...", fetchErr);
    }

    if (!xml) {
      // Fallback via S3 Client (bypasses R2 public domain / ISP blocking)
      const { s3Client, R2_BUCKET_NAME } = await import("@/lib/server/r2");
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      if (s3Client && R2_BUCKET_NAME) {
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: "podcasts/podcast-zh.xml",
        });
        const res = await s3Client.send(command);
        xml = (await res.Body?.transformToString()) || "";
      }
    }

    if (!xml) {
      return new Response("中文播客尚未生成。请在凌晨6点后重试。", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=UTF-8" },
      });
    }

    xml = xml.replace(
      /<atom:link[^>]*>/g,
      `<atom:link href="${APP_URL}/api/podcast-zh.xml" rel="self" type="application/rss+xml"/>`
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
        "Content-Language": "zh-cn",
        "X-Podcast-Feed": "Grace Daily (中文)",
      },
    });
  } catch (err) {
    console.error("[api/podcast-zh.xml] Error:", err);
    return new Response("Failed to fetch Mandarin podcast feed.", { status: 500 });
  }
}
