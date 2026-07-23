/**
 * Grace Daily — Podcast RSS Feed Proxy (Spanish)
 * GET /api/podcast-es.xml → Podcast en Español
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
    const feedUrl = `${R2_PUBLIC_URL}/podcasts/podcast-es.xml`;
    const r2Response = await fetch(feedUrl, {
      headers: { "Cache-Control": "no-cache" },
      cache: "no-store",
    });

    if (!r2Response.ok) {
      return new Response(
        "El feed de podcast en español aún no se ha generado. Por favor, intente después de las 6:00 WIB.",
        { status: 404, headers: { "Content-Type": "text/plain; charset=UTF-8" } }
      );
    }

    let xml = await r2Response.text();
    xml = xml.replace(
      /<atom:link[^>]*>/g,
      `<atom:link href="${APP_URL}/api/podcast-es.xml" rel="self" type="application/rss+xml"/>`
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
        "Content-Language": "es-es",
        "X-Podcast-Feed": "Grace Daily (Español)",
      },
    });
  } catch (err) {
    console.error("[api/podcast-es.xml] Error:", err);
    return new Response("Failed to fetch Spanish podcast feed.", { status: 500 });
  }
}
