import { NextResponse } from "next/server";
import { getAdminDb, reportDbFailure } from "@/lib/server/firebase-admin";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let tokenHash = "";
  try {
    const body = await request.json();
    const { token, devotionEnabled, articleEnabled } = body;

    if (!token || typeof token !== "string" || token.trim() === "") {
      return NextResponse.json({ error: "Token FCM tidak valid." }, { status: 400 });
    }

    const trimmedToken = token.trim();
    tokenHash = crypto.createHash("sha256").update(trimmedToken).digest("hex");

    const db = getAdminDb();
    if (!db) {
      console.warn("[Subscribe Push] Database not available. Returning graceful fallback.");
      return NextResponse.json({
        success: true,
        message: "Preferensi disimpan (mode offline/limit).",
        tokenHash,
        warning: "Database tidak tersedia saat ini."
      }, { status: 202 });
    }

    const subscriberRef = db.collection("pushSubscribers").doc(tokenHash);
    
    let docSnap;
    try {
      docSnap = await subscriberRef.get();
    } catch (readErr: any) {
      console.warn("[Subscribe Push] Firestore read failed, possibly exhausted. Bypassing check.", readErr);
      reportDbFailure();
      return NextResponse.json({
        success: true,
        message: "Preferensi disimpan (mode offline/limit).",
        tokenHash,
        warning: "Database limit tercapai."
      }, { status: 202 });
    }

    const devotionPref = devotionEnabled !== false;
    const articlePref = articleEnabled !== false;

    try {
      if (docSnap.exists) {
        // Update preferences and ensure active status
        await subscriberRef.update({
          devotionEnabled: devotionPref,
          articleEnabled: articlePref,
          active: true,
          updatedAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          message: "Preferensi notifikasi push telah diperbarui.",
          tokenHash,
        });
      } else {
        // Create new push subscription
        await subscriberRef.set({
          tokenHash,
          token: trimmedToken,
          devotionEnabled: devotionPref,
          articleEnabled: articlePref,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          message: "Berhasil mengaktifkan notifikasi push harian.",
          tokenHash,
        });
      }
    } catch (writeErr: any) {
      console.warn("[Subscribe Push] Firestore write failed, possibly exhausted.", writeErr);
      reportDbFailure();
      return NextResponse.json({
        success: true,
        message: "Preferensi disimpan (mode offline/limit).",
        tokenHash,
        warning: "Database limit tercapai."
      }, { status: 202 });
    }
  } catch (error: any) {
    console.error("[Subscribe Push API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses notifikasi push." },
      { status: 500 }
    );
  }
}
