/**
 * Grace Daily — Dynamic RSS 2.0 Feed
 *
 * Endpoint: GET /api/rss.xml
 *
 * Returns a valid RSS 2.0 feed containing:
 *  - Latest 30 daily devotions
 *  - Latest 30 blog articles
 *
 * Ready for use in make.com, Zapier, Feedly, and RSS readers.
 * Feed updates automatically — no manual refresh needed.
 * Cache: 1 hour CDN / 30 min browser
 */

import { getAdminDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";
const SITE_TITLE = "Grace Daily";
const SITE_DESCRIPTION =
  "Renungan harian Kristen, artikel rohani, ensiklopedia Alkitab, dan komunitas doa. Diperbarui setiap hari oleh Grace Daily.";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Escape XML special characters
 */
function xmlEscape(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Strip HTML tags and collapse whitespace
 */
function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format a Date or Firestore Timestamp to RFC-822 (RSS date format)
 * Diubah agar output selalu menggunakan Waktu Indonesia Barat (WIB / GMT+0700)
 */
function toRssDate(value: any): string {
  if (!value) return new Date().toUTCString();
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    
    // Paksa konversi internal ke zona waktu Asia/Jakarta
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    
    const parts = formatter.formatToParts(date);
    const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
    
    // Susun kembali menjadi format RFC-822 standar RSS yang valid dengan offset +0700 (WIB)
    return `${p.weekday}, ${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}:${p.second} +0700`;
  } catch {
    return new Date().toUTCString();
  }
}

/**
 * Build a single <item> block
 */
function buildItem({
  title,
  link,
  description,
  pubDate,
  guid,
  category,
  imageUrl,
}: {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  category?: string;
  imageUrl?: string;
}): string {
  let enclosure = "";
  let mediaTags = "";

  if (imageUrl && imageUrl.startsWith("http")) {
    let type = "image/jpeg";
    if (imageUrl.includes(".webp")) {
      type = "image/webp";
    } else if (imageUrl.includes(".png")) {
      type = "image/png";
    }

    enclosure = `\n    <enclosure url="${xmlEscape(imageUrl)}" type="${type}" length="0" />`;
    mediaTags = `\n    <media:content url="${xmlEscape(imageUrl)}" medium="image" type="${type}" />\n    <media:thumbnail url="${xmlEscape(imageUrl)}" />`;
  }

  const categoryTag = category
    ? `\n    <category>${xmlEscape(category)}</category>`
    : "";

  return `
  <item>
    <title>${xmlEscape(title)}</title>
    <link>${xmlEscape(link)}</link>
    <description><![CDATA[${description}]]></description>
    <pubDate>${pubDate}</pubDate>
    <guid isPermaLink="true">${xmlEscape(link)}</guid>${categoryTag}${enclosure}${mediaTags}
  </item>`;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchDevotions(db: FirebaseFirestore.Firestore) {
  try {
    const snap = await db
      .collection("daily_devotions")
      .orderBy("dateId", "desc")
      .limit(50)
      .get();

    const devotions = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort descending by dateId / id in-memory
    const sorted = devotions
      .filter((d: any) => d.status === "published" && d.title)
      .sort((a: any, b: any) => {
        const idA = a.dateId || a.id || "";
        const idB = b.dateId || b.id || "";
        return idB.localeCompare(idA);
      })
      .slice(0, 30);

    return sorted.map((d: any) => {
      const excerpt = d.body
        ? stripHtml(d.body).substring(0, 300) + "..."
        : d.excerpt || "";

      // Build absolute image URL if available
      let imageUrl: string | undefined;
      if (d.bannerUrl || d.imageUrl) {
        const raw: string = d.bannerUrl || d.imageUrl;
        imageUrl = raw.startsWith("http") ? raw : `${APP_URL}${raw}`;
      }

      return {
        title: `🌅 Renungan: ${d.title || "Renungan Harian"}`,
        link: `${APP_URL}/renungan/${d.id}`,
        description: excerpt,
        pubDate: toRssDate(d.generatedAt || d.createdAt || d.date),
        guid: `${APP_URL}/renungan/${d.id}`,
        category: "Renungan Harian",
        imageUrl,
      };
    });
  } catch (err) {
    console.error("[rss.xml] Failed to fetch devotions:", err);
    return [];
  }
}

async function fetchArticles(db: FirebaseFirestore.Firestore) {
  try {
    const snap = await db
      .collection("blog_posts")
      .where("status", "==", "published")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      const excerpt = d.excerpt
        ? stripHtml(d.excerpt).substring(0, 300)
        : d.body
        ? stripHtml(d.body).substring(0, 300) + "..."
        : "";

      // Build absolute image URL if available
      let imageUrl: string | undefined;
      if (d.imageUrl) {
        const raw: string = d.imageUrl;
        imageUrl = raw.startsWith("http") ? raw : `${APP_URL}${raw}`;
      }

      return {
        title: `✍️ Artikel: ${d.title || "Artikel Baru"}`,
        link: `${APP_URL}/blog/${doc.id}`,
        description: excerpt,
        pubDate: toRssDate(d.createdAt),
        guid: `${APP_URL}/blog/${doc.id}`,
        category: d.category || "Artikel",
        imageUrl,
      };
    });
  } catch (err) {
    console.error("[rss.xml] Failed to fetch articles:", err);
    return [];
  }
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET() {
  const db = getAdminDb();

  // Fetch devotions and articles in parallel
  const [devotions, articles] = db
    ? await Promise.all([fetchDevotions(db), fetchArticles(db)])
    : [[], []];

  // ============================================================================
  // PERBAIKAN: Berikan pengaman Number.isNaN agar sort tidak rusak menjadi NaN
  // ============================================================================
  const allItems = [...devotions, ...articles].sort((a, b) => {
    const parseA = new Date(a.pubDate).getTime();
    const parseB = new Date(b.pubDate).getTime();
    
    const ta = Number.isNaN(parseA) ? 0 : parseA;
    const tb = Number.isNaN(parseB) ? 0 : parseB;
    
    return tb - ta; // Menjamin artikel terbaru selalu berada di paling atas (index 0)
  });

  const itemsXml = allItems.map(buildItem).join("");
  const lastBuildDate =
    allItems.length > 0 ? allItems[0].pubDate : new Date().toUTCString();

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xmlEscape(SITE_TITLE)}</title>
    <link>${xmlEscape(APP_URL)}</link>
    <description>${xmlEscape(SITE_DESCRIPTION)}</description>
    <language>id</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>60</ttl>
    <image>
      <url>${xmlEscape(APP_URL)}/logo.png</url>
      <title>${xmlEscape(SITE_TITLE)}</title>
      <link>${xmlEscape(APP_URL)}</link>
    </image>
    <atom:link href="${xmlEscape(APP_URL)}/api/rss.xml" rel="self" type="application/rss+xml" />
    <copyright>© ${new Date().getFullYear()} Grace Daily. All rights reserved.</copyright>
    <managingEditor>renungan@gracedaily.my.id (Grace Daily)</managingEditor>
    <category>Christianity</category>
    <category>Devotional</category>
    <category>Bible</category>${itemsXml}
  </channel>
</rss>`;

  return new Response(rssXml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Cache for 1 minute at CDN, 1 minute in browser
      "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=60",
      // CORS open so make.com and any RSS reader can fetch
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}
