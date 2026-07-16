/**
 * Social Media Auto-Post Service for Grace Daily
 * Automatically publishes new devotions and articles to Bluesky, Mastodon, and Discord
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

// Bluesky Credentials
const BSKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER;
const BSKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;

// Mastodon Credentials
const MASTODON_SERVER = process.env.MASTODON_SERVER || "https://mastodon.social";
const MASTODON_ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;

// Discord Webhook
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

// ============================================================================
// CONFIG CHECKS
// ============================================================================

export function isBlueskyConfigured(): boolean {
  return !!(BSKY_IDENTIFIER && BSKY_APP_PASSWORD);
}

export function isMastodonConfigured(): boolean {
  return !!(MASTODON_SERVER && MASTODON_ACCESS_TOKEN);
}

export function isDiscordConfigured(): boolean {
  return !!DISCORD_WEBHOOK;
}

// ============================================================================
// BLUESKY (AT PROTOCOL) INTEGRATION
// ============================================================================

interface BlueskyPostParams {
  text: string;
  linkUri: string;
  linkTitle: string;
  linkDescription: string;
  imageUrl?: string;
}

async function uploadBlueskyBlob(accessJwt: string, imageUrl: string): Promise<any> {
  try {
    const absoluteUrl = imageUrl.startsWith("/") ? `${APP_URL}${imageUrl}` : imageUrl;
    const res = await fetch(absoluteUrl);
    if (!res.ok) {
      console.warn(`[Bluesky] Failed to fetch image for blob upload: ${res.status}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const uploadRes = await fetch(`${MASTODON_SERVER === "https://mastodon.social" ? "https://bsky.social" : "https://bsky.social"}/xrpc/com.atproto.repo.uploadBlob`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        "Content-Type": "image/jpeg",
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.warn(`[Bluesky] Blob upload endpoint returned error: ${uploadRes.status} ${errText}`);
      return null;
    }

    const data = await uploadRes.json();
    return data.blob;
  } catch (error) {
    console.error("[Bluesky] Failed to upload blob:", error);
    return null;
  }
}

async function postToBluesky(params: BlueskyPostParams): Promise<{ success: boolean; error?: string; uri?: string }> {
  if (!isBlueskyConfigured()) {
    return { success: false, error: "Bluesky not configured" };
  }

  try {
    // 1. Create Session
    const cleanIdentifier = BSKY_IDENTIFIER!.startsWith("@") ? BSKY_IDENTIFIER!.substring(1) : BSKY_IDENTIFIER!;
    const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: cleanIdentifier,
        password: BSKY_APP_PASSWORD,
      }),
    });

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      throw new Error(`Authentication failed: ${sessionRes.status} ${errText}`);
    }

    const session = await sessionRes.json();
    const { accessJwt, did } = session;

    // 2. Upload Thumbnail if present
    let thumbBlob = null;
    if (params.imageUrl) {
      thumbBlob = await uploadBlueskyBlob(accessJwt, params.imageUrl);
    }

    // 3. Create External Embed Block
    const embed: any = {
      $type: "app.bsky.embed.external",
      external: {
        uri: params.linkUri,
        title: params.linkTitle,
        description: params.linkDescription,
      },
    };

    if (thumbBlob) {
      embed.external.thumb = thumbBlob;
    }

    // 4. Submit Post Record
    const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text: params.text,
          createdAt: new Date().toISOString(),
          embed,
        },
      }),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      throw new Error(`Post creation failed: ${postRes.status} ${errText}`);
    }

    const postData = await postRes.json();
    return { success: true, uri: postData.uri };
  } catch (error: any) {
    console.error("[Bluesky] Error posting:", error.message || error);
    return { success: false, error: error.message || "Unknown Bluesky error" };
  }
}

// ============================================================================
// MASTODON INTEGRATION
// ============================================================================

async function uploadImageToMastodon(imageUrl: string): Promise<string | null> {
  if (!isMastodonConfigured() || !imageUrl) return null;

  try {
    const absoluteUrl = imageUrl.startsWith("/") ? `${APP_URL}${imageUrl}` : imageUrl;

    // 1. Fetch image from URL
    const imageRes = await fetch(absoluteUrl);
    if (!imageRes.ok) {
      console.warn(`[Mastodon] Failed to fetch image: ${imageRes.statusText}`);
      return null;
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Prepare FormData multipart body
    const formData = new FormData();
    const blob = new Blob([buffer], { type: "image/jpeg" });
    formData.append("file", blob, "banner.jpg");

    // 3. Upload to Mastodon Media endpoint
    const response = await fetch(`${MASTODON_SERVER}/api/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Mastodon] Media upload v2 failed, trying v1 fallback: ${response.status} ${errText}`);

      const fallbackResponse = await fetch(`${MASTODON_SERVER}/api/v1/media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`,
        },
        body: formData,
      });

      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        return data.id;
      }
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (error: any) {
    console.error("[Mastodon] Error uploading media:", error.message || error);
    return null;
  }
}

async function postToMastodon(text: string, imageUrl?: string): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!isMastodonConfigured()) {
    return { success: false, error: "Mastodon not configured" };
  }

  try {
    let mediaIds: string[] = [];
    if (imageUrl) {
      const mediaId = await uploadImageToMastodon(imageUrl);
      if (mediaId) {
        mediaIds.push(mediaId);
      }
    }

    const bodyData: any = {
      status: text,
    };
    if (mediaIds.length > 0) {
      bodyData.media_ids = mediaIds;
    }

    const response = await fetch(`${MASTODON_SERVER}/api/v1/statuses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Mastodon API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error("[Mastodon] Error posting:", error.message || error);
    return { success: false, error: error.message || "Unknown Mastodon error" };
  }
}

// ============================================================================
// DISCORD INTEGRATION
// ============================================================================

interface DiscordEmbedParams {
  content?: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  color?: number; // integer color code
}

async function postToDiscord(params: DiscordEmbedParams): Promise<{ success: boolean; error?: string }> {
  if (!isDiscordConfigured()) {
    return { success: false, error: "Discord webhook not configured" };
  }

  try {
    const absoluteImageUrl = params.imageUrl
      ? (params.imageUrl.startsWith("/") ? `${APP_URL}${params.imageUrl}` : params.imageUrl)
      : undefined;

    const payload = {
      content: params.content,
      embeds: [
        {
          title: params.title,
          description: params.description,
          url: params.url,
          color: params.color || 10255444, // Default gold-brown: #9C7C54
          image: absoluteImageUrl ? { url: absoluteImageUrl } : undefined,
          footer: {
            text: "Grace Daily",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const response = await fetch(DISCORD_WEBHOOK!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Discord API error: ${response.status} ${errText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Discord] Error posting webhook:", error.message || error);
    return { success: false, error: error.message || "Unknown Discord error" };
  }
}

// ============================================================================
// DEVOTION AND ARTICLE PUBLIC INTERFACES
// ============================================================================

export interface SocialsPostResult {
  bluesky: { success: boolean; uri?: string; error?: string };
  mastodon: { success: boolean; id?: string; error?: string };
  discord: { success: boolean; error?: string };
}

/**
 * Post a Daily Devotion to Bluesky, Mastodon, and Discord.
 */
export async function postDevotionToSocials(devotion: {
  id: string;
  title?: string;
  verseRef?: string;
  verseText?: string;
  body?: string;
  imageUrl?: string;
  bannerUrl?: string;
}): Promise<SocialsPostResult> {
  const title = devotion.title || "Renungan Harian";
  const verseRef = devotion.verseRef ? `📖 ${devotion.verseRef}` : "";
  const verseText = devotion.verseText
    ? `"${String(devotion.verseText).trim()}"`
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

  // --- Bluesky: strictly capped at 290 characters (limit 300) ---
  const cleanVerseRefBs = devotion.verseRef ? `📖 ${devotion.verseRef}` : "";
  const footerBs = "Baca renungan hari ini selengkapnya di Grace Daily ✨";

  let bskyTitle = title;
  let bskyText = [
    `🌅 Renungan Harian — ${bskyTitle}`,
    cleanVerseRefBs,
    "",
    footerBs,
    devotionUrl
  ].filter(Boolean).join("\n");

  if (bskyText.length > 290) {
    const excess = bskyText.length - 290;
    const maxTitleLen = Math.max(10, bskyTitle.length - excess - 3);
    bskyTitle = bskyTitle.substring(0, maxTitleLen) + "...";

    bskyText = [
      `🌅 Renungan Harian — ${bskyTitle}`,
      cleanVerseRefBs,
      "",
      footerBs,
      devotionUrl
    ].filter(Boolean).join("\n");
  }

  // If still too long, try without the verse reference
  if (bskyText.length > 290) {
    bskyText = [
      `🌅 Renungan Harian — ${bskyTitle}`,
      "",
      footerBs,
      devotionUrl
    ].filter(Boolean).join("\n");
  }

  // If STILL too long, truncate title even further
  if (bskyText.length > 290) {
    const excess = bskyText.length - 290;
    const maxTitleLen = Math.max(5, bskyTitle.length - excess - 3);
    bskyTitle = bskyTitle.substring(0, maxTitleLen) + "...";
    bskyText = [
      `🌅 Renungan Harian — ${bskyTitle}`,
      "",
      footerBs,
      devotionUrl
    ].filter(Boolean).join("\n");
  }

  // --- Mastodon: strictly capped at 480 characters (limit 500) ---
  const mastodonTitle = `🌅 Renungan Harian — ${title.substring(0, 100)}`;
  const mastodonVerseRef = devotion.verseRef ? `📖 ${devotion.verseRef}` : "";
  const mastodonFooter = `✨ Baca renungan lengkap di Grace Daily.\n${devotionUrl}`;

  const staticText = [
    mastodonTitle,
    mastodonVerseRef,
    mastodonFooter
  ].filter(Boolean).join("\n\n");

  const remainingBudget = 475 - staticText.length;

  let finalVerseText = verseText;
  let finalExcerpt = bodyExcerpt;

  if (remainingBudget < 80) {
    // Omit excerpt, truncate verseText to fit remaining budget
    finalExcerpt = "";
    const verseBudget = Math.max(0, remainingBudget - 10);
    if (verseText && verseText.length > verseBudget) {
      finalVerseText = `"${verseText.replace(/^"|"$/g, "").substring(0, Math.max(10, verseBudget - 5))}..."`;
    }
  } else {
    // Split remaining budget between verse text (40%) and body excerpt (50%)
    const verseBudget = Math.floor(remainingBudget * 0.4);
    const excerptBudget = Math.floor(remainingBudget * 0.5);

    if (verseText && verseText.length > verseBudget) {
      finalVerseText = `"${verseText.replace(/^"|"$/g, "").substring(0, Math.max(10, verseBudget - 5))}..."`;
    }
    if (bodyExcerpt && bodyExcerpt.length > excerptBudget) {
      finalExcerpt = `${bodyExcerpt.substring(0, Math.max(10, excerptBudget - 5))}...`;
    }
  }

  const mastodonFullText = [
    mastodonTitle,
    "",
    mastodonVerseRef,
    finalVerseText ? `${finalVerseText}` : "",
    "",
    finalExcerpt ? `${finalExcerpt}` : "",
    "",
    mastodonFooter
  ].filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n").trim();

  const results: SocialsPostResult = {
    bluesky: { success: false, error: "Not triggered" },
    mastodon: { success: false, error: "Not triggered" },
    discord: { success: false, error: "Not triggered" },
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // 1. Post to Bluesky
  if (isBlueskyConfigured()) {
    results.bluesky = await postToBluesky({
      text: bskyText,
      linkUri: devotionUrl,
      linkTitle: `🌅 Renungan Harian: ${title}`,
      linkDescription: verseRef ? `${verseRef} - ${bodyExcerpt}` : bodyExcerpt,
      imageUrl: displayImage,
    });
    await delay(2000); // 2 detik jeda sebelum post ke platform berikutnya
  } else {
    results.bluesky = { success: false, error: "Not configured" };
  }

  // 2. Post to Mastodon
  if (isMastodonConfigured()) {
    // Mastodon can take the full text since limit is 500 characters
    results.mastodon = await postToMastodon(mastodonFullText, displayImage);
    await delay(2000); // 2 detik jeda sebelum post ke platform berikutnya
  } else {
    results.mastodon = { success: false, error: "Not configured" };
  }

  // 3. Post to Discord Embed
  if (isDiscordConfigured()) {
    results.discord = await postToDiscord({
      content: `🌅 **Renungan Harian Baru!** — *${title}*`,
      title: title,
      description: [
        verseRef ? `**Ayat:** ${verseRef}` : "",
        verseText ? `*${verseText}*` : "",
        "",
        bodyExcerpt,
        "",
        "[**Baca Selengkapnya di Website**]" + `(${devotionUrl})`
      ].filter(l => l !== undefined).join("\n"),
      url: devotionUrl,
      imageUrl: displayImage,
      color: 10255444, // #9C7C54
    });
  } else {
    results.discord = { success: false, error: "Not configured" };
  }

  return results;
}

/**
 * Post a new Blog Article to Bluesky, Mastodon, and Discord.
 */
export async function postArticleToSocials(article: {
  slug: string;
  title?: string;
  excerpt?: string;
  category?: string;
  imageUrl?: string;
}): Promise<SocialsPostResult> {
  const title = article.title || "Artikel Baru";
  const excerpt = article.excerpt
    ? String(article.excerpt).substring(0, 200)
    : "";
  const category = article.category ? `🏷️ Kategori: ${article.category}` : "";
  const articleUrl = `${APP_URL}/blog/${article.slug}`;
  const displayImage = article.imageUrl;

  // --- Bluesky: strictly capped at 290 characters (limit 300) ---
  const footerBs = "Baca artikel baru selengkapnya di Grace Daily 📚";

  let bskyTitle = title;
  let shortText = [
    `✍️ Artikel Baru — ${bskyTitle}`,
    category,
    "",
    footerBs,
    articleUrl
  ].filter(Boolean).join("\n");

  if (shortText.length > 290) {
    const excess = shortText.length - 290;
    const maxTitleLen = Math.max(10, bskyTitle.length - excess - 3);
    bskyTitle = bskyTitle.substring(0, maxTitleLen) + "...";

    shortText = [
      `✍️ Artikel Baru — ${bskyTitle}`,
      category,
      "",
      footerBs,
      articleUrl
    ].filter(Boolean).join("\n");
  }

  // If still too long, try without category
  if (shortText.length > 290) {
    shortText = [
      `✍️ Artikel Baru — ${bskyTitle}`,
      "",
      footerBs,
      articleUrl
    ].filter(Boolean).join("\n");
  }

  // If STILL too long, truncate title even further
  if (shortText.length > 290) {
    const excess = shortText.length - 290;
    const maxTitleLen = Math.max(5, bskyTitle.length - excess - 3);
    bskyTitle = bskyTitle.substring(0, maxTitleLen) + "...";
    shortText = [
      `✍️ Artikel Baru — ${bskyTitle}`,
      "",
      footerBs,
      articleUrl
    ].filter(Boolean).join("\n");
  }

  // Calculate Mastodon excerpt size to fit within the 500-char limit without clipping the URL
  const mastodonStaticParts = [
    `✍️ Artikel Baru — ${title}`,
    "",
    "", // excerpt placeholder
    "",
    category,
    "",
    "📚 Baca artikel lengkap dan temukan lebih banyak konten rohani Kristen di Grace Daily.",
    "",
    articleUrl
  ].filter(Boolean).join("\n");

  const maxMastodonExcerptLen = Math.max(50, 480 - mastodonStaticParts.length);
  const mastodonExcerpt = article.excerpt
    ? String(article.excerpt).substring(0, maxMastodonExcerptLen) + (article.excerpt.length > maxMastodonExcerptLen ? "..." : "")
    : "";

  const mastodonFullText = [
    `✍️ Artikel Baru — ${title}`,
    "",
    mastodonExcerpt ? `${mastodonExcerpt}` : "",
    "",
    category,
    "",
    "📚 Baca artikel lengkap dan temukan lebih banyak konten rohani Kristen di Grace Daily.",
    "",
    articleUrl
  ].filter(Boolean).join("\n");

  const results: SocialsPostResult = {
    bluesky: { success: false, error: "Not triggered" },
    mastodon: { success: false, error: "Not triggered" },
    discord: { success: false, error: "Not triggered" },
  };

  // 1. Post to Bluesky
  if (isBlueskyConfigured()) {
    results.bluesky = await postToBluesky({
      text: shortText,
      linkUri: articleUrl,
      linkTitle: `✍️ Artikel Baru: ${title}`,
      linkDescription: excerpt || category || "Baca artikel selengkapnya di website Grace Daily.",
      imageUrl: displayImage,
    });
  } else {
    results.bluesky = { success: false, error: "Not configured" };
  }

  // 2. Post to Mastodon
  if (isMastodonConfigured()) {
    results.mastodon = await postToMastodon(mastodonFullText, displayImage);
  } else {
    results.mastodon = { success: false, error: "Not configured" };
  }

  // 3. Post to Discord Embed
  if (isDiscordConfigured()) {
    results.discord = await postToDiscord({
      content: `✍️ **Artikel Baru Kristen!** — *${title}*`,
      title: title,
      description: [
        category ? `**Kategori:** ${category}` : "",
        "",
        excerpt ? `*${excerpt}...*` : "",
        "",
        "[**Baca Artikel Lengkap**]" + `(${articleUrl})`
      ].filter(l => l !== undefined).join("\n"),
      url: articleUrl,
      imageUrl: displayImage,
      color: 10255444, // #9C7C54
    });
  } else {
    results.discord = { success: false, error: "Not configured" };
  }

  return results;
}
