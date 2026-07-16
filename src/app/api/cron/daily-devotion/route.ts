import { generateDailyDevotion } from "@/lib/server/daily-devotion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutes — needed for AI generation and image upload

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const customCronHeader = request.headers.get("x-cron-secret") || "";
  const userAgent = request.headers.get("user-agent") || "";

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || url.searchParams.get("cron_secret");

  // Log for debugging
  console.log(`[cron/daily-devotion] Auth attempt — UA: ${userAgent.substring(0, 80)}, hasSecret: ${Boolean(secret)}`);

  if (!secret) {
    // Allow in development mode OR if triggered by Vercel/known cron agents
    console.log("[cron/daily-devotion] No CRON_SECRET set — allowing request.");
    return true;
  }

  const authorized =
    authHeader === `Bearer ${secret}` ||
    querySecret === secret ||
    customCronHeader === secret;

  console.log(`[cron/daily-devotion] Authorization result: ${authorized}`);
  return authorized;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";
    const result = await generateDailyDevotion(new Date(), { force });
    
    if (result && (result.created || (force && (result as any).regenerated))) {
      try {
        const { getAdminDb } = await import("@/lib/server/firebase-admin");
        const db = getAdminDb();
        if (db) {
          const docSnap = await db.collection("daily_devotions").doc(result.id).get();
          if (docSnap.exists) {
            const devotion = docSnap.data();
            if (devotion) {
              const devotionTitle = `🌅 Renungan Harian: ${devotion.title || "Hari Ini"}`;
              const devotionBody = `${devotion.verseRef || ""}: "${(devotion.verseText || "").substring(0, 80)}..."`;
              
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";
              const devotionEmailSubject = `Renungan Harian: ${devotion.title || "Hari Ini"}`;
              
              const bodyHtml = (devotion.body || "")
                .split("\n")
                .map((p: string) => `<p style="line-height: 1.8; margin-bottom: 15px;">${p.trim()}</p>`)
                .join("");

              const prayerHtml = devotion.prayer
                ? `<div style="margin-top: 25px; padding: 15px; border-left: 4px solid #9C7C54; background-color: #F3ECE0; font-style: italic;">
                    <strong style="display: block; font-style: normal; color: #9C7C54; font-size: 12px; text-transform: uppercase; margin-bottom: 5px;">Doa Hari Ini</strong>
                    ${devotion.prayer}
                   </div>`
                : "";

              const devotionEmailHtml = `
                <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FAF6EE; color: #2D2924; border: 1px solid #E5D5C0;">
                  <h2 style="text-align: center; color: #9C7C54; font-family: sans-serif; font-size: 24px; letter-spacing: 2px;">GRACE DAILY</h2>
                  <hr style="border: 0; border-top: 1px solid #E5D5C0; margin-bottom: 20px;" />
                  
                  ${devotion.bannerUrl || devotion.imageUrl ? `<img src="${devotion.bannerUrl || devotion.imageUrl}" alt="${devotion.title}" style="width: 100%; border-radius: 8px; margin-bottom: 20px;" />` : ""}
                  
                  <span style="font-size: 11px; font-weight: bold; color: #9C7C54; text-transform: uppercase; letter-spacing: 1.5px;">Renungan Harian Kristen</span>
                  <h1 style="font-size: 28px; margin-top: 10px; margin-bottom: 15px; color: #2D2924; line-height: 1.3;">${devotion.title}</h1>
                  
                  <div style="margin-bottom: 25px; padding: 15px; background-color: #F3ECE0; border-radius: 6px; border-left: 4px solid #9C7C54;">
                    <p style="font-size: 12px; font-weight: bold; color: #9C7C54; text-transform: uppercase; margin: 0 0 5px 0;">Ayat Harian: ${devotion.verseRef}</p>
                    <blockquote style="font-size: 16px; font-style: italic; color: #2D2924; margin: 0; line-height: 1.5;">"${devotion.verseText}"</blockquote>
                  </div>
                  
                  <div style="font-size: 16px; line-height: 1.8; color: #332F2A;">
                    ${bodyHtml}
                  </div>
                  
                  ${prayerHtml}
                  
                  <p style="text-align: center; margin-top: 35px;">
                    <a href="${appUrl}/renungan/${result.id}" style="background-color: #9C7C54; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-family: sans-serif; display: inline-block;">Baca Selengkapnya di Website</a>
                  </p>
                  <!-- UNSUBSCRIBE_LINK_PLACEHOLDER -->
                </div>
              `;

              // Trigger all integrations and notifications in parallel to optimize execution speed
              await Promise.allSettled([
                // 1. Push notifications
                (async () => {
                  try {
                    const { sendPushNotification } = await import("@/lib/server/push-notification");
                    await sendPushNotification({
                      preferenceKey: "devotion",
                      title: devotionTitle,
                      body: devotionBody,
                      url: `/renungan/${result.id}`,
                    });
                    console.log("[cron/daily-devotion] Push notification sent successfully.");
                  } catch (err) {
                    console.error("[cron/daily-devotion] Failed to send push notification:", err);
                  }
                })(),
                // 2. Email newsletter blast
                (async () => {
                  try {
                    const { sendNewsletterBlast } = await import("@/lib/server/email");
                    await sendNewsletterBlast({
                      subject: devotionEmailSubject,
                      htmlTemplate: devotionEmailHtml,
                      preferenceKey: "devotion",
                    });
                    console.log("[cron/daily-devotion] Email newsletter blast completed.");
                  } catch (err) {
                    console.error("[cron/daily-devotion] Email blast failed:", err);
                  }
                })(),
                // 3. Cloudflare R2 Index Backup
                (async () => {
                  try {
                    const { syncSingleDevotion } = await import("@/lib/server/backup-r2-service");
                    await syncSingleDevotion(result.id, devotion);
                    console.log("[cron/daily-devotion] Incremental R2 and D1 sync completed successfully.");
                  } catch (err) {
                    console.error("[cron/daily-devotion] Incremental R2 and D1 sync failed:", err);
                  }
                })(),
                // 4. Telegram channel post
                (async () => {
                  try {
                    const { reportNewDevotionTelegram } = await import("@/lib/server/telegram");
                    await reportNewDevotionTelegram({
                      id: result.id,
                      title: devotion.title,
                      verseRef: devotion.verseRef,
                      verseText: devotion.verseText,
                    });
                    console.log("[cron/daily-devotion] Telegram channel post completed.");
                  } catch (err) {
                    console.error("[cron/daily-devotion] Telegram posting failed:", err);
                  }
                })()
              ]);
            }
          }
        }
      } catch (pushErr) {
        console.error("Failed to trigger devotion push notification/email:", pushErr);
      }
    }

    // Trigger Telegram Cron Report
    try {
      const { sendTelegramCronReport, escapeHtml } = await import("@/lib/server/telegram");
      const isNew = result && (result.created || (force && (result as any).regenerated));
      const entryTitle = isNew ? (result.title || "Renungan Hari Ini") : `Renungan sudah ada (${result?.id || ""})`;
      
      await sendTelegramCronReport({
        date: new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "long",
        }).format(new Date()),
        cronType: "daily-devotion",
        target: 1,
        success: isNew ? 1 : 0,
        duplicate: !isNew ? 1 : 0,
        failed: 0,
        entries: [`- 🌅 <b>${escapeHtml(entryTitle)}</b> — ${isNew ? (force && (result as any).regenerated ? "✅ Diregenerasi" : "✅ Berhasil") : "⚠️ Duplikat (Skipped)"}`],
      });
      console.log("[cron/daily-devotion] Telegram cron report sent successfully.");
    } catch (telegramErr) {
      console.error("[cron/daily-devotion] Failed to send Telegram cron report:", telegramErr);
    }

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat renungan harian.";

    // Trigger Telegram Cron Failure Report
    try {
      const { sendTelegramCronReport, escapeHtml } = await import("@/lib/server/telegram");
      await sendTelegramCronReport({
        date: new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "long",
        }).format(new Date()),
        cronType: "daily-devotion",
        target: 1,
        success: 0,
        duplicate: 0,
        failed: 1,
        entries: [`- ❌ <b>Error:</b> ${escapeHtml(message)}`],
      });
    } catch (telegramErr) {
      console.error("[cron/daily-devotion] Failed to send Telegram failure cron report:", telegramErr);
    }

    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
