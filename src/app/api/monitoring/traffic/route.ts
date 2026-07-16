import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/monitoring/traffic
 * Sends a traffic/status report to Telegram channel
 * Protected by CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || url.searchParams.get("cron_secret");
  const authHeader = request.headers.get("authorization") || "";

  const authorized =
    !cronSecret ||
    querySecret === cronSecret ||
    authHeader === `Bearer ${cronSecret}`;

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";
  const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

  if (!BOT_TOKEN || !CHAT_ID) {
    return NextResponse.json({ error: "Telegram not configured" }, { status: 503 });
  }

  // Gather statistics from R2
  let devotionCount = 0;
  let articleCount = 0;
  let encyclopediaTotal = 0;

  try {
    if (R2_PUBLIC_URL) {
      const [renunganRes, articlesRes, tokohRes] = await Promise.allSettled([
        fetch(`${R2_PUBLIC_URL}/renungan.json`, { cache: "no-store" }),
        fetch(`${R2_PUBLIC_URL}/articles/index.json`, { cache: "no-store" }),
        fetch(`${R2_PUBLIC_URL}/backup/tokoh.json`, { cache: "no-store" }),
      ]);

      if (renunganRes.status === "fulfilled" && renunganRes.value.ok) {
        const data = await renunganRes.value.json();
        if (Array.isArray(data)) devotionCount = data.length;
      }
      if (articlesRes.status === "fulfilled" && articlesRes.value.ok) {
        const data = await articlesRes.value.json();
        if (Array.isArray(data)) articleCount = data.length;
      }
      if (tokohRes.status === "fulfilled" && tokohRes.value.ok) {
        const data = await tokohRes.value.json();
        if (Array.isArray(data)) encyclopediaTotal = data.length; // at minimum tokoh count
      }
    }
  } catch (err) {
    console.error("[Traffic Monitor] R2 stats fetch failed:", err);
  }

  const now = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const message = `📡 <b>Status Monitoring Grace Daily</b>

🕐 <b>Waktu:</b> ${now}

━━━━━━━━━━━━━━━━━━━━
📊 <b>Statistik Konten (R2)</b>
━━━━━━━━━━━━━━━━━━━━
• 🌅 Renungan Harian: <b>${devotionCount}</b>
• ✍️ Artikel Blog: <b>${articleCount}</b>
• 📚 Ensiklopedia (Tokoh+): <b>${encyclopediaTotal}+</b>

━━━━━━━━━━━━━━━━━━━━
🌐 <b>Status Server</b>
━━━━━━━━━━━━━━━━━━━━
• Website: <a href="${APP_URL}">🟢 Online</a>
• API: 🟢 Aktif

<i>Laporan otomatis Grace Daily Monitoring System</i>`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    const result = await response.json();
    if (!result.ok) {
      console.error("[Traffic Monitor] Telegram send failed:", result);
      return NextResponse.json({ error: "Telegram send failed", detail: result }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      stats: { devotionCount, articleCount, encyclopediaTotal },
    });
  } catch (error: any) {
    console.error("[Traffic Monitor] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
