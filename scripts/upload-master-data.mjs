import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Load environment variables from .env.local
function loadEnv() {
  const envPath = resolve(".env.local");
  if (!existsSync(envPath)) {
    console.error("No .env.local file found.");
    process.exit(1);
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("R2 credentials not fully configured in .env.local");
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

async function uploadFile(filePath, fileName) {
  try {
    const fileContent = readFileSync(filePath, "utf8");
    const key = `Master_data_ensiklopedia/${fileName}`;

    console.log(`Uploading ${fileName} to R2 bucket: ${R2_BUCKET_NAME} as key: ${key}...`);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: Buffer.from(fileContent, "utf8"),
        ContentType: "application/json",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    console.log(`Successfully uploaded ${fileName} to R2.`);
  } catch (error) {
    console.error(`Failed to upload ${fileName}:`, error.message);
  }
}

async function main() {
  const dirPath = resolve("Master_data_ensiklopedia");
  if (!existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    process.exit(1);
  }

  const files = readdirSync(dirPath).filter(file => file.endsWith(".json"));
  console.log(`Found ${files.length} master data JSON files.`);

  for (const file of files) {
    const filePath = join(dirPath, file);
    await uploadFile(filePath, file);
  }

  console.log("Upload completed!");
}

main().catch(console.error);
