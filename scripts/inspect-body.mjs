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
  const doc1 = await db.collection("daily_devotions").doc("golden-2026-05-31-05").get();
  const doc2 = await db.collection("daily_devotions").doc("golden-2026-05-31-15").get();

  if (doc1.exists) {
    console.log("=== golden-2026-05-31-05 ===");
    console.log("Title:", doc1.data().title);
    console.log("Body:");
    console.log(JSON.stringify(doc1.data().body));
    console.log("Prayer:");
    console.log(JSON.stringify(doc1.data().prayer));
  }
  if (doc2.exists) {
    console.log("=== golden-2026-05-31-15 ===");
    console.log("Title:", doc2.data().title);
    console.log("Body:");
    console.log(JSON.stringify(doc2.data().body));
    console.log("Prayer:");
    console.log(JSON.stringify(doc2.data().prayer));
  }
}

run().catch(console.error);
