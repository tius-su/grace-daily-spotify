import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

async function deleteFromR2Path(key: string) {
  if (!s3Client || !R2_BUCKET_NAME) return;
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    console.log(`[cleanup-devotion-sore] Deleted R2: ${key}`);
  } catch (err) {
    console.warn(`[cleanup-devotion-sore] Failed to delete R2 key: ${key}`, err);
  }
}

/**
 * GET /api/admin/cleanup-devotion-sore
 * Menghapus semua dokumen daily_devotions dengan suffix -15 (slot sore jam 15:00 WIB)
 * dari Firestore dan Cloudflare R2.
 *
 * Mode preview (default): hanya menampilkan daftar dokumen yang akan dihapus tanpa menghapus.
 * Mode delete: tambahkan ?confirm=true untuk benar-benar menghapus.
 */
export async function GET(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const confirmDelete = url.searchParams.get("confirm") === "true";

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Firestore Admin tidak tersedia." }, { status: 500 });
  }

  try {
    // Ambil semua dokumen daily_devotions yang ID-nya berakhir dengan -15
    const snapshot = await db.collection("daily_devotions").get();

    const soreDocs = snapshot.docs.filter((doc) => doc.id.endsWith("-15"));

    if (soreDocs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada dokumen slot sore (-15) yang ditemukan. Tidak ada yang perlu dihapus.",
        count: 0,
        ids: [],
      });
    }

    const ids = soreDocs.map((doc) => doc.id);

    if (!confirmDelete) {
      // Preview mode: tampilkan apa yang akan dihapus
      return NextResponse.json({
        preview: true,
        message: `Ditemukan ${soreDocs.length} dokumen slot sore. Tambahkan ?confirm=true untuk menghapus.`,
        count: soreDocs.length,
        ids,
      });
    }

    // Delete mode: hapus dari Firestore dan R2
    const results: { id: string; firestore: string; r2: string[] }[] = [];

    for (const doc of soreDocs) {
      const id = doc.id;
      const r2Deleted: string[] = [];

      // Hapus dari Firestore
      try {
        await db.collection("daily_devotions").doc(id).delete();
      } catch (err) {
        console.error(`[cleanup-devotion-sore] Gagal menghapus Firestore doc: ${id}`, err);
      }

      // Hapus dari R2
      const r2Keys = [
        `devotions/${id}.json`,
        `devotions/${id}_en.json`,
        `devotions/${id}_zh.json`,
      ];
      for (const key of r2Keys) {
        await deleteFromR2Path(key);
        r2Deleted.push(key);
      }

      results.push({ id, firestore: "deleted", r2: r2Deleted });
      console.log(`[cleanup-devotion-sore] Dokumen ${id} berhasil dihapus.`);
    }

    // Rebuild backup/renungan.json index (tanpa dokumen -15)
    try {
      const updatedSnap = await db.collection("daily_devotions").get();
      const updatedDocs = updatedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const { uploadToR2Path } = await import("@/lib/server/backup-r2-service");
      await uploadToR2Path("backup/renungan.json", JSON.stringify(updatedDocs));
      console.log("[cleanup-devotion-sore] Rebuilt backup/renungan.json setelah penghapusan.");
    } catch (rebuildErr) {
      console.error("[cleanup-devotion-sore] Gagal rebuild backup/renungan.json:", rebuildErr);
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} dokumen slot sore (-15) berhasil dihapus dari Firestore dan R2.`,
      count: results.length,
      deleted: results,
    });
  } catch (err: any) {
    console.error("[cleanup-devotion-sore] Error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
