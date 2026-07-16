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
const bgColors = ["cream", "sage", "blue", "rose", "amber", "gray"];

async function run() {
  console.log("Fetching blog_posts from Firestore...");
  const snapshot = await db.collection("blog_posts").get();
  console.log(`Found ${snapshot.size} total posts.`);
  
  let updatedCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const imageUrl = data.imageUrl;
    
    // Check if it is missing a dynamic banner
    if (!imageUrl || imageUrl.trim() === "" || imageUrl === "/logo.png" || !imageUrl.includes("generate-image")) {
      const title = data.title || "Grace Daily";
      const excerpt = data.excerpt || "Baca artikel selengkapnya di Grace Daily.";
      const randomBg = bgColors[Math.floor(Math.random() * bgColors.length)];
      
      const bannerUrl = `/api/admin/generate-image?title=${encodeURIComponent(title)}&description=${encodeURIComponent(excerpt)}&icon=logo&bg=${randomBg}`;
      
      console.log(`Updating post [${doc.id}]:`);
      console.log(`  Title: ${title}`);
      console.log(`  New imageUrl: ${bannerUrl}`);
      
      await db.collection("blog_posts").doc(doc.id).update({
        imageUrl: bannerUrl,
        updatedAt: new Date(),
      });
      
      console.log("  Successfully updated.");
      console.log("---");
      updatedCount++;
    }
  }
  
  console.log(`Finished banner updates! Total posts updated: ${updatedCount}`);
}

run().catch(console.error);
