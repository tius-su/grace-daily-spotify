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
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: node scripts/delete-devotion.mjs <devotion-id>");
    process.exit(1);
  }

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

  console.log(`Checking if devotion [${id}] exists in Firestore...`);
  const docRef = db.collection("daily_devotions").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.warn(`Devotion [${id}] does not exist in Firestore. Will attempt S3 deletion anyway.`);
  } else {
    console.log(`Found devotion in Firestore. Title: "${docSnap.data().title}"`);
  }

  // 1. Delete from Firestore
  if (docSnap.exists) {
    console.log("Deleting from Firestore...");
    await docRef.delete();
    console.log("Deleted from Firestore.");
  }

  // 2. Delete files from R2
  const r2Files = [
    `devotions/${id}.json`,
    `devotions/${id}_en.json`,
    `devotions/${id}_zh.json`
  ];

  for (const file of r2Files) {
    try {
      await deleteFromR2Path(client, bucket, file);
      console.log(`Deleted R2 file: ${file}`);
    } catch (err) {
      console.warn(`Failed to delete R2 file: ${file}`, err.message);
    }
  }

  // 3. Rebuild indexes
  console.log("Rebuilding backup/renungan.json index in R2...");
  const snap = await db.collection("daily_devotions").get();
  const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Found ${docs.length} devotions in Firestore.`);
  
  await uploadToR2Path(client, bucket, "backup/renungan.json", JSON.stringify(docs));
  console.log("Rebuilt backup/renungan.json.");

  console.log("Rebuilding devotions/latest.json in R2...");
  let latestDevotion = null;
  for (const devotion of docs) {
    if (!latestDevotion || devotion.id > latestDevotion.id) {
      latestDevotion = devotion;
    }
  }

  if (latestDevotion) {
    console.log(`New latest devotion will be: ${latestDevotion.id}`);
    await uploadToR2Path(client, bucket, "devotions/latest.json", JSON.stringify(latestDevotion));
  } else {
    console.log("No devotions remaining. Deleting devotions/latest.json.");
    await deleteFromR2Path(client, bucket, "devotions/latest.json");
  }

  console.log("Deletion complete!");
}

main().catch(console.error);
