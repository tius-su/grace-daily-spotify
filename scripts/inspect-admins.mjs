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
  const uid = "ZHRPfMdh1oSLEDbhi7OH2OCEJUk2";
  console.log(`Checking UID: ${uid}`);
  
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists) {
    console.log("Found in users collection:", userDoc.data());
  } else {
    console.log("NOT found in users collection!");
  }
  
  const adminDoc = await db.collection("admin_users").doc(uid).get();
  if (adminDoc.exists) {
    console.log("Found in admin_users collection:", adminDoc.data());
  } else {
    console.log("NOT found in admin_users collection!");
  }
  
  const settingsApp = await db.collection("settings").doc("app").get();
  if (settingsApp.exists) {
    console.log("Found settings/app:", settingsApp.data());
  } else {
    console.log("settings/app NOT found!");
  }
}

run().catch(console.error);
