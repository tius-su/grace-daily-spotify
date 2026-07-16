import fs from "fs";
import path from "path";
import zlib from "zlib";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// Load .env.local manually
const envFile = fs.readFileSync(".env.local", "utf8");
envFile.split("\n").forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const parts = trimmed.split("=");
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim().replace(/(^['"]|['"]$)/g, "");
    process.env[key] = val;
  }
});

console.log("R2 Bucket:", process.env.R2_BUCKET_NAME);
console.log("R2 Account ID:", process.env.R2_ACCOUNT_ID);

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

async function run() {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: "backup/blog_posts.json",
    });

    console.log("Fetching backup/blog_posts.json from R2...");
    const response = await s3Client.send(command);
    const body = response.Body;
    if (!body) {
      throw new Error("Empty body returned from R2");
    }

    let buffer = Buffer.from(await body.transformToByteArray());
    console.log("Download successful! File size:", buffer.length, "bytes");
    console.log("Content-Encoding from metadata:", response.ContentEncoding);

    let textContent = "";
    if (response.ContentEncoding === "gzip" || (buffer[0] === 0x1f && buffer[1] === 0x8b)) {
      console.log("Decompressing gzip data...");
      textContent = zlib.gunzipSync(buffer).toString("utf8");
    } else {
      textContent = buffer.toString("utf8");
    }

    // Attempt parse
    const data = JSON.parse(textContent);
    console.log("Parsed successfully! Total blog posts:", Array.isArray(data) ? data.length : "Not an array");
    if (Array.isArray(data) && data.length > 0) {
      console.log("Sample post title:", data[0].title);
    }
  } catch (error) {
    console.error("Error reading/processing R2 file:", error);
  }
}

run();
