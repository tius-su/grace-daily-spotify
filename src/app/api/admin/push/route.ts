import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { type PushPreferenceType } from "@/lib/server/push-notification";
import { getCollectionWithFallback } from "@/lib/server/db-fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 1. Verify that the requester is an authorized admin
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Database not initialized (FCM Messaging requires Service Account)" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, preferenceKey, title, body: textBody, url } = body;

    if (action === "broadcast") {
      if (!title || !textBody) {
        return NextResponse.json({ error: "Judul dan isi notifikasi wajib diisi." }, { status: 400 });
      }

      const { sendPushNotification } = await import("@/lib/server/push-notification");
      const result = await sendPushNotification({
        preferenceKey: (preferenceKey as PushPreferenceType) || "general",
        title,
        body: textBody,
        url: url || "/",
      });

      return NextResponse.json(result);
    }

    if (action === "trigger_devotion") {
      const { getLatestDevotion } = await import("@/lib/server/daily-devotion");
      // Fetch latest devotion using fallback chain
      const devotion = await getLatestDevotion();

      if (!devotion) {
        return NextResponse.json({ error: "Belum ada renungan harian yang tersedia." }, { status: 404 });
      }

      const devotionTitle = `🌅 Renungan Harian: ${devotion.title || "Hari Ini"}`;
      const devotionBody = `${devotion.verseRef || ""}: "${(devotion.verseText || "").substring(0, 80)}..."`;

      const { sendPushNotification } = await import("@/lib/server/push-notification");
      const result = await sendPushNotification({
        preferenceKey: "devotion",
        title: devotionTitle,
        body: devotionBody,
        url: "/",
      });

      // Send email blast in background
      let emailResult = { sentCount: 0, failedCount: 0 };
      try {
        const devotionHtml = `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2933; background-color: #f7f4ee; border: 1px solid #dfd8ca; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: #2a6f6f;">Grace Daily</span>
            </div>
            <h1 style="font-size: 24px; font-weight: bold; color: #14213d; margin-top: 10px; margin-bottom: 5px; text-align: center;">${devotion.title}</h1>
            <p style="text-align: center; font-size: 12px; color: #52606d; margin-bottom: 25px;">Sajian Teduh Hari Ini</p>
            
            <div style="background-color: #fffdf8; border-left: 4px solid #2a6f6f; padding: 15px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #2a6f6f; letter-spacing: 1.5px;">Ayat Harian: ${devotion.verseRef}</p>
              <blockquote style="margin: 5px 0 0 0; font-style: italic; font-size: 15px; color: #334155;">&ldquo;${devotion.verseText}&rdquo;</blockquote>
            </div>
            
            <div style="line-height: 1.8; font-size: 15px; color: #334155; margin-bottom: 25px;">
              ${devotion.body.split("\n").map(para => `<p style="margin-bottom: 15px;">${para}</p>`).join("")}
            </div>
            
            ${devotion.prayer ? `
              <div style="background-color: #e9f5db; border: 1px solid #dfd8ca; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #2a6f6f; letter-spacing: 1.5px;">Doa Hari Ini</p>
                <p style="margin: 0; font-style: italic; font-size: 14px; color: #334155;">&ldquo;${devotion.prayer}&rdquo;</p>
              </div>
            ` : ""}
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id"}/renungan/${devotion.id}" style="background-color: #2a6f6f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Baca Online & Dengarkan Audio</a>
            </div>
          </div>
        `;
        const { sendNewsletterBlast } = await import("@/lib/server/email");
        emailResult = await sendNewsletterBlast({
          subject: devotionTitle,
          htmlTemplate: devotionHtml,
          preferenceKey: "devotion",
        });
      } catch (err) {
        console.error("Gagal mengirim email blast renungan:", err);
      }

      return NextResponse.json({ devotionId: devotion.id || "latest", emailBlast: emailResult, ...result });
    }

    if (action === "trigger_article") {
      // Fetch latest blog post using fallback chain
      const posts = await getCollectionWithFallback<any>("blog_posts", "blog_posts.json");
      const publishedPosts = posts ? posts.filter((p: any) => p.status === "published") : [];
      
      if (publishedPosts.length === 0) {
        return NextResponse.json({ error: "Belum ada artikel blog yang dipublikasi." }, { status: 404 });
      }

      // Sort by createdAt descending
      publishedPosts.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0));
        const timeB = b.createdAt?.seconds 
          ? b.createdAt.seconds * 1000 
          : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0));
        return timeB - timeA;
      });

      const post = publishedPosts[0];
      const articleTitle = `🔔 Artikel Baru: ${post.title || ""}`;
      const articleBody = post.excerpt || "Baca artikel selengkapnya di website Grace Daily.";
      const articleUrl = `/blog/${post.id || post.slug}`;

      const { sendPushNotification } = await import("@/lib/server/push-notification");
      const result = await sendPushNotification({
        preferenceKey: "article",
        title: articleTitle,
        body: articleBody,
        url: articleUrl,
      });

      // Send email blast in background
      let emailResult = { sentCount: 0, failedCount: 0 };
      try {
        const articleHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2933; background-color: #f7f4ee; border: 1px solid #dfd8ca; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: #2a6f6f;">Grace Daily</span>
            </div>
            <h1 style="font-size: 24px; font-weight: bold; color: #14213d; margin-top: 10px; margin-bottom: 5px; text-align: center;">${post.title}</h1>
            <p style="text-align: center; font-size: 12px; color: #52606d; margin-bottom: 25px;">Kategori: ${post.category}</p>
            
            ${post.excerpt ? `
              <div style="background-color: #fffdf8; border-left: 4px solid #2a6f6f; padding: 15px; margin-bottom: 25px; border-radius: 0 8px 8px 0; font-style: italic; font-size: 14px; color: #52606d;">
                ${post.excerpt}
              </div>
            ` : ""}
            
            <div style="line-height: 1.8; font-size: 15px; color: #334155; margin-bottom: 25px;">
              ${post.body.substring(0, 1000)}${post.body.length > 1000 ? "..." : ""}
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id"}/blog/${post.id}" style="background-color: #2a6f6f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Baca Artikel Selengkapnya</a>
            </div>
          </div>
        `;
        const { sendNewsletterBlast } = await import("@/lib/server/email");
        emailResult = await sendNewsletterBlast({
          subject: articleTitle,
          htmlTemplate: articleHtml,
          preferenceKey: "article",
        });
      } catch (err) {
        console.error("Gagal mengirim email blast artikel:", err);
      }

      return NextResponse.json({ articleId: post.id || "latest", emailBlast: emailResult, ...result });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error: any) {
    console.error("Error inside admin push route:", error);
    return NextResponse.json({ error: error.message || "Gagal mengirim notifikasi." }, { status: 500 });
  }
}
