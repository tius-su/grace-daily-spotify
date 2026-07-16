import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { runR2Backup } from "@/lib/server/backup-r2-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const serverKey = process.env.MIDTRANS_SERVER_KEY;

    if (!serverKey) {
      return NextResponse.json({ error: "Server Key not configured" }, { status: 500 });
    }

    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = body;
    
    // Verify signature
    const signatureString = order_id + status_code + gross_amount + serverKey;
    const localSignature = crypto.createHash("sha512").update(signatureString).digest("hex");

    if (localSignature !== signature_key) {
      console.warn(`[Midtrans Webhook] Signature verification failed for order ${order_id}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Database not connected" }, { status: 500 });
    }

    // Load subscription doc
    const subRef = db.collection("subscriptions").doc(order_id);
    const subDoc = await subRef.get();
    
    let userId = "";
    let planName = "Premium";
    let durationDays = 30;
    let aiRequests = 0;

    if (subDoc.exists) {
      const subData = subDoc.data();
      userId = subData?.userId || "";
      planName = subData?.planName || "Premium";
      durationDays = Number(subData?.durationDays) || 30;
      aiRequests = Number(subData?.aiRequests) || 0;
    } else {
      // Fallback: parse userId from order_id if document doesn't exist yet
      // format: ORDER-uid-timestamp or DON-uid-timestamp
      const parts = order_id.split("-");
      if (body.custom_field1) {
        userId = body.custom_field1;
      } else if (parts.length >= 3) {
        userId = parts.slice(1, -1).join("-");
      }
      planName = body.custom_field2 || planName;
      aiRequests = Number(body.custom_field3 ?? aiRequests) || 0;
      
      if (planName === "Open Donation" || planName === "donasi-open") {
        const grossAmountNum = Number(gross_amount);
        if (grossAmountNum >= 250000) {
          durationDays = 40;
        } else if (grossAmountNum >= 100000) {
          durationDays = 30;
        } else if (grossAmountNum >= 50000) {
          durationDays = 14;
        } else if (grossAmountNum >= 20000) {
          durationDays = 7;
        } else {
          durationDays = 0;
        }
      }
      
      console.warn(`[Midtrans Webhook] Doc not found for order ${order_id}, using fallback UID parsing: ${userId}`);
    }

    // Determine status
    let isSuccess = false;
    let newStatus = "pending";

    if (
      (transaction_status === "capture" && fraud_status === "accept") ||
      transaction_status === "settlement"
    ) {
      isSuccess = true;
      newStatus = "success";
    } else if (
      transaction_status === "cancel" ||
      transaction_status === "deny" ||
      transaction_status === "expire"
    ) {
      newStatus = "failed";
    } else if (transaction_status === "pending") {
      newStatus = "pending";
    }

    // Update or create subscription document
    await subRef.set({
      userId,
      planName,
      status: newStatus,
      paymentType: body.payment_type || null,
      updatedAt: new Date(),
      ...(subDoc.exists ? {} : { createdAt: new Date() })
    }, { merge: true });

    // If payment is successful, activate premium/role for the user
    if (isSuccess && userId) {
      // Validate user document existence
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        console.warn(`[Midtrans Webhook] User document not found for userId: ${userId}. Aborting activation.`);
        return NextResponse.json({ error: "User document not found" }, { status: 400 });
      }

      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt);
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      const isGuest = userId.startsWith("GUEST-");
      const benefitToken = isGuest ? crypto.randomBytes(16).toString("hex") : null;

      await db.collection("users").doc(userId).set({
        role: planName.toLowerCase() === "komunitas" ? "admin" : "premium",
        selectedPlan: planName,
        premiumActivatedAt: activatedAt,
        premiumExpiresAt: expiresAt,
        aiRequestsQuota: aiRequests,
        aiRequestsRemaining: aiRequests,
        premiumLastOrder: order_id,
        updatedAt: activatedAt,
        ...(isGuest ? { benefitToken } : {})
      }, { merge: true });

      await subRef.set({
        startedAt: activatedAt,
        expiresAt,
        aiRequests,
      }, { merge: true });

      console.log(`[Midtrans Webhook] Successfully activated ${planName} for user ${userId}`);

      // Kirim email tautan akses jika dia guest
      if (isGuest) {
        try {
          const userData = userDoc.data();
          const cleanEmail = userData?.email || "";
          if (cleanEmail) {
            const { sendEmail } = await import("@/lib/server/notify");
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.gracedaily.my.id";
            const benefitLink = `${siteUrl}/login?guestId=${userId}&token=${benefitToken}`;
            
            const emailSubject = "Tautan Akses Premium Grace Daily";
            const emailBody = `
              <h3>Terima Kasih Atas Donasi Anda!</h3>
              <p>Halo Kak <b>${userData?.name || "Mitra Grace Daily"}</b>,</p>
              <p>Kami telah menerima donasi Anda. Sebagai bentuk apresiasi, akses premium untuk perangkat Anda telah diaktifkan selama <b>${durationDays} hari</b> dengan <b>${aiRequests} kuota AI</b>.</p>
              <p>Silakan klik tombol di bawah ini untuk mengaktifkan fitur premium di browser Anda secara otomatis:</p>
              <p style="margin: 20px 0;">
                <a href="${benefitLink}" style="background-color: #2a6f6f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Aktifkan Akses Premium Sekarang</a>
              </p>
              <p>Atau salin tautan berikut ke browser Anda:<br/>
              <code>${benefitLink}</code></p>
              <hr style="border: 0; border-top: 1px solid #dfd8ca; margin: 20px 0;" />
              <p style="font-size: 12px; color: #52606d;">Tautan ini bersifat pribadi tanpa perlu login. Harap simpan email ini dengan baik.</p>
            `;
            await sendEmail(emailSubject, emailBody, cleanEmail);
            console.log(`[Midtrans Webhook] Benefit email sent to ${cleanEmail}`);
          }
        } catch (emailErr) {
          console.error("[Midtrans Webhook] Failed to send benefit email:", emailErr);
        }
      }

      // Send Telegram Notification
      try {
        const { sendTelegramSuccess } = await import("@/lib/server/telegram");
        const userData = userDoc.data();
        const userEmail = userData?.email || "Tidak ada email";
        const userDisplayName = userData?.displayName || "Tidak ada nama";
        const isDonation = planName.toLowerCase().includes("donasi") || planName.toLowerCase().includes("donation");
        
        const amountFormatted = Number(gross_amount || 0).toLocaleString("id-ID");
        const paymentMethod = body.payment_type || "-";

        if (isDonation) {
          await sendTelegramSuccess(
            "Donasi Baru via Midtrans",
            `• Pengirim: <b>${userDisplayName}</b> (<code>${userEmail}</code>)\n• Jumlah: <b>Rp ${amountFormatted}</b>\n• Metode: <b>${paymentMethod}</b>\n• Order ID: <code>${order_id}</code>`
          );
        } else {
          await sendTelegramSuccess(
            "Pembelian Paket Baru via Midtrans",
            `• Pelanggan: <b>${userDisplayName}</b> (<code>${userEmail}</code>)\n• Paket: <b>${planName}</b> (${durationDays} Hari)\n• Jumlah: <b>Rp ${amountFormatted}</b>\n• Metode: <b>${paymentMethod}</b>\n• Order ID: <code>${order_id}</code>`
          );
        }
      } catch (telegramErr) {
        console.error("[Midtrans Webhook] Failed to send Telegram notification:", telegramErr);
      }

      // Trigger automatic backup to Cloudflare R2
      runR2Backup()
        .then(() => console.log("[Midtrans Webhook] Auto backup to R2 triggered successfully"))
        .catch(err => console.error("[Midtrans Webhook] Auto backup to R2 failed:", err));
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("[Midtrans Webhook Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
