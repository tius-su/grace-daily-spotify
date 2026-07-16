import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAdminDb } from "@/lib/server/firebase-admin";


const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME;
const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

let s3Client: S3Client | null = null;
if (r2AccountId && r2AccessKey && r2SecretKey) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKey,
      secretAccessKey: r2SecretKey,
    },
  });
}

function proxyUrlBase(key: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${appUrl.replace(/\/$/, "")}/api/media/public?key=${encodeURIComponent(key)}`;
}

async function r2ObjectExists(key: string) {
  if (!s3Client || !r2BucketName) return false;
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: r2BucketName,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

async function uploadBufferToR2({ key, contentType, buffer }: { key: string; contentType: string; buffer: Buffer }) {
  if (!s3Client || !r2BucketName || !r2PublicUrl) return "";

  let uploadBuffer: any = buffer;
  let uploadKey = key;
  let uploadContentType = contentType;

  // Convert and optimize image to WebP on-the-fly (excluding SVGs)
  if (contentType.startsWith("image/") && !key.endsWith(".svg")) {
    try {
      const { optimizeToWebp } = await import("@/lib/server/image-optimizer");
      const optimized = await optimizeToWebp(buffer);
      uploadBuffer = optimized.buffer;
      uploadContentType = optimized.contentType;
      uploadKey = key.replace(/\.[^/.]+$/, "") + ".webp";
    } catch (err) {
      console.error("[encyclopedia-images] WebP optimization failed, uploading original:", err);
    }
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: r2BucketName,
      Key: uploadKey,
      Body: uploadBuffer,
      ContentType: uploadContentType,
      CacheControl: "public, max-age=31536000",
    }),
  );

  // return via proxy (lebih konsisten dengan app kamu)
  const proxyBase = proxyUrlBase(uploadKey);
  return `${proxyBase}${proxyBase.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

async function generateImageWithHuggingFace(prompt: string) {
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HUGGINGFACE_ACCESS_TOKEN || process.env.HF_TOKEN;
  if (!token) return null;

  const model = process.env.HUGGINGFACE_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png,image/jpeg,image/webp,*/*",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        width: 1024,
        height: 768,
        guidance_scale: 7,
      },
    }),
  });

  const contentType = response.headers.get("content-type") || "image/png";
  if (!response.ok || !contentType.startsWith("image/")) {
    const errorText = await response.text().catch(() => "");
    console.warn(`[Hugging Face AI Error] Status: ${response.status}, Content-Type: ${contentType}. Detail:`, errorText);
    return null;
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}

async function generateImageWithCloudflare(prompt: string, customToken?: string, customAccountId?: string) {
  const accountId = customAccountId || process.env.R2_ACCOUNT_ID;
  const token = customToken || process.env.CLOUDFLARE_AI_TOKEN;
  if (!accountId || !token) return null;

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.warn(`[Cloudflare AI Error] Status: ${response.status}. Detail:`, errorText);
    
    const isLimit = response.status === 429 || errorText.includes("limit exceeded") || errorText.includes("10015");
    if (isLimit) {
      try {
        const db = getAdminDb();
        if (db) {
          await db.collection("settings").doc("ai_status").set({
            cloudflareLimitExceeded: true,
            cloudflareLimitExceededAt: new Date(),
            updatedAt: new Date(),
            lastError: errorText
          }, { merge: true });
        }
      } catch (err) {
        console.error("Failed to update AI status on failure:", err);
      }
    }
    return null;
  }
  try {
    const json = await response.json();
    const base64Image = json.result?.image;
    if (!base64Image) return null;

    const buffer = Buffer.from(base64Image, "base64");
    if (buffer.length < 1000) return null; // Too small to be a valid image

    // Set cloudflare status as active (success)
    try {
      const db = getAdminDb();
      if (db) {
        await db.collection("settings").doc("ai_status").set({
          cloudflareLimitExceeded: false,
          updatedAt: new Date()
        }, { merge: true });
      }
    } catch (err) {
      console.error("Failed to update AI status on success:", err);
    }

    return { buffer, contentType: "image/jpeg" };
  } catch (err) {
    console.warn("Failed to parse Cloudflare Workers AI response:", err);
    return null;
  }
}

async function generateImageWithPollinations(prompt: string) {
  const width = 1024;
  const height = 768;
  const model = "flux";
  
  const token = process.env.POLLINATIONS_API_KEY || process.env.POLLINATIONS_TOKEN;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${model}&nologo=true&private=true`;
  
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

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
}



async function generateIllustrationWithFallback(prompt: string) {
  // 1. Try Cloudflare Workers AI primary first
  try {
    const cfImage = await generateImageWithCloudflare(prompt);
    if (cfImage) return cfImage;
  } catch (err) {
    console.warn("Cloudflare AI generation failed:", err);
  }

  // 2. Try Cloudflare Workers AI backup second
  try {
    const backupToken = process.env.CLOUDFLARE_AI_TOKEN_BACKUP;
    const backupAccountId = process.env.CLOUDFLARE_ACCOUNT_ID_BACKUP || process.env.R2_ACCOUNT_ID;
    if (backupToken) {
      const cfImageBackup = await generateImageWithCloudflare(prompt, backupToken, backupAccountId);
      if (cfImageBackup) return cfImageBackup;
    }
  } catch (err) {
    console.warn("Cloudflare AI backup generation failed:", err);
  }

  // 3. Try Pollinations AI as third fallback
  try {
    const pollinationsImage = await generateImageWithPollinations(prompt);
    if (pollinationsImage) return pollinationsImage;
  } catch (err) {
    console.warn("Pollinations AI generation failed:", err);
  }

  // 4. Try Hugging Face as fourth fallback
  try {
    const hfImage = await generateImageWithHuggingFace(prompt);
    if (hfImage) return hfImage;
  } catch (err) {
    console.warn("Hugging Face generation failed:", err);
  }

  return null;
}

export async function ensureEncyclopediaBannerIllustrationR2(params: {
  slug: string;
  kategori: string;
  topik: string;
  illustrationPrompt?: string;
  force?: boolean;
}): Promise<string> {
  const { slug, kategori, topik, illustrationPrompt, force = false } = params;

  const key = `encyclopedia-banners/${slug}.webp`;

  // 1) If cached in R2, return proxy URL
  if (!force) {
    const exists = await r2ObjectExists(key);
    if (exists) {
      const proxyBase = proxyUrlBase(key);
      return `${proxyBase}${proxyBase.includes("?") ? "&" : "?"}t=${Date.now()}`;
    }
  }

  // 2) Generate image using existing generator API (same style as daily-devotion)
  //    We re-use /api/admin/generate-image because it already outputs PNG-like banners.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const title = topik;
  const capitalizedKategori = kategori.charAt(0).toUpperCase() + kategori.slice(1);
  const descText = illustrationPrompt || `${capitalizedKategori} — ${topik}`;

  const bannerApiUrl = `${appUrl}/api/admin/generate-image?title=${encodeURIComponent(title)}&description=${encodeURIComponent(descText)}&icon=logo&bg=sage`;

  try {
    const imgResponse = await fetch(bannerApiUrl);
    if (!imgResponse.ok) {
      return "";
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3) Upload to R2 (ensures permanent caching)
    try {
      const proxy = await uploadBufferToR2({ key, contentType: "image/png", buffer });
      return proxy;
    } catch {
      // Fallback: return proxy for cached key (may 404 if upload fails)
      const proxyBase = proxyUrlBase(key);
      return `${proxyBase}${proxyBase.includes("?") ? "&" : "?"}t=${Date.now()}`;
    }
  } catch (err) {
    console.error("[encyclopedia-images] Gagal mengambil/menyimpan banner ilustrasi dari API:", err);
    // Fallback: kembalikan URL proxy key langsung
    const proxyBase = proxyUrlBase(key);
    return `${proxyBase}${proxyBase.includes("?") ? "&" : "?"}t=${Date.now()}`;
  }
}

export async function ensureEncyclopediaBannerR2(params: {
  slug: string;
  kategori: string;
  topik: string;
  force?: boolean;
}) {
  return ensureEncyclopediaBannerIllustrationR2(params);
}

function illustrationPromptFor({ kategori, topik }: { kategori: string; topik: string }) {
  return [
    `Biblical encyclopedia illustration of ${topik}.`,
    `Category: ${kategori}.`,
    "Historical ancient Near East setting, cinematic painterly realism, natural light, no text, no typography, no logo, no modern objects.",
    "Respectful Christian educational artwork, detailed environment, human scale scene when appropriate.",
  ].join(" ");
}

export async function ensureEncyclopediaIllustrationR2(params: {
  slug: string;
  kategori: string;
  topik: string;
  illustrationPrompt?: string;
  force?: boolean;
}): Promise<string> {
  const { slug, kategori, topik, illustrationPrompt, force = false } = params;
  const key = `encyclopedia-illustrations/${slug}.webp`;

  if (!force) {
    const exists = await r2ObjectExists(key);
    if (exists) {
      const proxyBase = proxyUrlBase(key);
      return `${proxyBase}${proxyBase.includes("?") ? "&" : "?"}t=${Date.now()}`;
    }
  }

  const prompt = illustrationPrompt || illustrationPromptFor({ kategori, topik });

  let buffer: Buffer | null = null;
  let contentType = "image/png";

  try {
    // Increase timeout to 30s for HuggingFace FLUX model
    const image = await Promise.race([
      generateIllustrationWithFallback(prompt).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000))
    ]);

    if (image) {
      buffer = image.buffer;
      contentType = image.contentType;
    }
  } catch (err) {
    console.warn("External image generation failed:", err);
  }

  // If failed, fallback to a consistent static placeholder image using Picsum
  if (!buffer) {
    return `https://picsum.photos/seed/${slug}/1024/768`;
  }

  try {
    return await uploadBufferToR2({ key, contentType, buffer });
  } catch (err) {
    console.error("Upload to R2 failed:", err);
  }

  const proxyBase = proxyUrlBase(key);
  return `${proxyBase}${proxyBase.includes("?") ? "&" : "?"}t=${Date.now()}`;
}
