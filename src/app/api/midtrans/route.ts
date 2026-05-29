import { getAdminDb } from "@/lib/server/firebase-admin";

type MidtransRequest = {
  orderId?: string;
  grossAmount?: number;
  customerName?: string;
  customerEmail?: string;
  planName?: string;
  durationDays?: number;
  aiRequests?: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as MidtransRequest;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
  const isProduction =
    (process.env.MIDTRANS_IS_PRODUCTION ?? process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION) === "true";

  if (!body.orderId || !body.grossAmount || body.grossAmount < 1 || !body.customerEmail) {
    return Response.json(
      { error: "orderId, grossAmount, dan customerEmail wajib diisi." },
      { status: 400 },
    );
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
        gross_amount: body.grossAmount,
      },
      customer_details: {
        first_name: body.customerName ?? "Grace Daily User",
        email: body.customerEmail,
      },
      item_details: [
        {
          id: body.planName ?? "premium",
          name: body.planName ?? "Grace Daily Premium",
          price: body.grossAmount,
          quantity: 1,
        },
      ],
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gracedaily.my.id"}/profil`,
        error: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gracedaily.my.id"}/login`,
        pending: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gracedaily.my.id"}/profil`,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return Response.json(
      {
        error: data.error_messages?.join(" ") ?? data.error ?? "Midtrans gagal membuat transaksi.",
        isProduction,
      },
      { status: response.status },
    );
  }

  // Save pending subscription in Firestore
  const db = getAdminDb();
  if (db) {
    try {
      const parts = body.orderId.split("-");
      const userId = parts.length >= 2 ? parts[1] : "";
      
      await db.collection("subscriptions").doc(body.orderId).set({
        userId: userId,
        planName: body.planName ?? "Premium",
        amount: body.grossAmount,
        durationDays: Number(body.durationDays) || 30,
        aiRequests: Number(body.aiRequests) || 0,
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
}
