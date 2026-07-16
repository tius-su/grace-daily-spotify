#!/usr/bin/env node
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// simple .env.local parser (no external deps)
function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const env = {};
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.substring(0, eq).trim();
    let val = line.substring(eq + 1).trim();
    // remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
  return env;
}

const env = parseEnv(path.resolve(process.cwd(), ".env.local"));

let serviceAccountPath = path.resolve(process.cwd(), "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  // try scripts/ for legacy placement
  const alt = path.resolve(process.cwd(), "scripts", "serviceAccountKey.json");
  if (fs.existsSync(alt)) {
    serviceAccountPath = alt;
  } else {
    console.error("serviceAccountKey.json not found in project root or scripts/. Aborting.");
    process.exit(1);
  }
}

const r2Public = env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
const appUrl = (env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");

if (!r2Public) {
  console.error("NEXT_PUBLIC_R2_PUBLIC_URL not set in .env.local. Aborting.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))),
});

const db = admin.firestore();

async function run() {
  console.log("Scanning daily_devotions for R2 URLs...");
  const col = db.collection("daily_devotions");
  const snapshot = await col.get();
  console.log(`Found ${snapshot.size} docs.`);

  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates = {};

    ["illustrationUrl", "bannerUrl"].forEach((field) => {
      const val = data[field];
      if (typeof val === "string" && val.includes(r2Public)) {
        // extract key after r2Public/
        const idx = val.indexOf(r2Public);
        const remainder = val.substring(idx + r2Public.length + 1); // skip trailing '/'
        // remainder may include query params like ?t=...
        const key = decodeURIComponent(remainder.split("?")[0]) + (remainder.includes("?") ? `?${remainder.split("?").slice(1).join("?")}` : "");
        const proxied = `${appUrl}/api/media/public?key=${encodeURIComponent(key)}`;
        if (proxied !== val) {
          updates[field] = proxied;
        }
      }
    });

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      console.log(`Updated ${doc.id}:`, updates);
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} documents.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
