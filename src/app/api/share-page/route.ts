import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";
import { slugifyShareTitle } from "@/lib/server/share-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, max = 20000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return Response.json({ error: "Silakan login untuk membuat halaman hasil." }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    if (!adminAuth || !adminDb) {
      return Response.json({ error: "Firebase Admin belum dikonfigurasi." }, { status: 503 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const body = await request.json();
    const title = cleanText(body.title, 160);
    const content = cleanText(body.content, 30000);
    const type = cleanText(body.type, 80) || "Grace Daily";
    const subtitle = cleanText(body.subtitle, 280);
    const prompt = cleanText(body.prompt, 5000);
    const sourceId = cleanText(body.sourceId, 160);

    if (!title || !content) {
      return Response.json({ error: "Judul dan isi halaman wajib diisi." }, { status: 400 });
    }

    const id = `${slugifyShareTitle(title)}-${Date.now().toString(36)}`;
    const description = subtitle || prompt || content.slice(0, 150);
    const bannerUrl = `/api/admin/generate-image?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description.slice(0, 220))}&icon=logo&bg=sage`;

    const shareDoc = {
      id,
      type,
      title,
      subtitle,
      prompt,
      content,
      sourceId,
      bannerUrl,
      userId: decoded.uid,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await adminDb.collection("share_pages").doc(id).set(shareDoc);

    try {
      const { uploadToR2Path } = await import("@/lib/server/backup-r2-service");
      await uploadToR2Path(`shared-pages/${id}.json`, JSON.stringify(shareDoc));
      console.log(`[Share Page API] Successfully synced share page to R2: shared-pages/${id}.json`);
    } catch (e) {
      console.warn("[Share Page API] Failed to sync share page to R2 on the fly:", e);
    }

    return Response.json({
      id,
      url: `/hasil/${id}`,
      bannerUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat halaman hasil.";
    return Response.json({ error: message }, { status: 500 });
  }
}
