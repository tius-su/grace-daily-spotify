#!/usr/bin/env node
/**
 * Script: cleanup-sore-devotions.mjs
 * 
 * Menghapus semua dokumen daily_devotions dengan suffix -15 (slot sore)
 * dari Firestore menggunakan Firebase REST API.
 * 
 * Jalankan: node cleanup-sore-devotions.mjs
 * Jalankan (hapus sungguhan): node cleanup-sore-devotions.mjs --delete
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env.local
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.substring(0, idx).trim(), l.substring(idx + 1).trim()];
    })
);

const PROJECT_ID = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "renungan-life";
const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const shouldDelete = process.argv.includes("--delete");

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function firestoreRequest(path, method = "GET", body) {
  const url = `${BASE_URL}${path}?key=${API_KEY}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore ${method} ${path} failed: ${res.status} - ${text.substring(0, 200)}`);
  }
  if (method === "DELETE") return null;
  return res.json();
}

async function listAllDocuments() {
  const allDocs = [];
  let pageToken = null;

  do {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/daily_devotions?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.documents) {
      allDocs.push(...data.documents);
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return allDocs;
}

async function main() {
  console.log(`\n🔍 Memeriksa dokumen slot sore di Firestore (project: ${PROJECT_ID})...\n`);

  const docs = await listAllDocuments();
  console.log(`📊 Total dokumen daily_devotions: ${docs.length}`);

  const soreDocs = docs.filter((doc) => {
    const id = doc.name.split("/").pop();
    return id.endsWith("-15");
  });

  if (soreDocs.length === 0) {
    console.log("\n✅ Tidak ada dokumen slot sore (-15). Semuanya bersih!\n");
    return;
  }

  console.log(`\n⚠️  Ditemukan ${soreDocs.length} dokumen slot sore (-15):\n`);
  soreDocs.forEach((doc) => {
    const id = doc.name.split("/").pop();
    const provider = doc.fields?.provider?.stringValue || "?";
    const status = doc.fields?.status?.stringValue || "?";
    const title = doc.fields?.title?.stringValue || "?";
    console.log(`   - ${id} | provider: ${provider} | status: ${status}`);
    if (title && title.length < 80) console.log(`     judul: "${title}"`);
  });

  if (!shouldDelete) {
    console.log(
      "\n💡 Ini adalah mode PREVIEW. Jalankan dengan --delete untuk menghapus:\n"
    );
    console.log("   node cleanup-sore-devotions.mjs --delete\n");
    return;
  }

  console.log("\n🗑️  Menghapus dokumen slot sore...\n");
  let deleted = 0;
  let failed = 0;

  for (const doc of soreDocs) {
    const id = doc.name.split("/").pop();
    try {
      await firestoreRequest(`/daily_devotions/${id}`, "DELETE");
      console.log(`   ✅ Deleted: ${id}`);
      deleted++;
    } catch (err) {
      console.error(`   ❌ Failed to delete ${id}:`, err.message);
      failed++;
    }
  }

  console.log(`\n📋 Selesai: ${deleted} dihapus, ${failed} gagal.\n`);
  
  if (deleted > 0) {
    console.log("ℹ️  Catatan: Index backup/renungan.json di R2 akan otomatis diperbarui");
    console.log("   saat admin panel sync berikutnya, atau Anda bisa deploy dan panggil:");
    console.log("   GET /api/admin/cleanup-devotion-sore?confirm=true\n");
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
