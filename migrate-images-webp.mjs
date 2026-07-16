import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { getAdminDb } from "./src/lib/server/firebase-admin.ts";

// 1. Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
  console.log(".env.local loaded successfully");
} else {
  console.log(".env.local not found");
}

// Helper to stream S3 body to buffer
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function main() {
  const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const bucket = process.env.R2_BUCKET_NAME;
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firestore Admin DB failed to initialize");
  }

  const prefixes = ["daily-banners/", "encyclopedia-banners/", "encyclopedia-illustrations/"];

  console.log("Starting R2 image compression migration to WebP...");

  for (const prefix of prefixes) {
    console.log(`\n--- Processing Prefix: ${prefix} ---`);
    let continuationToken = undefined;
    let totalCount = 0;
    let convertedCount = 0;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listResponse = await s3Client.send(listCommand);
      continuationToken = listResponse.NextContinuationToken;

      const objects = listResponse.Contents || [];
      for (const obj of objects) {
        const key = obj.Key;
        totalCount++;

        // Only convert .png, .jpeg, .jpg files
        if (key.endsWith(".png") || key.endsWith(".jpeg") || key.endsWith(".jpg")) {
          console.log(`[${prefix}] Converting: ${key}`);
          try {
            // Get original S3 object
            const getRes = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const buffer = await streamToBuffer(getRes.Body);

            // Compress buffer to WebP at 75% quality
            const webpBuffer = await sharp(buffer)
              .webp({ quality: 75 })
              .toBuffer();

            // Create new key
            const newKey = key.replace(/\.(png|jpeg|jpg)$/i, ".webp");

            // Upload optimized WebP file
            await s3Client.send(new PutObjectCommand({
              Bucket: bucket,
              Key: newKey,
              Body: webpBuffer,
              ContentType: "image/webp",
              CacheControl: "public, max-age=31536000",
            }));

            // Delete original file
            await s3Client.send(new DeleteObjectCommand({
              Bucket: bucket,
              Key: key,
            }));

            console.log(`[${prefix}] Success -> ${newKey}`);
            convertedCount++;
          } catch (err) {
            console.error(`[${prefix}] Failed to migrate ${key}:`, err);
          }
        }
      }
    } while (continuationToken);

    console.log(`Finished ${prefix}. Found: ${totalCount}, Converted: ${convertedCount}`);
  }

  // 2. Update Firestore references
  console.log("\n=== Updating Firestore references ===");

  // A. daily_devotions
  console.log("Processing daily_devotions...");
  const devSnap = await db.collection("daily_devotions").get();
  let devUpdates = 0;
  for (const doc of devSnap.docs) {
    const data = doc.data();
    const updates = {};
    if (data.bannerUrl && /\.(png|jpeg|jpg)/i.test(data.bannerUrl)) {
      updates.bannerUrl = data.bannerUrl.replace(/\.(png|jpeg|jpg)/gi, ".webp");
    }
    if (data.imageUrl && /\.(png|jpeg|jpg)/i.test(data.imageUrl)) {
      updates.imageUrl = data.imageUrl.replace(/\.(png|jpeg|jpg)/gi, ".webp");
    }

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      devUpdates++;
    }
  }
  console.log(`Updated ${devUpdates} daily_devotions documents.`);

  // B. ensiklopedia_cache
  console.log("Processing ensiklopedia_cache...");
  const ensiklopediaSnap = await db.collection("ensiklopedia_cache").get();
  let ensiklopediaUpdates = 0;
  for (const doc of ensiklopediaSnap.docs) {
    const data = doc.data();
    const updates = {};
    if (data.bannerUrl && /\.(png|jpeg|jpg)/i.test(data.bannerUrl)) {
      updates.bannerUrl = data.bannerUrl.replace(/\.(png|jpeg|jpg)/gi, ".webp");
    }
    if (data.illustrationUrl && /\.(png|jpeg|jpg)/i.test(data.illustrationUrl)) {
      updates.illustrationUrl = data.illustrationUrl.replace(/\.(png|jpeg|jpg)/gi, ".webp");
    }

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      ensiklopediaUpdates++;
    }
  }
  console.log(`Updated ${ensiklopediaUpdates} ensiklopedia_cache documents.`);

  console.log("\nMigration completed successfully!");
}

main().catch(console.error);
