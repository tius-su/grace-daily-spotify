import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

async function objectExists(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
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

async function generatePollinationsImage(prompt) {
  try {
    const width = 1024;
    const height = 768;
    const model = "flux";
    const token = process.env.POLLINATIONS_API_KEY || process.env.POLLINATIONS_TOKEN;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${model}&nologo=true&private=true`;

    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { method: "GET", headers });
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!response.ok || !contentType.startsWith("image/")) {
      const errorText = await response.text().catch(() => "");
      console.warn(`[Pollinations AI Error] Status: ${response.status}, Content-Type: ${contentType}. Detail:`, errorText);
      return null;
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType,
    };
  } catch (error) {
    console.warn("Pollinations AI generation failed:", error.message);
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

async function ensureIllustration({ client, bucket, key, kategori, topik, force }) {
  if (!force && await objectExists(client, bucket, key)) {
    return proxyUrlForKey(key);
  }

  const prompt = illustrationPromptFor({ kategori, topik });

  let image = await generateCloudflareImage(prompt);
  if (!image) {
    image = await generatePollinationsImage(prompt);
  }
  if (!image) {
    image = await generateHuggingFaceImage(prompt);
  }

  if (!image) {
    // Fallback to static picsum
    return `https://picsum.photos/seed/${slugify(topik)}/1024/768`;
  }

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
    console.error("R2 env belum lengkap.");
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

  const forceAll = process.argv.includes("--force-all");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 500;
  const snapshot = await db.collection("ensiklopedia_cache").limit(Number.isFinite(limit) ? limit : 500).get();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data();
    const kategori = data.kategori || doc.id.split("-")[0] || "tokoh";
    const keyword = data.keyword || data.title || data.slug || doc.id;
    const slug = data.slug || slugify(keyword);
    const current = data.illustrationUrl || "";
    const needsUpdate = forceAll || !current || isLegacyIllustrationUrl(current) || !isValidIllustrationUrl(current);

    if (!needsUpdate) {
      skipped += 1;
      continue;
    }

    const key = `encyclopedia-illustrations/${kategori}-${slug}-illustration.png`;
    const illustrationUrl = await ensureIllustration({
      client,
      bucket,
      key,
      kategori,
      topik: keyword,
      force: forceAll || isLegacyIllustrationUrl(current),
    });

    if (!illustrationUrl) {
      console.warn(`Failed: ${doc.id}`);
      continue;
    }

    await doc.ref.set({ illustrationUrl, updatedAt: new Date() }, { merge: true });
    updated += 1;
    console.log(`Updated ${doc.id}`);
  }

  console.log(JSON.stringify({ scanned, updated, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
