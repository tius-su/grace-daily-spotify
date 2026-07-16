import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

try {
  const serviceAccount = JSON.parse(readFileSync("scripts/serviceAccountKey.json", "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  
  console.log("Fetching generate-blog logs...");
  const snapshot = await db.collection("cron_logs")
    .where("cronType", "==", "generate-blog")
    .limit(10)
    .get();
  
  console.log("Found:", snapshot.size);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log("========================================");
    console.log("ID:", doc.id);
    console.log("Date:", data.date);
    console.log("Success:", data.success);
    console.log("Failed:", data.failed);
    console.log("Entries:", JSON.stringify(data.entries, null, 2));
  });
} catch (e) {
  console.error("Error running script:", e);
}
