#!/usr/bin/env node
import fs from 'fs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
} = process.env;

const key = process.argv[2] || 'daily-banners/golden-2026-06-04-05.png';
const out = process.argv[3] || '/tmp/banner.png';

if (!R2_BUCKET_NAME || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('R2 env vars not configured. Ensure .env.local is loaded.');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function run() {
  try {
    const cmd = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
    const res = await s3Client.send(cmd);
    const body = res.Body;
    if (!body) throw new Error('No body in response');

    // Node readable stream
    const stream = body;
    const writeStream = fs.createWriteStream(out);
    await new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    console.log(`Saved ${key} to ${out}`);
  } catch (e) {
    console.error('Fetch failed:', e);
    process.exit(2);
  }
}

run();
