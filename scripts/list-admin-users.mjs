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
  console.log("Listing admin_users...");
  const adminSnap = await db.collection("admin_users").get();
  adminSnap.forEach(doc => {
    console.log(`Admin Doc ID (UID): ${doc.id}`, doc.data());
  });

  console.log("\nSearching for creativecortex168@gmail.com in users collection...");
  const userSnap = await db.collection("users").where("email", "==", "creativecortex168@gmail.com").get();
  if (userSnap.empty) {
    console.log("creativecortex168@gmail.com not found in users collection!");
  } else {
    userSnap.forEach(doc => {
      console.log(`User ID: ${doc.id}`, doc.data());
    });
  }
}

run().catch(console.error);
