import { NextRequest, NextResponse } from "next/server";
import { getLatestDevotion, generateDailyImage } from "@/lib/server/daily-devotion";
import { getAdminDb } from "@/lib/server/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const devotion = await getLatestDevotion();
    if (!devotion) {
      return NextResponse.json({ error: "Devotion not found" }, { status: 404 });
    }

    const db = getAdminDb();
    
    // Check if illustration URL already exists in Firestore
    if (db && (devotion as any).illustrationUrl) {
      return responseWithCache((devotion as any).illustrationUrl);
    }

    if (db) {
      // Re-fetch document directly to ensure we have the latest cached illustrationUrl
      const docSnap = await db.collection("daily_devotions").doc(devotion.id).get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data?.illustrationUrl) {
          return responseWithCache(data.illustrationUrl);
        }
      }
    }

    // Generate illustration image URL using the shared utility helper
    const imageUrl = await generateDailyImage(devotion.id, devotion.verseRef, devotion.verseText);

    // Save URL to Firestore for caching
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

