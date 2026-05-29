import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminDb } from "@/lib/server/firebase-admin";

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
      // format: ORDER-uid-timestamp
      const parts = order_id.split("-");
      if (parts.length >= 2) {
        userId = parts[1];
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
      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt);
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      await db.collection("users").doc(userId).set({
        role: planName.toLowerCase() === "komunitas" ? "admin" : "premium",
        selectedPlan: planName,
        premiumActivatedAt: activatedAt,
        premiumExpiresAt: expiresAt,
        aiRequestsQuota: aiRequests,
        aiRequestsRemaining: aiRequests,
        premiumLastOrder: order_id,
        updatedAt: activatedAt
      }, { merge: true });

      await subRef.set({
        startedAt: activatedAt,
        expiresAt,
        aiRequests,
      }, { merge: true });
      
      console.log(`[Midtrans Webhook] Successfully activated ${planName} for user ${userId}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("[Midtrans Webhook Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
