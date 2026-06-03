import { NextRequest, NextResponse } from "next/server";
import { getLatestDevotion, generateDailyImage } from "@/lib/server/daily-devotion";
import { getAdminDb } from "@/lib/server/firebase-admin";

export const dynamic = "force-dynamic";

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
    // kembalikan null — jangan tampilkan gambar renungan lama/kemarin.
    if (requestedDevotionId && requestedDevotionId !== devotion.id) {
      return NextResponse.json({ url: null });
    }

    const db = getAdminDb();

    if (db) {
      // Selalu re-fetch dari Firestore untuk mendapatkan illustrationUrl terbaru
      // (tidak pakai prop devotion.illustrationUrl yang mungkin sudah stale)
      const docSnap = await db.collection("daily_devotions").doc(devotion.id).get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data?.illustrationUrl) {
          return responseWithCache(data.illustrationUrl);
        }
      }
    }

    // Gambar belum ada — generate baru
    const imageUrl = await generateDailyImage(devotion.id, devotion.verseRef, devotion.verseText);

    // Simpan ke Firestore untuk di-cache
    if (db) {
      try {
        await db.collection("daily_devotions").doc(devotion.id).set(
          { illustrationUrl: imageUrl },
          { merge: true }
        );
      } catch (e) {
        console.error("Failed to save illustrationUrl to Firestore:", e);
      }
    }

    return responseWithCache(imageUrl);
  } catch (error: any) {
    console.error("Daily image endpoint error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function responseWithCache(url: string) {
  return new NextResponse(JSON.stringify({ url }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}

