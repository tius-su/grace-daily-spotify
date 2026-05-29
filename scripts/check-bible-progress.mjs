import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const bookOrder = [
  "GEN",
  "EXO",
  "LEV",
  "NUM",
  "DEU",
  "JOS",
  "JDG",
  "RUT",
  "1SA",
  "2SA",
  "1KI",
  "2KI",
  "1CH",
  "2CH",
  "EZR",
  "NEH",
  "EST",
  "JOB",
  "PSA",
  "PRO",
  "ECC",
  "SNG",
  "ISA",
  "JER",
  "LAM",
  "EZK",
  "DAN",
  "HOS",
  "JOL",
  "AMO",
  "OBA",
  "JON",
  "MIC",
  "NAM",
  "HAB",
  "ZEP",
  "HAG",
  "ZEC",
  "MAL",
  "MAT",
  "MRK",
  "LUK",
  "JHN",
  "ACT",
  "ROM",
  "1CO",
  "2CO",
  "GAL",
  "EPH",
  "PHP",
  "COL",
  "1TH",
  "2TH",
  "1TI",
  "2TI",
  "TIT",
  "PHM",
  "HEB",
  "JAS",
  "1PE",
  "2PE",
  "1JN",
  "2JN",
  "3JN",
  "JUD",
  "REV",
];

function loadEnv() {
  for (const file of [resolve(".env.local"), resolve("../.env.local")]) {
    if (!existsSync(file)) {
      continue;
    }

    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
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
    "Tambahkan FIREBASE_SERVICE_ACCOUNT_JSON atau GOOGLE_APPLICATION_CREDENTIALS.",
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

function verseSortKey(data) {
  const order = bookOrder.indexOf(data.bookShort);
  return [
    order < 0 ? 999 : order,
    Number(data.chapter ?? 0),
    Number(data.verse ?? 0),
  ];
}

function compareVerse(a, b) {
  const aKey = verseSortKey(a);
  const bKey = verseSortKey(b);

  for (let index = 0; index < aKey.length; index += 1) {
    if (aKey[index] !== bKey[index]) {
      return aKey[index] - bKey[index];
    }
  }

  return 0;
}

async function main() {
  loadEnv();
  initAdmin();

  const db = getFirestore();
  const snapshot = await db
    .collection("bible_verses")
    .select("book", "bookShort", "chapter", "verse", "reference", "translationId")
    .get();

  const byTranslation = new Map();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const translationId = data.translationId ?? "unknown";
    const bucket = byTranslation.get(translationId) ?? {
      latest: null,
      byBook: new Map(),
      total: 0,
    };

    bucket.total += 1;
    bucket.byBook.set(data.bookShort, (bucket.byBook.get(data.bookShort) ?? 0) + 1);

    if (!bucket.latest || compareVerse(data, bucket.latest) > 0) {
      bucket.latest = data;
    }

    byTranslation.set(translationId, bucket);
  }

  console.log(`Total bible_verses: ${snapshot.size}`);

  for (const [translationId, bucket] of byTranslation.entries()) {
    console.log(`\n[${translationId}] Total: ${bucket.total}`);

    const latest = bucket.latest;
    const byBook = bucket.byBook;

    if (!latest) continue;

    console.log(
      `Ayat terakhir menurut urutan Alkitab: ${latest.reference ?? `${latest.book} ${latest.chapter}:${latest.verse}`} (${latest.bookShort})`,
    );

    const lastBookIndex = latest ? bookOrder.indexOf(latest.bookShort) : -1;
    const nextBook = bookOrder[lastBookIndex + 1];
    console.log(
      `Kitab terisi: ${Array.from(byBook.keys()).length}/${bookOrder.length}`,
    );

    if (nextBook) {
      console.log(`Kitab berikutnya setelah progres terakhir: ${nextBook}`);
    } else if (latest?.bookShort === "REV") {
      console.log("Progres sudah mencapai Wahyu.");
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
