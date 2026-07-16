/**
 * Instagram Publishing Service for Grace Daily
 * Publishes content to Instagram Business accounts linked to Facebook Pages
 */

const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

export interface InstagramPostResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}

/**
 * Retrieve the Instagram Business Account ID associated with the Facebook Page
 */
async function getInstagramBusinessAccountId(pageId: string, accessToken: string): Promise<string | null> {
  try {
    console.log(`[Instagram] Checking linked Instagram account for FB Page: ${pageId}`);
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Instagram] Failed to fetch linked page account: ${response.status} - ${errText}`);
      return null;
    }

    const data = await response.json();
    const instagramId = data?.instagram_business_account?.id;

    if (!instagramId) {
      console.warn("[Instagram] No connected Instagram Business Account found for this Facebook Page.");
      return null;
    }

    console.log(`[Instagram] Found linked Instagram Account ID: ${instagramId}`);
    return instagramId;
  } catch (error: any) {
    console.error("[Instagram] Failed to get Instagram Account ID:", error.message);
    return null;
  }
}

/**
 * Publishes a single image post to Instagram Page
 */
export async function postToInstagram({
  imageUrl,
  caption,
}: {
  imageUrl: string;
  caption: string;
}): Promise<InstagramPostResult> {
  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
    console.warn("[Instagram] FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not configured. Skipping Instagram post.");
    return { success: false, error: "Missing Facebook/Instagram configuration" };
  }

  // Ensure we use an absolute image URL
  const absoluteImageUrl = imageUrl.startsWith("/") ? `${APP_URL}${imageUrl}` : imageUrl;

  try {
    // 1. Get the linked Instagram Account ID
    const igAccountId = await getInstagramBusinessAccountId(FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN);
    if (!igAccountId) {
      return { success: false, error: "No connected Instagram account found on Facebook Page" };
    }

    // 2. Create the media container (upload the image to Instagram servers)
    console.log(`[Instagram] Creating media container for image: ${absoluteImageUrl}`);
    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: absoluteImageUrl,
          caption: caption,
          access_token: FB_PAGE_ACCESS_TOKEN,
        }),
      }
    );

    const containerData = await containerRes.json();
    if (!containerRes.ok) {
      const errMsg = containerData?.error?.message || `HTTP ${containerRes.status}`;
      console.error("[Instagram] Create media container error:", errMsg);
      return { success: false, error: errMsg };
    }

    const creationId = containerData?.id;
    if (!creationId) {
      return { success: false, error: "Failed to retrieve creation ID from Instagram" };
    }

    console.log(`[Instagram] Container created. ID: ${creationId}. Waiting 3 seconds for processing...`);
    // Wait briefly for Instagram to download and process the image
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 3. Publish the media container
    console.log(`[Instagram] Publishing media container: ${creationId}`);
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: FB_PAGE_ACCESS_TOKEN,
        }),
      }
    );

    const publishData = await publishRes.json();
    if (!publishRes.ok) {
      const errMsg = publishData?.error?.message || `HTTP ${publishRes.status}`;
      console.error("[Instagram] Publish error:", errMsg);
      return { success: false, error: errMsg };
    }

    if (publishData?.id) {
      console.log("[Instagram] Post published successfully! ID:", publishData.id);
      return { success: true, mediaId: publishData.id };
    }

    return { success: false, error: "Unexpected response from Instagram API" };
  } catch (error: any) {
    console.error("[Instagram] Failed to publish post:", error.message);
    return { success: false, error: error.message || "Unknown error" };
  }
}
