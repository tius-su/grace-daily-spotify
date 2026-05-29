import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

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
  throw new Error("Tambahkan FIREBASE_SERVICE_ACCOUNT_JSON atau GOOGLE_APPLICATION_CREDENTIALS");
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
  const limitBooks = argNumber("limit-books");
  const limitChapters = argNumber("limit-chapters");

  let apiDir = resolve(arg("source") ?? "public/bible");
  if (!existsSync(apiDir) && existsSync(resolve("scripts"))) {
    apiDir = resolve("scripts");
  }

  // Patok folder lokal untuk kedua bahasa
  const indDir = join(apiDir, "ind_ayt");
  const engDir = join(apiDir, "BSB");

  if (!existsSync(indDir)) {
    throw new Error(`Folder ind_ayt tidak ditemukan di ${apiDir}`);
  }

  console.log("Membaca master data kitab dari ind_ayt...");
  const booksFile = join(indDir, "books.json");
  const { books } = JSON.parse(readFileSync(booksFile, "utf8"));

  // Fitur tambahan untuk melompati kitab di hari ke-2
  const skipBooks = argNumber("skip-books") ?? 0;
  let booksToSeed = books.slice(skipBooks);
  if (limitBooks) {
    booksToSeed = booksToSeed.slice(0, limitBooks);
  }

  let batch = db.batch();
  let pending = 0;
  let total = 0;
  
  const maxWrites = argNumber("max-writes");
  let totalWritesInThisRun = 0;
  let limitReached = false;

  async function commitIfNeeded(force = false) {
    if (pending === 0 || (!force && pending < batchSize)) return;
    console.log(`Sedang mengunggah bungkusan ${total + pending} ayat bilingual ke Firestore...`);
    try {
      await batch.commit();
      total += pending;
    } finally {
      batch = db.batch();
      pending = 0;
    }
  }

  for (const book of booksToSeed) {
    console.log(`\n[BILINGUAL] Memproses Kitab: ${book.name} (${book.id})`);

    const chapterLimit = limitChapters ? Math.min(limitChapters, book.numberOfChapters) : book.numberOfChapters;

    for (let ch = 1; ch <= chapterLimit; ch++) {
      const indChapterFile = join(indDir, book.id, `${ch}.json`);
      const engChapterFile = join(engDir, book.id, `${ch}.json`);

      if (!existsSync(indChapterFile)) continue;

      try {
        const indData = JSON.parse(readFileSync(indChapterFile, "utf8"));
        const indVerses = indData.chapter.content.filter((item) => item.type === "verse");

        // Baca data Inggris jika file-nya tersedia
        let engVerses = [];
        if (existsSync(engChapterFile)) {
          const engData = JSON.parse(readFileSync(engChapterFile, "utf8"));
          engVerses = engData.chapter.content.filter((item) => item.type === "verse");
        }

        for (const indVerse of indVerses) {
          const indText = extractText(indVerse.content).replace(/\s+/g, " ").trim();
          if (!indText) continue;

          // Cari ayat bahasa Inggris yang nomornya sama
          const engVerse = engVerses.find((v) => v.number === indVerse.number);
          const engText = engVerse ? extractText(engVerse.content).replace(/\s+/g, " ").trim() : "";

          const id = `${book.id}-${ch}-${indVerse.number}`;
          const refInd = `${book.name} ${ch}:${indVerse.number}`;

          const finalData = {
            id,
            book: book.name, // Menggunakan nama Indonesia (misal: KEJADIAN)
            bookShort: book.id,
            bookNormalized: normalize(book.name),
            chapter: ch,
            verse: indVerse.number,
            reference_ind: refInd,
            text_ind_ayt: indText,
            normalizedText_ind_ayt: normalize(indText),
            keywords_ind_ayt: keywordsFor(indText, refInd),
            themes_ind_ayt: themesFor(indText),
            updatedAt: FieldValue.serverTimestamp(),
          };

          // Masukkan data bahasa Inggris jika ada
          if (engText) {
            finalData["text_BSB"] = engText;
            finalData["normalizedText_BSB"] = normalize(engText);
            finalData["reference_bsb"] = `Genesis ${ch}:${indVerse.number}`; // Fallback atau sesuaikan jika perlu
          }

          if (maxWrites && totalWritesInThisRun >= maxWrites) {
            limitReached = true;
            break;
          }

          batch.set(bibleCollection.doc(id), finalData, { merge: true });
          pending += 1;
          totalWritesInThisRun += 1;
          await commitIfNeeded();
        }
        if (limitReached) break;
      } catch (err) {
        console.error(`Gagal memproses ${book.id} Pasal ${ch}:`, err.message);
      }
      if (limitReached) break;
    }
    if (limitReached) {
      console.log(`\n[BILINGUAL] Batas kuota penulisan (${maxWrites}) tercapai untuk sesi ini. Menghentikan proses.`);
      break;
    }
  }

  await commitIfNeeded(true);
  console.log(`\n🎉 SELESAI! Total ${total} data ayat bilingual berhasil dirapikan di Firestore.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});