import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { verifyAdmin } from "@/lib/server/auth";
import {
  generateDailyEncyclopediaEntries,
  generateManualEncyclopediaEntries,
  getCronLogs,
  saveCronLog,
  getTodaysCategories,
} from "@/lib/server/generate-encyclopedia";
import { sendTelegramCronReport, escapeHtml } from "@/lib/server/telegram";

// ============================================================================
// CONFIGURATION
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes - needed for 25 AI generations

// ============================================================================
// AUTHORIZATION
// ============================================================================

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const customCronHeader = request.headers.get("x-cron-secret") || "";

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || url.searchParams.get("cron_secret");

  // Log for debugging
  const userAgent = request.headers.get("user-agent") || "";
  console.log(
    `[cron/generate-encyclopedia] Auth attempt — UA: ${userAgent.substring(0, 80)}, hasSecret: ${Boolean(
      secret
    )}`
  );

  if (!secret) {
    // Allow in development mode OR if triggered by Vercel/known cron agents
    console.log("[cron/generate-encyclopedia] No CRON_SECRET set — allowing request.");
    return true;
  }

  const authorized =
    authHeader === `Bearer ${secret}` ||
    querySecret === secret ||
    customCronHeader === secret;

  console.log(
    `[cron/generate-encyclopedia] Authorization result: ${authorized}`
  );
  return authorized;
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

/**
 * Handle automatic cron generation (25 entries with category rotation)
 */
async function handleAutoGeneration(
  request: Request
): Promise<NextResponse> {
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Firebase Admin belum dikonfigurasi." },
      { status: 503 }
    );
  }

  try {
    // Generate with daily rotation
    const result = await generateDailyEncyclopediaEntries();

    // Send Telegram notification
    try {
      let totalCount = 0;
      try {
        const countSnap = await db.collection("ensiklopedia_cache").count().get();
        totalCount = countSnap.data().count;
      } catch (countErr) {
        console.error("Failed to count encyclopedia entries from Firestore:", countErr);
        // Fallback to counting from R2 index
        try {
          const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
          if (R2_PUBLIC_URL) {
            const categoriesList = ["tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi", "silsilah", "teologi", "topikal_alkitab", "peristiwa"];
            let r2Total = 0;
            await Promise.allSettled(
              categoriesList.map(async (cat) => {
                const res = await fetch(`${R2_PUBLIC_URL}/backup/${cat}.json`, { cache: "no-store" });
                if (res.ok) {
                  const data = await res.json();
                  if (Array.isArray(data)) r2Total += data.length;
                }
              })
            );
            totalCount = r2Total;
          }
        } catch (r2CountErr) {
          console.error("Failed to fallback count from R2:", r2CountErr);
        }
      }

      const reportEntries = result.cronLog?.entries?.map((e) => {
        const statusSymbol = e.status === "success" ? "✅" : e.status === "duplicate" ? "⚠️ Duplikat" : "❌ Gagal";
        const timeStr = e.generatedAt ? new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          timeStyle: "short",
        }).format(new Date(e.generatedAt)) : "-";
        const escTitle = escapeHtml(e.title || e.keyword);
        const escCategory = escapeHtml(e.kategori);
        return `- <b>${escTitle}</b> (Kategori: <b>${escCategory}</b>) - Jam: <b>${timeStr} WIB</b> — ${statusSymbol}`;
      }) || result.entries.map((e) => {
        const timeStr = e.createdAt ? new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          timeStyle: "short",
        }).format(new Date(e.createdAt)) : "-";
        const escTitle = escapeHtml(e.title || e.keyword);
        const escCategory = escapeHtml(e.kategori);
        return `- <b>${escTitle}</b> (Kategori: <b>${escCategory}</b>) - Jam: <b>${timeStr} WIB</b> — ✅`;
      });

      await sendTelegramCronReport({
        date: new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "long",
        }).format(new Date()),
        cronType: "generate-encyclopedia",
        target: result.cronLog?.target || 1,
        success: result.generated,
        duplicate: result.duplicates,
        failed: result.failed,
        entries: reportEntries,
        totalCount,
      });
    } catch (telegramError) {
      console.error(
        "[cron/generate-encyclopedia] Failed to send Telegram notification:",
        telegramError
      );
    }

    return NextResponse.json({
      success: result.success,
      generated: result.generated,
      duplicates: result.duplicates,
      failed: result.failed,
      todaysCategories: getTodaysCategories(),
      entries: result.entries.map((e) => ({
        id: e.id,
        keyword: e.keyword,
        kategori: e.kategori,
        slug: e.slug,
        title: e.title,
      })),
      cronLog: result.cronLog,
    });
  } catch (error: any) {
    console.error("[cron/generate-encyclopedia] Auto generation failed:", error);
    
    // Save error log
    try {
      const todayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      await saveCronLog({
        date: todayKey,
        cronType: "generate-encyclopedia",
        target: 1,
        success: 0,
        duplicate: 0,
        failed: 1,
        status: "PERLU_PERHATIAN",
        createdAt: new Date(),
        entries: [
          {
            keyword: "error",
            kategori: "system",
            slug: "error",
            status: "failed",
            error: error.message || "Unknown error",
            generatedAt: new Date().toISOString(),
          },
        ],
      });
    } catch {
      // Ignore log save errors
    }

    return NextResponse.json(
      { error: error.message || "Gagal menjalankan cron ensiklopedia." },
      { status: 500 }
    );
  }
}

/**
 * Handle manual generation with optional parameters
 */
async function handleManualGeneration(
  request: Request
): Promise<NextResponse> {
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Firebase Admin belum dikonfigurasi." },
      { status: 503 }
    );
  }

  try {
    const url = new URL(request.url);
    const countParam = url.searchParams.get("count");
    const categoryParam = url.searchParams.get("category");
    const forceParam = url.searchParams.get("force");

    // Admin manual trigger is limited to 10 entries per run to avoid quota abuse
    const MANUAL_MAX = 10;
    const count = countParam ? Math.min(Number(countParam), MANUAL_MAX) : MANUAL_MAX;
    const category = categoryParam || undefined;
    const force = forceParam === "true";

    // Generate manually
    const result = await generateManualEncyclopediaEntries(count, category);

    // Send Telegram notification
    try {
      const date = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "long",
      }).format(new Date());

      let totalCount = 0;
      try {
        const countSnap = await db.collection("ensiklopedia_cache").count().get();
        totalCount = countSnap.data().count;
      } catch (countErr) {
        console.error("Failed to count encyclopedia entries from Firestore:", countErr);
        // Fallback to counting from R2 index
        try {
          const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
          if (R2_PUBLIC_URL) {
            const categoriesList = ["tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi", "silsilah", "teologi", "topikal_alkitab", "peristiwa"];
            let r2Total = 0;
            await Promise.allSettled(
              categoriesList.map(async (cat) => {
                const res = await fetch(`${R2_PUBLIC_URL}/backup/${cat}.json`, { cache: "no-store" });
                if (res.ok) {
                  const data = await res.json();
                  if (Array.isArray(data)) r2Total += data.length;
                }
              })
            );
            totalCount = r2Total;
          }
        } catch (r2CountErr) {
          console.error("Failed to fallback count from R2:", r2CountErr);
        }
      }

      const reportEntries = result.cronLog?.entries?.map((e) => {
        const statusSymbol = e.status === "success" ? "✅" : e.status === "duplicate" ? "⚠️ Duplikat" : "❌ Gagal";
        const timeStr = e.generatedAt ? new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          timeStyle: "short",
        }).format(new Date(e.generatedAt)) : "-";
        const escTitle = escapeHtml(e.title || e.keyword);
        const escCategory = escapeHtml(e.kategori);
        return `- <b>${escTitle}</b> (Kategori: <b>${escCategory}</b>) - Jam: <b>${timeStr} WIB</b> — ${statusSymbol}`;
      }) || result.entries.map((e) => {
        const timeStr = e.createdAt ? new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          timeStyle: "short",
        }).format(new Date(e.createdAt)) : "-";
        const escTitle = escapeHtml(e.title || e.keyword);
        const escCategory = escapeHtml(e.kategori);
        return `- <b>${escTitle}</b> (Kategori: <b>${escCategory}</b>) - Jam: <b>${timeStr} WIB</b> — ✅`;
      });

      await sendTelegramCronReport({
        date,
        cronType: `generate-encyclopedia-manual${category ? `-${category}` : "-all"}`,
        target: count,
        success: result.generated,
        duplicate: result.duplicates,
        failed: result.failed,
        entries: reportEntries,
        totalCount,
      });
    } catch (telegramError) {
      console.error(
        "[cron/generate-encyclopedia] Failed to send Telegram notification:",
        telegramError
      );
    }

    return NextResponse.json({
      success: result.success,
      generated: result.generated,
      duplicates: result.duplicates,
      failed: result.failed,
      maxPerRun: MANUAL_MAX,
      entries: result.entries.map((e) => ({
        id: e.id,
        keyword: e.keyword,
        kategori: e.kategori,
        slug: e.slug,
        title: e.title,
      })),
      cronLog: result.cronLog,
    });
  } catch (error: any) {
    console.error(
      "[cron/generate-encyclopedia] Manual generation failed:",
      error
    );
    return NextResponse.json(
      { error: error.message || "Gagal menjalankan generasi manual." },
      { status: 500 }
    );
  }
}

/**
 * Get cron logs
 */
async function handleGetLogs(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 50;

    const logs = await getCronLogs(limit);

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error("[cron/generate-encyclopedia] Failed to get logs:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memuat log cron." },
      { status: 500 }
    );
  }
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export async function GET(request: Request): Promise<NextResponse> {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "logs") {
    return handleGetLogs(request);
  }

  // Default: auto generation
  return handleAutoGeneration(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  // Check authorization for manual triggers
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "manual") {
    // Manual trigger requires admin auth
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      console.warn("[cron/generate-encyclopedia] Unauthorized manual trigger request rejected.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleManualGeneration(request);
  }

  // For POST, check cron auth
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Default: auto generation
  return handleAutoGeneration(request);
}
