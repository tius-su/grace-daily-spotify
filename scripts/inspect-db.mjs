import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

initializeApp({ credential: cert(JSON.parse(readFileSync("scripts/serviceAccountKey.json", "utf8"))) });
const db = getFirestore();

async function run() {
  const snapshot = await db.collection("ensiklopedia_cache").get();
  console.log("Total documents in ensiklopedia_cache:", snapshot.size);
  
  const stats = {};
  let statusCounts = {};
  let sampleDoc = null;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (!sampleDoc) sampleDoc = data;
    const cat = data.kategori || "unknown";
    stats[cat] = (stats[cat] || 0) + 1;
    const status = data.status || "no_status";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log("Categories stats:", stats);
  console.log("Status fields stats:", statusCounts);
  console.log("Sample Document Keys:", Object.keys(sampleDoc || {}));
  if (sampleDoc) {
    console.log("Sample Document fields:", {
      title: sampleDoc.title,
      kategori: sampleDoc.kategori,
      slug: sampleDoc.slug,
      keyword: sampleDoc.keyword,
      status: sampleDoc.status,
      updatedAt: sampleDoc.updatedAt
    });
  }
}

run().catch(console.error);
