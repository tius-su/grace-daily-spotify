import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { postDevotionToSocials, postArticleToSocials } from "@/lib/server/socials";
import { postDevotionToFacebook, postArticleToFacebook } from "@/lib/server/facebook";
import { postToInstagram } from "@/lib/server/instagram";
import { reportSocialShareStatusTelegram } from "@/lib/server/telegram";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { collection, id } = body;

    if (!collection || !id) {
      return NextResponse.json({ error: "Collection and ID are required" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firestore Admin is not initialized" }, { status: 500 });
    }

    if (collection === "daily_devotions") {
      const docSnap = await db.collection("daily_devotions").doc(id).get();
      if (!docSnap.exists) {
        return NextResponse.json({ error: "Devotion not found" }, { status: 404 });
      }

      const devotion = docSnap.data();
      if (!devotion) {
        return NextResponse.json({ error: "Devotion data is empty" }, { status: 404 });
      }

      const title = devotion.title || "Renungan Harian";
      const rawText = devotion.body || "";
      const cleanText = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const description = cleanText.substring(0, 150) + "...";
      const bannerUrl = devotion.bannerUrl || devotion.imageUrl || "";

      // Trigger sharing in parallel to optimize speed and avoid timeout
      const fbPromise = postDevotionToFacebook({
        id,
        title: devotion.title,
        verseRef: devotion.verseRef,
        verseText: devotion.verseText,
        body: devotion.body,
      }).catch(err => ({ success: false, error: err.message }));

      const igPromise = bannerUrl
        ? postToInstagram({
            imageUrl: bannerUrl,
            caption: `🌅 ${title}\n\n📖 Ayat: ${devotion.verseRef || ""}\n\n${description}\n\nBaca renungan selengkapnya di link bio! #RenunganHarian #GraceDaily`,
          }).catch(err => ({ success: false, error: err.message }))
        : Promise.resolve({ success: false, error: "No image banner available" });

      const socialsPromise = postDevotionToSocials({
        id,
        title: devotion.title,
        verseRef: devotion.verseRef,
        verseText: devotion.verseText,
        body: devotion.body,
        imageUrl: devotion.imageUrl,
        bannerUrl: devotion.bannerUrl,
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
        description: devotion.verseRef ? `${devotion.verseRef} - ${description}` : description,
        imageUrl: bannerUrl,
        type: "devotion",
        results: shareResults,
        success: overallSuccess,
      });

      return NextResponse.json({
        success: true,
        message: "Devotion shared to social media and reported to Telegram",
        results: shareResults,
      });

    } else if (collection === "blog_posts") {
      const docSnap = await db.collection("blog_posts").doc(id).get();
      if (!docSnap.exists) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      const article = docSnap.data();
      if (!article) {
        return NextResponse.json({ error: "Article data is empty" }, { status: 404 });
      }

      const title = article.title || "Artikel Baru";
      const description = article.excerpt || "";
      const bannerUrl = article.imageUrl || "";
      const category = article.category || "Blog";

      // Trigger sharing in parallel
      const fbPromise = postArticleToFacebook({
        slug: id,
        title: article.title,
        excerpt: article.excerpt,
        category: article.category,
      }).catch(err => ({ success: false, error: err.message }));

      const igPromise = bannerUrl
        ? postToInstagram({
            imageUrl: bannerUrl,
            caption: `✍️ Artikel Baru: ${title}\n\n🏷️ Kategori: ${category}\n\n${description}\n\nBaca artikel selengkapnya di link bio! #ArtikelKristen #GraceDaily`,
          }).catch(err => ({ success: false, error: err.message }))
        : Promise.resolve({ success: false, error: "No image banner available" });

      const socialsPromise = postArticleToSocials({
        slug: id,
        title: article.title,
        excerpt: article.excerpt,
        category: article.category,
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

      return NextResponse.json({
        success: true,
        message: "Article shared to social media and reported to Telegram",
        results: shareResults,
      });
    }

    return NextResponse.json({ error: "Unsupported collection" }, { status: 400 });
  } catch (err: any) {
    console.error("[Share Socials API] Sharing failed:", err);
    return NextResponse.json({ error: err.message || "Failed to share to socials" }, { status: 500 });
  }
}
