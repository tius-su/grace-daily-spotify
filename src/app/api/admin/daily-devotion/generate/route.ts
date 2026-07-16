import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutes — needed for image generation

export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse force flag from request body
  let force = false;
  try {
    const body = await request.json().catch(() => ({}));
    force = Boolean(body.force);
  } catch {
    // No body or invalid JSON — default force=false
  }

  try {
    const { generateDailyDevotion } = await import("@/lib/server/daily-devotion");
    const result = await generateDailyDevotion(new Date(), { force });

    if (result.created || (force && (result as any).regenerated)) {
      const db = getAdminDb();
      const docSnap = db ? await db.collection("daily_devotions").doc(result.id).get() : null;
      const devotion = docSnap?.exists ? docSnap.data() : null;

      if (devotion) {
        const { sendPushNotification } = await import("@/lib/server/push-notification");
        await sendPushNotification({
          preferenceKey: "devotion",
          title: `Renungan Harian: ${devotion.title || "Hari Ini"}`,
          body: `${devotion.verseRef || ""}: "${(devotion.verseText || "").substring(0, 80)}..."`,
          url: `/renungan/${result.id}`,
        }).catch((err) => console.error("Push notification failed:", err));
      }
    }

    const res = result as any;
    let message: string;
    if (res.created) {
      message = `Renungan harian baru berhasil dibuat: "${res.title || result.id}"`;
    } else if (res.regenerated) {
      message = `Renungan harian berhasil di-generate ulang: "${res.title || result.id}"`;
    } else if (res.imageGenerated) {
      message = `Renungan untuk slot ini sudah ada (${result.id}). Gambar yang kosong berhasil dilengkapi. Judul: "${res.existingTitle || ""}"`;
    } else {
      message = `Renungan untuk slot ini sudah ada (${result.id}): "${res.existingTitle || ""}". Gunakan force=true untuk generate ulang.`;
    }

    return NextResponse.json({
      success: true,
      ...result,
      message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat renungan harian.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
