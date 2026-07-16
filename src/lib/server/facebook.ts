/**
 * Facebook Pages Auto-Post Service for Grace Daily
 * Posts new devotions and articles to Facebook Page automatically via Graph API
 */

const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

// ============================================================================
// INTERFACES
// ============================================================================

export interface FacebookPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

interface FacebookFeedPost {
  message: string;
  link?: string;
}

// ============================================================================
// CORE FUNCTION
// ============================================================================

/**
 * Post a message to the Facebook Page feed using the Graph API.
 * Uses feed endpoint with link for rich preview (Open Graph thumbnail).
 */
async function postToFacebookPage(params: FacebookFeedPost): Promise<FacebookPostResult> {
  // Facebook auto-posting has been disabled as requested by the user
  console.warn("[Facebook] Auto-posting is disabled.");
  return { success: false, error: "Dinonaktifkan" };
}

// ============================================================================
// DEVOTION POST
// ============================================================================

/**
 * Post new daily devotion to Facebook Page.
 * Format: title, verse ref, excerpt, link to full devotion.
 */
export async function postDevotionToFacebook(devotion: {
  id: string;
  title?: string;
  verseRef?: string;
  verseText?: string;
  body?: string;
}): Promise<FacebookPostResult> {
  const title = devotion.title || "Renungan Harian";
  const verseRef = devotion.verseRef ? `📖 ${devotion.verseRef}` : "";
  const verseText = devotion.verseText
    ? `"${String(devotion.verseText).substring(0, 120)}..."`
    : "";

  // Strip HTML from body for excerpt
  const bodyExcerpt = devotion.body
    ? String(devotion.body)
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 200) + "..."
    : "";

  const devotionUrl = `${APP_URL}/renungan/${devotion.id}`;

  const message = [
    `🌅 Renungan Harian — ${title}`,
    "",
    verseRef,
    verseText ? `${verseText}` : "",
    "",
    bodyExcerpt,
    "",
    "✨ Baca renungan lengkap dan temukan inspirasi rohani lainnya di Grace Daily.",
    "",
    "#RenunganHarian #GraceDaily #RohaniKristen #ImanKristen #Alkitab",
  ]
    .filter((line) => line !== undefined && line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return postToFacebookPage({ message, link: devotionUrl });
}

// ============================================================================
// ARTICLE POST
// ============================================================================

/**
 * Post new blog article to Facebook Page.
 * Format: article title, excerpt, category, link.
 */
export async function postArticleToFacebook(article: {
  slug: string;
  title?: string;
  excerpt?: string;
  category?: string;
}): Promise<FacebookPostResult> {
  const title = article.title || "Artikel Baru";
  const excerpt = article.excerpt
    ? String(article.excerpt).substring(0, 200)
    : "";
  const category = article.category ? `🏷️ Kategori: ${article.category}` : "";
  const articleUrl = `${APP_URL}/blog/${article.slug}`;

  const message = [
    `✍️ Artikel Baru — ${title}`,
    "",
    excerpt ? `${excerpt}...` : "",
    "",
    category,
    "",
    "📚 Baca artikel lengkap dan temukan lebih banyak konten rohani Kristen di Grace Daily.",
    "",
    "#ArtikelKristen #GraceDaily #RohaniKristen #Blog #ImanKristen",
  ]
    .filter((line) => line !== undefined && line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return postToFacebookPage({ message, link: articleUrl });
}

// ============================================================================
// CONFIG CHECK
// ============================================================================

export function isFacebookConfigured(): boolean {
  return false;
}
