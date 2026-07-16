import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

initializeApp({ credential: cert(JSON.parse(readFileSync("scripts/serviceAccountKey.json", "utf8"))) });
const db = getFirestore();

async function run() {
  const snapshot = await db.collection("ensiklopedia_cache").get();
  console.log("Total documents in ensiklopedia_cache:", snapshot.size);

  const unknownDocs = [];
  const slugCounts = {};
  const keywordCounts = {};
  
  snapshot.forEach(doc => {
    const id = doc.id;
    const data = doc.data();
    const title = String(data.title || "");
    const slug = String(data.slug || "");
    const keyword = String(data.keyword || "");
    const kategori = String(data.kategori || "");

    const isUnknown = 
      title.toLowerCase().startsWith("unknown-") ||
      title.toLowerCase() === "unknown" ||
      slug.toLowerCase().includes("unknown") ||
      keyword.toLowerCase().includes("unknown") ||
      id.toLowerCase().includes("unknown");

    if (isUnknown) {
      unknownDocs.push({ id, title, slug, keyword, kategori });
    }

    // Track slug duplicates
    const slugKey = `${kategori}/${slug}`;
    if (!slugCounts[slugKey]) {
      slugCounts[slugKey] = [];
    }
    slugCounts[slugKey].push({ id, title, keyword });

    // Track keyword duplicates
    const kwKey = `${kategori}/${keyword.toLowerCase().trim()}`;
    if (!keywordCounts[kwKey]) {
      keywordCounts[kwKey] = [];
    }
    keywordCounts[kwKey].push({ id, title, slug });
  });

  console.log("\n=== UNKNOWN DOCUMENTS ===");
  console.log(`Found ${unknownDocs.length} unknown documents:`);
  unknownDocs.forEach(d => {
    console.log(`- ID: ${d.id} | Title: "${d.title}" | Slug: "${d.slug}" | Keyword: "${d.keyword}" | Kategori: "${d.kategori}"`);
  });

  console.log("\n=== DUPLICATE SLUGS (same category) ===");
  let duplicateSlugsCount = 0;
  for (const [slugKey, docs] of Object.entries(slugCounts)) {
    if (docs.length > 1) {
      duplicateSlugsCount++;
      console.log(`- Slug: ${slugKey} (${docs.length} occurrences):`);
      docs.forEach(d => {
        console.log(`  * ID: ${d.id} | Title: "${d.title}" | Keyword: "${d.keyword}"`);
      });
    }
  }
  if (duplicateSlugsCount === 0) {
    console.log("No duplicate slugs found.");
  }

  console.log("\n=== DUPLICATE KEYWORDS (same category) ===");
  let duplicateKeywordsCount = 0;
  for (const [kwKey, docs] of Object.entries(keywordCounts)) {
    if (docs.length > 1) {
      duplicateKeywordsCount++;
      console.log(`- Keyword: ${kwKey} (${docs.length} occurrences):`);
      docs.forEach(d => {
        console.log(`  * ID: ${d.id} | Title: "${d.title}" | Slug: "${d.slug}"`);
      });
    }
  }
  if (duplicateKeywordsCount === 0) {
    console.log("No duplicate keywords found.");
  }
}

run().catch(console.error);
