import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, devotionEnabled, articleEnabled } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Alamat email tidak valid." }, { status: 400 });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Database tidak tersedia." }, { status: 500 });
    }

    const docId = sanitizedEmail;
    const subscriberRef = db.collection("emailSubscribers").doc(docId);
    const docSnap = await subscriberRef.get();

    const devotionPref = devotionEnabled !== false;
    const articlePref = articleEnabled !== false;

    if (docSnap.exists) {
      const data = docSnap.data();
      // Update preferences and reactivate
      await subscriberRef.update({
        devotionEnabled: devotionPref,
        articleEnabled: articlePref,
        active: true,
        updatedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: "Langganan Anda telah diperbarui.",
        token: data?.unsubscribeToken,
      });
    } else {
      // Create new subscription with secure random token
      const unsubscribeToken = crypto.randomBytes(32).toString("hex");
      
      await subscriberRef.set({
        email: sanitizedEmail,
        devotionEnabled: devotionPref,
        articleEnabled: articlePref,
        active: true,
        unsubscribeToken,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Send Telegram notification for new subscriber
      try {
        const { sendTelegramSuccess } = await import("@/lib/server/telegram");
        await sendTelegramSuccess(
          "Subscriber Email Baru",
          `• Email: <code>${sanitizedEmail}</code>\n• Renungan: <b>${devotionPref ? "Aktif" : "Nonaktif"}</b>\n• Artikel: <b>${articlePref ? "Aktif" : "Nonaktif"}</b>`
        );
      } catch (telegramErr) {
        console.error("Failed to send Telegram notification:", telegramErr);
      }

      return NextResponse.json({
        success: true,
        message: "Berhasil berlangganan harian Grace Daily.",
        token: unsubscribeToken,
      });
    }
  } catch (error: any) {
    console.error("[Subscribe Email API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses langganan." },
      { status: 500 }
    );
  }
}
