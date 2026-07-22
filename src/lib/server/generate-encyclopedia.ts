import { Firestore, FieldValue } from "firebase-admin/firestore";
import { getAdminDb, reportDbFailure, withDbTimeout } from "./firebase-admin";
import { s3Client, R2_BUCKET_NAME } from "./r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EncyclopediaMasterEntry {
  // Generic interface to handle different master data structures
  id?: string;
  person_id?: string;
  person_name?: string;
  tokoh?: string;
  nama?: string;
  istilah?: string;
  definisi?: string;
  istilah_asli?: string;
  event_id?: string;
  section?: string;
  [key: string]: any;
}

export interface EncyclopediaCacheEntry {
  id: string;
  kategori: string;
  keyword: string;
  slug: string;
  title: string;
  isi_artikel: string;
  bannerUrl?: string;
  illustrationUrl?: string;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    image?: string;
  };
  status: "published" | "draft" | "review";
  createdAt: Date | string;
  updatedAt: Date | string;
  normalizedKeyword?: string;
  isGenerated?: boolean;
  generatedAt?: Date | string;
  provider?: string;
  sourceFile?: string;
  sourceId?: string;
}

export interface CronLogEntry {
  id: string;
  date: string;
  cronType: string;
  target: number;
  success: number;
  duplicate: number;
  failed: number;
  entries: Array<{
    keyword: string;
    kategori: string;
    slug: string;
    title?: string;
    status: "success" | "duplicate" | "failed";
    error?: string;
    generatedAt: string;
  }>;
  status: "BERHASIL" | "PERLU_PERHATIAN";
  createdAt: Date | string;
}

export interface GenerationResult {
  success: boolean;
  entry: EncyclopediaCacheEntry | null;
  error?: string;
  isDuplicate?: boolean;
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

// All available categories with their master data files
const ALL_CATEGORIES = [
  "tokoh",
  "tempat",
  "kamus",
  "mukjizat",
  "perumpamaan",
  "kitab",
  "kronologi",
  "silsilah",
  "teologi",
  "teologi-2",
  "topikal_alkitab",
  "peristiwa",
  "peristiwa-2",
];

// Number of entries per category per day
const ENTRIES_PER_CATEGORY = 5;
// Total entries to generate per day
const TOTAL_ENTRIES_PER_DAY = 25;

/**
 * Get today's categories for rotation
 * Selects 5 categories out of all available, rotating daily
 */
export function getTodaysCategories(): string[] {
  // Get a deterministic seed based on today's date
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const diffTime = today.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Simple rotation: use dayOfYear modulo number of categories
  // This ensures we cycle through all categories over time
  const startIndex = dayOfYear % ALL_CATEGORIES.length;

  // Select 5 consecutive categories (wrapping around if needed)
  const selectedCategories: string[] = [];
  for (let i = 0; i < 5; i++) {
    const index = (startIndex + i) % ALL_CATEGORIES.length;
    selectedCategories.push(ALL_CATEGORIES[index]);
  }

  return selectedCategories;
}

// Master data file mapping
const MASTER_DATA_FILES: Record<string, string> = {
  tokoh: "tokoh.json",
  tempat: "tempat.json",
  kamus: "kamus.json",
  mukjizat: "mukjizat.json",
  perumpamaan: "perumpamaan.json",
  kitab: "kitab.json",
  kronologi: "kronologi.json",
  silsilah: "silsilah_tokoh.json",
  teologi: "teologi.json",
  "teologi-2": "teologi-2.json",
  topikal_alkitab: "topikal_alkitab.json",
  peristiwa: "peristiwa.json",
  "peristiwa-2": "peristiwa-2.json",
};

// Field name mapping for each master data file (FIXED: sesuai struktur JSON aktual)
// tokoh: field "tokoh" berisi nama bahasa Indonesia (lebih akurat untuk ensiklopedia ID)
// teologi: field "istilah" berisi term yang bersih, bukan "teologi" yang berformat kode
// teologi-2: field "teologi" berisi nama epoch dalam bahasa Indonesia
// topikal_alkitab: field "topikal" = subject (uppercase, perlu title-case)
const FIELD_MAPPINGS: Record<string, { keywordField: string; nameField?: string; idField?: string }> = {
  tokoh: { keywordField: "tokoh", nameField: "tokoh", idField: "person_id" },
  tempat: { keywordField: "tempat", nameField: "tempat", idField: "place_id" },
  kamus: { keywordField: "Kamus", nameField: "Kamus" },
  mukjizat: { keywordField: "Mukjizat", nameField: "Mukjizat" },
  perumpamaan: { keywordField: "Perumpamaan", nameField: "Perumpamaan" },
  kitab: { keywordField: "kitab_name", nameField: "kitab_name", idField: "kitab_code" },
  kronologi: { keywordField: "Kronologi", nameField: "Kronologi" },
  silsilah: { keywordField: "nama", nameField: "nama", idField: "tokoh_id" },
  // teologi: gunakan field "istilah" (bersih), bukan "teologi" yang berformat "YHVH 1 1"
  teologi: { keywordField: "istilah", nameField: "istilah" },
  // teologi-2: gunakan "teologi" yang berisi nama epoch bahasa Indonesia ("Penciptaan" dll)
  "teologi-2": { keywordField: "teologi", nameField: "teologi", idField: "epoch_id" },
  // topikal_alkitab: field "topikal" = subject name (uppercase → perlu title-case saat extract)
  topikal_alkitab: { keywordField: "topikal", nameField: "topikal", idField: "entry_id" },
  peristiwa: { keywordField: "peristiwa", nameField: "peristiwa", idField: "event_id" },
  // peristiwa-2: gunakan event_name (English) sebagai fallback, tapi "peristiwa" (ID) sebagai primary
  "peristiwa-2": { keywordField: "peristiwa", nameField: "peristiwa", idField: "event_id" },
};

// Nama kitab Alkitab dalam Bahasa Indonesia
const KITAB_NAMES: Record<string, string> = {
  GEN: "Kejadian", EXO: "Keluaran", LEV: "Imamat", NUM: "Bilangan", DEU: "Ulangan",
  JOS: "Yosua", JDG: "Hakim-Hakim", RUT: "Rut", "1SA": "1 Samuel", "2SA": "2 Samuel",
  "1KI": "1 Raja-Raja", "2KI": "2 Raja-Raja", "1CH": "1 Tawarikh", "2CH": "2 Tawarikh",
  EZR: "Ezra", NEH: "Nehemia", EST: "Ester", JOB: "Ayub", PSA: "Mazmur",
  PRO: "Amsal", ECC: "Pengkhotbah", SNG: "Kidung Agung", ISA: "Yesaya",
  JER: "Yeremia", LAM: "Ratapan", EZK: "Yehezkiel", DAN: "Daniel",
  HOS: "Hosea", JOL: "Yoel", AMO: "Amos", OBA: "Obaja", JON: "Yunus",
  MIC: "Mikha", NAM: "Nahum", HAB: "Habakuk", ZEP: "Zefanya",
  HAG: "Hagai", ZEC: "Zakharia", MAL: "Maleakhi",
  MAT: "Matius", MRK: "Markus", LUK: "Lukas", JHN: "Yohanes",
  ACT: "Kisah Para Rasul", ROM: "Roma",
  "1CO": "1 Korintus", "2CO": "2 Korintus", GAL: "Galatia",
  EPH: "Efesus", PHP: "Filipi", COL: "Kolose",
  "1TH": "1 Tesalonika", "2TH": "2 Tesalonika",
  "1TI": "1 Timotius", "2TI": "2 Timotius",
  TIT: "Titus", PHM: "Filemon", HEB: "Ibrani",
  JAS: "Yakobus", "1PE": "1 Petrus", "2PE": "2 Petrus",
  "1JN": "1 Yohanes", "2JN": "2 Yohanes", "3JN": "3 Yohanes",
  JUD: "Yudas", REV: "Wahyu",
};

const MIN_ARTICLE_LENGTH = 200; // Minimum characters for a valid article
const MAX_RETRIES = 3; // Maximum retries for AI generation
const BATCH_SIZE = ENTRIES_PER_CATEGORY; // Entries per category per run (legacy alias)

// ============================================================================
// AI PROVIDER MONITORING
// ============================================================================

interface AIUsageLog {
  provider: string;
  keyIndex: number;
  category: string;
  keyword: string;
  status: "success" | "failed";
  error?: string;
  durationMs: number;
  timestamp: Date;
}

let aiUsageLogs: AIUsageLog[] = [];

/**
 * Log AI provider usage for monitoring
 */
function logAIUsage(log: AIUsageLog): void {
  aiUsageLogs.push(log);

  // Keep only last 1000 logs to prevent memory issues
  if (aiUsageLogs.length > 1000) {
    aiUsageLogs = aiUsageLogs.slice(-1000);
  }

  // Log to console for debugging
  console.log(
    `[AI Monitor] ${log.provider}[${log.keyIndex}] | ${log.status} | ${log.category}/${log.keyword} | ${log.durationMs}ms`
  );
}

/**
 * Get AI provider usage statistics
 */
export function getAIUsageStats(): {
  totalCalls: number;
  byProvider: Record<string, { total: number; success: number; failed: number; avgDuration: number }>;
  byCategory: Record<string, { total: number; byProvider: Record<string, number> }>;
  recentLogs: AIUsageLog[];
} {
  const byProvider: Record<string, { total: number; success: number; failed: number; durations: number[] }> = {};
  const byCategory: Record<string, { total: number; byProvider: Record<string, number> }> = {};

  for (const log of aiUsageLogs) {
    // By provider stats
    if (!byProvider[log.provider]) {
      byProvider[log.provider] = { total: 0, success: 0, failed: 0, durations: [] };
    }
    byProvider[log.provider].total++;
    byProvider[log.provider][log.status]++;
    byProvider[log.provider].durations.push(log.durationMs);

    // By category stats
    if (!byCategory[log.category]) {
      byCategory[log.category] = { total: 0, byProvider: {} };
    }
    byCategory[log.category].total++;
    byCategory[log.category].byProvider[log.provider] =
      (byCategory[log.category].byProvider[log.provider] || 0) + 1;
  }

  // Calculate average durations
  const byProviderResult: Record<string, { total: number; success: number; failed: number; avgDuration: number }> = {};
  for (const [provider, stats] of Object.entries(byProvider)) {
    byProviderResult[provider] = {
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      avgDuration: stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length,
    };
  }

  return {
    totalCalls: aiUsageLogs.length,
    byProvider: byProviderResult,
    byCategory,
    recentLogs: aiUsageLogs.slice(-50), // Last 50 logs
  };
}

// ============================================================================
// AI PROVIDER CONFIGURATION (Priority Order as requested)
// ============================================================================

interface AIProviderConfig {
  name: string;
  keys: string[];
  endpoint: string;
  model: string;
  headers: (key: string) => Record<string, string>;
}

const AI_PROVIDERS: AIProviderConfig[] = [
  {
    name: "groq",
    keys: [
      process.env.GROQ_API_KEY || "",
      process.env.GROQ_API_KEY_BACKUP || "",
    ].filter(Boolean) as string[],
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    headers: (key: string) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
  },
  {
    name: "openai",
    keys: [
      process.env.OPENROUTER_API_KEY_BACKUP || "",
      process.env.OPENROUTER_API_KEY_BACKUP_BACKUP || "",
    ].filter(Boolean) as string[],
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    headers: (key: string) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
  },
  {
    name: "gemini",
    keys: [
      process.env.GEMINI_API_KEY || "",
    ].filter(Boolean) as string[],
    endpoint: "",
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    headers: () => ({}),
  },
  {
    name: "openrouter",
    keys: [
      process.env.OPENROUTER_API_KEY || "",
      process.env.OPENROUTER_API_KEY_BACKUP || "",
      process.env.OPENROUTER_API_KEY_BACKUP2?.startsWith("sk-or-") ? process.env.OPENROUTER_API_KEY_BACKUP2 : "",
    ].filter(Boolean) as string[],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
    headers: (key: string) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://grace-daily.app",
      "X-Title": "Grace Daily",
    }),
  },
  {
    name: "deepseek",
    keys: [
      process.env.OPENROUTER_API_KEY_BACKUP2?.startsWith("sk-") && !process.env.OPENROUTER_API_KEY_BACKUP2?.startsWith("sk-or-") ? process.env.OPENROUTER_API_KEY_BACKUP2 : "",
      process.env.OPENROUTER_API_KEY_BACKUP2_BACKUP || "",
    ].filter(Boolean) as string[],
    endpoint: "https://api.deepseek.com/chat/completions",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    headers: (key: string) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
  },
  {
    name: "openrouter_second_backup",
    keys: [
      process.env.OPENROUTER_API_KEY_SECOND_BACKUP || "",
    ].filter(Boolean) as string[],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
    headers: (key: string) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://grace-daily.app",
      "X-Title": "Grace Daily",
    }),
  },
  {
    name: "mistral",
    keys: [
      process.env.MISTRAL_API_KEY || "",
    ].filter(Boolean) as string[],
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    model: process.env.MISTRAL_MODEL || "mistral-large-latest",
    headers: (key: string) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
  },
  {
    name: "nvidia",
    keys: [
      process.env.NVIDIA_API_KEY || "",
      process.env.NVIDIA_API_KEY_BACKUP || "",
    ].filter(Boolean) as string[],
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
    headers: (key: string) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize keyword for duplicate checking
 */
function normalizeKeyword(keyword: string): string {
  if (!keyword) return "";
  return keyword
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate slug from keyword
 */
function generateSlug(keyword: string): string {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return `untitled-${Date.now()}`;

  return normalized
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extract keyword from master data entry based on category
 * Returns a clean, human-readable keyword for the encyclopedia entry
 */
function extractKeywordFromEntry(entry: EncyclopediaMasterEntry, category: string): string {
  const mapping = FIELD_MAPPINGS[category];
  if (!mapping) return "";

  // =========================================================================
  // SPECIAL: tokoh — prefer field "tokoh" (nama bahasa Indonesia)
  // Fallback ke person_name jika tokoh kosong
  // =========================================================================
  if (category === "tokoh") {
    const namaId = entry.tokoh ? String(entry.tokoh).trim() : "";
    const namaEn = entry.person_name ? String(entry.person_name).trim() : "";
    // Gunakan nama Indonesia jika tersedia dan bukan lowercase semua (artinya valid)
    if (namaId && namaId.length > 0) return namaId;
    if (namaEn && namaEn.length > 0) return namaEn;
  }

  // =========================================================================
  // SPECIAL: topikal_alkitab — field "topikal" dalam UPPERCASE, convert ke Title Case
  // =========================================================================
  if (category === "topikal_alkitab") {
    const rawTopikal = entry.topikal || entry.subject || "";
    if (rawTopikal) {
      // Convert "AARON" → "Aaron", "HOLY SPIRIT" → "Holy Spirit"
      return String(rawTopikal)
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .trim();
    }
  }

  // =========================================================================
  // SPECIAL: kamus — trim spasi pada field Kamus
  // =========================================================================
  if (category === "kamus") {
    if (entry.Kamus) return String(entry.Kamus).trim();
  }

  // =========================================================================
  // SPECIAL: silsilah — gunakan "nama" (bahasa Indonesia)
  // =========================================================================
  if (category === "silsilah") {
    if (entry.nama) return String(entry.nama).trim();
  }

  // =========================================================================
  // SPECIAL: teologi — gunakan "istilah" yang lebih bersih
  // =========================================================================
  if (category === "teologi") {
    if (entry.istilah) {
      // Strip trailing number codes: "Yhvh 1 1" -> "Yhvh"
      return String(entry.istilah).replace(/\s+\d+(\s+\d+)*$/, "").trim();
    }
  }

  // =========================================================================
  // SPECIAL: teologi-2 — gunakan "teologi" (nama epoch bahasa Indonesia)
  // =========================================================================
  if (category === "teologi-2") {
    if (entry.teologi) return String(entry.teologi).trim();
    if (entry.epoch_name) return String(entry.epoch_name).trim();
  }

  // Try primary keyword field
  if (mapping.keywordField && entry[mapping.keywordField]) {
    return String(entry[mapping.keywordField]).trim();
  }

  // Try name field
  if (mapping.nameField && entry[mapping.nameField]) {
    return String(entry[mapping.nameField]).trim();
  }

  // Try common fields
  const commonFields = ["tokoh", "nama", "istilah", "peristiwa", "title", "name"];
  for (const field of commonFields) {
    if (entry[field]) {
      return String(entry[field]).trim();
    }
  }

  // Fallback to ID
  return String(entry.id || entry.person_id || entry.event_id || `unknown-${Date.now()}`);
}

/**
 * Generate SEO fields for encyclopedia entry
 */
function generateSeoFields(keyword: string, category: string, article: string): {
  title: string;
  description: string;
  keywords: string[];
} {
  const cleanKeyword = normalizeKeyword(keyword);
  const excerpt = article.length > 160 ? article.substring(0, 160) + "..." : article;

  return {
    title: `Ensiklopedia Alkitab: ${keyword} - ${category.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}`,
    description: `Pelajari tentang ${cleanKeyword} dalam kategori ${category} di Ensiklopedia Alkitab Grace Daily.`,
    keywords: [
      cleanKeyword,
      category,
      "Ensiklopedia Alkitab",
      "Grace Daily",
      "Alkitab",
      "Kristen",
    ],
  };
}

/**
 * Get unique ID for master data entry
 * Returns a stable, deterministic ID for deduplication
 */
function getEntryId(entry: EncyclopediaMasterEntry, category: string): string {
  const mapping = FIELD_MAPPINGS[category];

  // Use idField from mapping first
  if (mapping?.idField && entry[mapping.idField]) {
    return String(entry[mapping.idField]);
  }

  // Category-specific fallbacks
  if (category === "tokoh" && entry.person_id) return String(entry.person_id);
  if (category === "tempat" && entry.place_id) return String(entry.place_id);
  if (category === "silsilah" && entry.tokoh_id) return String(entry.tokoh_id);
  if (category === "topikal_alkitab" && entry.entry_id) return String(entry.entry_id);
  if ((category === "peristiwa" || category === "peristiwa-2") && entry.event_id) return String(entry.event_id);
  if (category === "kitab" && entry.kitab_code) return String(entry.kitab_code);
  // teologi: use "istilah" as stable ID
  if (category === "teologi" && entry.istilah) return String(entry.istilah);
  // teologi-2: use epoch_id as stable ID
  if (category === "teologi-2" && entry.epoch_id) return String(entry.epoch_id);
  // kronologi: use keyword text as ID (no dedicated id field)
  if (category === "kronologi" && entry.Kronologi) {
    return `kronologi-${normalizeKeyword(String(entry.Kronologi)).replace(/\s+/g, "-").substring(0, 60)}`;
  }

  // Generic ID fields
  const idFields = ["id", "person_id", "event_id", "tempat_id", "tokoh_id", "entry_id", "_id"];
  for (const field of idFields) {
    if (entry[field]) return String(entry[field]);
  }

  // Derive stable ID from keyword (avoid Date.now() which changes each run)
  const keyword = extractKeywordFromEntry(entry, category);
  if (keyword && keyword !== "unknown") {
    return `${category}-${normalizeKeyword(keyword).replace(/\s+/g, "-").substring(0, 80)}`;
  }

  return `${category}-unknown-${Math.random().toString(36).slice(2)}`;
}

// ============================================================================
// MASTER DATA LOADING
// ============================================================================

/**
 * Load master data from JSON files with special handlers per category
 */
async function loadMasterData(category: string): Promise<EncyclopediaMasterEntry[]> {
  const fileName = MASTER_DATA_FILES[category];
  if (!fileName) {
    console.warn(`[generate-encyclopedia] No master data file mapped for category: ${category}`);
    return [];
  }

  try {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    // Try multiple possible paths for Vercel/Next.js
    const possiblePaths = [
      join(process.cwd(), "Master_data_ensiklopedia", fileName),
      join(process.cwd(), "..", "Master_data_ensiklopedia", fileName),
      join(__dirname, "..", "..", "..", "Master_data_ensiklopedia", fileName),
    ];

    let content: string = "";
    for (const filePath of possiblePaths) {
      try {
        content = readFileSync(filePath, "utf8");
        break;
      } catch {
        // Try next path
      }
    }

    if (!content) {
      console.warn(`[generate-encyclopedia] Could not find master data file locally: ${fileName}. Fetching from R2...`);
      try {
        const { downloadFromR2 } = await import("./backup-r2-service");
        content = await downloadFromR2(`Master_data_ensiklopedia/${fileName}`);
        console.log(`[generate-encyclopedia] Successfully loaded master data from R2: ${fileName}`);
      } catch (r2Error: any) {
        console.error(`[generate-encyclopedia] Failed to fetch master data from R2 for ${fileName}:`, r2Error.message);
        return [];
      }
    }

    const data = JSON.parse(content);

    // =====================================================================
    // SPECIAL HANDLER: kitab.json → object structure, bukan array
    // =====================================================================
    if (category === "kitab" && !Array.isArray(data)) {
      const books: EncyclopediaMasterEntry[] = [];
      for (const [testament, groups] of Object.entries(data as Record<string, any>)) {
        for (const [group, codes] of Object.entries(groups as Record<string, any>)) {
          if (Array.isArray(codes)) {
            for (const code of codes as string[]) {
              const nameId = KITAB_NAMES[code] || code;
              books.push({
                kitab_code: code,
                kitab_name: nameId,
                golongan: group,
                perjanjian: testament,
              });
            }
          }
        }
      }
      console.log(`[generate-encyclopedia] Loaded ${books.length} kitab entries from object structure`);
      return books;
    }

    if (!Array.isArray(data)) {
      console.warn(`[generate-encyclopedia] Master data for ${category} is not an array`);
      return [];
    }

    // =====================================================================
    // SPECIAL HANDLER: mukjizat.json & perumpamaan.json → nested structure
    // Extract headings dari teks.[Category][].type === "heading"
    // =====================================================================
    if (category === "mukjizat" || category === "perumpamaan") {
      const fieldName = category === "mukjizat" ? "Mukjizat" : "Perumpamaan";
      const headings = new Set<string>();

      for (const item of data) {
        if (item.teks && Array.isArray(item.teks[fieldName])) {
          for (const block of item.teks[fieldName]) {
            if (
              block.type === "heading" &&
              Array.isArray(block[fieldName]) &&
              block[fieldName][0] &&
              typeof block[fieldName][0] === "string"
            ) {
              const heading = String(block[fieldName][0]).trim();
              // Filter heading yang valid (minimal 5 karakter, bukan ayat)
              if (heading && heading.length >= 5 && !/^\d/.test(heading)) {
                headings.add(heading);
              }
            }
          }
        }
      }

      const result = Array.from(headings).map(h => ({ [fieldName]: h }));
      console.log(`[generate-encyclopedia] Extracted ${result.length} unique headings from ${category}`);
      return result;
    }

    return data;
  } catch (error: any) {
    console.error(`[generate-encyclopedia] Failed to load master data for ${category}:`, error.message);
    return [];
  }
}

/**
 * Load all master data entries that haven't been generated yet
 * Fixed: handles "undefined" string sourceId/normalizedKeyword from old broken entries
 * Fixed: cross-category dedup for peristiwa/peristiwa-2 and silsilah/tokoh
 */
async function loadUnusedMasterEntries(
  category: string,
  db: Firestore,
  crossCategoryKeywords?: Set<string>
): Promise<{ entry: EncyclopediaMasterEntry; sourceId: string }[]> {
  const masterData = await loadMasterData(category);
  if (!masterData || masterData.length === 0) {
    console.log(`[generate-encyclopedia] No master data loaded for category: ${category}`);
    return [];
  }

  // Get all already generated entries for this category
  const generatedSnapshot = await withDbTimeout(
    db.collection("ensiklopedia_cache")
      .where("kategori", "==", category)
      .select("normalizedKeyword", "keyword", "sourceId", "slug")
      .get(),
    5000
  );

  const generatedKeywords = new Set<string>();
  const generatedSourceIds = new Set<string>();

  generatedSnapshot.forEach((doc) => {
    const data = doc.data();
    // FIXED: skip entries where normalizedKeyword/sourceId literally is "undefined"
    // — these are broken entries from old bug, use keyword instead
    if (data.normalizedKeyword && data.normalizedKeyword !== "undefined") {
      generatedKeywords.add(data.normalizedKeyword);
    }
    // Always use keyword for dedup (most reliable)
    if (data.keyword && data.keyword !== "undefined") {
      generatedKeywords.add(normalizeKeyword(data.keyword));
    }
    // slug is also a reliable unique identifier
    if (data.slug && data.slug !== "undefined") {
      generatedKeywords.add(data.slug);
    }
    if (data.sourceId && data.sourceId !== "undefined") {
      generatedSourceIds.add(data.sourceId);
    }
  });

  // Also include cross-category keywords to avoid duplicates
  // e.g. peristiwa and peristiwa-2 share many event names
  const allGeneratedKeywords = crossCategoryKeywords
    ? new Set([...generatedKeywords, ...crossCategoryKeywords])
    : generatedKeywords;

  // Filter out already generated entries
  const unusedEntries: { entry: EncyclopediaMasterEntry; sourceId: string }[] = [];

  for (const entry of masterData) {
    const sourceId = getEntryId(entry, category);
    const keyword = extractKeywordFromEntry(entry, category);
    if (!keyword || keyword.startsWith("unknown")) continue;
    const normalizedKw = normalizeKeyword(keyword);
    if (!normalizedKw) continue;
    const slug = generateSlug(keyword);

    // Skip if already generated by keyword, slug, or sourceId
    if (
      allGeneratedKeywords.has(normalizedKw) ||
      allGeneratedKeywords.has(slug) ||
      (sourceId && sourceId !== "undefined" && generatedSourceIds.has(sourceId))
    ) {
      continue;
    }

    unusedEntries.push({ entry, sourceId });
  }

  console.log(`[generate-encyclopedia] Category "${category}": ${masterData.length} master → ${generatedSnapshot.size} generated → ${unusedEntries.length} remaining`);
  return unusedEntries;
}

// ============================================================================
// AI CONTENT GENERATION
// ============================================================================

/**
 * Parse JSON from AI response
 */
function parseEncyclopediaJSON(content: string): {
  title?: string;
  isi_artikel?: string;
  excerpt?: string;
} | null {
  let cleaned = content.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || parsed.judul,
      isi_artikel: parsed.isi_artikel || parsed.artikel || parsed.content || parsed.body,
      excerpt: parsed.excerpt || parsed.ringkasan || parsed.summary,
    };
  } catch (e) {
    // Try to extract fields with regex
    const titleMatch = cleaned.match(/(?:"title"|'title'|title)\s*:\s*"([^"]+)"/i);
    const articleMatch = cleaned.match(/(?:"isi_artikel"|'isi_artikel'|"artikel"|'artikel')\s*:\s*"([^"]+)"/i);

    if (titleMatch && articleMatch) {
      return {
        title: titleMatch[1],
        isi_artikel: articleMatch[1].replace(/\\n/g, "\n"),
      };
    }

    return null;
  }
}

/**
 * Generate encyclopedia article using AI
 */
async function generateEncyclopediaArticle(
  keyword: string,
  category: string,
  providerConfigs: AIProviderConfig[],
  retries: number = MAX_RETRIES
): Promise<{ title: string; isi_artikel: string; provider: string } | null> {
  const categoryDisplay = category.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const prompt = `Tulis artikel ensiklopedia Alkitab yang mendalam dan terstruktur dalam Bahasa Indonesia untuk topik: "${keyword}" dalam kategori: "${categoryDisplay}".

Artikel HARUS menggunakan format sections berikut ini PERSIS (termasuk tanda ## dan nama section):

## RINGKASAN KUNCI
[Paragraf ringkasan 2-3 kalimat tentang ${keyword}, definisi dan penjelasan inti]

## INFORMASI SINGKAT
Detail:[Tuliskan informasi singkat pertama tentang ${keyword}, misalnya asal-usul, latar belakang, atau fakta utama - dalam 2-4 kalimat]

Detail:[Tuliskan informasi singkat kedua yang melanjutkan penjelasan tentang ${keyword}, misalnya peran, konteks sejarah, atau fakta penting lainnya - dalam 2-4 kalimat]

Detail:[Tuliskan informasi singkat ketiga tentang ${keyword}, misalnya dampak, relevansi teologis, atau hubungan dengan tokoh/peristiwa lain - dalam 2-4 kalimat]

## PERISTIWA PENTING & KRONOLOGI
[Deskripsi kronologi atau peristiwa-peristiwa penting yang berhubungan dengan ${keyword}. Gunakan angka atau bullet untuk setiap poin.]

## PELAJARAN ROHANI & PENERAPAN
[Pelajaran iman Kristen dan penerapan praktis dari ${keyword} bagi kehidupan sehari-hari]

## DAFTAR AYAT REFERENSI
[Daftar ayat Alkitab yang relevan, pisahkan dengan koma, contoh: Kejadian 1:1, Yohanes 3:16]

Aturan penting:
- Gunakan bahasa Indonesia yang baik dan benar
- Hindari kesalahan teologis
- Minimal 400 kata total
- Setiap section HARUS diisi dengan konten yang relevan
- Jangan skip section manapun

Kembalikan HANYA dalam format JSON valid:
{
  "title": "Judul artikel yang jelas dan deskriptif",
  "isi_artikel": "[isi artikel lengkap dengan semua section ## di atas]",
  "excerpt": "Ringkasan singkat 1-2 kalimat tentang ${keyword}"
}

Jangan ada teks lain di luar JSON. Jangan ada penjelasan pembuka atau penutup.`;

  const errors: string[] = [];

  const startTime = Date.now();

  for (const providerConfig of providerConfigs) {
    if (providerConfig.keys.length === 0) continue;

    for (let keyIndex = 0; keyIndex < providerConfig.keys.length; keyIndex++) {
      const key = providerConfig.keys[keyIndex];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        let response;
        try {
          if (providerConfig.name === "gemini") {
            response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${providerConfig.model}:generateContent?key=${key}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  systemInstruction: {
                    parts: [{ text: "Anda adalah teolog dan penulis ensiklopedia Alkitab yang berpengalaman. Anda menulis artikel yang akurat, mendalam, dan berpusat pada Alkitab dengan sudut pandang Kristen yang sehat." }],
                  },
                  contents: [
                    {
                      role: "user",
                      parts: [{ text: prompt }],
                    },
                  ],
                  generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4000,
                  },
                }),
                signal: controller.signal,
              }
            );
          } else {
            response = await fetch(providerConfig.endpoint, {
              method: "POST",
              headers: providerConfig.headers(key),
              body: JSON.stringify({
                model: providerConfig.model,
                messages: [
                  {
                    role: "system",
                    content: "Anda adalah teolog dan penulis ensiklopedia Alkitab yang berpengalaman. Anda menulis artikel yang akurat, mendalam, dan berpusat pada Alkitab dengan sudut pandang Kristen yang sehat.",
                  },
                  { role: "user", content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 4000,
              }),
              signal: controller.signal,
            });
          }
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || response.statusText);
        }

        const data = await response.json();
        let content;
        if (providerConfig.name === "gemini") {
          content = data.candidates?.[0]?.content?.parts
            ?.map((part: { text?: string }) => part.text ?? "")
            .join("")
            .trim();
        } else {
          content = data.choices?.[0]?.message?.content?.trim();
        }

        if (!content) {
          throw new Error("Empty content");
        }

        const parsed = parseEncyclopediaJSON(content);
        if (!parsed || !parsed.isi_artikel) {
          throw new Error("Failed to parse AI output");
        }

        // Validate minimum length
        if (parsed.isi_artikel.length < MIN_ARTICLE_LENGTH) {
          throw new Error(`Article too short: ${parsed.isi_artikel.length} chars`);
        }

        // Log successful usage
        const durationMs = Date.now() - startTime;
        logAIUsage({
          provider: providerConfig.name,
          keyIndex,
          category,
          keyword,
          status: "success",
          durationMs,
          timestamp: new Date(),
        });

        return {
          title: parsed.title || keyword,
          isi_artikel: parsed.isi_artikel,
          provider: providerConfig.name,
        };
      } catch (error: any) {
        const durationMs = Date.now() - startTime;
        console.warn(`[generate-encyclopedia] ${providerConfig.name}[${keyIndex}] failed:`, error.message);

        // Log failed usage
        logAIUsage({
          provider: providerConfig.name,
          keyIndex,
          category,
          keyword,
          status: "failed",
          error: error.message,
          durationMs,
          timestamp: new Date(),
        });

        errors.push(`${providerConfig.name}[${keyIndex}]: ${error.message}`);
      }
    }
  }

  console.error(`[generate-encyclopedia] All AI providers failed:`, errors.join(" | "));
  return null;
}

/**
 * Generate fallback article if AI fails
 */
function generateFallbackArticle(keyword: string, category: string): {
  title: string;
  isi_artikel: string;
  provider: string;
} {
  const categoryDisplay = category.replace(/_/g, " ");

  return {
    title: `${keyword} - ${categoryDisplay}`,
    isi_artikel: `Artikel tentang ${keyword} dalam kategori ${categoryDisplay} sedang dalam proses penyempurnaan. Silakan kunjungi kembali nanti untuk melihat konten yang lengkap.`,
    provider: "local-fallback",
  };
}

// ============================================================================
// ENTRY GENERATION & SAVING
// ============================================================================

/**
 * Generate a single encyclopedia entry from master data
 */
async function generateSingleEntry(
  entry: EncyclopediaMasterEntry,
  sourceId: string,
  category: string,
  db: Firestore
): Promise<GenerationResult> {
  const keyword = extractKeywordFromEntry(entry, category);
  const normalizedKeyword = normalizeKeyword(keyword);
  const slug = generateSlug(keyword);

  // Double-check for duplicates
  const existingQuery = await withDbTimeout(
    db.collection("ensiklopedia_cache")
      .where("normalizedKeyword", "==", normalizedKeyword)
      .limit(1)
      .get(),
    3000
  );

  if (!existingQuery.empty) {
    return {
      success: false,
      entry: null,
      error: "Duplicate entry",
      isDuplicate: true,
    };
  }

  // Generate article using AI
  let article = await generateEncyclopediaArticle(
    keyword,
    category,
    AI_PROVIDERS
  );

  if (!article) {
    // Use fallback
    article = generateFallbackArticle(keyword, category);
  }

  // Generate SEO
  const seo = generateSeoFields(keyword, category, article.isi_artikel);

  // Generate Banner & Illustration URLs synchronously/sequentially
  let bannerUrl = "";
  let illustrationUrl = "";
  try {
    const { ensureEncyclopediaBannerR2, ensureEncyclopediaIllustrationR2 } = await import("./encyclopedia-images");
    bannerUrl = await ensureEncyclopediaBannerR2({
      slug: `${category}-${slug}`,
      kategori: category,
      topik: keyword,
      force: false,
    });
    illustrationUrl = await ensureEncyclopediaIllustrationR2({
      slug: `${category}-${slug}-illustration`,
      kategori: category,
      topik: keyword,
      force: false,
    });
  } catch (imgError) {
    console.error(`[generate-encyclopedia] Failed to generate images for ${keyword}:`, imgError);
  }

  // Create entry
  const now = new Date();
  const cacheEntry: EncyclopediaCacheEntry = {
    id: `${category}-${slug}`,
    kategori: category,
    keyword,
    slug,
    title: article.title,
    isi_artikel: article.isi_artikel,
    bannerUrl: bannerUrl || "",
    illustrationUrl: illustrationUrl || "",
    seo,
    status: "published",
    createdAt: now,
    updatedAt: now,
    normalizedKeyword,
    isGenerated: true,
    generatedAt: now,
    provider: article.provider,
    sourceFile: MASTER_DATA_FILES[category],
    sourceId,
  };

  // Save to Firestore
  try {
    await withDbTimeout(
      db.collection("ensiklopedia_cache").doc(cacheEntry.id).set(cacheEntry, { merge: true }),
      5000
    );

    // Upload to R2
    await uploadEntryToR2(cacheEntry);

    return {
      success: true,
      entry: cacheEntry,
      isDuplicate: false,
    };
  } catch (error: any) {
    console.error(`[generate-encyclopedia] Failed to save entry ${cacheEntry.id}:`, error);
    return {
      success: false,
      entry: cacheEntry,
      error: error.message || "Failed to save",
      isDuplicate: false,
    };
  }
}

/**
 * Upload encyclopedia entry to R2
 */
async function uploadEntryToR2(entry: EncyclopediaCacheEntry): Promise<void> {
  if (!R2_BUCKET_NAME || !s3Client) {
    console.warn("[generate-encyclopedia] R2 not configured, skipping R2 upload");
    return;
  }

  try {
    // Upload individual entry file
    const individualKey = `encyclopedia/${entry.kategori}/${entry.slug}.json`;
    const content = JSON.stringify(entry, null, 2);

    let body = Buffer.from(content, "utf8");
    let contentType = "application/json";
    let contentEncoding: string | undefined;

    // Compress if large
    if (body.length > 10000) {
      body = zlib.gzipSync(body);
      contentType = "application/json";
      contentEncoding = "gzip";
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: individualKey,
        Body: body,
        ContentType: contentType,
        ContentEncoding: contentEncoding,
        CacheControl: "public, max-age=86400",
      })
    );

    console.log(`[generate-encyclopedia] Uploaded to R2: ${individualKey}`);

    // Update bulk category file
    await updateBulkCategoryFile(entry.kategori);

  } catch (error) {
    console.error(`[generate-encyclopedia] Failed to upload to R2:`, error);
  }
}

/**
 * Update bulk category JSON file in R2
 */
async function updateBulkCategoryFile(category: string): Promise<void> {
  if (!R2_BUCKET_NAME || !s3Client) return;

  const db = getAdminDb();
  if (!db) return;

  try {
    const snapshot = await withDbTimeout(
      db.collection("ensiklopedia_cache")
        .where("kategori", "==", category)
        .get(),
      5000
    );

    const entries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const bulkKey = `${category}.json`;
    const content = JSON.stringify(entries, null, 2);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `backup/${bulkKey}`,
        Body: Buffer.from(content, "utf8"),
        ContentType: "application/json",
        CacheControl: "public, max-age=3600",
      })
    );

    console.log(`[generate-encyclopedia] Updated bulk file: ${bulkKey}`);
  } catch (error) {
    console.error(`[generate-encyclopedia] Failed to update bulk file for ${category}:`, error);
  }
}

// ============================================================================
// CRON LOG FUNCTIONS
// ============================================================================

/**
 * Save cron log to Firestore
 */
export async function saveCronLog(log: Omit<CronLogEntry, "id">): Promise<CronLogEntry> {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  const status = log.failed > 0 ? "PERLU_PERHATIAN" : "BERHASIL";

  const cronLog: CronLogEntry = {
    ...log,
    id: `cron-log-${Date.now()}`,
    status,
    createdAt: new Date(),
  };

  await withDbTimeout(
    db.collection("cron_logs").doc(cronLog.id).set(cronLog, { merge: true }),
    3000
  );

  return cronLog;
}

/**
 * Get recent cron logs
 */
export async function getCronLogs(limit: number = 50): Promise<CronLogEntry[]> {
  const db = getAdminDb();
  if (!db) {
    return [];
  }

  try {
    const snapshot = await withDbTimeout(
      db.collection("cron_logs")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get(),
      5000
    );

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    })) as CronLogEntry[];
  } catch (error) {
    console.error("[generate-encyclopedia] Failed to fetch cron logs:", error);
    return [];
  }
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate encyclopedia entries for today's categories
 * Rotates through categories daily
 */
export async function generateDailyEncyclopediaEntries(
  options: {
    force?: boolean;
    categories?: string[];
    targetPerCategory?: number;
    limit?: number;
  } = {}
): Promise<{
  success: boolean;
  generated: number;
  duplicates: number;
  failed: number;
  entries: EncyclopediaCacheEntry[];
  cronLog?: CronLogEntry;
}> {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin DB is not initialized");
  }

  const {
    force = false,
    categories,
    targetPerCategory,
    limit = 1,
  } = options;

  // Get today's date key for rotation tracking
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Determine categories dynamically if not provided
  let resolvedCategories = categories;
  if (!resolvedCategories) {
    let lastCategory: string | null = null;
    try {
      const lastEntryQuery = await db.collection("ensiklopedia_cache")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      if (!lastEntryQuery.empty) {
        lastCategory = lastEntryQuery.docs[0].data().kategori || null;
      }
    } catch (error) {
      console.error("[generate-encyclopedia] Failed to query last generated category:", error);
    }

    // Select all categories starting from the next in rotation (supports automatic fallback)
    let startIndex = 0;
    if (lastCategory) {
      const lastIndex = ALL_CATEGORIES.indexOf(lastCategory);
      if (lastIndex !== -1) {
        startIndex = (lastIndex + 1) % ALL_CATEGORIES.length;
      }
    }

    resolvedCategories = [];
    for (let i = 0; i < ALL_CATEGORIES.length; i++) {
      const index = (startIndex + i) % ALL_CATEGORIES.length;
      resolvedCategories.push(ALL_CATEGORIES[index]);
    }
  }

  const results: {
    entry: EncyclopediaCacheEntry | null;
    status: "success" | "duplicate" | "failed";
    error?: string;
    keyword: string;
    kategori: string;
    slug: string;
  }[] = [];

  let generated = 0;
  let duplicates = 0;
  let failed = 0;
  const entries: EncyclopediaCacheEntry[] = [];

  const targetPerCat = targetPerCategory ?? (limit === 1 ? 1 : limit);

  // Build cross-category keyword sets for categories with overlapping data
  // This prevents generating duplicate entries between related categories
  const crossCategoryCache: Map<string, Set<string>> = new Map();

  async function getCrossKeywords(cat: string): Promise<Set<string>> {
    if (crossCategoryCache.has(cat)) return crossCategoryCache.get(cat)!;
    const snap = await db!.collection("ensiklopedia_cache")
      .where("kategori", "==", cat)
      .select("keyword", "normalizedKeyword", "slug")
      .get();
    const kws = new Set<string>();
    snap.forEach(doc => {
      const d = doc.data();
      if (d.keyword) kws.add(normalizeKeyword(d.keyword));
      if (d.normalizedKeyword && d.normalizedKeyword !== "undefined") kws.add(d.normalizedKeyword);
      if (d.slug && d.slug !== "undefined") kws.add(d.slug);
    });
    crossCategoryCache.set(cat, kws);
    return kws;
  }

  // Process each category
  for (const category of resolvedCategories) {
    if (generated >= limit) break;

    // Build cross-category exclusion set for overlapping categories
    let crossKeywords: Set<string> | undefined;
    if (category === "peristiwa-2") {
      crossKeywords = await getCrossKeywords("peristiwa");
    } else if (category === "peristiwa") {
      crossKeywords = await getCrossKeywords("peristiwa-2");
    } else if (category === "silsilah") {
      // silsilah shares many names with tokoh
      crossKeywords = await getCrossKeywords("tokoh");
    }

    // Load unused entries for this category
    const unusedEntries = await loadUnusedMasterEntries(category, db, crossKeywords);

    if (unusedEntries.length === 0) {
      console.log(`[generate-encyclopedia] No unused entries for category: ${category}`);
      continue;
    }

    // For cron execution (limit=1), fetch up to 5 entries to allow retries if the first fails or is duplicate
    const entriesToProcess = limit === 1 ? 5 : targetPerCat;
    const selectedEntries = unusedEntries.slice(0, entriesToProcess);

    // Process each entry
    for (const { entry: masterEntry, sourceId } of selectedEntries) {
      if (generated >= limit) break;

      const keyword = extractKeywordFromEntry(masterEntry, category);
      const slug = generateSlug(keyword);

      try {
        const result = await generateSingleEntry(masterEntry, sourceId, category, db);

        if (result.isDuplicate) {
          duplicates++;
          results.push({
            entry: null,
            status: "duplicate",
            keyword,
            kategori: category,
            slug,
            error: result.error,
          });
        } else if (result.success && result.entry) {
          generated++;
          entries.push(result.entry);
          results.push({
            entry: result.entry,
            status: "success",
            keyword,
            kategori: category,
            slug,
            error: "",
          });

          // Report new encyclopedia entry to Telegram channel
          try {
            const { reportNewEncyclopediaTelegram } = await import("./telegram");
            await reportNewEncyclopediaTelegram({
              id: result.entry.id,
              keyword: result.entry.keyword,
              kategori: result.entry.kategori,
              slug: result.entry.slug,
              title: result.entry.title,
            });
            console.log(`[generate-encyclopedia] Telegram channel report sent for ${result.entry.keyword}`);
          } catch (telegramErr) {
            console.error(`[generate-encyclopedia] Failed to send Telegram channel report for ${result.entry.keyword}:`, telegramErr);
          }
        } else {
          failed++;
          results.push({
            entry: null,
            status: "failed",
            keyword,
            kategori: category,
            slug,
            error: result.error,
          });
        }
      } catch (error: any) {
        failed++;
        results.push({
          entry: null,
          status: "failed",
          keyword,
          kategori: category,
          slug,
          error: error.message || "Unknown error",
        });
        console.error(`[generate-encyclopedia] Error processing ${category}/${keyword}:`, error);
      }
    }
  }

  // Save cron log
  const status = failed > 0 ? "PERLU_PERHATIAN" : "BERHASIL";
  const cronLog = await saveCronLog({
    date: todayKey,
    cronType: "generate-encyclopedia",
    target: limit,
    success: generated,
    duplicate: duplicates,
    failed,
    status,
    createdAt: new Date(),
    entries: results.map((r) => ({
      keyword: r.keyword,
      kategori: r.kategori,
      slug: r.slug,
      title: r.entry?.title || r.keyword,
      status: r.status,
      error: r.error || "",
      generatedAt: new Date().toISOString(),
    })),
  });

  // Trigger R2 backup for encyclopedia asynchronously (non-blocking)
  import("./backup-r2-service").then(({ runR2Backup }) => {
    runR2Backup()
      .then(() => console.log("[generate-encyclopedia] Async R2 backup completed successfully."))
      .catch((error) => console.error("[generate-encyclopedia] Async R2 backup failed:", error));
  }).catch((error) => {
    console.error("[generate-encyclopedia] Failed to import backup-r2-service:", error);
  });

  return {
    success: failed === 0,
    generated,
    duplicates,
    failed,
    entries,
    cronLog,
  };
}

// ============================================================================
// MANUAL TRIGGER FUNCTION
// ============================================================================

/**
 * Generate specific number of entries manually
 */
export async function generateManualEncyclopediaEntries(
  count: number = 25,
  category?: string
): Promise<{
  success: boolean;
  generated: number;
  duplicates: number;
  failed: number;
  entries: EncyclopediaCacheEntry[];
  cronLog?: CronLogEntry;
}> {
  const targetCategories = category ? [category] : ALL_CATEGORIES;
  const perCategory = Math.ceil(count / Math.min(targetCategories.length, 5));

  return generateDailyEncyclopediaEntries({
    force: true,
    categories: targetCategories,
    targetPerCategory: perCategory,
    limit: count,
  });
}

// ============================================================================
// EXPORT
// ============================================================================
