import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { verifyAdmin } from "@/lib/server/auth";
import {
  encyclopediaSlug,
  isLegacyEncyclopediaIllustrationUrl,
  isValidEncyclopediaIllustrationUrl,
} from "@/lib/encyclopedia";
import { ensureEncyclopediaIllustrationR2 } from "@/lib/server/encyclopedia-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Firestore Admin belum siap." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit ?? 50), 1), 200);
  const forceAll = Boolean(body.forceAll);

  const snapshot = await db.collection("ensiklopedia_cache").limit(limit).get();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data();
    const kategori = asText(data.kategori) || doc.id.split("-")[0] || "tokoh";
    const keyword = asText(data.keyword) || asText(data.title) || asText(data.slug) || doc.id;
    const slug = asText(data.slug) || encyclopediaSlug(keyword);
    const currentIllustrationUrl = asText(data.illustrationUrl);
    const needsUpdate =
      forceAll ||
      !currentIllustrationUrl ||
      isLegacyEncyclopediaIllustrationUrl(currentIllustrationUrl) ||
      !isValidEncyclopediaIllustrationUrl(currentIllustrationUrl);

    if (!needsUpdate) {
      skipped += 1;
      continue;
    }

    try {
      const illustrationUrl = await ensureEncyclopediaIllustrationR2({
        slug: `${kategori}-${slug}-illustration`,
        kategori,
        topik: keyword,
        force: forceAll || isLegacyEncyclopediaIllustrationUrl(currentIllustrationUrl),
      });

      if (!illustrationUrl) {
        failures.push({ id: doc.id, error: "Generator ilustrasi tidak mengembalikan URL." });
        continue;
      }

      await doc.ref.set(
        {
          illustrationUrl,
          updatedAt: new Date(),
        },
        { merge: true },
      );
      updated += 1;
    } catch (error) {
      failures.push({
        id: doc.id,
        error: error instanceof Error ? error.message : "Gagal regenerate ilustrasi.",
      });
    }
  }

  if (updated > 0) {
    try {
      const { syncEncyclopediaOnly } = await import("@/lib/server/backup-r2-service");
      await syncEncyclopediaOnly();
      console.log("[Regenerate Illustrations] Successfully synced encyclopedia R2 files");
    } catch (syncErr) {
      console.error("[Regenerate Illustrations] Failed to run syncEncyclopediaOnly:", syncErr);
    }
  }

  return NextResponse.json({ ok: true, scanned, updated, skipped, failures });
}
