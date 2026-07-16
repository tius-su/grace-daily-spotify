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
  console.log("Fetching detailed devotion...");
  const doc = await db.collection("daily_devotions").doc("golden-2026-06-04-05").get();
  if (doc.exists) {
    const data = doc.data();
    console.log("Document fields:");
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("Document golden-2026-06-04-05 not found.");
  }
}

run().catch(console.error);
