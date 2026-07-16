import { NextResponse } from "next/server";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

// Cache index in-memory untuk mengurangi download R2 berulang kali
let cachedDevotions: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

async function getDevotionsIndex(): Promise<any[]> {
  const now = Date.now();
  if (cachedDevotions && (now - cacheTime < CACHE_TTL)) {
    return cachedDevotions;
  }

  if (!R2_BUCKET_NAME || !s3Client) return [];

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: "backup/renungan.json",
    });
    const response = await s3Client.send(command);
    if (!response.Body) return [];

    const buffer = Buffer.from(await response.Body.transformToByteArray());
    const data = JSON.parse(buffer.toString("utf8"));

    if (Array.isArray(data)) {
      cachedDevotions = data;
      cacheTime = now;
      return data;
    }
  } catch (err) {
    console.warn("[related-devotions] Gagal load dari R2:", err);
  }

  return [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") || "";

  if (!keyword) {
    return NextResponse.json({ devotions: [] });
  }

  try {
    const allDevotions = await getDevotionsIndex();
    const lowerKeyword = keyword.toLowerCase();

    const matched: any[] = [];
    for (const d of allDevotions) {
      if (matched.length >= 3) break;
      const title = String(d.title || "").toLowerCase();
      const body = String(d.body || "").toLowerCase();
      const verseText = String(d.verseText || "").toLowerCase();
      const verseRef = String(d.verseRef || "").toLowerCase();

      if (
        title.includes(lowerKeyword) ||
        body.includes(lowerKeyword) ||
        verseText.includes(lowerKeyword) ||
        verseRef.includes(lowerKeyword)
      ) {
        matched.push({
          id: d.id || d.dateId,
          title: d.title,
          verseRef: d.verseRef,
          verseText: d.verseText,
        });
      }
    }

    return NextResponse.json({ devotions: matched });
  } catch (error) {
    console.error("Gagal mengambil renungan terkait:", error);
    return NextResponse.json({ devotions: [] }, { status: 500 });
  }
}
