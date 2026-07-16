import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { getAdminDb } from "./firebase-admin";
import { s3Client, R2_BUCKET_NAME } from "./r2";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { headers } from "next/headers";

export function isBot(): boolean {
  try {
    const headersList = headers();
    const userAgent = headersList.get("user-agent") || "";
    const botPattern = /bot|googlebot|bingbot|yandex|baidu|duckduckbot|slurp|twitterbot|facebookexternalhit|crawler|spider|robot|crawling/i;
    return botPattern.test(userAgent);
  } catch (e) {
    return false;
  }
}

export type StorageConfig = {
  tokoh: "firebase" | "r2";
  tempat: "firebase" | "r2";
  kamus: "firebase" | "r2";
  mukjizat: "firebase" | "r2";
  perumpamaan: "firebase" | "r2";
  kitab: "firebase" | "r2";
  kronologi: "firebase" | "r2";
  artikel: "firebase" | "r2";
  renungan: "firebase" | "r2";
  songs: "firebase" | "r2";
  goldenVerse: "firebase" | "r2";
  bibleVerse: "vercel" | "firebase";
};

const DEFAULT_CONFIG: StorageConfig = {
  tokoh: "r2",
  tempat: "r2",
  kamus: "r2",
  mukjizat: "r2",
  perumpamaan: "r2",
  kitab: "r2",
  kronologi: "r2",
  artikel: "r2",
  renungan: "r2",
  songs: "r2",
  goldenVerse: "r2",
  bibleVerse: "vercel",
};

// In-memory cache for configuration
let cachedConfig: StorageConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // Cache for 60 seconds

// Helper to load config from local storage-config.json file
function getLocalConfig(): StorageConfig {
  try {
    const filePath = path.join(process.cwd(), "storage-config.json");
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("[StorageConfig] Failed to read local storage-config.json:", err);
  }
  return DEFAULT_CONFIG;
}

// Helper to load dynamic config from R2
async function getR2Config(): Promise<StorageConfig | null> {
  if (!R2_BUCKET_NAME) return null;
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: "storage-config.json",
    });
    const response = await s3Client.send(command);
    const body = response.Body;
    if (body) {
      const dataStr = await body.transformToString();
      return JSON.parse(dataStr);
    }
  } catch (err) {
    // Ignore NoSuchKey errors as it might not be uploaded yet
    console.warn("[StorageConfig] Could not fetch config from R2:", err);
  }
  return null;
}

// Fetch active storage configuration
export async function getActiveStorageConfig(): Promise<StorageConfig> {
  // If it is a bot, skip Firestore check entirely to save reads/bandwidth
  if (isBot()) {
    return cachedConfig || getLocalConfig();
  }

  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedConfig;
  }

  let config: StorageConfig | null = null;

  // Langsung gunakan R2 config (skip Firestore untuk hemat reads)
  // Firestore TIDAK digunakan sebagai sumber config agar tidak membuang kuota reads
  config = await getR2Config();

  // Fallback ke local file jika R2 tidak tersedia
  if (!config) {
    config = getLocalConfig();
  }

  cachedConfig = config;
  cacheTimestamp = now;
  return config;
}

// Update storage configuration dynamically without redeploying
export async function updateStorageConfig(newConfig: Partial<StorageConfig>): Promise<StorageConfig> {
  const current = await getActiveStorageConfig();
  const merged = { ...current, ...newConfig } as StorageConfig;

  // Update in-memory cache
  cachedConfig = merged;
  cacheTimestamp = Date.now();

  // 1. Save to Firebase
  const db = getAdminDb();
  if (db) {
    try {
      await db.collection("settings").doc("storage_config").set(merged, { merge: true });
    } catch (err) {
      console.error("[StorageConfig] Failed to save config to Firestore:", err);
    }
  }

  // 2. Save to R2
  if (R2_BUCKET_NAME) {
    try {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: "storage-config.json",
        Body: JSON.stringify(merged, null, 2),
        ContentType: "application/json",
      });
      await s3Client.send(command);
    } catch (err) {
      console.error("[StorageConfig] Failed to save config to R2:", err);
    }
  }

  return merged;
}

// Map collection & filename to the configuration key to retrieve its active source
export function getStorageSource(collectionName: string, r2FileName?: string, activeConfig?: StorageConfig): "firebase" | "r2" | "vercel" {
  // If it's a search bot or crawler, bypass Firebase completely to save quota
  if (isBot()) {
    if (collectionName === "bible_verses") return "vercel";
    return "r2";
  }

  // Use passed config or fall back to cached config, or load synchronously from local file if async not ready
  const config = activeConfig || cachedConfig || getLocalConfig();

  if (collectionName === "ensiklopedia_cache") {
    if (r2FileName) {
      const fn = r2FileName.toLowerCase();
      if (fn.includes("tokoh")) return config.tokoh;
      if (fn.includes("tempat")) return config.tempat;
      if (fn.includes("istilah") || fn.includes("kamus")) return config.kamus;
      if (fn.includes("mukjizat")) return config.mukjizat;
      if (fn.includes("perumpamaan")) return config.perumpamaan;
      if (fn.includes("kitab")) return config.kitab;
      if (fn.includes("kronologi")) return config.kronologi;
    }
    return config.tokoh; // default to tokoh if unknown file
  }

  if (collectionName === "blog_posts") return config.artikel;
  if (collectionName === "daily_devotions" || collectionName === "daily_devotion") return config.renungan;
  if (collectionName === "songs") return config.songs;
  if (collectionName === "golden_verse") return config.goldenVerse;
  if (collectionName === "bible_verses") return config.bibleVerse;

  return "firebase";
}
