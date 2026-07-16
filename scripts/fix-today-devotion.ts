import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";
import path from "path";

// Initialize Firebase Admin first so generateDailyDevotion has getAdminDb() working
const keyPath = path.join(process.cwd(), "scripts", "serviceAccountKey.json");
if (!existsSync(keyPath)) {
  console.error("serviceAccountKey.json not found!");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({
  credential: cert(serviceAccount),
});

import { generateDailyDevotion } from "../src/lib/server/daily-devotion";

async function run() {
  const db = getFirestore();
  const dateId = "golden-2026-05-31-15";
  console.log(`Checking/deleting existing document ${dateId}...`);
  await db.collection("daily_devotions").doc(dateId).delete();
  console.log(`Document ${dateId} deleted.`);

  console.log("Triggering regeneration of today's 15:00 devotion...");
  const res = await generateDailyDevotion(new Date());
  console.log("Regeneration result:", res);
}

run().catch(console.error);
