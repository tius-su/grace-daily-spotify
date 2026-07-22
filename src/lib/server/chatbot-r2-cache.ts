import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import type { Readable } from "stream";

export interface ChatbotCacheItem {
  query: string;
  normalizedQuery: string;
  answer: string;
  provider: string;
  timestamp: number;
  ttlMs: number;
}

// Default TTL: 24 hours (in milliseconds)
const DEFAULT_TTL_HOURS = 24;
const DEFAULT_TTL_MS = DEFAULT_TTL_HOURS * 60 * 60 * 1000;

// Keywords that indicate real-time / daily dynamic data request that should bypass cache
const DYNAMIC_KEYWORDS = [
  // Renungan Harian
  "renungan",
  "renungan hari ini",
  "renungan harian",
  "renungan pagi",
  "renungan siang",
  "renungan malam",
  // Artikel & Blog
  "artikel",
  "artikel hari ini",
  "artikel harian",
  "artikel terbaru",
  "blog",
  "berita",
  "berita terbaru",
  "berita harian",
  "kabar terbaru",
  // Ensiklopedia & Topik Tren
  "ensiklopedia",
  "ensiklopedia kristen",
  "topik tren",
  "topik trending",
  "trending",
  "topik populer",
  "konten harian",
  "konten terbaru",
  "konten hari ini",
  // Doa & Komunitas
  "doa hari ini",
  "tembok doa",
  "komunitas doa",
  "permohonan doa",
  // Rencana Baca
  "rencana baca",
  "bacaan hari ini",
  "jadwal baca",
];

/**
 * Normalizes user query text for uniform hashing
 */
export function normalizeQuery(query: string): string {
  if (!query) return "";
  return query
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/gi, " ") // keep alphanumeric and words
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates SHA-256 hash for object key in R2
 */
export function getCacheKey(query: string): string {
  const normalized = normalizeQuery(query);
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return `chatbot-cache/${hash}.json`;
}

/**
 * Determines if query requests dynamic / daily content that should bypass R2 cache
 */
export function isDynamicQuery(query: string): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) return false;

  return DYNAMIC_KEYWORDS.some((kw) => normalized.includes(kw));
}

/**
 * Helper to convert readable stream from AWS S3 SDK to string
 */
async function streamToString(stream: Readable | any): Promise<string> {
  if (!stream) return "";
  if (typeof stream.transformToString === "function") {
    return await stream.transformToString("utf-8");
  }
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err: any) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

/**
 * Fetches cached chatbot response from Cloudflare R2
 * Returns null if query is dynamic, missing, or expired (TTL passed)
 */
export async function getCachedResponse(
  userQuery: string
): Promise<{ answer: string; provider: string; cachedAt: number } | null> {
  if (!R2_BUCKET_NAME) {
    console.warn("[Chatbot Cache] R2_BUCKET_NAME is not configured.");
    return null;
  }

  if (isDynamicQuery(userQuery)) {
    console.log(`[Chatbot Cache] Bypassing cache for dynamic query: "${userQuery}"`);
    return null;
  }

  const key = getCacheKey(userQuery);

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    if (!response.Body) return null;

    const jsonText = await streamToString(response.Body);
    if (!jsonText) return null;

    const data = JSON.parse(jsonText) as ChatbotCacheItem;
    if (!data || !data.answer) return null;

    const now = Date.now();
    const ttlMs = data.ttlMs || DEFAULT_TTL_MS;

    // Check TTL Expiration
    if (now - data.timestamp > ttlMs) {
      const ageHours = ((now - data.timestamp) / (1000 * 60 * 60)).toFixed(1);
      console.log(`[Chatbot Cache] Cache EXPIRED for query "${userQuery}" (Age: ${ageHours}h > TTL: ${ttlMs / 3600000}h)`);
      return null;
    }

    console.log(`[Chatbot Cache] Cache HIT for query: "${userQuery}" (Key: ${key})`);
    return {
      answer: data.answer,
      provider: data.provider || "openrouter",
      cachedAt: data.timestamp,
    };
  } catch (error: any) {
    if (error.name !== "NoSuchKey" && error.$metadata?.httpStatusCode !== 404) {
      console.warn(`[Chatbot Cache] Failed to read cache key ${key}:`, error.message);
    }
    return null;
  }
}

/**
 * Saves chatbot Q&A response to Cloudflare R2 with TTL metadata
 */
export async function setCachedResponse(
  userQuery: string,
  answer: string,
  provider: string,
  ttlHoursOverride?: number
): Promise<boolean> {
  if (!R2_BUCKET_NAME || !userQuery || !answer) return false;

  if (isDynamicQuery(userQuery)) {
    console.log(`[Chatbot Cache] Skipping cache save for dynamic query: "${userQuery}"`);
    return false;
  }

  const envTtlHours = process.env.CHATBOT_CACHE_TTL_HOURS
    ? parseFloat(process.env.CHATBOT_CACHE_TTL_HOURS)
    : DEFAULT_TTL_HOURS;
  const ttlHours = ttlHoursOverride || envTtlHours;
  // Maximum 20 days (480 hours)
  const safeTtlHours = Math.min(Math.max(ttlHours, 1), 480);
  const ttlMs = safeTtlHours * 60 * 60 * 1000;

  const key = getCacheKey(userQuery);
  const cacheItem: ChatbotCacheItem = {
    query: userQuery,
    normalizedQuery: normalizeQuery(userQuery),
    answer,
    provider,
    timestamp: Date.now(),
    ttlMs,
  };

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: "application/json",
      Body: JSON.stringify(cacheItem, null, 2),
    });

    await s3Client.send(command);
    console.log(`[Chatbot Cache] Successfully saved R2 cache for: "${userQuery}" (Key: ${key}, TTL: ${safeTtlHours}h)`);
    return true;
  } catch (error: any) {
    console.error(`[Chatbot Cache] Failed to save R2 cache key ${key}:`, error.message);
    return false;
  }
}
