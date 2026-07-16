import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";
import path from "path";
import zlib from "zlib";

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

async function uploadToR2Path(client, bucket, key, content, contentType = "application/json") {
  let body = Buffer.from(content, "utf8");
  let gzipped = false;

  if (body.length > 50000) {
    body = zlib.gzipSync(body);
    gzipped = true;
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentEncoding: gzipped ? "gzip" : undefined,
  });
  await client.send(command);
}

async function deleteFromR2Path(client, bucket, key) {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  await client.send(command);
}

async function main() {
  loadDotEnv(path.join(process.cwd(), ".env.local"));

  const keyPath = path.join(process.cwd(), "scripts", "serviceAccountKey.json");
  if (!existsSync(keyPath)) {
    console.error("scripts/serviceAccountKey.json not found.");
    process.exit(1);
  }

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket || !process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.error("R2 credentials not fully configured.");
    process.exit(1);
  }

  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
  const db = getFirestore();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  console.log("Fetching all documents from ensiklopedia_cache...");
  const snapshot = await db.collection("ensiklopedia_cache").get();
  console.log(`Found ${snapshot.size} documents in Firestore.`);

  const toDelete = [];
  snapshot.forEach(doc => {
    const id = doc.id;
    const data = doc.data();
    const title = String(data.title || "");
    const slug = String(data.slug || "");
    const keyword = String(data.keyword || "");
    const kategori = String(data.kategori || "");

    const isUnknown = 
      title.toLowerCase().startsWith("unknown-") ||
      title.toLowerCase() === "unknown" ||
      slug.toLowerCase().includes("unknown") ||
      keyword.toLowerCase().includes("unknown") ||
      id.toLowerCase().includes("unknown");

    if (isUnknown) {
      toDelete.push({ id, docRef: doc.ref, kategori, slug, title });
    }
  });

  console.log(`Found ${toDelete.length} corrupted/unknown documents to delete.`);

  if (toDelete.length === 0) {
    console.log("No documents to delete.");
    return;
  }

  let deletedCount = 0;
  for (const item of toDelete) {
    console.log(`Deleting [${item.id}] - Title: "${item.title}"`);
    
    // 1. Delete from Firestore
    await item.docRef.delete();

    // 2. Delete individual file from R2
    if (item.kategori && item.slug) {
      const r2Key = `encyclopedia/${item.kategori.toLowerCase()}/${item.slug}.json`;
      try {
        await deleteFromR2Path(client, bucket, r2Key);
        console.log(`  - Deleted R2 key: ${r2Key}`);
      } catch (err) {
        console.warn(`  - Failed to delete R2 key: ${r2Key}`, err.message);
      }
    }
    deletedCount++;
  }

  console.log(`Successfully deleted ${deletedCount} documents from Firestore and R2.`);

  // 3. Rebuild the bulk files in R2 by fetching remaining documents
  console.log("Rebuilding category bulk files in R2...");
  const remainingSnapshot = await db.collection("ensiklopedia_cache").get();
  const remainingDocs = remainingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Remaining documents in Firestore: ${remainingDocs.length}`);

  const categories = [
    "tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi",
    "silsilah", "teologi", "topikal_alkitab", "peristiwa"
  ];

  for (const cat of categories) {
    let docs = remainingDocs.filter(d => String(d.kategori).toLowerCase() === cat);
    if (cat === "istilah") {
      docs = remainingDocs.filter(d => String(d.kategori).toLowerCase() === "istilah" || String(d.kategori).toLowerCase() === "kamus");
    }

    const fileName = `backup/${cat}.json`;
    console.log(`Uploading bulk file for "${cat}" (${docs.length} docs) to ${fileName}...`);
    await uploadToR2Path(client, bucket, fileName, JSON.stringify(docs));
  }

  console.log("Cleanup and bulk rebuild complete!");
}

main().catch(console.error);
