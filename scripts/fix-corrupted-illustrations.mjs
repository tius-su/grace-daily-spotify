import { HeadObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";
import path from "path";

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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isLegacyIllustrationUrl(value) {
  if (!value || typeof value !== "string") return false;
  const decoded = decodeURIComponent(value);
  return decoded.includes("encyclopedia-banners/") && decoded.includes("-illustration");
}

function isValidIllustrationUrl(value) {
  return typeof value === "string" && (value.includes("encyclopedia-illustrations/") || value.includes("picsum.photos/seed"));
}

function proxyUrlForKey(key) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";
  return `${appUrl.replace(/\/$/, "")}/api/media/public?key=${encodeURIComponent(key)}&t=${Date.now()}`;
}

function illustrationPromptFor({ kategori, topik }) {
  return [
    `Biblical encyclopedia illustration of ${topik}.`,
    `Category: ${kategori}.`,
    "Historical ancient Near East setting, cinematic painterly realism, natural light, no text, no typography, no logo, no modern objects.",
    "Respectful Christian educational artwork, detailed environment, human scale scene when appropriate.",
  ].join(" ");
}

async function checkIsCorruptedJson(client, bucket, key) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: "bytes=0-99",
    });
    const response = await client.send(command);
    const bodyString = await response.Body.transformToString("utf8");
    return bodyString.trim().startsWith("{");
  } catch (err) {
    console.warn(`Could not check R2 object for key=${key}:`, err.message);
    // If it doesn't exist, we treat it as corrupted/missing
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return true;
    }
    return false;
  }
}

async function generateCloudflareImage(prompt) {
  try {
    const accountId = process.env.R2_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_AI_TOKEN;
    if (!accountId || !token) return null;

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) return null;
    const json = await response.json();
    const base64Image = json.result?.image;
    if (!base64Image) return null;

    const buffer = Buffer.from(base64Image, "base64");
    if (buffer.length < 1000) return null;
    return { buffer, contentType: "image/jpeg" };
  } catch (error) {
    console.warn("Cloudflare AI generation failed:", error.message);
    return null;
  }
}

async function generateHuggingFaceImage(prompt) {
  try {
    const token = process.env.HUGGINGFACE_ACCESS_TOKEN || process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN;
    if (!token) return null;
    const model = process.env.HUGGINGFACE_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "image/png,image/jpeg,image/webp,*/*",
      },
      body: JSON.stringify({ inputs: prompt, parameters: { width: 1024, height: 768, guidance_scale: 7 } }),
    });
    const contentType = response.headers.get("content-type") || "image/png";
    if (!response.ok || !contentType.startsWith("image/")) return null;
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
  } catch (error) {
    console.warn("HuggingFace generation failed:", error.message);
    return null;
  }
}

async function regenerateIllustration({ client, bucket, key, kategori, topik }) {
  console.log(`Generating correct illustration for "${topik}"...`);
  const prompt = illustrationPromptFor({ kategori, topik });
  
  let image = await generateCloudflareImage(prompt);
  if (!image) {
    image = await generateHuggingFaceImage(prompt);
  }
  
  if (!image) {
    console.warn(`Both AI providers failed. Falling back to picsum for "${topik}"`);
    return `https://picsum.photos/seed/${slugify(topik)}/1024/768`;
  }

  console.log(`Uploading correct illustration for "${topik}" to R2 (${image.buffer.length} bytes)...`);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: image.buffer,
    ContentType: image.contentType,
    CacheControl: "public, max-age=31536000",
  }));

  return proxyUrlForKey(key);
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

  const snapshot = await db.collection("ensiklopedia_cache").get();
  console.log(`Found ${snapshot.docs.length} cached documents.`);

  let scanned = 0;
  let fixedCount = 0;
  let cleanCount = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data();
    const kategori = data.kategori || doc.id.split("-")[0] || "tokoh";
    const keyword = data.keyword || data.title || data.slug || doc.id;
    const slug = data.slug || slugify(keyword);
    const illustrationUrl = data.illustrationUrl || "";

    if (!illustrationUrl) {
      console.log(`[${doc.id}] No illustration URL. Skipped.`);
      continue;
    }

    // Determine the R2 Key from URL
    let r2Key = "";
    if (illustrationUrl.includes("/api/media/public")) {
      try {
        const parsedUrl = new URL(illustrationUrl);
        const keyParam = parsedUrl.searchParams.get("key");
        if (keyParam) {
          r2Key = decodeURIComponent(keyParam);
        }
      } catch (e) {
        console.warn(`Failed to parse URL for ${doc.id}: ${illustrationUrl}`);
      }
    }

    if (!r2Key) {
      // If it's a direct picsum URL or something external, check if it fits the schema. If it's legacy, we force update.
      if (isLegacyIllustrationUrl(illustrationUrl) || !isValidIllustrationUrl(illustrationUrl)) {
        r2Key = `encyclopedia-illustrations/${kategori}-${slug}-illustration.png`;
      } else {
        console.log(`[${doc.id}] Valid external URL: ${illustrationUrl}. Skipped.`);
        cleanCount += 1;
        continue;
      }
    }

    console.log(`[${doc.id}] Checking key "${r2Key}"...`);
    const isCorrupted = await checkIsCorruptedJson(client, bucket, r2Key);

    if (isCorrupted) {
      console.log(`[${doc.id}] Illustration is corrupted (JSON or missing)! Regenerating...`);
      try {
        const newUrl = await regenerateIllustration({
          client,
          bucket,
          key: r2Key,
          kategori,
          topik: keyword
        });

        if (newUrl) {
          await doc.ref.set({ illustrationUrl: newUrl, updatedAt: new Date() }, { merge: true });
          console.log(`[${doc.id}] Successfully regenerated and updated in database!`);
          fixedCount += 1;
        }
      } catch (err) {
        console.error(`[${doc.id}] Failed to regenerate:`, err.message);
      }
    } else {
      console.log(`[${doc.id}] Illustration is OK.`);
      cleanCount += 1;
    }
  }

  console.log("\nScan complete:");
  console.log(JSON.stringify({ scanned, fixedCount, cleanCount }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
