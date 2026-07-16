import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

try {
  const serviceAccount = JSON.parse(readFileSync("scripts/serviceAccountKey.json", "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  
  console.log("Fetching latest 5 cron logs...");
  const snapshot = await db.collection("cron_logs").orderBy("createdAt", "desc").limit(5).get();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log("----------------------------------------");
    console.log("ID:", doc.id);
    console.log("Date:", data.date);
    console.log("CronType:", data.cronType);
    console.log("Target:", data.target);
    console.log("Success:", data.success);
    console.log("Duplicate:", data.duplicate);
    console.log("Failed:", data.failed);
    console.log("Status:", data.status);
    console.log("Created At:", data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt);
    console.log("Entries:", JSON.stringify(data.entries, null, 2));
  });
} catch (e) {
  console.error("Error running script:", e);
}
