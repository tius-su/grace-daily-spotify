#!/usr/bin/env node
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  NEXT_PUBLIC_APP_URL,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("Missing R2 env vars. Ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME are set.");
  process.exit(1);
}

const origin = NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function run() {
  const corsConfig = {
    CORSRules: [
      {
        AllowedHeaders: ["*"],
        AllowedMethods: ["GET", "HEAD"],
        AllowedOrigins: [origin, "*"],
        ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
        MaxAgeSeconds: 3600,
      },
    ],
  };

  try {
    const cmd = new PutBucketCorsCommand({
      Bucket: R2_BUCKET_NAME,
      CORSConfiguration: corsConfig,
    });
    await client.send(cmd);
    console.log(`Successfully applied CORS to bucket ${R2_BUCKET_NAME} (allowed origins: ${origin})`);
  } catch (e) {
    console.error("Failed to set CORS:", e);
    process.exit(2);
  }
}

run();
