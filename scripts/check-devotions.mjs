import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";
import path from "path";

const keyPath = path.join(process.cwd(), "scripts", "serviceAccountKey.json");
if (!existsSync(keyPath)) {
  console.error("serviceAccountKey.json not found!");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function run() {
  console.log("Fetching recent daily_devotions...");
  const snapshot = await db.collection("daily_devotions")
    .orderBy("updatedAt", "desc")
    .limit(10)
    .get();
  
  console.log(`Found ${snapshot.size} devotions:`);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}`);
    console.log(`  Title: ${data.title}`);
    console.log(`  Verse: ${data.verseRef}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  UpdatedAt: ${data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : 'none'}`);
    console.log("---");
  });
}

run().catch(console.error);
