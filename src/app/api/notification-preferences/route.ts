import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const pushToken = searchParams.get("pushToken");

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 500 });
  }

  try {
    if (token) {
      // Fetch email subscriber by unsubscribeToken
      const snap = await db
        .collection("emailSubscribers")
        .where("unsubscribeToken", "==", token)
        .limit(1)
        .get();

      if (snap.empty) {
        return NextResponse.json({ error: "Token tidak valid." }, { status: 404 });
      }

      const docData = snap.docs[0].data();
      return NextResponse.json({
        type: "email",
        email: docData.email,
        devotionEnabled: docData.devotionEnabled !== false,
        articleEnabled: docData.articleEnabled !== false,
        active: docData.active !== false,
      });
    }

    if (pushToken) {
      // Fetch push subscriber by tokenHash (we assume they send the actual token or hash)
      const tokenHash = pushToken.length === 64 ? pushToken : crypto.createHash("sha256").update(pushToken).digest("hex");
      const docSnap = await db.collection("pushSubscribers").doc(tokenHash).get();

      if (!docSnap.exists) {
        return NextResponse.json({ error: "Token push tidak ditemukan." }, { status: 404 });
      }

      const docData = docSnap.data();
      return NextResponse.json({
        type: "push",
        devotionEnabled: docData?.devotionEnabled !== false,
        articleEnabled: docData?.articleEnabled !== false,
        active: docData?.active !== false,
      });
    }

    return NextResponse.json({ error: "Token atau Token Push diperlukan." }, { status: 400 });
  } catch (error: any) {
    console.error("[Get Preferences API Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { token, pushToken, devotionEnabled, articleEnabled, active } = body;

    const devotionPref = devotionEnabled !== false;
    const articlePref = articleEnabled !== false;
    const activePref = active !== false;

    if (token) {
      // Update email subscriber
      const snap = await db
        .collection("emailSubscribers")
        .where("unsubscribeToken", "==", token)
        .limit(1)
        .get();

      if (snap.empty) {
        return NextResponse.json({ error: "Token tidak valid." }, { status: 404 });
      }

      await snap.docs[0].ref.update({
        devotionEnabled: devotionPref,
        articleEnabled: articlePref,
        active: activePref,
        updatedAt: new Date(),
      });

      return NextResponse.json({ success: true, message: "Preferensi email berhasil diperbarui." });
    }

    if (pushToken) {
      // Update push subscriber
      const tokenHash = pushToken.length === 64 ? pushToken : crypto.createHash("sha256").update(pushToken).digest("hex");
      const subscriberRef = db.collection("pushSubscribers").doc(tokenHash);
      const docSnap = await subscriberRef.get();

      if (!docSnap.exists) {
        return NextResponse.json({ error: "Token push tidak ditemukan." }, { status: 404 });
      }

      await subscriberRef.update({
        devotionEnabled: devotionPref,
        articleEnabled: articlePref,
        active: activePref,
        updatedAt: new Date(),
      });

      return NextResponse.json({ success: true, message: "Preferensi notifikasi push berhasil diperbarui." });
    }

    return NextResponse.json({ error: "Token atau Token Push diperlukan." }, { status: 400 });
  } catch (error: any) {
    console.error("[Save Preferences API Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
