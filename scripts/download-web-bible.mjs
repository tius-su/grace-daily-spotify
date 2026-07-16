/**
 * download-web-bible.mjs
 * Script to automatically download the World English Bible (WEB) and translate it to Indonesian & Chinese (Mandarin) using Python translator.
 * It caches progress and uploads to Cloudflare R2 if configured.
 * Run: node scripts/download-web-bible.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Load environment variables
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
}

// R2 Setup
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

let s3Client = null;
if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  console.log("✅ Cloudflare R2 client initialized for backup.");
} else {
  console.log("⚠️  Missing R2 credentials. R2 upload step will be skipped.");
}

// Books Mapping to Indonesian & Chinese (Mandarin)
const BOOK_MAP = {
  "GEN": { name_ind: "Kejadian", name_eng: "Genesis", name_zh: "创世记" },
  "EXO": { name_ind: "Keluaran", name_eng: "Exodus", name_zh: "出埃及记" },
  "LEV": { name_ind: "Imamat", name_eng: "Leviticus", name_zh: "利未记" },
  "NUM": { name_ind: "Bilangan", name_eng: "Numbers", name_zh: "民数记" },
  "DEU": { name_ind: "Ulangan", name_eng: "Deuteronomy", name_zh: "申命记" },
  "JOS": { name_ind: "Yosua", name_eng: "Joshua", name_zh: "约书亚记" },
  "JDG": { name_ind: "Hakim-Hakim", name_eng: "Judges", name_zh: "士师记" },
  "RUT": { name_ind: "Rut", name_eng: "Ruth", name_zh: "路得记" },
  "1SA": { name_ind: "1 Samuel", name_eng: "1 Samuel", name_zh: "撒母耳记上" },
  "2SA": { name_ind: "2 Samuel", name_eng: "2 Samuel", name_zh: "撒母耳记下" },
  "1KI": { name_ind: "1 Raja-Raja", name_eng: "1 Kings", name_zh: "列王纪上" },
  "2KI": { name_ind: "2 Raja-Raja", name_eng: "2 Kings", name_zh: "列王纪下" },
  "1CH": { name_ind: "1 Tawarikh", name_eng: "1 Chronicles", name_zh: "历代志上" },
  "2CH": { name_ind: "2 Tawarikh", name_eng: "2 Chronicles", name_zh: "历代志下" },
  "EZR": { name_ind: "Ezra", name_eng: "Ezra", name_zh: "以斯拉记" },
  "NEH": { name_ind: "Nehemia", name_eng: "Nehemiah", name_zh: "尼希米记" },
  "EST": { name_ind: "Ester", name_eng: "Esther", name_zh: "以斯帖记" },
  "JOB": { name_ind: "Ayub", name_eng: "Job", name_zh: "约伯记" },
  "PSA": { name_ind: "Mazmur", name_eng: "Psalms", name_zh: "诗篇" },
  "PRO": { name_ind: "Amsal", name_eng: "Proverbs", name_zh: "箴言" },
  "ECC": { name_ind: "Pengkhotbah", name_eng: "Ecclesiastes", name_zh: "传道书" },
  "SNG": { name_ind: "Kidung Agung", name_eng: "Song of Solomon", name_zh: "雅歌" },
  "ISA": { name_ind: "Yesaya", name_eng: "Isaiah", name_zh: "以赛亚书" },
  "JER": { name_ind: "Yeremia", name_eng: "Jeremiah", name_zh: "耶利米书" },
  "LAM": { name_ind: "Ratapan", name_eng: "Lamentations", name_zh: "耶利米哀歌" },
  "EZK": { name_ind: "Yehezkiel", name_eng: "Ezekiel", name_zh: "以西结书" },
  "DAN": { name_ind: "Daniel", name_eng: "Daniel", name_zh: "但以理书" },
  "HOS": { name_ind: "Hosea", name_eng: "Hosea", name_zh: "何西阿书" },
  "JOL": { name_ind: "Yoel", name_eng: "Joel", name_zh: "约耳书" },
  "AMO": { name_ind: "Amos", name_eng: "Amos", name_zh: "阿摩司书" },
  "OBA": { name_ind: "Obaja", name_eng: "Obadiah", name_zh: "俄巴底亚书" },
  "JON": { name_ind: "Yunus", name_eng: "Jonah", name_zh: "约拿书" },
  "MIC": { name_ind: "Mikha", name_eng: "Micah", name_zh: "弥迦书" },
  "NAM": { name_ind: "Nahum", name_eng: "Nahum", name_zh: "那鸿书" },
  "HAB": { name_ind: "Habakuk", name_eng: "Habakkuk", name_zh: "哈巴谷书" },
  "ZEP": { name_ind: "Zefanya", name_eng: "Zephaniah", name_zh: "西番雅书" },
  "HAG": { name_ind: "Hagai", name_eng: "Haggai", name_zh: "哈该书" },
  "ZEC": { name_ind: "Zakharia", name_eng: "Zechariah", name_zh: "撒迦利亚书" },
  "MAL": { name_ind: "Maleakhi", name_eng: "Malachi", name_zh: "玛拉基书" },
  "MAT": { name_ind: "Matius", name_eng: "Matthew", name_zh: "马太福音" },
  "MRK": { name_ind: "Markus", name_eng: "Mark", name_zh: "马可福音" },
  "LUK": { name_ind: "Lukas", name_eng: "Luke", name_zh: "路加福音" },
  "JHN": { name_ind: "Yohanes", name_eng: "John", name_zh: "约翰福音" },
  "ACT": { name_ind: "Kisah Para Rasul", name_eng: "Acts", name_zh: "使徒行传" },
  "ROM": { name_ind: "Roma", name_eng: "Romans", name_zh: "罗马书" },
  "1CO": { name_ind: "1 Korintus", name_eng: "1 Corinthians", name_zh: "哥林多前书" },
  "2CO": { name_ind: "2 Korintus", name_eng: "2 Corinthians", name_zh: "哥林多后书" },
  "GAL": { name_ind: "Galatia", name_eng: "Galatians", name_zh: "加拉太书" },
  "EPH": { name_ind: "Efesus", name_eng: "Ephesians", name_zh: "以弗所书" },
  "PHP": { name_ind: "Filipi", name_eng: "Philippians", name_zh: "腓立比书" },
  "COL": { name_ind: "Kolose", name_eng: "Colossians", name_zh: "歌罗西书" },
  "1TH": { name_ind: "1 Tesalonika", name_eng: "1 Thessalonians", name_zh: "帖撒罗尼迦前书" },
  "2TH": { name_ind: "2 Tesalonika", name_eng: "2 Thessalonians", name_zh: "帖撒罗尼迦后书" },
  "1TI": { name_ind: "1 Timotius", name_eng: "1 Timothy", name_zh: "提摩太前书" },
  "2TI": { name_ind: "2 Timotius", name_eng: "2 Timothy", name_zh: "提摩太后书" },
  "TIT": { name_ind: "Titus", name_eng: "Titus", name_zh: "提多书" },
  "PHM": { name_ind: "Filemon", name_eng: "Philemon", name_zh: "腓利门书" },
  "HEB": { name_ind: "Ibrani", name_eng: "Hebrews", name_zh: "希伯来书" },
  "JAS": { name_ind: "Yakobus", name_eng: "James", name_zh: "雅格书" },
  "1PE": { name_ind: "1 Petrus", name_eng: "1 Peter", name_zh: "彼得前书" },
  "2PE": { name_ind: "2 Petrus", name_eng: "2 Peter", name_zh: "彼得后书" },
  "1JN": { name_ind: "1 Yohanes", name_eng: "1 John", name_zh: "约翰一书" },
  "2JN": { name_ind: "2 Yohanes", name_eng: "2 John", name_zh: "约翰二书" },
  "3JN": { name_ind: "3 Yohanes", name_eng: "3 John", name_zh: "约翰三书" },
  "JUD": { name_ind: "Yudas", name_eng: "Jude", name_zh: "犹大书" },
  "REV": { name_ind: "Wahyu", name_eng: "Revelation", name_zh: "启示录" }
};

const baseDir = path.join(__dirname, "..", "public", "bible");
const progressFile = path.join(__dirname, "seeder-progress-web.json");

// Command Line options helper
function getArgNumber(name) {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return value ? Number(value.split("=")[1]) : null;
}

async function uploadToR2(key, data) {
  if (!s3Client || !R2_BUCKET_NAME) return;
  try {
    const jsonStr = JSON.stringify(data);
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(jsonStr, "utf8"),
      ContentType: "application/json",
      CacheControl: "public, max-age=86400, must-revalidate",
    });
    await s3Client.send(command);
  } catch (err) {
    console.error(`[R2] Gagal mengunggah file ${key}:`, err.message);
  }
}

function translateTexts(texts, targetLang) {
  const result = spawnSync("python3", [
    path.join(__dirname, "translate.py"),
    "--source", "en",
    "--target", targetLang
  ], {
    input: JSON.stringify(texts),
    encoding: "utf8"
  });
  if (result.status !== 0 || result.error) {
    console.error(`❌ Python translation to ${targetLang} failed:`, result.stderr || result.error);
    return texts; // fallback to English
  }
  try {
    return JSON.parse(result.stdout);
  } catch (parseErr) {
    console.error(`❌ Failed to parse Python stdout for ${targetLang}:`, parseErr.message, "Stdout:", result.stdout);
    return texts;
  }
}

async function run() {
  console.log("=========================================================");
  console.log("📖 World English Bible (WEB) Multilingual Sync Script");
  console.log("=========================================================");

  // Limits for partial run / dry-run testing
  const limitBooks = getArgNumber("limit-books");
  const limitChapters = getArgNumber("limit-chapters");

  // Load progress
  let progress = { completedBooks: [] };
  if (existsSync(progressFile)) {
    try {
      progress = JSON.parse(readFileSync(progressFile, "utf8"));
      console.log(`⏳ Melanjutkan dari progres sebelumnya. Kitab selesai: ${progress.completedBooks.length}`);
    } catch {}
  }

  // Fetch book list from Bible API
  console.log("🔗 Mengunduh daftar kitab dari bible-api.com...");
  const response = await fetch("https://bible-api.com/data/web");
  if (!response.ok) {
    throw new Error(`Gagal mengunduh daftar kitab: ${response.statusText}`);
  }
  const rootData = await response.json();
  let books = rootData.books;
  
  if (limitBooks) {
    books = books.slice(0, limitBooks);
    console.log(`ℹ️ Limit diaktifkan: Memproses ${limitBooks} kitab pertama.`);
  }

  // Ensure directories exist
  mkdirSync(path.join(baseDir, "web"), { recursive: true });
  mkdirSync(path.join(baseDir, "ind_web"), { recursive: true });
  mkdirSync(path.join(baseDir, "zh_web"), { recursive: true });

  // Book list metadata arrays
  const webBooksMetadata = [];
  const indWebBooksMetadata = [];
  const zhWebBooksMetadata = [];

  let bookOrder = 1;

  for (const book of books) {
    const bookMap = BOOK_MAP[book.id] || { name_ind: book.name, name_eng: book.name, name_zh: book.name };
    const bookId = book.id;
    
    console.log(`\n📘 Memproses Kitab: ${bookMap.name_eng} / ${bookMap.name_ind} / ${bookMap.name_zh} (${bookId})`);

    // Fetch book chapter structure
    const bookUrl = `https://bible-api.com/data/web/${bookId}`;
    const bookRes = await fetch(bookUrl);
    if (!bookRes.ok) {
      console.error(`❌ Gagal mengambil data kitab ${bookId} dari API.`);
      continue;
    }
    const bookData = await bookRes.json();
    const chapters = bookData.chapters;
    const numberOfChapters = chapters.length;

    // Filter chapters based on limit-chapters option
    const chaptersToProcess = limitChapters ? chapters.slice(0, limitChapters) : chapters;

    // Track total verses in book
    let totalVersesInBook = 0;

    // Ensure subdirectories exist for this book
    mkdirSync(path.join(baseDir, "web", bookId), { recursive: true });
    mkdirSync(path.join(baseDir, "ind_web", bookId), { recursive: true });
    mkdirSync(path.join(baseDir, "zh_web", bookId), { recursive: true });

    for (const ch of chaptersToProcess) {
      const chapterNum = ch.chapter;
      const webFile = path.join(baseDir, "web", bookId, `${chapterNum}.json`);
      const indWebFile = path.join(baseDir, "ind_web", bookId, `${chapterNum}.json`);
      const zhWebFile = path.join(baseDir, "zh_web", bookId, `${chapterNum}.json`);

      // Avoid re-downloading if already exist and not empty
      if (existsSync(webFile) && existsSync(indWebFile) && existsSync(zhWebFile)) {
        try {
          const webChData = JSON.parse(readFileSync(webFile, "utf8"));
          totalVersesInBook += webChData.chapter.content.filter(v => v.type === "verse").length;
          console.log(`   ⏭️ Pasal ${chapterNum} sudah ada secara lokal. Dilewati.`);
          continue;
        } catch {}
      }

      console.log(`   📥 Mengunduh pasal ${chapterNum}...`);
      const chRes = await fetch(`https://bible-api.com/data/web/${bookId}/${chapterNum}`);
      if (!chRes.ok) {
        console.error(`      ❌ Gagal mengunduh pasal ${chapterNum}`);
        continue;
      }

      const chData = await chRes.json();
      const verses = chData.verses || [];
      totalVersesInBook += verses.length;

      // Map to web schema
      const webChapterContent = {
        translation: {
          id: "web",
          name: "World English Bible",
          shortName: "WEB",
          englishName: "World English Bible",
          language: "eng",
          languageName: "English"
        },
        book: {
          id: bookId,
          translationId: "web",
          name: bookMap.name_eng,
          commonName: bookMap.name_eng.toUpperCase(),
          title: bookMap.name_eng,
          order: bookOrder,
          numberOfChapters
        },
        chapter: {
          number: chapterNum,
          content: verses.map(v => ({
            type: "verse",
            number: v.verse,
            content: [v.text.trim()]
          }))
        },
        numberOfVerses: verses.length
      };

      // Save English WEB JSON
      writeFileSync(webFile, JSON.stringify(webChapterContent), "utf8");
      await uploadToR2(`bible/web/${bookId}/${chapterNum}.json`, webChapterContent);

      const englishTexts = verses.map(v => v.text.trim());

      // 1. Translate to Indonesian (ind_web)
      console.log(`      ✍️ Menerjemahkan pasal ${chapterNum} ke Bahasa Indonesia...`);
      const indonesianTexts = translateTexts(englishTexts, "id");

      const indWebChapterContent = {
        translation: {
          id: "ind_web",
          name: "World English Bible Terjemahan AI",
          shortName: "WEB-AI",
          englishName: "Indonesian AI Translated WEB",
          language: "ind",
          languageName: "Indonesia"
        },
        book: {
          id: bookId,
          translationId: "ind_web",
          name: bookMap.name_ind.toUpperCase(),
          commonName: bookMap.name_ind.toUpperCase(),
          title: bookMap.name_ind,
          order: bookOrder,
          numberOfChapters
        },
        chapter: {
          number: chapterNum,
          content: verses.map((v, idx) => ({
            type: "verse",
            number: v.verse,
            content: [indonesianTexts[idx] || v.text.trim()]
          }))
        },
        numberOfVerses: verses.length
      };

      writeFileSync(indWebFile, JSON.stringify(indWebChapterContent), "utf8");
      await uploadToR2(`bible/ind_web/${bookId}/${chapterNum}.json`, indWebChapterContent);

      // 2. Translate to Chinese Mandarin (zh_web)
      console.log(`      ✍️ Menerjemahkan pasal ${chapterNum} ke Bahasa Mandarin...`);
      const mandarinTexts = translateTexts(englishTexts, "zh-CN");

      const zhWebChapterContent = {
        translation: {
          id: "zh_web",
          name: "World English Bible 华语 AI 翻译",
          shortName: "WEB-ZH",
          englishName: "Chinese AI Translated WEB",
          language: "zho",
          languageName: "华语"
        },
        book: {
          id: bookId,
          translationId: "zh_web",
          name: bookMap.name_zh,
          commonName: bookMap.name_zh,
          title: bookMap.name_zh,
          order: bookOrder,
          numberOfChapters
        },
        chapter: {
          number: chapterNum,
          content: verses.map((v, idx) => ({
            type: "verse",
            number: v.verse,
            content: [mandarinTexts[idx] || v.text.trim()]
          }))
        },
        numberOfVerses: verses.length
      };

      writeFileSync(zhWebFile, JSON.stringify(zhWebChapterContent), "utf8");
      await uploadToR2(`bible/zh_web/${bookId}/${chapterNum}.json`, zhWebChapterContent);

      console.log(`      ✅ Selesai memproses pasal ${chapterNum} (${verses.length} ayat).`);
    }

    // Add metadata for books.json
    webBooksMetadata.push({
      id: bookId,
      translationId: "web",
      name: bookMap.name_eng.toUpperCase(),
      commonName: bookMap.name_eng.toUpperCase(),
      title: bookMap.name_eng,
      order: bookOrder,
      numberOfChapters,
      firstChapterNumber: 1,
      firstChapterApiLink: `/api/web/${bookId}/1.json`,
      lastChapterNumber: numberOfChapters,
      lastChapterApiLink: `/api/web/${bookId}/${numberOfChapters}.json`,
      totalNumberOfVerses: totalVersesInBook
    });

    indWebBooksMetadata.push({
      id: bookId,
      translationId: "ind_web",
      name: bookMap.name_ind.toUpperCase(),
      commonName: bookMap.name_ind.toUpperCase(),
      title: bookMap.name_ind,
      order: bookOrder,
      numberOfChapters,
      firstChapterNumber: 1,
      firstChapterApiLink: `/api/ind_web/${bookId}/1.json`,
      lastChapterNumber: numberOfChapters,
      lastChapterApiLink: `/api/ind_web/${bookId}/${numberOfChapters}.json`,
      totalNumberOfVerses: totalVersesInBook
    });

    zhWebBooksMetadata.push({
      id: bookId,
      translationId: "zh_web",
      name: bookMap.name_zh,
      commonName: bookMap.name_zh,
      title: bookMap.name_zh,
      order: bookOrder,
      numberOfChapters,
      firstChapterNumber: 1,
      firstChapterApiLink: `/api/zh_web/${bookId}/1.json`,
      lastChapterNumber: numberOfChapters,
      lastChapterApiLink: `/api/zh_web/${bookId}/${numberOfChapters}.json`,
      totalNumberOfVerses: totalVersesInBook
    });

    // Save and upload progress
    if (!progress.completedBooks.includes(bookId)) {
      progress.completedBooks.push(bookId);
      writeFileSync(progressFile, JSON.stringify(progress, null, 2), "utf8");
    }

    bookOrder++;
  }

  // Generate and save books.json for all translations
  console.log("\n📦 Menghasilkan file books.json...");

  const webBooksContent = {
    translation: {
      id: "web",
      name: "World English Bible",
      shortName: "WEB",
      englishName: "World English Bible",
      language: "eng",
      languageName: "English",
      numberOfBooks: webBooksMetadata.length,
      totalNumberOfChapters: webBooksMetadata.reduce((acc, b) => acc + b.numberOfChapters, 0),
      totalNumberOfVerses: webBooksMetadata.reduce((acc, b) => acc + b.totalNumberOfVerses, 0)
    },
    books: webBooksMetadata
  };
  writeFileSync(path.join(baseDir, "web", "books.json"), JSON.stringify(webBooksContent), "utf8");
  await uploadToR2("bible/web/books.json", webBooksContent);
  console.log("   ✅ public/bible/web/books.json berhasil diperbarui.");

  const indWebBooksContent = {
    translation: {
      id: "ind_web",
      name: "World English Bible Terjemahan AI",
      shortName: "WEB-AI",
      englishName: "Indonesian AI Translated WEB",
      language: "ind",
      languageName: "Indonesia",
      numberOfBooks: indWebBooksMetadata.length,
      totalNumberOfChapters: indWebBooksMetadata.reduce((acc, b) => acc + b.numberOfChapters, 0),
      totalNumberOfVerses: indWebBooksMetadata.reduce((acc, b) => acc + b.totalNumberOfVerses, 0)
    },
    books: indWebBooksMetadata
  };
  writeFileSync(path.join(baseDir, "ind_web", "books.json"), JSON.stringify(indWebBooksContent), "utf8");
  await uploadToR2("bible/ind_web/books.json", indWebBooksContent);
  console.log("   ✅ public/bible/ind_web/books.json berhasil diperbarui.");

  const zhWebBooksContent = {
    translation: {
      id: "zh_web",
      name: "World English Bible 华语 AI 翻译",
      shortName: "WEB-ZH",
      englishName: "Chinese AI Translated WEB",
      language: "zho",
      languageName: "华语",
      numberOfBooks: zhWebBooksMetadata.length,
      totalNumberOfChapters: zhWebBooksMetadata.reduce((acc, b) => acc + b.numberOfChapters, 0),
      totalNumberOfVerses: zhWebBooksMetadata.reduce((acc, b) => acc + b.totalNumberOfVerses, 0)
    },
    books: zhWebBooksMetadata
  };
  writeFileSync(path.join(baseDir, "zh_web", "books.json"), JSON.stringify(zhWebBooksContent), "utf8");
  await uploadToR2("bible/zh_web/books.json", zhWebBooksContent);
  console.log("   ✅ public/bible/zh_web/books.json berhasil diperbarui.");

  // Assemble flat indices
  console.log("\n🔍 Assembling flat index bible_ind_web.json...");
  const assembledFlatIndex = [];
  const assembledFlatIndexZh = [];
  
  for (const b of books) {
    const bookMap = BOOK_MAP[b.id] || { name_ind: b.name, name_zh: b.name };
    const bookId = b.id;
    
    // Assemble ID
    const chaptersDirId = path.join(baseDir, "ind_web", bookId);
    if (existsSync(chaptersDirId)) {
      const files = readdirSync(chaptersDirId).filter(f => f.endsWith(".json"));
      files.sort((x, y) => parseInt(x) - parseInt(y));
      for (const file of files) {
        const chapterNum = parseInt(file);
        try {
          const content = JSON.parse(readFileSync(path.join(chaptersDirId, file), "utf8"));
          const verses = content.chapter.content.filter(v => v.type === "verse");
          for (const v of verses) {
            assembledFlatIndex.push({
              id: `ind_web-${bookId}-${chapterNum}-${v.number}`,
              reference: `${bookMap.name_ind} ${chapterNum}:${v.number}`,
              book: bookMap.name_ind,
              bookShort: bookId,
              chapter: chapterNum,
              verse: v.number,
              translation: "WEB-AI",
              text: v.content[0] || "",
              keywords: [bookMap.name_ind.toLowerCase(), `${chapterNum}:${v.number}`],
              themes: ["alkitab"]
            });
          }
        } catch (err) {
          console.error(`Failed parsing ind_web ${bookId} chapter ${chapterNum}:`, err.message);
        }
      }
    }

    // Assemble ZH
    const chaptersDirZh = path.join(baseDir, "zh_web", bookId);
    if (existsSync(chaptersDirZh)) {
      const files = readdirSync(chaptersDirZh).filter(f => f.endsWith(".json"));
      files.sort((x, y) => parseInt(x) - parseInt(y));
      for (const file of files) {
        const chapterNum = parseInt(file);
        try {
          const content = JSON.parse(readFileSync(path.join(chaptersDirZh, file), "utf8"));
          const verses = content.chapter.content.filter(v => v.type === "verse");
          for (const v of verses) {
            assembledFlatIndexZh.push({
              id: `zh_web-${bookId}-${chapterNum}-${v.number}`,
              reference: `${bookMap.name_zh} ${chapterNum}:${v.number}`,
              book: bookMap.name_zh,
              bookShort: bookId,
              chapter: chapterNum,
              verse: v.number,
              translation: "WEB-ZH",
              text: v.content[0] || "",
              keywords: [bookMap.name_zh, `${chapterNum}:${v.number}`],
              themes: ["alkitab"]
            });
          }
        } catch (err) {
          console.error(`Failed parsing zh_web ${bookId} chapter ${chapterNum}:`, err.message);
        }
      }
    }
  }
  
  if (assembledFlatIndex.length > 0) {
    const indexPath = path.join(baseDir, "ind_web", "bible_ind_web.json");
    writeFileSync(indexPath, JSON.stringify(assembledFlatIndex), "utf8");
    await uploadToR2("backup/bible_ind_web.json", assembledFlatIndex);
    console.log(`   ✅ Indonesian Flat index assembled: ${assembledFlatIndex.length} verses saved & uploaded.`);
  }

  if (assembledFlatIndexZh.length > 0) {
    const indexPath = path.join(baseDir, "zh_web", "bible_zh_web.json");
    writeFileSync(indexPath, JSON.stringify(assembledFlatIndexZh), "utf8");
    await uploadToR2("backup/bible_zh_web.json", assembledFlatIndexZh);
    console.log(`   ✅ Chinese Flat index assembled: ${assembledFlatIndexZh.length} verses saved & uploaded.`);
  }

  console.log("\n🎉 Seluruh sinkronisasi World English Bible (WEB) Multilingual selesai!");
}

run().catch(err => {
  console.error("❌ Fatal error during run:", err.message);
  process.exit(1);
});
