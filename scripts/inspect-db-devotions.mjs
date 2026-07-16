import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadEnv() {
  for (const file of [resolve(".env.vercel.local"), resolve(".env.local"), resolve(".env")]) {
    if (!existsSync(file)) {
      continue;
    }

    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

      if (!match || process.env[match[1]]) {
        continue;
      }

      process.env[match[1]] = match[2]; // Keep quotes for parsing
    }
  }
}

function serviceAccount() {
  let json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error("Single JSON parse failed:", e.message);
    }
  }

  if (file && existsSync(file)) {
    return JSON.parse(readFileSync(file, "utf8"));
  }

  const defaultKeyPath = resolve("scripts", "serviceAccountKey.json");
  if (existsSync(defaultKeyPath)) {
    return JSON.parse(readFileSync(defaultKeyPath, "utf8"));
  }

  throw new Error(
    "Service account key not found.",
  );
}

async function inspect() {
  loadEnv();
  
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount()),
    });
  }

  const db = getFirestore();

  console.log("=== Inspecting daily_devotions ===");
  const snapshot = await db.collection("daily_devotions").orderBy("dateId", "desc").limit(10).get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`Title: ${data.title}`);
    console.log(`Verse: ${data.verseRef}`);
    console.log(`Status: ${data.status}`);
    console.log(`Generated At: ${data.generatedAt?.toDate?.() || data.generatedAt}`);
    console.log(`Banner URL: ${data.bannerUrl}`);
    console.log("------------------------");
  });
}

inspect().catch(console.error);
