import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";

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
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    let prunedEmailCount = 0;
    let prunedPushCount = 0;
    let prunedFcmCount = 0;

    // 1. Clean up inactive email subscribers (active = false) older than 30 days
    const inactiveEmails = await db
      .collection("emailSubscribers")
      .where("active", "==", false)
      .get();

    const emailsToPrune = inactiveEmails.docs.filter(doc => {
      const data = doc.data();
      if (!data.updatedAt) return false;
      const updatedTime = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
      return updatedTime < thirtyDaysAgo;
    });

    if (emailsToPrune.length > 0) {
      const batch = db.batch();
      emailsToPrune.forEach((doc) => {
        batch.delete(doc.ref);
        prunedEmailCount++;
      });
      await batch.commit();
    }

    // 2. Clean up inactive push subscribers (active = false) older than 30 days
    const inactivePush = await db
      .collection("pushSubscribers")
      .where("active", "==", false)
      .get();

    const pushToPrune = inactivePush.docs.filter(doc => {
      const data = doc.data();
      if (!data.updatedAt) return false;
      const updatedTime = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
      return updatedTime < thirtyDaysAgo;
    });

    if (pushToPrune.length > 0) {
      const batch = db.batch();
      pushToPrune.forEach((doc) => {
        batch.delete(doc.ref);
        prunedPushCount++;
      });
      await batch.commit();
    }

    // 3. Clean up stale FCM tokens (from general fcm_tokens collection) older than 90 days
    const staleFcm = await db
      .collection("fcm_tokens")
      .where("updatedAt", "<", ninetyDaysAgo)
      .get();

    if (!staleFcm.empty) {
      const batch = db.batch();
      staleFcm.forEach((doc) => {
        batch.delete(doc.ref);
        prunedFcmCount++;
      });
      await batch.commit();
    }

    // 4. Clean up old Telegram messages (older than 48 hours)
    let prunedTelegramCount = 0;
    try {
      const { cleanupTelegramMessages } = await import("@/lib/server/telegram");
      const cleanResult = await cleanupTelegramMessages();
      prunedTelegramCount = cleanResult.deletedCount;
    } catch (telegramCleanErr) {
      console.error("[Subscription Cleanup] Gagal menghapus pesan Telegram:", telegramCleanErr);
    }

    console.log(`[Subscription Cleanup] Berhasil menghapus: ${prunedEmailCount} email, ${prunedPushCount} push sub, ${prunedFcmCount} stale FCM token, ${prunedTelegramCount} telegram messages.`);

    return NextResponse.json({
      success: true,
      pruned: {
        emailSubscribers: prunedEmailCount,
        pushSubscribers: prunedPushCount,
        fcmTokens: prunedFcmCount,
        telegramMessages: prunedTelegramCount,
      }
    });
  } catch (error: any) {
    console.error("[Subscription Cleanup Error]:", error);
    return NextResponse.json({ error: error.message || "Gagal melakukan pembersihan." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
