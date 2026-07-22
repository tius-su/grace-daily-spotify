import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { postDevotionToFacebook, postArticleToFacebook } from "@/lib/server/facebook";
import { postToInstagram } from "@/lib/server/instagram";
import { postDevotionToSocials, postArticleToSocials } from "@/lib/server/socials";
import { reportSocialShareStatusTelegram } from "@/lib/server/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const customCronHeader = request.headers.get("x-cron-secret") || "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || url.searchParams.get("cron_secret");

  if (!secret) return true;

  return (
    authHeader === `Bearer ${secret}` ||
    querySecret === secret ||
    customCronHeader === secret ||
    request.headers.get("x-vercel-cron") === "1"
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Firestore not initialized" }, { status: 500 });
  }

  const now = new Date();
  const resultsLog: any[] = [];

  try {
    // 1. Fetch pending devotions
    const devotionsSnap = await db
      .collection("daily_devotions")
      .where("socialsShareStatus", "==", "pending")
      .limit(20)
      .get();

    const devotionsToShare = devotionsSnap.docs.filter(doc => {
      const data = doc.data();
      if (!data.scheduledShareAt) return false;
      const scheduledTime = data.scheduledShareAt.toDate ? data.scheduledShareAt.toDate() : new Date(data.scheduledShareAt);
      return scheduledTime <= now;
    }).slice(0, 5);

    for (const doc of devotionsToShare) {
      const data = doc.data();
      const devotionId = doc.id;
      const title = data.title || "Renungan Harian";
      
      const rawText = data.body || "";
      const cleanText = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const description = cleanText.substring(0, 150) + "...";
      
      const bannerUrl = data.bannerUrl || data.imageUrl || "";

      console.log(`[Scheduled Share] Processing devotion: ${devotionId}`);

      // Run posts in parallel
      const fbPromise = postDevotionToFacebook({
        id: devotionId,
        title: data.title,
        verseRef: data.verseRef,
        verseText: data.verseText,
        body: data.body,
        imageUrl: data.imageUrl,
        bannerUrl: data.bannerUrl,
      }).catch(err => ({ success: false, error: err.message }));

      const igPromise = bannerUrl
        ? postToInstagram({
            imageUrl: bannerUrl,
            caption: `🌅 ${title}\n\n📖 Ayat: ${data.verseRef || ""}\n\n${description}\n\nBaca renungan selengkapnya di link bio! #RenunganHarian #GraceDaily`,
          }).catch(err => ({ success: false, error: err.message }))
        : Promise.resolve({ success: false, error: "No image banner available" });

      const socialsPromise = postDevotionToSocials({
        id: devotionId,
        title: data.title,
        verseRef: data.verseRef,
        verseText: data.verseText,
        body: data.body,
        imageUrl: data.imageUrl,
        bannerUrl: data.bannerUrl,
      }).catch(err => ({
        bluesky: { success: false, error: err.message },
        mastodon: { success: false, error: err.message },
        discord: { success: false, error: err.message },
      }));

      const [fbRes, igRes, socialsRes] = await Promise.all([fbPromise, igPromise, socialsPromise]);

      const shareResults = {
        facebook: fbRes,
        instagram: igRes,
        bluesky: (socialsRes as any).bluesky || { success: false, error: "Not executed" },
        mastodon: (socialsRes as any).mastodon || { success: false, error: "Not executed" },
        discord: (socialsRes as any).discord || { success: false, error: "Not executed" },
      };

      const overallSuccess = Object.values(shareResults).some(r => r.success);

      // Report to Telegram
      await reportSocialShareStatusTelegram({
        title,
        description: data.verseRef ? `${data.verseRef} - ${description}` : description,
        imageUrl: bannerUrl,
        type: "devotion",
        results: shareResults,
        success: overallSuccess,
      });

      // Update document to completed
      await db.collection("daily_devotions").doc(devotionId).update({
        socialsShareStatus: "completed",
        socialsShareResults: shareResults,
        sharedAt: new Date(),
      });

      resultsLog.push({ id: devotionId, type: "devotion", success: overallSuccess, results: shareResults });
    }

    // 2. Fetch pending articles
    const articlesSnap = await db
      .collection("blog_posts")
      .where("socialsShareStatus", "==", "pending")
      .limit(20)
      .get();

    const articlesToShare = articlesSnap.docs.filter(doc => {
      const data = doc.data();
      if (!data.scheduledShareAt) return false;
      const scheduledTime = data.scheduledShareAt.toDate ? data.scheduledShareAt.toDate() : new Date(data.scheduledShareAt);
      return scheduledTime <= now;
    }).slice(0, 5);

    for (const doc of articlesToShare) {
      const data = doc.data();
      const slug = doc.id;
      const title = data.title || "Artikel Baru";
      const description = data.excerpt || "";
      const bannerUrl = data.imageUrl || "";
      const category = data.category || "Blog";

      console.log(`[Scheduled Share] Processing article: ${slug}`);

      // Run posts in parallel
      const fbPromise = postArticleToFacebook({
        slug,
        title: data.title,
        excerpt: data.excerpt,
        category: data.category,
        imageUrl: bannerUrl,
      }).catch(err => ({ success: false, error: err.message }));

      const igPromise = bannerUrl
        ? postToInstagram({
            imageUrl: bannerUrl,
            caption: `✍️ Artikel Baru: ${title}\n\n🏷️ Kategori: ${category}\n\n${description}\n\nBaca artikel selengkapnya di link bio! #ArtikelKristen #GraceDaily`,
          }).catch(err => ({ success: false, error: err.message }))
        : Promise.resolve({ success: false, error: "No image banner available" });

      const socialsPromise = postArticleToSocials({
        slug,
        title: data.title,
        excerpt: data.excerpt,
        category: data.category,
        imageUrl: bannerUrl,
      }).catch(err => ({
        bluesky: { success: false, error: err.message },
        mastodon: { success: false, error: err.message },
        discord: { success: false, error: err.message },
      }));

      const [fbRes, igRes, socialsRes] = await Promise.all([fbPromise, igPromise, socialsPromise]);

      const shareResults = {
        facebook: fbRes,
        instagram: igRes,
        bluesky: (socialsRes as any).bluesky || { success: false, error: "Not executed" },
        mastodon: (socialsRes as any).mastodon || { success: false, error: "Not executed" },
        discord: (socialsRes as any).discord || { success: false, error: "Not executed" },
      };

      const overallSuccess = Object.values(shareResults).some(r => r.success);

      // Report to Telegram
      await reportSocialShareStatusTelegram({
        title,
        description,
        imageUrl: bannerUrl,
        type: "article",
        results: shareResults,
        success: overallSuccess,
      });

      // Update document to completed
      await db.collection("blog_posts").doc(slug).update({
        socialsShareStatus: "completed",
        socialsShareResults: shareResults,
        sharedAt: new Date(),
      });

      resultsLog.push({ id: slug, type: "article", success: overallSuccess, results: shareResults });
    }

    return NextResponse.json({ success: true, processedCount: resultsLog.length, log: resultsLog });
  } catch (error: any) {
    console.error("[Scheduled Share] Cron execution failed:", error);
    return NextResponse.json({ error: error.message || "Execution error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
