import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const RETENTION_DAYS = 300;

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("❌ Cloudflare R2 credentials not set in environment variables (.env.local)");
  process.exit(1);
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function getObjectDate(key, lastModified) {
  const match = key.match(/(\d{4}-\d{2}-\d{2})/);
  if (match && match[1]) {
    const parsed = new Date(match[1]);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return lastModified || new Date();
}

async function main() {
  const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffTime);

  console.log(`🧹 Scanning Cloudflare R2 bucket "${R2_BUCKET_NAME}" for podcast audio files older than ${RETENTION_DAYS} days...`);
  console.log(`   Cutoff date: ${cutoffDate.toISOString()}`);

  let continuationToken;
  let totalScanned = 0;
  const keysToDelete = [];

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: "podcasts/",
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    const items = response.Contents || [];
    totalScanned += items.length;

    for (const item of items) {
      if (!item.Key) continue;
      const isMp3 = item.Key.toLowerCase().endsWith(".mp3") || item.Key.toLowerCase().endsWith(".m4a");
      if (isMp3) {
        const date = getObjectDate(item.Key, item.LastModified);
        if (date.getTime() < cutoffTime) {
          keysToDelete.push(item.Key);
        }
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`📊 Total objects scanned: ${totalScanned}`);
  console.log(`🗑️ Objects eligible for deletion (> ${RETENTION_DAYS} days old): ${keysToDelete.length}`);

  if (keysToDelete.length > 0) {
    for (let i = 0; i < keysToDelete.length; i += 1000) {
      const batch = keysToDelete.slice(i, i + 1000);
      const delCommand = new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: batch.map((k) => ({ Key: k })),
          Quiet: true,
        },
      });
      await s3Client.send(delCommand);
      console.log(`   Deleted batch of ${batch.length} files.`);
    }
    console.log(`✅ Successfully deleted ${keysToDelete.length} expired podcast audio files.`);
  } else {
    console.log(`✨ All podcast audio files are up to date within the ${RETENTION_DAYS}-day window.`);
  }
}

main().catch((err) => {
  console.error("❌ Error during R2 cleanup:", err);
  process.exit(1);
});
