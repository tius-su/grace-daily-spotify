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
  console.log("Checking blog_posts banners...");
  const snapshot = await db.collection("blog_posts").get();
  let countNoBanner = 0;
  snapshot.forEach(doc => {
    const data = doc.data();
    const imageUrl = data.imageUrl;
    if (!imageUrl || imageUrl.trim() === "" || imageUrl === "/logo.png" || !imageUrl.includes("generate-image")) {
      console.log(`Missing/Default Banner - ID: ${doc.id}`);
      console.log(`  Title: ${data.title}`);
      console.log(`  Current imageUrl: ${imageUrl}`);
      console.log("---");
      countNoBanner++;
    }
  });
  console.log(`Total posts checked: ${snapshot.size}`);
  console.log(`Posts with missing or non-dynamic banner: ${countNoBanner}`);
}

run().catch(console.error);
