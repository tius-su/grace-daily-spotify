/**
 * backup-bible.mjs
 * Script to compile all bible_verses from local public/bible directory and upload them to Cloudflare R2.
 * Run: node scripts/backup-bible.mjs
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

// Load .env.local manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("✅ Loaded .env.local");
} else {
  console.warn("⚠️  .env.local not found, using system environment variables");
}

// --- R2 setup ---
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("❌ Missing R2 credentials in environment variables!");
  console.error("   Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME");
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

// --- Helper Functions ---
function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extractText).join("");
  if (content && typeof content === "object") return extractText(content.content ?? content.text ?? "");
  return "";
}

function keywordsFor(text, reference) {
  const ignored = new Set([
    "dan", "yang", "di", "ke", "dari", "ini", "itu", "aku", "kamu", "ia", "nya",
    "dengan", "dalam", "untuk", "akan", "tidak", "adalah"
  ]);

  return Array.from(
    new Set(
      normalize(`${reference} ${text}`)
        .split(" ")
        .filter((word) => word.length > 2 && !ignored.has(word)),
    ),
  ).slice(0, 40);
}

function themesFor(text) {
  const normalized = normalize(text);
  const themes = [];

  for (const [theme, words] of Object.entries({
    kasih: ["kasih", "mengasihi"],
    iman: ["percaya", "iman"],
    doa: ["doa", "permohonan"],
    damai: ["damai", "sejahtera"],
    pengampunan: ["ampun", "mengampuni"],
    pengharapan: ["harap", "pengharapan"],
    hikmat: ["hikmat", "bijaksana"],
  })) {
    if (words.some((word) => normalized.includes(word))) {
      themes.push(theme);
    }
  }

  return themes.length ? themes : ["alkitab"];
}

// --- Upload helper with gzip ---
async function uploadToR2(key, data) {
  const jsonStr = JSON.stringify(data);
  const rawBuffer = Buffer.from(jsonStr, "utf8");

  let body = rawBuffer;
  let gzipped = false;

  // Compress if larger than 50KB
  if (rawBuffer.length > 50000) {
    body = zlib.gzipSync(rawBuffer);
    gzipped = true;
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: "application/json",
    ContentEncoding: gzipped ? "gzip" : undefined,
    CacheControl: "public, max-age=86400, must-revalidate",
  });

  await s3Client.send(command);
  return { sizeKb: (body.length / 1024).toFixed(1), gzipped, count: Array.isArray(data) ? data.length : 1 };
}

// --- Main ---
async function run() {
  console.log("\n📖 Bible Verses Backup to Cloudflare R2 (Local Source Mode)");
  console.log("=========================================================");
  console.log(`🪣  Bucket: ${R2_BUCKET_NAME}`);
  console.log("");

  const allVerses = [];
  const byTranslation = {};

  const baseDir = path.join(__dirname, "..", "public", "bible");
  const translations = ["ind_ayt", "BSB"];

  for (const transId of translations) {
    const transDir = path.join(baseDir, transId);
    if (!existsSync(transDir)) {
      console.warn(`⚠️  Translation directory not found: ${transDir}`);
      continue;
    }

    const booksFile = path.join(transDir, "books.json");
    if (!existsSync(booksFile)) {
      console.warn(`⚠️  books.json not found in: ${transDir}`);
      continue;
    }

    const { books } = JSON.parse(readFileSync(booksFile, "utf8"));
    console.log(`📖 Compiling local files for translation [${transId}]...`);

    for (const book of books) {
      for (let ch = 1; ch <= book.numberOfChapters; ch++) {
        const chapterFile = path.join(transDir, book.id, `${ch}.json`);
        if (!existsSync(chapterFile)) continue;

        try {
          const chData = JSON.parse(readFileSync(chapterFile, "utf8"));
          const verses = chData.chapter.content.filter((item) => item.type === "verse");

          for (const verse of verses) {
            const text = extractText(verse.content).replace(/\s+/g, " ").trim();
            if (!text) continue;

            const reference = `${book.name} ${ch}:${verse.number}`;
            const id = `${transId}-${book.id}-${ch}-${verse.number}`;

            const data = {
              id,
              book: book.name,
              bookShort: book.id,
              chapter: ch,
              verse: verse.number,
              translation: transId === "ind_ayt" ? "AYT" : "BSB",
              translationId: transId,
              reference,
              text,
              keywords: keywordsFor(text, reference),
              themes: themesFor(text),
            };

            allVerses.push(data);
            if (!byTranslation[transId]) byTranslation[transId] = [];
            byTranslation[transId].push(data);
          }
        } catch (err) {
          console.error(`❌ Error parsing ${book.id} chapter ${ch}:`, err.message);
        }
      }
    }
  }

  const totalDocs = allVerses.length;
  console.log(`\n📊 Compiling complete. Total ${totalDocs.toLocaleString()} verses compiled locally.`);
  for (const [trans, verses] of Object.entries(byTranslation)) {
    console.log(`   • ${trans}: ${verses.length.toLocaleString()} verses`);
  }

  if (totalDocs === 0) {
    console.warn("⚠️  No verses were found/compiled!");
    process.exit(1);
  }

  // 3. Upload full index (all translations combined)
  console.log("\n📤 Uploading to Cloudflare R2...");

  try {
    const result = await uploadToR2("backup/bible_verses.json", allVerses);
    console.log(`   ✅ backup/bible_verses.json → ${result.sizeKb} KB${result.gzipped ? " (gzipped)" : ""}`);
  } catch (err) {
    console.error(`   ❌ Failed to upload bible_verses.json:`, err.message);
  }

  // 4. Upload per-translation split files for efficient lookups
  for (const [trans, verses] of Object.entries(byTranslation)) {
    const key = `backup/bible_${trans}.json`;
    try {
      const result = await uploadToR2(key, verses);
      console.log(`   ✅ ${key} → ${result.sizeKb} KB${result.gzipped ? " (gzipped)" : ""} (${verses.length.toLocaleString()} verses)`);
    } catch (err) {
      console.error(`   ❌ Failed to upload ${key}:`, err.message);
    }
  }

  // 5. Upload index (metadata only, without full text — for search use)
  const indexData = allVerses.map((v) => ({
    id: v.id,
    reference: v.reference,
    book: v.book,
    bookShort: v.bookShort,
    chapter: v.chapter,
    verse: v.verse,
    translation: v.translationId,
    keywords: v.keywords,
    themes: v.themes,
  }));

  try {
    const result = await uploadToR2("backup/bible_index.json", indexData);
    console.log(`   ✅ backup/bible_index.json → ${result.sizeKb} KB${result.gzipped ? " (gzipped)" : ""} (metadata-only index)`);
  } catch (err) {
    console.error(`   ❌ Failed to upload bible_index.json:`, err.message);
  }

  console.log("\n🎉 Backup compile & upload complete!");
}

run().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
