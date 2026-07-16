import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================================
// TYPES
// ============================================================================

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

async function sendReply(chatId: number, text: string, replyMarkup?: object): Promise<void> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) return;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "" }),
  });
}

/**
 * Load FAQ from R2 bucket
 */
async function loadFaq(): Promise<Array<{ q: string; a: string; keywords: string[] }>> {
  const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
  if (!R2_PUBLIC_URL) return getDefaultFaq();

  try {
    const res = await fetch(`${R2_PUBLIC_URL}/faq.json`, { cache: "no-store" });
    if (!res.ok) {
      await uploadDefaultFaq();
      return getDefaultFaq();
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    return getDefaultFaq();
  } catch {
    return getDefaultFaq();
  }
}

function getDefaultFaq(): Array<{ q: string; a: string; keywords: string[] }> {
  return [
    {
      q: "Apa itu Grace Daily?",
      a: "Grace Daily adalah aplikasi renungan harian Kristen dengan AI. Tersedia renungan, ensiklopedia Alkitab, blog rohani, dan banyak fitur spiritual lainnya.",
      keywords: ["grace daily", "apa itu", "tentang", "aplikasi"],
    },
    {
      q: "Bagaimana cara berlangganan premium?",
      a: "Anda bisa berlangganan premium melalui halaman profil di website Grace Daily. Tersedia beberapa paket mulai dari Premium, Ensiklopedia Basic, hingga Ensiklopedia Pro.",
      keywords: ["premium", "berlangganan", "paket", "bayar"],
    },
    {
      q: "Apakah Grace Daily gratis?",
      a: "Ya! Grace Daily memiliki paket gratis dengan akses ke renungan harian, ayat harian, dan 10 pencarian ensiklopedia. Paket premium tersedia untuk fitur lebih lengkap.",
      keywords: ["gratis", "free", "biaya", "harga"],
    },
    {
      q: "Bagaimana cara menghubungi admin?",
      a: "Anda bisa menghubungi kami melalui:\n• Form Kontak: https://www.gracedaily.my.id/kontak\n• Email: info@gracedaily.my.id\n• Channel Telegram: @gracedailybible",
      keywords: ["kontak", "hubungi", "admin", "email", "bantuan", "help"],
    },
    {
      q: "Apa itu Ensiklopedia Alkitab?",
      a: "Ensiklopedia Alkitab Grace Daily adalah database komprehensif tentang tokoh, tempat, peristiwa, teologi, kitab, dan banyak topik Alkitab lainnya. Setiap entri ditulis oleh AI dan divalidasi secara teologis.",
      keywords: ["ensiklopedia", "alkitab", "tokoh", "tempat", "teologi"],
    },
  ];
}

async function uploadDefaultFaq(): Promise<void> {
  try {
    const { s3Client, R2_BUCKET_NAME } = await import("@/lib/server/r2");
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    if (!R2_BUCKET_NAME) return;

    const faqData = JSON.stringify(getDefaultFaq(), null, 2);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: "faq.json",
        Body: Buffer.from(faqData, "utf8"),
        ContentType: "application/json",
        CacheControl: "public, max-age=3600",
      })
    );
    console.log("[Telegram Webhook] Default FAQ uploaded to R2.");
  } catch (err) {
    console.error("[Telegram Webhook] Failed to upload default FAQ:", err);
  }
}

/**
 * In-memory cache for encyclopedia R2 index
 */
let encyclopediaR2Cache: any[] | null = null;
let encyclopediaR2CachedAt = 0;
const ENCYCLOPEDIA_CACHE_TTL = 20 * 60 * 1000; // 20 minutes

async function getEncyclopediaFromR2(): Promise<any[]> {
  const now = Date.now();
  if (encyclopediaR2Cache && now - encyclopediaR2CachedAt < ENCYCLOPEDIA_CACHE_TTL) {
    return encyclopediaR2Cache;
  }

  const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev";
  if (!R2_PUBLIC_URL) return [];

  // Try each category bulk JSON file and merge
  const categories = ["tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi", "silsilah", "teologi", "teologi-2", "topikal_alkitab", "peristiwa", "peristiwa-2"];
  const allEntries: any[] = [];

  await Promise.allSettled(
    categories.map(async (cat) => {
      try {
        const res = await fetch(`${R2_PUBLIC_URL}/backup/${cat}.json`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) allEntries.push(...data);
      } catch {}
    })
  );

  if (allEntries.length > 0) {
    encyclopediaR2Cache = allEntries;
    encyclopediaR2CachedAt = now;
  }
  return allEntries;
}

/**
 * Search encyclopedia entries from R2 (all categories) by keyword
 */
async function searchEncyclopedia(query: string): Promise<{
  keyword: string;
  kategori: string;
  slug: string;
  ringkasan: string;
} | null> {
  const normalizedQuery = query.toLowerCase().trim();

  // First try R2 (fast, no Firebase quota)
  try {
    const allEntries = await getEncyclopediaFromR2();
    if (allEntries.length > 0) {
      // Exact normalized keyword match
      let found = allEntries.find((e: any) =>
        (e.normalizedKeyword || (e.keyword || "").toLowerCase()) === normalizedQuery
      );
      // Partial keyword match
      if (!found) {
        found = allEntries.find((e: any) =>
          (e.keyword || "").toLowerCase().includes(normalizedQuery) ||
          normalizedQuery.includes((e.keyword || "").toLowerCase())
        );
      }
      if (found) {
        return {
          keyword: found.keyword,
          kategori: found.kategori,
          slug: found.slug,
          ringkasan: extractRingkasan(found.isi_artikel || ""),
        };
      }
    }
  } catch (r2Err) {
    console.warn("[Telegram] R2 encyclopedia search failed, falling back to Firebase:", r2Err);
  }

  // Fallback to Firebase if R2 has no data
  try {
    const { getAdminDb } = await import("@/lib/server/firebase-admin");
    const db = getAdminDb();
    if (!db) return null;

    const exactSnap = await db.collection("ensiklopedia_cache")
      .where("normalizedKeyword", "==", normalizedQuery)
      .limit(1)
      .get();

    if (!exactSnap.empty) {
      const doc = exactSnap.docs[0].data();
      return { keyword: doc.keyword, kategori: doc.kategori, slug: doc.slug, ringkasan: extractRingkasan(doc.isi_artikel || "") };
    }

    const partialSnap = await db.collection("ensiklopedia_cache")
      .orderBy("keyword").startAt(query).endAt(query + "\uf8ff").limit(1).get();

    if (!partialSnap.empty) {
      const doc = partialSnap.docs[0].data();
      return { keyword: doc.keyword, kategori: doc.kategori, slug: doc.slug, ringkasan: extractRingkasan(doc.isi_artikel || "") };
    }
  } catch (err) {
    console.error("[Telegram] Encyclopedia Firebase fallback failed:", err);
  }
  return null;
}

function extractRingkasan(isiArtikel: string): string {
  // Extract ## RINGKASAN section
  const match = isiArtikel.match(/##\s*RINGKASAN\s*\n([\s\S]+?)(?=\n##|$)/i);
  if (match && match[1]) {
    return match[1].trim().substring(0, 400);
  }
  // Fallback: first paragraph
  return isiArtikel.replace(/##[^\n]*/g, "").trim().substring(0, 400);
}

// ============================================================================
// BIBLE VERSE SEARCH FROM R2
// ============================================================================

interface BibleVerseEntry {
  id: string;
  reference: string;
  book: string;
  bookShort: string;
  chapter: number;
  verse: number;
  translation?: string;
  text?: string;
  keywords?: string[];
  themes?: string[];
}

// In-memory cache so we don't re-download on every message
let bibleIndexCache: BibleVerseEntry[] | null = null;
let bibleIndexCachedAt = 0;
const BIBLE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
// Cache for full bible text (only load once)
let bibleFullCache: BibleVerseEntry[] | null = null;
let bibleFullCachedAt = 0;

async function getBibleIndex(): Promise<BibleVerseEntry[]> {
  const now = Date.now();
  if (bibleIndexCache && now - bibleIndexCachedAt < BIBLE_CACHE_TTL) {
    return bibleIndexCache;
  }

  const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev";
  if (!R2_PUBLIC_URL) return [];

  try {
    const USE_WEB_BIBLE = process.env.NEXT_PUBLIC_USE_WEB_BIBLE === "true";
    const filename = USE_WEB_BIBLE ? "bible_ind_web.json" : "bible_ind_ayt.json";
    
    // First try the full bible file (has text field)
    const res = await fetch(`${R2_PUBLIC_URL}/backup/${filename}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        bibleIndexCache = data;
        bibleIndexCachedAt = now;
        return data;
      }
    }
    // Fallback to index (no text)
    const idxRes = await fetch(`${R2_PUBLIC_URL}/backup/bible_index.json`, { cache: "no-store" });
    if (!idxRes.ok) return [];
    const idxData = await idxRes.json();
    if (Array.isArray(idxData)) {
      bibleIndexCache = idxData;
      bibleIndexCachedAt = now;
      return idxData;
    }
    return [];
  } catch (err) {
    console.error("[Telegram Webhook] Failed to load bible data from R2:", err);
    return [];
  }
}

// Fetch full text of a single verse from R2 full dataset
async function getBibleVerseText(verseId: string): Promise<string | null> {
  const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
  if (!R2_PUBLIC_URL) return null;

  try {
    // The full file is large; we serve it via the webhook's own API to avoid loading 6MB
    // Instead, use the Next.js API endpoint to get a single verse
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";
    const res = await fetch(`${APP_URL}/api/bible/verse?id=${encodeURIComponent(verseId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text || null;
  } catch {
    return null;
  }
}

/**
 * Parse a Bible reference like "Yohanes 3:16" or "Yoh 3:16" or "Roma 8:28-30"
 */
function parseBibleReference(text: string): { book: string; chapter: number; verseStart: number; verseEnd?: number } | null {
  const cleaned = text.trim();
  // Match: "1 Yohanes 3:16", "Yohanes 3:16", "Yoh 3:16-18"
  const match = cleaned.match(/^((?:\d\s*)?[a-zA-Z\u00C0-\u024F]+(?:\s+[a-zA-Z\u00C0-\u024F]+)*)\s+(\d+):(\d+)(?:-(\d+))?$/i);
  if (!match) return null;
  return {
    book: match[1].trim(),
    chapter: parseInt(match[2]),
    verseStart: parseInt(match[3]),
    verseEnd: match[4] ? parseInt(match[4]) : undefined,
  };
}

/**
 * Search Bible verses from R2 index
 */
async function searchBibleVerses(query: string): Promise<{
  verses: BibleVerseEntry[];
  type: "reference" | "keyword";
} | null> {
  const index = await getBibleIndex();
  if (index.length === 0) return null;

  const q = query.trim();
  const qNorm = q.toLowerCase();

  // 1. Try to match exact or range reference (e.g. "Yohanes 3:16")
  const ref = parseBibleReference(q);
  if (ref) {
    const bookNorm = ref.book.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matched = index.filter((v) => {
      const bookMatch = v.book.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(bookNorm) ||
                        (v.bookShort || "").toLowerCase() === bookNorm;
      const chapterMatch = v.chapter === ref.chapter;
      const verseMatch = ref.verseEnd
        ? v.verse >= ref.verseStart && v.verse <= ref.verseEnd
        : v.verse === ref.verseStart;
      return bookMatch && chapterMatch && verseMatch;
    });
    if (matched.length > 0) return { verses: matched.slice(0, 10), type: "reference" };
  }

  // 2. Try reference format in index (exact match on reference field)
  const refMatch = index.filter((v) =>
    (v.reference || "").toLowerCase().includes(qNorm)
  ).slice(0, 5);
  if (refMatch.length > 0) return { verses: refMatch, type: "reference" };

  // 3. Keyword search
  const keywords = qNorm.split(/\s+/).filter((w) => w.length > 2);
  if (keywords.length === 0) return null;

  const scored = index.map((v) => {
    const haystack = [
      v.reference || "",
      (v.keywords || []).join(" "),
      (v.themes || []).join(" "),
    ].join(" ").toLowerCase();
    const score = keywords.reduce((s, kw) => s + (haystack.includes(kw) ? 1 : 0), 0);
    return { ...v, score };
  }).filter((v) => v.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

  if (scored.length > 0) return { verses: scored, type: "keyword" };
  return null;
}

/**
 * Find FAQ match by keywords
 */
function matchFaq(
  text: string,
  faqs: Array<{ q: string; a: string; keywords: string[] }>
): { q: string; a: string } | null {
  const normalized = text.toLowerCase();
  for (const faq of faqs) {
    if (faq.keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
      return faq;
    }
  }
  return null;
}

// ============================================================================
// DATE SEARCH: DEVOTIONS & ARTICLES FROM R2
// ============================================================================

// Cache for R2 data (avoid re-downloading on every message)
let devotionCache: any[] | null = null;
let devotionCachedAt = 0;
let articleCache: any[] | null = null;
let articleCachedAt = 0;
const R2_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function getR2Devotions(): Promise<any[]> {
  const now = Date.now();
  if (devotionCache && now - devotionCachedAt < R2_CACHE_TTL) return devotionCache;

  const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
  if (!R2_PUBLIC_URL) return [];

  try {
    const res = await fetch(`${R2_PUBLIC_URL}/backup/renungan.json`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) {
      devotionCache = data;
      devotionCachedAt = now;
      return data;
    }
    return [];
  } catch (err) {
    console.error("[Telegram] Failed to load devotions from R2:", err);
    return [];
  }
}

async function getR2Articles(): Promise<any[]> {
  const now = Date.now();
  if (articleCache && now - articleCachedAt < R2_CACHE_TTL) return articleCache;

  const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
  if (!R2_PUBLIC_URL) return [];

  try {
    const res = await fetch(`${R2_PUBLIC_URL}/backup/blog_posts.json`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) {
      articleCache = data;
      articleCachedAt = now;
      return data;
    }
    return [];
  } catch (err) {
    console.error("[Telegram] Failed to load articles from R2:", err);
    return [];
  }
}

/**
 * Parse date query from Indonesian text:
 * - "20 Juni 2026"        → { day: 20, month: 6, year: 2026 }
 * - "Juni 2026"           → { month: 6, year: 2026 }
 * - "2026"                → { year: 2026 }
 * - "2026-06" or "06-2026" → { month: 6, year: 2026 }
 * - "2026-06-20"          → { day: 20, month: 6, year: 2026 }
 */
const BULAN_ID: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, ags: 8,
  september: 9, sep: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  desember: 12, des: 12,
};

function parseDateQuery(q: string): { day?: number; month?: number; year?: number } | null {
  const s = q.trim().toLowerCase();

  // ISO date: 2026-06-20
  const isoFull = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoFull) return { year: parseInt(isoFull[1]), month: parseInt(isoFull[2]), day: parseInt(isoFull[3]) };

  // ISO month: 2026-06
  const isoMonth = s.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMonth) return { year: parseInt(isoMonth[1]), month: parseInt(isoMonth[2]) };

  // Indonesian: "20 Juni 2026" or "20 juni"
  const withDay = s.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/);
  if (withDay) {
    const month = BULAN_ID[withDay[2]];
    if (month) return { day: parseInt(withDay[1]), month, year: withDay[3] ? parseInt(withDay[3]) : new Date().getFullYear() };
  }

  // Indonesian: "Juni 2026" or "Juni"
  const monthYear = s.match(/^([a-z]+)(?:\s+(\d{4}))?$/);
  if (monthYear) {
    const month = BULAN_ID[monthYear[1]];
    if (month) return { month, year: monthYear[2] ? parseInt(monthYear[2]) : new Date().getFullYear() };
  }

  // Year only: "2026"
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return { year: parseInt(yearOnly[1]) };

  return null;
}

function formatDateLabel(d: { day?: number; month?: number; year?: number }): string {
  const namaBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const parts: string[] = [];
  if (d.day) parts.push(String(d.day));
  if (d.month) parts.push(namaBulan[d.month - 1]);
  if (d.year) parts.push(String(d.year));
  return parts.join(" ");
}

/**
 * Filter devotions from R2 by date
 * Devotion id format: "golden-YYYY-MM-DD-HH" or "golden-YYYY-MM-DD"
 */
async function searchDevotionsByDate(query: string): Promise<any[] | null> {
  const dateFilter = parseDateQuery(query);
  if (!dateFilter) return null;

  const devotions = await getR2Devotions();
  if (devotions.length === 0) return null;

  const filtered = devotions.filter((d: any) => {
    // Extract date from id: golden-2026-06-20-05 → "2026-06-20"
    const id = (d.id || d.dateId || "");
    const idMatch = id.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!idMatch) return false;

    const [, y, m, day] = idMatch;
    if (dateFilter.year && parseInt(y) !== dateFilter.year) return false;
    if (dateFilter.month && parseInt(m) !== dateFilter.month) return false;
    if (dateFilter.day && parseInt(day) !== dateFilter.day) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  // Sort newest first
  filtered.sort((a: any, b: any) => (b.id || "").localeCompare(a.id || ""));
  return filtered.slice(0, 5);
}

/**
 * Filter articles from R2 by date
 * Article uses createdAt ISO string or dateKey
 */
async function searchArticlesByDate(query: string): Promise<any[] | null> {
  const dateFilter = parseDateQuery(query);
  if (!dateFilter) return null;

  const articles = await getR2Articles();
  if (articles.length === 0) return null;

  const filtered = articles.filter((a: any) => {
    // Try createdAt ISO string or id
    const raw = a.createdAt?.seconds
      ? new Date(a.createdAt.seconds * 1000).toISOString()
      : (a.createdAt || a.id || "");

    const match = String(raw).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return false;

    const [, y, m, d] = match;
    if (dateFilter.year && parseInt(y) !== dateFilter.year) return false;
    if (dateFilter.month && parseInt(m) !== dateFilter.month) return false;
    if (dateFilter.day && parseInt(d) !== dateFilter.day) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  // Sort newest first
  filtered.sort((a: any, b: any) => {
    const getTs = (x: any) => x.createdAt?.seconds ? x.createdAt.seconds : new Date(x.createdAt || 0).getTime() / 1000;
    return getTs(b) - getTs(a);
  });
  return filtered.slice(0, 5);
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "Bot not configured" }, { status: 200 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;

    // ── Handle inline keyboard button presses ──────────────────────────────
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbChatId = cb.message?.chat.id;
      const data = cb.data || "";
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

      await answerCallbackQuery(cb.id);

      if (!cbChatId) return NextResponse.json({ ok: true });

      // btn:renungan:YYYY-MM → list devotions for that month
      if (data.startsWith("btn:renungan:")) {
        const monthKey = data.replace("btn:renungan:", ""); // e.g. "2026-06"
        const results = await searchDevotionsByDate(monthKey);
        const [y, m] = monthKey.split("-");
        const namaBulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
        const label = `${namaBulan[parseInt(m)-1]} ${y}`;
        if (results && results.length > 0) {
          const lines = results.map((d: any) => {
            const id = d.id || d.dateId || "";
            const title = d.title || "Renungan";
            const verseRef = d.verseRef ? ` — ${d.verseRef}` : "";
            const idMatch = id.match(/(\d{4})-(\d{2})-(\d{2})/);
            const dateStr = idMatch ? `${idMatch[3]}/${idMatch[2]}/${idMatch[1]}` : "";
            return `🌅 <a href="${APP_URL}/renungan/${id}"><b>${title}</b></a>${verseRef}\n<i>${dateStr}</i>`;
          }).join("\n\n");
          await sendReply(cbChatId, `📖 <b>Renungan — ${label}</b>\n\n${lines}\n\n🔗 <a href="${APP_URL}/renungan">Lihat Semua</a>`);
        } else {
          await sendReply(cbChatId, `😔 Tidak ada renungan untuk <b>${label}</b>.`);
        }
        return NextResponse.json({ ok: true });
      }

      // btn:artikel:YYYY-MM → list articles for that month
      if (data.startsWith("btn:artikel:")) {
        const monthKey = data.replace("btn:artikel:", "");
        const results = await searchArticlesByDate(monthKey);
        const [y, m] = monthKey.split("-");
        const namaBulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
        const label = `${namaBulan[parseInt(m)-1]} ${y}`;
        if (results && results.length > 0) {
          const lines = results.map((a: any) => {
            const slug = a.slug || a.id || "";
            const title = a.title || "Artikel";
            const cat = a.category ? ` <i>[${a.category}]</i>` : "";
            return `✍️ <a href="${APP_URL}/blog/${slug}"><b>${title}</b></a>${cat}`;
          }).join("\n\n");
          await sendReply(cbChatId, `📰 <b>Artikel Blog — ${label}</b>\n\n${lines}\n\n🔗 <a href="${APP_URL}/blog">Lihat Semua</a>`);
        } else {
          await sendReply(cbChatId, `😔 Tidak ada artikel untuk <b>${label}</b>.`);
        }
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const firstName = message.from?.first_name || "teman";
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

    // Handle /start command
    if (text === "/start" || text.toLowerCase() === "start") {
      await sendReply(
        chatId,
        `👋 Halo, <b>${firstName}</b>! Selamat datang di Bot Grace Daily!

🙏 Saya siap membantu Anda dengan:
• 📖 <b>Cari Ayat</b> — <code>Yohanes 3:16</code> atau <code>/ayat kasih</code>
• 🌅 <b>Renungan</b> — <code>/renungan</code> atau <code>/renungan Juni 2026</code>
• ✍️ <b>Artikel Blog</b> — <code>/artikel</code> atau <code>/artikel Juni 2026</code>
• 📚 <b>Ensiklopedia</b> — ketik topik, contoh: <code>Musa</code>
• ❓ <b>FAQ</b> — ketik pertanyaan seputar Grace Daily
• 📞 <b>Kontak</b> — <code>/kontak</code>

🔗 <a href="${APP_URL}">${APP_URL}</a>
📢 Channel: <a href="https://t.me/gracedailybible">@gracedailybible</a>`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /kontak command
    if (text === "/kontak") {
      await sendReply(
        chatId,
        `📞 <b>Hubungi Kami</b>

📧 Email: info@gracedaily.my.id
🌐 Form: <a href="${APP_URL}/kontak">${APP_URL}/kontak</a>
📢 Channel: <a href="https://t.me/gracedailybible">@gracedailybible</a>

Kami siap membantu Anda! 🙏`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle /renungan command (with optional date: /renungan 20 Juni 2026)
    if (text === "/renungan" || text.toLowerCase().startsWith("/renungan ")) {
      const dateQuery = text.replace(/^\/renungan\s*/i, "").trim();

      if (!dateQuery) {
        // Show inline keyboard with last 6 months as buttons
        const now = new Date();
        const months: Array<{ label: string; key: string }> = [];
        const namaBulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
        for (let i = 0; i < 6; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({
            label: `📅 ${namaBulan[d.getMonth()]} ${d.getFullYear()}`,
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          });
        }
        const keyboard = {
          inline_keyboard: [
            months.slice(0, 3).map((m) => ({ text: m.label, callback_data: `btn:renungan:${m.key}` })),
            months.slice(3, 6).map((m) => ({ text: m.label, callback_data: `btn:renungan:${m.key}` })),
          ],
        };
        await sendReply(
          chatId,
          `🌅 <b>Renungan Harian Grace Daily</b>\n\nPilih bulan untuk melihat renungan, atau ketik tanggal langsung:\n<code>/renungan 20 Juni 2026</code>`,
          keyboard
        );
        return NextResponse.json({ ok: true });
      }

      // Search by date from R2
      const results = await searchDevotionsByDate(dateQuery);
      if (results && results.length > 0) {
        const label = formatDateLabel(parseDateQuery(dateQuery)!);
        const lines = results.map((d: any) => {
          const id = d.id || d.dateId || "";
          const title = d.title || "Renungan";
          const verseRef = d.verseRef ? ` — ${d.verseRef}` : "";
          const idMatch = id.match(/(\d{4})-(\d{2})-(\d{2})/);
          const dateStr = idMatch ? `${idMatch[3]}/${idMatch[2]}/${idMatch[1]}` : "";
          return `🌅 <a href="${APP_URL}/renungan/${id}"><b>${title}</b></a>${verseRef}\n<i>${dateStr}</i>`;
        }).join("\n\n");
        await sendReply(chatId, `📖 <b>Renungan Harian — ${label}</b>\n\n${lines}\n\n🔗 <a href="${APP_URL}/renungan">Lihat Semua Renungan</a>`);
      } else {
        await sendReply(chatId, `😔 Tidak ada renungan ditemukan untuk "<b>${dateQuery}</b>".\n\nCoba format lain:\n• <code>/renungan 20 Juni 2026</code>\n• <code>/renungan Juni 2026</code>`);
      }
      return NextResponse.json({ ok: true });
    }

    // Handle /artikel command (with optional date: /artikel Juni 2026)
    if (text === "/artikel" || text.toLowerCase().startsWith("/artikel ")) {
      const dateQuery = text.replace(/^\/artikel\s*/i, "").trim();

      if (!dateQuery) {
        // Show inline keyboard with last 6 months as buttons
        const now = new Date();
        const months: Array<{ label: string; key: string }> = [];
        const namaBulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
        for (let i = 0; i < 6; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({
            label: `📅 ${namaBulan[d.getMonth()]} ${d.getFullYear()}`,
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          });
        }
        const keyboard = {
          inline_keyboard: [
            months.slice(0, 3).map((m) => ({ text: m.label, callback_data: `btn:artikel:${m.key}` })),
            months.slice(3, 6).map((m) => ({ text: m.label, callback_data: `btn:artikel:${m.key}` })),
          ],
        };
        await sendReply(
          chatId,
          `✍️ <b>Artikel Blog Grace Daily</b>\n\nPilih bulan untuk melihat artikel, atau ketik tanggal langsung:\n<code>/artikel Juni 2026</code>`,
          keyboard
        );
        return NextResponse.json({ ok: true });
      }

      const results = await searchArticlesByDate(dateQuery);
      if (results && results.length > 0) {
        const label = formatDateLabel(parseDateQuery(dateQuery)!);
        const lines = results.map((a: any) => {
          const slug = a.slug || a.id || "";
          const title = a.title || "Artikel";
          const cat = a.category ? ` <i>[${a.category}]</i>` : "";
          return `✍️ <a href="${APP_URL}/blog/${slug}"><b>${title}</b></a>${cat}`;
        }).join("\n\n");
        await sendReply(chatId, `📰 <b>Artikel Blog — ${label}</b>\n\n${lines}\n\n🔗 <a href="${APP_URL}/blog">Lihat Semua Artikel</a>`);
      } else {
        await sendReply(chatId, `😔 Tidak ada artikel ditemukan untuk "<b>${dateQuery}</b>".\n\nCoba format lain:\n• <code>/artikel Juni 2026</code>\n• <code>/artikel 2026</code>`);
      }
      return NextResponse.json({ ok: true });
    }

    // Handle /ayat command — e.g. /ayat Yohanes 3:16 or /ayat kasih
    if (text.startsWith("/ayat")) {
      const ayatQuery = text.replace(/^\/ayat\s*/i, "").trim();
      if (!ayatQuery) {
        await sendReply(
          chatId,
          `📖 <b>Cara mencari ayat Alkitab:</b>

• Referensi langsung: <code>Yohanes 3:16</code>
• Rentang ayat: <code>Roma 8:28-30</code>
• Kata kunci: <code>/ayat kasih karunia</code>
• Pasal penuh: <code>/ayat Mazmur 23</code>`
        );
        return NextResponse.json({ ok: true });
      }

      const bibleResult = await searchBibleVerses(ayatQuery);
      if (bibleResult) {
        const { verses, type } = bibleResult;
        const verseLines = verses.map((v) =>
          `📖 <b>${v.reference}</b>\n<i>${v.text ? v.text.substring(0, 250) : "(Teks lengkap tersedia di website)"}</i>`
        ).join("\n\n");

        await sendReply(
          chatId,
          `${type === "reference" ? "📖" : "🔍"} <b>${type === "reference" ? "Ayat Alkitab" : "Hasil pencarian"}: ${ayatQuery}</b>\n\n${verseLines}\n\n🔗 <a href="${APP_URL}/alkitab">Baca Alkitab Lengkap</a>`
        );
      } else {
        await sendReply(
          chatId,
          `😔 Ayat "<b>${ayatQuery}</b>" tidak ditemukan.\n\nContoh format:\n• <code>Yohanes 3:16</code>\n• <code>Roma 8:28</code>\n• <code>Mazmur 23:1</code>`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Load FAQ
    const faqs = await loadFaq();

    // 0. Auto-detect Bible reference (e.g. user just types "Yohanes 3:16" without /ayat)
    const autoRef = parseBibleReference(text);
    if (autoRef) {
      const bibleResult = await searchBibleVerses(text);
      if (bibleResult && bibleResult.verses.length > 0) {
        const { verses } = bibleResult;
        const verseLines = verses.map((v) =>
          `📖 <b>${v.reference}</b>\n<i>${v.text ? v.text.substring(0, 300) : "(Teks lengkap di website)"}</i>`
        ).join("\n\n");
        await sendReply(
          chatId,
          `${verseLines}\n\n🔗 <a href="${APP_URL}/alkitab">Baca Alkitab Lengkap di Grace Daily</a>`
        );
        return NextResponse.json({ ok: true });
      }
    }

    // 1. Check FAQ match
    const faqMatch = matchFaq(text, faqs);
    if (faqMatch) {
      await sendReply(
        chatId,
        `❓ <b>${faqMatch.q}</b>\n\n${faqMatch.a}\n\n<i>Ketik /kontak untuk bantuan lebih lanjut</i>`
      );
      return NextResponse.json({ ok: true });
    }

    // 2. Search encyclopedia
    const encyclopediaResult = await searchEncyclopedia(text);
    if (encyclopediaResult) {
      const entryUrl = `${APP_URL}/ensiklopedia/${encyclopediaResult.kategori}/${encyclopediaResult.slug}`;
      await sendReply(
        chatId,
        `📚 <b>${encyclopediaResult.keyword}</b>
🏷️ Kategori: ${encyclopediaResult.kategori.replace(/_/g, " ")}

${encyclopediaResult.ringkasan}...

🔗 <a href="${entryUrl}">Baca artikel lengkap di Grace Daily</a>`
      );
      return NextResponse.json({ ok: true });
    }

    // 3. Not found — send help message
    await sendReply(
      chatId,
      `🤔 Maaf, saya tidak menemukan informasi tentang "<b>${text.substring(0, 100)}</b>".

Coba dengan:
📖 <b>Ayat Alkitab</b> → <code>Yohanes 3:16</code> atau <code>/ayat kasih</code>
📚 <b>Ensiklopedia</b> → <code>Musa</code>, <code>Abraham</code>, <code>Yerusalem</code>
❓ <b>FAQ</b> → Ketik pertanyaan tentang Grace Daily

📞 Butuh bantuan lain? Ketik <code>/kontak</code>
🌐 Website: <a href="${APP_URL}">${APP_URL}</a>`
    );
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Telegram Webhook] Error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

/**
 * GET - Verify webhook is alive
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "Grace Daily Telegram Webhook" });
}
