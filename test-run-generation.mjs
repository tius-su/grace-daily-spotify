import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

// Initialize Firebase Admin first so generateDailyEncyclopediaEntries can use getAdminDb()
const serviceAccount = JSON.parse(readFileSync("scripts/serviceAccountKey.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Now import the module
const modulePath = "./src/lib/server/generate-encyclopedia.ts";
const { generateDailyEncyclopediaEntries, getTodaysCategories } = await import(modulePath);

console.log("Running generation test...");
try {
  const result = await generateDailyEncyclopediaEntries({
    limit: 1,
    force: true,
  });
  console.log("Result:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Critical Generation Error:", err);
}
