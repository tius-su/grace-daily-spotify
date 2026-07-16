import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const keyPath = path.join(process.cwd(), "scripts", "serviceAccountKey.json");
if (!existsSync(keyPath)) {
  console.error("serviceAccountKey.json not found!");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({
  credential: cert(serviceAccount),
});

// Import getLatestDevotion and generateDailyDevotion dynamically or mock them if necessary.
// Let's run a script that imports them. But since they are ES modules, we should resolve imports correctly.
// Let's write a standard Node script that runs the API endpoint logic or imports the files.
// Let's look at grace-daily/src/lib/server/daily-devotion.ts and next.config.js to see if we can run it.
// To run ts files directly, we can use `tsx` or we can write a script that does the same steps.
// Let's check if ts-node or tsx is available in the project, or if we can run:
// `npx tsx scripts/test-devotion-generation.mts`
