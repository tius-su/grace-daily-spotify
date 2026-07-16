import { NextResponse } from "next/server";
import { runR2Backup } from "@/lib/server/backup-r2-service";
import { sendTelegramNotification } from "@/lib/server/telegram";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { Firestore } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

/**
 * Check if today's backup already ran
 */
async function isTodayBackupDone(db: FirebaseFirestore.Firestore): Promise<boolean> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const snapshot = await db
    .collection("backup_logs")
    .where("type", "==", "daily")
    .where("date", "==", today)
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * Save backup log
 */
async function saveBackupLog(
  db: FirebaseFirestore.Firestore,
  result: any
): Promise<void> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  await db.collection("backup_logs").add({
    type: "daily",
    date: today,
    status: result.status,
    files: result.files || [],
    error: result.error,
    createdAt: new Date(),
  });
}

/**
 * Authorization check
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const customCronHeader = request.headers.get("x-cron-secret") || "";

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || url.searchParams.get("cron_secret");

  if (!secret) {
    console.log("[cron/daily-backup] No CRON_SECRET set — allowing request.");
    return true;
  }

  const authorized =
    authHeader === `Bearer ${secret}` ||
    querySecret === secret ||
    customCronHeader === secret;

  return authorized;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Firebase Admin belum dikonfigurasi." },
      { status: 503 }
    );
  }

  try {
    // Check if already ran today (prevent duplicate)
    const alreadyDone = await isTodayBackupDone(db);
    if (alreadyDone) {
      return NextResponse.json({
        success: true,
        message: "Daily backup already completed today.",
        skipped: true,
      });
    }

    // Run backup
    console.log("[cron/daily-backup] Starting daily R2 backup...");
    const result = await runR2Backup();

    // Save log
    await saveBackupLog(db, result);

    // Send Telegram notification
    try {
      const statusEmoji = result.status === "success" ? "✅" : "❌";
      const filesCount = result.files?.length || 0;
      await sendTelegramNotification(
        `${statusEmoji} <b>Daily Backup Report</b>\n\n` +
        `<b>Status:</b> ${result.status}\n` +
        `<b>Files:</b> ${filesCount}\n` +
        `<b>Time:</b> ${new Date().toISOString()}`
      );
    } catch (telegramError) {
      console.error(
        "[cron/daily-backup] Failed to send Telegram notification:",
        telegramError
      );
    }

    return NextResponse.json({
      success: result.status === "success",
      ...result,
    });
  } catch (error: any) {
    console.error("[cron/daily-backup] Backup failed:", error);
    return NextResponse.json(
      { error: error.message || "Daily backup failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return GET(request);
}
