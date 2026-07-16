import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";

type MidtransRequest = {
  orderId?: string;
  grossAmount?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCity?: string;
  planName?: string;
  durationDays?: number;
  aiRequests?: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MidtransRequest;
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    const isProduction =
      (process.env.MIDTRANS_IS_PRODUCTION ?? process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION) !== "false";

    if (!body.orderId || !body.grossAmount || !body.planName) {
      console.warn("[Midtrans API] Validation failed: missing required parameters", body);
      return Response.json(
        { error: "orderId, grossAmount, dan planName wajib diisi." },
        { status: 400 },
      );
    }

    const authToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    const isDonation = body.planName === "donasi-open" || body.planName === "Open Donation";
    let userId = "";
    let decoded: any = null;

    if (authToken && adminAuth) {
      try {
        decoded = await adminAuth.verifyIdToken(authToken);
        userId = decoded.uid;
      } catch (err) {
        console.warn("[Midtrans API] Token verification failed:", err);
      }
    }

    if (!userId) {
      if (isDonation) {
        const email = body.customerEmail || "guest@gracedaily.my.id";
        const cleanEmail = email.toLowerCase().replace(/[^a-z0-9@.]/g, "");
        const cleanName = (body.customerName || "Mitra Grace Daily").substring(0, 100);
        userId = `GUEST-${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;

        if (db) {
          try {
            await db.collection("users").doc(userId).set({
              email: cleanEmail,
              name: cleanName,
              role: "free",
              createdAt: new Date(),
              updatedAt: new Date()
            }, { merge: true });
            console.log(`[Midtrans API] Created/updated guest user: ${userId}`);
          } catch (e) {
            console.error("[Midtrans API] Failed to create guest user document:", e);
          }
        }
      } else {
        return Response.json({ error: "Login diperlukan untuk membeli paket." }, { status: 401 });
      }
    }

    if (decoded && !body.orderId.startsWith(`ORDER-${userId}-`) && !body.orderId.startsWith(`DON-${userId}-`)) {
      console.warn(`[Midtrans API] Validation failed: orderId/userId mismatch. orderId: ${body.orderId}, userId: ${userId}`);
      return Response.json({ error: "Order ID tidak sesuai dengan pengguna login." }, { status: 400 });
    }

    let grossAmount = Number(body.grossAmount);
    let planName = isDonation ? "Open Donation" : body.planName;
    let durationDays = 30;
    let aiRequests = 0;

    if (isDonation) {
      if (grossAmount < 20000) {
        console.warn(`[Midtrans API] Validation failed: donation grossAmount ${grossAmount} < 20000`);
        return Response.json(
          { error: "Nominal donasi minimal Rp20.000." },
          { status: 400 },
        );
      }
      if (grossAmount >= 250000) {
        durationDays = 40;
      } else if (grossAmount >= 100000) {
        durationDays = 30;
      } else if (grossAmount >= 50000) {
        durationDays = 14;
      } else if (grossAmount >= 20000) {
        durationDays = 7;
      } else {
        durationDays = 0;
      }
      aiRequests = Math.floor((grossAmount / 20000) * 50);
    } else {
      if (!db) {
        return Response.json({ error: "Database tidak aktif." }, { status: 503 });
      }
      const planSnap = await db.collection("plans")
        .where("name", "==", body.planName)
        .limit(1)
        .get();
      const planData = planSnap.docs[0]?.data();

      if (!planData || planData.active === false) {
        return Response.json({ error: "Paket tidak ditemukan atau tidak aktif." }, { status: 404 });
      }

      grossAmount = Number(planData.price);
      planName = String(planData.name ?? body.planName);
      durationDays = Number(planData.durationDays) || 30;
      aiRequests = Number(planData.aiRequests) || 0;

      if (grossAmount < 1 || grossAmount !== Number(body.grossAmount)) {
        return Response.json({ error: "Harga paket tidak sesuai dengan data server." }, { status: 400 });
      }
    }

    if (!serverKey) {
      return Response.json({
        token: "demo-midtrans-token",
        redirectUrl: "/",
        mode: "demo",
      });
    }

    if (!clientKey) {
      return Response.json(
        { error: "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY belum diisi di Vercel." },
        { status: 500 },
      );
    }

    const auth = Buffer.from(`${serverKey}:`).toString("base64");
    const endpoint =
      isProduction
        ? "https://app.midtrans.com/snap/v1/transactions"
        : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: body.orderId,
          gross_amount: grossAmount,
        },
        customer_details: {
          first_name: body.customerName || decoded.name || decoded.email?.split("@")[0] || "Grace Daily Donor",
          email: body.customerEmail || decoded.email || undefined,
          phone: body.customerPhone || undefined,
          billing_address: body.customerCity ? {
            city: body.customerCity
          } : undefined,
        },
        item_details: [
          {
            id: isDonation ? "donasi-open" : planName,
            name: isDonation ? "Open Donation" : planName,
            price: grossAmount,
            quantity: 1,
          },
        ],
        callbacks: {
          finish: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gracedaily.my.id"}/profil`,
          error: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gracedaily.my.id"}/login`,
          pending: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gracedaily.my.id"}/profil`,
        },
        custom_field1: userId,
        custom_field2: planName,
        custom_field3: String(aiRequests),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn("[Midtrans API] Midtrans Snap API returned error:", data);
      return Response.json(
        {
          error: data.error_messages?.join(" ") ?? data.error ?? "Midtrans gagal membuat transaksi.",
          isProduction,
        },
        { status: response.status },
      );
    }

    // Save pending subscription in Firestore
    if (db) {
      try {
        await db.collection("subscriptions").doc(body.orderId).set({
          userId: userId,
          planName,
          amount: grossAmount,
          durationDays,
          aiRequests,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
        
        console.log(`[Midtrans API] Saved pending subscription for order ${body.orderId}`);
      } catch (e) {
        console.error("[Midtrans API] Failed to save pending subscription:", e);
      }
    }

    return Response.json({ ...data, isProduction }, { status: response.status });
  } catch (error: any) {
    console.error("[Midtrans API Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan internal pada server Midtrans API." },
      { status: 500 }
    );
  }
}
