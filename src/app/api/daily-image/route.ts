import { NextRequest, NextResponse } from "next/server";
import { getLatestDevotion, generateDailyImage } from "@/lib/server/daily-devotion";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { resolveDailyHeroImage } from "@/lib/daily-hero-images";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { devotionId, verseRef, verseText } = body;

    if (!devotionId || !verseRef || !verseText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const imageUrl = await generateDailyImage(devotionId, verseRef, verseText);

    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error("Daily image POST endpoint error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Terima query param devotionId untuk validasi — client mengirim ID renungan yang sedang ditampilkan
    const { searchParams } = new URL(request.url);
    const requestedDevotionId = searchParams.get("devotionId");

    const devotion = await getLatestDevotion();
    if (!devotion) {
      return NextResponse.json({ error: "Devotion not found" }, { status: 404 });
    }

    // Jika client meminta devotionId yang berbeda dari renungan terbaru,
    // kembalikan gambar renungan terbaru dengan flag bahwa ID sudah berubah
    // (agar client bisa refresh devotion data sekalian)
    const idMismatch = requestedDevotionId && requestedDevotionId !== devotion.id;

    const db = getAdminDb();

    if (db) {
      // Selalu re-fetch dari Firestore untuk mendapatkan imageUrl terbaru.
      const docSnap = await db.collection("daily_devotions").doc(devotion.id).get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const savedImageUrl = resolveDailyHeroImage(data?.imageUrl, data?.illustrationUrl);
        if (savedImageUrl) {
          return responseWithNoCache({ url: savedImageUrl, latestId: devotion.id, idMismatch: Boolean(idMismatch) });
        }
      }
    }

    // Gambar belum ada: pilih URL statis R2, tanpa AI image generation.
    const imageUrl = await generateDailyImage(devotion.id, devotion.verseRef, devotion.verseText);

    // Simpan field baru untuk renungan saat ini tanpa menyentuh dokumen lama lain.
    if (db) {
      try {
        await db.collection("daily_devotions").doc(devotion.id).set(
          { imageUrl },
          { merge: true }
        );
      } catch (e) {
        console.error("Failed to save imageUrl to Firestore:", e);
      }
    }

    return responseWithNoCache({ url: resolveDailyHeroImage(imageUrl), latestId: devotion.id, idMismatch: Boolean(idMismatch) });
  } catch (error: any) {
    console.error("Daily image endpoint error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function responseWithNoCache(data: object) {
  return new NextResponse(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      // Aggressive no-cache headers for mobile browsers
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "Surrogate-Control": "no-store",
    },
  });
}
