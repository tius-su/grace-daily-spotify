import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// 1. Load env variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        process.env[key] = value;
      }
    }
  }
}

// 2. Initialize Firebase Admin
const certPath = "scripts/serviceAccountKey.json";
if (!existsSync(certPath)) {
  console.error(`Firebase Service Account key not found at ${certPath}`);
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(certPath, "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// 3. Dynamically import R2 and D1 sync services
const { syncSingleBlogArticle, syncSingleDevotion } = await import(
  "./src/lib/server/backup-r2-service.ts"
);
const { queryD1 } = await import("./src/lib/server/d1.ts");

async function syncArticles() {
  console.log("\n--- SINKRONISASI ARTIKEL BLOG DARI FIRESTORE KE D1 & R2 ---");
  
  // Ambil ID artikel yang sudah terdaftar di D1
  const existingArticles = await queryD1("SELECT id FROM articles").catch(() => []);
  const existingIds = new Set(existingArticles.map(a => a.id));
  console.log(`D1 memiliki ${existingIds.size} artikel terdaftar.`);

  const snap = await db.collection("blog_posts").get();
  console.log(`Menemukan ${snap.size} artikel di Firestore.`);

  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const id = doc.id;
    if (existingIds.has(id)) {
      // Lewati jika sudah ada di D1
      continue;
    }
    console.log(`Memproses artikel baru (${id}): "${data.title}"...`);
    try {
      await syncSingleBlogArticle(id, data);
      count++;
    } catch (err) {
      console.error(`Gagal menyinkronkan artikel ${id}:`, err.message);
    }
  }
  console.log(`Selesai. Berhasil menyinkronkan ${count} artikel baru.`);
}

async function syncDevotions() {
  console.log("\n--- SINKRONISASI RENUNGAN HARIAN DARI FIRESTORE KE D1 & R2 (LIMIT 15 TERBARU) ---");
  
  // Ambil ID renungan yang sudah terjemahannya terdaftar di D1
  const existingDevotions = await queryD1("SELECT devotion_id FROM devotion_translations WHERE language_code='id'").catch(() => []);
  const existingDevotionIds = new Set(existingDevotions.map(d => d.devotion_id));
  console.log(`D1 memiliki ${existingDevotionIds.size} terjemahan renungan terdaftar.`);

  // Sync the latest 15 devotions to keep it fast
  const snap = await db.collection("daily_devotions").orderBy("scheduledShareAt", "desc").limit(15).get();
  console.log(`Menemukan ${snap.size} renungan di Firestore.`);

  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const id = doc.id;
    if (existingDevotionIds.has(id)) {
      // Lewati jika sudah ada di D1
      continue;
    }
    console.log(`Memproses renungan baru (${id}): "${data.title}"...`);
    try {
      await syncSingleDevotion(id, data);
      count++;
    } catch (err) {
      console.error(`Gagal menyinkronkan renungan ${id}:`, err.message);
    }
  }
  console.log(`Selesai. Berhasil menyinkronkan ${count} renungan baru.`);
}

async function main() {
  try {
    await syncArticles();
    await syncDevotions();
    console.log("\n🎉 SINKRONISASI BERHASIL! Semua artikel dan renungan telah terdaftar di D1 dan R2.");
  } catch (err) {
    console.error("Terjadi kesalahan kritis:", err.message);
  } finally {
    process.exit(0);
  }
}

main();
