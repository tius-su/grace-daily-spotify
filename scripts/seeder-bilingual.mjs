import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { FreeUseBibleApi } from "free-use-bible-api";

const translations = [
  { id: "ind_ayt", name: "Alkitab Yang Terbuka (AYT)" },
  { id: "eng_bsb", name: "Berean Standard Bible (BSB)" }
];

function loadEnv() {
  for (const file of [resolve(".env.local"), resolve("../.env.local")]) {
    if (!existsSync(file)) {
      continue;
    }

    const lines = readFileSync(file, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

      if (!match || process.env[match[1]]) {
        continue;
      }

      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function serviceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (json) {
    return JSON.parse(json);
  }

  if (file && existsSync(file)) {
    return JSON.parse(readFileSync(file, "utf8"));
  }

  throw new Error(
    "Tambahkan FIREBASE_SERVICE_ACCOUNT_JSON atau GOOGLE_APPLICATION_CREDENTIALS untuk seed Bible.",
  );
}

function initAdmin() {
  if (getApps().length) {
    return;
  }

  initializeApp({
    credential: cert(serviceAccount()),
  });
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
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(extractText).join("");
  }

  if (content && typeof content === "object") {
    return extractText(content.content ?? content.text ?? "");
  }

  return "";
}

function keywordsFor(text, reference) {
  const ignored = new Set([
    "dan", "yang", "di", "ke", "dari", "ini", "itu", "aku", "kamu", "ia", "nya", 
    "dengan", "dalam", "untuk", "akan", "tidak", "adalah", "and", "the", "in", 
    "to", "of", "this", "that", "i", "you", "he", "she", "it", "with", "for", "not", "is"
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
    kasih: ["kasih", "mengasihi", "love", "loved"],
    iman: ["percaya", "iman", "faith", "believe"],
    doa: ["doa", "permohonan", "pray", "prayer"],
    damai: ["damai", "sejahtera", "peace"],
    pengampunan: ["ampun", "mengampuni", "forgive", "forgiveness"],
    pengharapan: ["harap", "pengharapan", "hope"],
    hikmat: ["hikmat", "bijaksana", "wisdom", "wise"],
  })) {
    if (words.some((word) => normalized.includes(word))) {
      themes.push(theme);
    }
  }

  return themes.length ? themes : ["alkitab"];
}

function argNumber(name) {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return value ? Number(value.split("=")[1]) : null;
}

async function main() {
  loadEnv();
  initAdmin();

  const bibleApi = new FreeUseBibleApi();
  const db = getFirestore();
  const bibleCollection = db.collection("bible_verses");
  const limitBooks = argNumber("limit-books");
  const limitChapters = argNumber("limit-chapters");
  const startAfter = argNumber("start-after") ?? 0;
  const batchSize = argNumber("batch-size") ?? 200;

  for (const trans of translations) {
    console.log(`Reading ${trans.id} books from HelloAO...`);
    const translationBooks = await bibleApi.getTranslationBooks(trans.id);
    const books = limitBooks ? translationBooks.books.slice(0, limitBooks) : translationBooks.books;

    let batch = db.batch();
    let pending = 0;
    let total = 0;
    let seen = 0;

    async function commitIfNeeded(force = false) {
      if (pending === 0 || (!force && pending < batchSize)) {
        return;
      }
      await batch.commit();
      total += pending;
      console.log(`[${trans.id}] Seeded ${total} verses...`);
      batch = db.batch();
      pending = 0;
    }

    for (const book of books) {
      const chapterCount = limitChapters ? Math.min(limitChapters, book.numberOfChapters) : book.numberOfChapters;
      const chapterNumbers = Array.from({ length: chapterCount }, (_, index) => index + 1);

      for (const chapterNumber of chapterNumbers) {
        try {
          const chapter = await bibleApi.getTranslationBookChapter(trans.id, book.id, chapterNumber);
          if (!chapter || !chapter.chapter || !chapter.chapter.content) continue;
          
          const verses = chapter.chapter.content.filter((item) => item.type === "verse");

          for (const verse of verses) {
            seen += 1;
            if (seen <= startAfter) continue;

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
              translation: trans.id.includes("eng") ? "BSB" : "AYT",
              translationId: trans.id,
              translationName: trans.name,
              reference,
              text,
              normalizedText: normalize(text),
              keywords: keywordsFor(text, reference),
              themes: themesFor(text),
              source: "helloao",
              updatedAt: FieldValue.serverTimestamp(),
            });

            pending += 1;
            await commitIfNeeded();
          }
        } catch (e) {
          console.error(`Error processing ${trans.id} - ${book.id} - Chapter ${chapterNumber}:`, e.message);
        }
      }
    }
    await commitIfNeeded(true);
    console.log(`Done. Seeded ${total} verses for ${trans.name}.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
