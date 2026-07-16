import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/contact
 * Receives contact form submissions and forwards them to admin via Telegram bot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body as {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
    };

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Nama, email, dan pesan wajib diisi." },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid." },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const safeName = String(name).substring(0, 100).replace(/[<>]/g, "");
    const safeEmail = String(email).substring(0, 200);
    const safeSubject = String(subject || "Pesan dari Website").substring(0, 200).replace(/[<>]/g, "");
    const safeMessage = String(message).substring(0, 2000).replace(/[<>]/g, "");

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      console.warn("[Contact API] Telegram not configured, logging contact message.");
      // Even if Telegram is not configured, return success to user
      console.log(`[Contact] From: ${safeName} <${safeEmail}> | Subject: ${safeSubject}`);
      return NextResponse.json({ success: true });
    }

    const now = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date());

    const telegramMessage = `📬 <b>Pesan Kontak Baru!</b>

👤 <b>Nama:</b> ${safeName}
📧 <b>Email:</b> ${safeEmail}
📝 <b>Subjek:</b> ${safeSubject}
🕐 <b>Waktu:</b> ${now}

━━━━━━━━━━━━━━━━━━━━
<b>💬 Isi Pesan:</b>
━━━━━━━━━━━━━━━━━━━━
${safeMessage}

<i>Dikirim melalui form kontak Grace Daily</i>`;

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: telegramMessage,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[Contact API] Telegram send failed:", err);
      // Still return success to avoid exposing internal errors
    } else {
      console.log("[Contact API] Message forwarded to Telegram admin successfully.");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Contact API] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
