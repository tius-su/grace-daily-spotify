/**
 * Facebook Pages Auto-Post Service for Grace Daily
 * Posts new devotions and articles to Facebook Page automatically via Graph API
 */

const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID || process.env.GRACE_DAILY_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.GRACE_DAILY_PAGE_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

// ============================================================================
// INTERFACES
// ============================================================================

export interface FacebookPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

interface FacebookPostParams {
  message: string;
  link?: string;
  imageUrl?: string;
}

// ============================================================================
// CORE FUNCTION
// ============================================================================

/**
 * Post a message to the Facebook Page using the Graph API.
 * If an imageUrl is provided, uploads as a photo post to `/photos` with the message as a caption.
 * Otherwise, posts a standard feed preview to `/feed`.
 */
async function postToFacebookPage(params: FacebookPostParams): Promise<FacebookPostResult> {
  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
    console.warn("[Facebook] FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN not configured. Skipping Facebook post.");
    return { success: false, error: "Missing Facebook configuration" };
  }

  try {
    const isPhotoPost = !!params.imageUrl;
    const endpoint = isPhotoPost 
      ? `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos` 
      : `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`;

    console.log(`[Facebook] Posting to Page (${isPhotoPost ? 'Photo' : 'Feed'}): ${FB_PAGE_ID}`);
    
    // Ensure absolute image URL
    const absoluteImageUrl = params.imageUrl 
      ? (params.imageUrl.startsWith("/") ? `${APP_URL}${params.imageUrl}` : params.imageUrl)
      : undefined;

    const requestBody = isPhotoPost 
      ? {
          url: absoluteImageUrl,
          caption: params.message + (params.link ? `\n\nBaca selengkapnya: ${params.link}` : ""),
          access_token: FB_PAGE_ACCESS_TOKEN,
        }
      : {
          message: params.message,
          link: params.link,
          access_token: FB_PAGE_ACCESS_TOKEN,
        };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    if (!response.ok) {
      const errMsg = data?.error?.message || `HTTP ${response.status}`;
      console.error("[Facebook] Post error:", errMsg);
      return { success: false, error: errMsg };
    }

    const id = data?.id || data?.post_id;
    if (id) {
      console.log("[Facebook] Post published successfully! ID:", id);
      return { success: true, postId: id };
    }

    return { success: false, error: "Unexpected response from Facebook API" };
  } catch (error: any) {
    console.error("[Facebook] Failed to publish post:", error.message);
    return { success: false, error: error.message || "Unknown error" };
  }
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
  imageUrl?: string;
  bannerUrl?: string;
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
  const displayImage = devotion.bannerUrl || devotion.imageUrl;

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

  return postToFacebookPage({ message, link: devotionUrl, imageUrl: displayImage });
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
  imageUrl?: string;
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

  return postToFacebookPage({ message, link: articleUrl, imageUrl: article.imageUrl });
}

// ============================================================================
// CONFIG CHECK
// ============================================================================

export function isFacebookConfigured(): boolean {
  return !!(FB_PAGE_ID && FB_PAGE_ACCESS_TOKEN);
}
