import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const translations = [
  { id: "ind_ayt", name: "Alkitab Yang Terbuka (AYT)", shortName: "AYT" },
  { id: "BSB", name: "Berean Standard Bible (ENG)", shortName: "BSB" },
];

function loadEnv() {
  for (const file of [resolve(".env.local"), resolve("../.env.local")]) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function serviceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (json) return JSON.parse(json);
  if (file && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  
  // Fallback to default key location
  const defaultKey = resolve("scripts/serviceAccountKey.json");
  if (existsSync(defaultKey)) {
    return JSON.parse(readFileSync(defaultKey, "utf8"));
  }

  throw new Error("Tambahkan serviceAccountKey.json di folder scripts atau konfigurasi env.");
}

function initAdmin() {
  if (getApps().length) return;
  initializeApp({ credential: cert(serviceAccount()) });
}

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
  const ignored = new Set(["dan", "yang", "di", "ke", "dari", "ini", "itu", "aku", "kamu", "ia", "nya"]);
  return Array.from(
    new Set(
      normalize(`${reference} ${text}`).split(" ").filter((w) => w.length > 2 && !ignored.has(w)),
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
    if (words.some((w) => normalized.includes(w))) themes.push(theme);
  }
  return themes.length ? themes : ["alkitab"];
}

function arg(name) {
  const value = process.argv.find((item) => item.startsWith(`--${name}=`));
  return value ? value.split("=").slice(1).join("=") : null;
}

function argNumber(name) {
  const value = arg(name);
  return value ? Number(value) : null;
}

async function main() {
  loadEnv();
  initAdmin();

  const db = getFirestore();
  const bibleCollection = db.collection("bible_verses");
  const batchSize = argNumber("batch-size") ?? 200;
  
  // Set default write limit to 14,000 per run to stay safely under 20,000 daily limit
  const maxWrites = argNumber("max-writes") ?? 14000;
  const onlyTranslations = (arg("translations") ?? arg("translation") ?? "ind_ayt,BSB")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const apiDir = resolve(arg("source") ?? "scripts"); // Default to scripts directory

  if (!existsSync(apiDir)) {
    throw new Error(`Folder lokal tidak ditemukan: ${apiDir}`);
  }

  // Load progress file
  const progressFile = resolve("scripts/seeder-progress.json");
  let progress = { completedChapters: [] };
  if (existsSync(progressFile)) {
    try {
      progress = JSON.parse(readFileSync(progressFile, "utf8"));
      if (!Array.isArray(progress.completedChapters)) {
        progress.completedChapters = [];
      }
    } catch (e) {
      console.warn("Progress file corrupted, resetting progress tracker.");
    }
  }

  const completedSet = new Set(progress.completedChapters);
  let totalWritesInThisRun = 0;
  let hasReachedLimit = false;

  console.log(`Starting Bible seeder run. Max writes allowed in this run: ${maxWrites}`);
  console.log(`Already seeded chapters count: ${completedSet.size}`);

  for (const trans of translations.filter((item) => onlyTranslations.includes(item.id))) {
    if (hasReachedLimit) break;

    const transDir = join(apiDir, trans.id);
    if (!existsSync(transDir)) {
      console.warn(`Folder terjemahan ${trans.id} tidak ditemukan. Dilewati.`);
      continue;
    }

    const booksFile = join(transDir, "books.json");
    if (!existsSync(booksFile)) {
      console.warn(`File books.json untuk ${trans.id} tidak ditemukan.`);
      continue;
    }

    const { books } = JSON.parse(readFileSync(booksFile, "utf8"));
    
    for (const book of books) {
      if (hasReachedLimit) break;

      const bookDir = join(transDir, book.id);
      if (!existsSync(bookDir)) continue;

      for (let chapterNumber = 1; chapterNumber <= book.numberOfChapters; chapterNumber++) {
        const chapterKey = `${trans.id}-${book.id}-${chapterNumber}`;
        
        // Skip if already completed in a previous run
        if (completedSet.has(chapterKey)) {
          continue;
        }

        const chapterFile = join(bookDir, `${chapterNumber}.json`);
        if (!existsSync(chapterFile)) continue;

        try {
          const chapterData = JSON.parse(readFileSync(chapterFile, "utf8"));
          if (!chapterData.chapter || !chapterData.chapter.content) continue;

          const verses = chapterData.chapter.content.filter((item) => item.type === "verse");
          if (verses.length === 0) {
            // No verses in this chapter, mark it as done
            completedSet.add(chapterKey);
            continue;
          }

          // Check if adding this chapter will exceed our batch/run limits
          if (totalWritesInThisRun + verses.length > maxWrites) {
            console.log(`\nReached batch limit (${totalWritesInThisRun}/${maxWrites} writes). Stopping this run to protect Firebase quota.`);
            hasReachedLimit = true;
            break;
          }

          console.log(`[${trans.id}] Seeding ${book.name} Chapter ${chapterNumber} (${verses.length} verses)...`);
          
          let batch = db.batch();
          let versesAdded = 0;

          for (const verse of verses) {
            const text = extractText(verse.content).replace(/\s+/g, " ").trim();
            if (!text) continue;

            const reference = `${book.name} ${chapterNumber}:${verse.number}`;
            const id = `${trans.id}-${book.id}-${chapterNumber}-${verse.number}`;

            batch.set(bibleCollection.doc(id), {
              id,
              book: book.name,
              bookShort: book.id,
              bookNormalized: normalize(book.name),
              chapter: chapterNumber,
              verse: verse.number,
              translation: trans.shortName,
              translationId: trans.id,
              translationName: trans.name,
              reference,
              text,
              normalizedText: normalize(text),
              keywords: keywordsFor(text, reference),
              themes: themesFor(text),
              source: "local",
              updatedAt: FieldValue.serverTimestamp(),
            });
            versesAdded++;
          }

          if (versesAdded > 0) {
            await batch.commit();
            totalWritesInThisRun += versesAdded;
          }

          // Save progress
          completedSet.add(chapterKey);
          writeFileSync(progressFile, JSON.stringify({ completedChapters: Array.from(completedSet) }, null, 2), "utf8");

        } catch (e) {
          console.error(`Error processing ${book.id} Chapter ${chapterNumber}:`, e.message);
        }
      }
    }
  }

  console.log(`\nRun finished.`);
  console.log(`Verses seeded in this run: ${totalWritesInThisRun}`);
  console.log(`Total completed chapters in DB: ${completedSet.size}`);
  
  if (hasReachedLimit) {
    console.log(`\nSilakan jalankan kembali perintah ini besok untuk melanjutkan seeding:`);
    console.log(`node scripts/seeder-safe.mjs`);
  } else {
    console.log(`\nSemua data Alkitab berhasil di-seed sepenuhnya!`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
