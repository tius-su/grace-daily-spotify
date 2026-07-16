import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

type PayPalCaptureRequest = {
  orderId: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCity?: string;
  planName?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PayPalCaptureRequest;
    
    if (!body.orderId || !body.amount) {
      return Response.json(
        { error: "orderId dan amount wajib diisi." },
        { status: 400 }
      );
    }

    const authToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    let userId = "";
    let decoded: any = null;

    if (authToken && adminAuth) {
      try {
        decoded = await adminAuth.verifyIdToken(authToken);
        userId = decoded.uid;
      } catch (err) {
        console.warn("[PayPal Capture] AuthToken verify failed:", err);
      }
    }

    if (!userId) {
      if (body.customerEmail) {
        const cleanEmail = body.customerEmail.toLowerCase().replace(/[^a-z0-9@.]/g, "");
        userId = `GUEST-${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;
      } else {
        return Response.json({ error: "Login atau data email diperlukan untuk memproses donasi." }, { status: 401 });
      }
    }

    if (!db) {
      return Response.json(
        { error: "Layanan database sedang tidak tersedia. Silakan coba beberapa saat lagi." },
        { status: 503 }
      );
    }

    // PayPal API Credentials
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_LIVE_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_LIVE_SECRET_ID;

    // Fallback sandbox credentials for local dev if secret is not set
    const activeClientId = clientId || "AV-qbXdZ7YTsWJEBugrHBNIFNLG14bvAqYOFc3dDDmmZ8bwG-5fSIE9GLVu5K3ja1CXP5wZvHFaEpnt5";
    const activeClientSecret = clientSecret || "EEZNWvN91sUQhWdg_IgaMgZ49oJjokg-rPFAXh_GZhsjROXkAQKLAhmit8pdtZ9iLYpNxc98002Twqxo";
    
    const isSandbox = !clientSecret;
    const paypalHost = isSandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

    console.log(`[PayPal API] Verifying order ${body.orderId} in ${isSandbox ? "Sandbox" : "Production"} mode.`);

    // 1. Get PayPal Access Token
    const authString = Buffer.from(`${activeClientId}:${activeClientSecret}`).toString("base64");
    const tokenRes = await fetch(`${paypalHost}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      console.error("[PayPal API] Failed to get OAuth2 token:", errData);
      return Response.json({ error: "Gagal menghubungkan ke server PayPal." }, { status: 502 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch Order Details from PayPal REST API
    const orderRes = await fetch(`${paypalHost}/v2/checkout/orders/${body.orderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!orderRes.ok) {
      const errData = await orderRes.json().catch(() => ({}));
      console.error("[PayPal API] Failed to fetch order details:", errData);
      return Response.json({ error: "Gagal memverifikasi transaksi dengan PayPal." }, { status: 502 });
    }

    const payPalOrder = await orderRes.json();
    console.log(`[PayPal API] Order status retrieved: ${payPalOrder.status}`);

    if (payPalOrder.status !== "COMPLETED" && payPalOrder.status !== "APPROVED") {
      return Response.json(
        { error: `Transaksi belum selesai. Status PayPal: ${payPalOrder.status}` },
        { status: 400 }
      );
    }

    const purchaseUnit = payPalOrder.purchase_units?.[0];
    const capturedAmount = parseFloat(
      purchaseUnit?.payments?.captures?.[0]?.amount?.value || 
      purchaseUnit?.amount?.value || 
      body.amount.toString()
    );

    if (isNaN(capturedAmount) || capturedAmount <= 0) {
      return Response.json({ error: "Nilai nominal transaksi PayPal tidak valid." }, { status: 400 });
    }

    // Load donation configuration rules from Firestore
    let durationDaysPerMultiplier = 30;
    let aiRequestsPerMultiplier = 50;
    let usdMultiplier = 1.5;

    try {
      const configSnap = await db.collection("settings").doc("donation").get();
      if (configSnap.exists) {
        const configData = configSnap.data();
        durationDaysPerMultiplier = Number(configData?.durationDaysPerMultiplier) || 30;
        aiRequestsPerMultiplier = Number(configData?.aiRequestsPerMultiplier) || 50;
        usdMultiplier = Number(configData?.multiplierUsd) || 1.5;
      }
    } catch (e) {
      console.warn("[PayPal API] Failed to load donation settings from Firestore:", e);
    }

    const durationDays = Math.floor((capturedAmount / usdMultiplier) * durationDaysPerMultiplier);
    const aiRequests = Math.floor((capturedAmount / usdMultiplier) * aiRequestsPerMultiplier);

    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const isGuest = userId.startsWith("GUEST-");
    const crypto = await import("crypto");
    const benefitToken = isGuest ? crypto.randomBytes(16).toString("hex") : null;

    // 3. Update User Profile in Firestore
    await db.collection("users").doc(userId).set({
      role: "premium",
      selectedPlan: "Open Donation",
      premiumActivatedAt: activatedAt,
      premiumExpiresAt: expiresAt,
      aiRequestsQuota: aiRequests,
      aiRequestsRemaining: aiRequests,
      premiumLastOrder: body.orderId,
      updatedAt: activatedAt,
      ...(isGuest ? { benefitToken } : {})
    }, { merge: true });

    // 4. Save completed subscription record in Firestore
    await db.collection("subscriptions").doc(body.orderId).set({
      userId,
      planName: "Open Donation",
      amount: capturedAmount,
      currency: "USD",
      durationDays,
      aiRequests,
      status: "completed",
      gateway: "paypal",
      customerName: body.customerName || (decoded ? (decoded.name || decoded.email?.split("@")[0]) : "Grace Daily Donor"),
      customerEmail: body.customerEmail || (decoded ? decoded.email : null),
      customerPhone: body.customerPhone || null,
      customerCity: body.customerCity || null,
      createdAt: activatedAt,
      updatedAt: activatedAt,
    });

    console.log(`[PayPal API] Successfully activated premium access for user ${userId} via PayPal capture.`);

    // Kirim email tautan akses jika dia guest
    if (isGuest && body.customerEmail) {
      try {
        const { sendEmail } = await import("@/lib/server/notify");
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.gracedaily.my.id";
        const benefitLink = `${siteUrl}/login?guestId=${userId}&token=${benefitToken}`;
        
        const emailSubject = "Tautan Akses Premium Grace Daily (Donasi PayPal)";
        const emailBody = `
          <h3>Terima Kasih Atas Donasi Anda!</h3>
          <p>Halo Kak <b>${body.customerName || "Mitra Grace Daily"}</b>,</p>
          <p>Kami telah menerima donasi Anda melalui PayPal sebesar <b>$${capturedAmount.toFixed(2)} USD</b>. Sebagai bentuk apresiasi, akses premium untuk perangkat Anda telah diaktifkan selama <b>${durationDays} hari</b> dengan <b>${aiRequests} kuota AI</b>.</p>
          <p>Silakan klik tombol di bawah ini untuk mengaktifkan fitur premium di browser Anda secara otomatis:</p>
          <p style="margin: 20px 0;">
            <a href="${benefitLink}" style="background-color: #2a6f6f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Aktifkan Akses Premium Sekarang</a>
          </p>
          <p>Atau salin tautan berikut ke browser Anda:<br/>
          <code>${benefitLink}</code></p>
          <hr style="border: 0; border-top: 1px solid #dfd8ca; margin: 20px 0;" />
          <p style="font-size: 12px; color: #52606d;">Tautan ini bersifat pribadi tanpa perlu login. Harap simpan email ini dengan baik.</p>
        `;
        await sendEmail(emailSubject, emailBody, body.customerEmail);
        console.log(`[PayPal API] Benefit email sent to ${body.customerEmail}`);
      } catch (emailErr) {
        console.error("[PayPal API] Failed to send benefit email:", emailErr);
      }
    }

    return Response.json({
      success: true,
      amount: capturedAmount,
      durationDays,
      aiRequests,
    });
  } catch (error: any) {
    console.error("[PayPal API Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan internal server." },
      { status: 500 }
    );
  }
}
