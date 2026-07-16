import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "fs";

// Parse .env.local manually if it exists to load credentials
if (existsSync(".env.local")) {
  const envContent = readFileSync(".env.local", "utf8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const equalsIdx = trimmed.indexOf("=");
      if (equalsIdx !== -1) {
        const key = trimmed.substring(0, equalsIdx).trim();
        const value = trimmed.substring(equalsIdx + 1).trim();
        process.env[key] = value;
      }
    }
  });
}

// Load Firebase Admin
const serviceAccount = JSON.parse(readFileSync("scripts/serviceAccountKey.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Read storage config
const configJson = readFileSync("storage-config.json", "utf8");
const configData = JSON.parse(configJson);

async function run() {
  console.log("1. Updating Firestore 'settings/storage_config' doc...");
  await db.collection("settings").doc("storage_config").set(configData, { merge: true });
  console.log("Firestore settings updated successfully!");

  // AWS SDK R2 upload
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (accountId && accessKeyId && secretAccessKey && bucketName) {
    console.log(`2. Connecting to Cloudflare R2 and uploading storage-config.json to bucket ${bucketName}...`);
    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: "storage-config.json",
      Body: configJson,
      ContentType: "application/json",
    });

    await s3Client.send(command);
    console.log("Cloudflare R2 storage-config.json uploaded successfully!");
  } else {
    console.warn("R2 Env variables not fully set in the shell context. Skipping R2 upload via script.");
  }
}

run().catch(error => {
  console.error("Sync storage config script failed:", error);
  process.exit(1);
});
