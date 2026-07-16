import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Require admin authentication
  const adminUser = await verifyAdmin(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "5429818332";
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "@gracedailybible";

  // Return config status
  const configStatus = {
    hasBotToken: !!BOT_TOKEN,
    botTokenPrefix: BOT_TOKEN ? `${BOT_TOKEN.substring(0, 10)}...` : null,
    chatId: CHAT_ID,
    channelId: CHANNEL_ID,
  };

  if (!BOT_TOKEN) {
    return NextResponse.json(
      {
        success: false,
        error: "TELEGRAM_BOT_TOKEN tidak dikonfigurasi di environment variables Vercel",
        config: configStatus,
      },
      { status: 200 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const message =
      body.message ||
      `🔔 <b>Test Telegram</b>\n\nPesan test dari Admin Dashboard Grace Daily.\n\n⏰ ${new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date())}\n\n<i>Jika pesan ini diterima, konfigurasi Telegram berfungsi dengan baik ✅</i>`;

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

    if (!response.ok || !result.ok) {
      return NextResponse.json({
        success: false,
        error: result.description || `HTTP ${response.status}`,
        telegramError: result,
        config: configStatus,
      });
    }

    return NextResponse.json({
      success: true,
      messageId: result.result?.message_id,
      config: configStatus,
      sentTo: CHAT_ID,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Unknown error",
      config: configStatus,
    });
  }
}
