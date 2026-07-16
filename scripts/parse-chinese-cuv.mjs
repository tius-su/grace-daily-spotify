import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "public", "bible", "bible_zh");
const targetDir = path.join(__dirname, "..", "public", "bible", "zh_web");

// R2 Setup (to upload parsed files to Cloudflare R2 backup)
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
    console.error(`[R2] Gagal mengunggah ${key}:`, err.message);
  }
}

// 66 Books list mapping
const BOOK_LIST = [
  { id: "GEN", order: 1, name: "创世记", filePattern: "GEN" },
  { id: "EXO", order: 2, name: "出埃及记", filePattern: "EXO" },
  { id: "LEV", order: 3, name: "利未记", filePattern: "LEV" },
  { id: "NUM", order: 4, name: "民数记", filePattern: "NUM" },
  { id: "DEU", order: 5, name: "申命记", filePattern: "DEU" },
  { id: "JOS", order: 6, name: "约书亚记", filePattern: "JOS" },
  { id: "JDG", order: 7, name: "士师记", filePattern: "JDG" },
  { id: "RUT", order: 8, name: "路得记", filePattern: "RUT" },
  { id: "1SA", order: 9, name: "撒母耳记上", filePattern: "1SA" },
  { id: "2SA", order: 10, name: "撒母耳记下", filePattern: "2SA" },
  { id: "1KI", order: 11, name: "列王纪上", filePattern: "1KI" },
  { id: "2KI", order: 12, name: "列王纪下", filePattern: "2KI" },
  { id: "1CH", order: 13, name: "历代志上", filePattern: "1CH" },
  { id: "2CH", order: 14, name: "历代志下", filePattern: "2CH" },
  { id: "EZR", order: 15, name: "以斯拉记", filePattern: "EZR" },
  { id: "NEH", order: 16, name: "尼希米记", filePattern: "NEH" },
  { id: "EST", order: 17, name: "以斯帖记", filePattern: "EST" },
  { id: "JOB", order: 18, name: "约伯记", filePattern: "JOB" },
  { id: "PSA", order: 19, name: "诗篇", filePattern: "PSA" },
  { id: "PRO", order: 20, name: "箴言", filePattern: "PRO" },
  { id: "ECC", order: 21, name: "传道书", filePattern: "ECC" },
  { id: "SNG", order: 22, name: "雅歌", filePattern: "SNG" },
  { id: "ISA", order: 23, name: "以赛亚书", filePattern: "ISA" },
  { id: "JER", order: 24, name: "耶利米书", filePattern: "JER" },
  { id: "LAM", order: 25, name: "耶利米哀歌", filePattern: "LAM" },
  { id: "EZK", order: 26, name: "以西结书", filePattern: "EZK" },
  { id: "DAN", order: 27, name: "但以理书", filePattern: "DAN" },
  { id: "HOS", order: 28, name: "何西阿书", filePattern: "HOS" },
  { id: "JOL", order: 29, name: "约耳书", filePattern: "JOL" },
  { id: "AMO", order: 30, name: "阿摩司书", filePattern: "AMO" },
  { id: "OBA", order: 31, name: "俄巴底亚书", filePattern: "OBA" },
  { id: "JON", order: 32, name: "约拿书", filePattern: "JON" },
  { id: "MIC", order: 33, name: "弥迦书", filePattern: "MIC" },
  { id: "NAM", order: 34, name: "那鸿书", filePattern: "NAM" },
  { id: "HAB", order: 35, name: "哈巴谷书", filePattern: "HAB" },
  { id: "ZEP", order: 36, name: "西番雅书", filePattern: "ZEP" },
  { id: "HAG", order: 37, name: "哈该书", filePattern: "HAG" },
  { id: "ZEC", order: 38, name: "撒迦利亚书", filePattern: "ZEC" },
  { id: "MAL", order: 39, name: "玛拉基书", filePattern: "MAL" },
  { id: "MAT", order: 40, name: "马太福音", filePattern: "MAT" },
  { id: "MRK", order: 41, name: "马可福音", filePattern: "MRK" },
  { id: "LUK", order: 42, name: "路加福音", filePattern: "LUK" },
  { id: "JHN", order: 43, name: "约翰福音", filePattern: "JHN" },
  { id: "ACT", order: 44, name: "使徒行传", filePattern: "ACT" },
  { id: "ROM", order: 45, name: "罗马书", filePattern: "ROM" },
  { id: "1CO", order: 46, name: "哥林多前书", filePattern: "1CO" },
  { id: "2CO", order: 47, name: "哥林多后书", filePattern: "2CO" },
  { id: "GAL", order: 48, name: "加拉太书", filePattern: "GAL" },
  { id: "EPH", order: 49, name: "以弗所书", filePattern: "EPH" },
  { id: "PHP", order: 50, name: "腓立比书", filePattern: "PHP" },
  { id: "COL", order: 51, name: "歌罗西书", filePattern: "COL" },
  { id: "1TH", order: 52, name: "帖撒罗尼迦前书", filePattern: "1TH" },
  { id: "2TH", order: 53, name: "帖撒罗尼迦后书", filePattern: "2TH" },
  { id: "1TI", order: 54, name: "提摩太前书", filePattern: "1TI" },
  { id: "2TI", order: 55, name: "提摩太后书", filePattern: "2TI" },
  { id: "TIT", order: 56, name: "提多书", filePattern: "TIT" },
  { id: "PHM", order: 57, name: "腓利门书", filePattern: "PHM" },
  { id: "HEB", order: 58, name: "希伯来书", filePattern: "HEB" },
  { id: "JAS", order: 59, name: "雅各书", filePattern: "JAS" },
  { id: "1PE", order: 60, name: "彼得前书", filePattern: "1PE" },
  { id: "2PE", order: 61, name: "彼得后书", filePattern: "2PE" },
  { id: "1JN", order: 62, name: "约翰一书", filePattern: "1JN" },
  { id: "2JN", order: 63, name: "约翰二书", filePattern: "2JN" },
  { id: "3JN", order: 64, name: "约翰三书", filePattern: "3JN" },
  { id: "JUD", order: 65, name: "犹大书", filePattern: "JUD" },
  { id: "REV", order: 66, name: "启示录", filePattern: "REV" }
];

function extractText(el) {
  if (typeof el === "string") return el;
  if (!el) return "";
  
  if (el.type === "char" && Array.isArray(el.content)) {
    return el.content.map(extractText).join("");
  }
  
  // Skip notes, footnotes, headers, cross-references
  return "";
}

async function parseBook(bookInfo, filePath) {
  const rawData = JSON.parse(readFileSync(filePath, "utf8"));
  const usjContent = rawData.content || [];
  
  const chaptersMap = new Map(); // chapterNum -> array of verses { number, content: [string] }
  
  let currentChapter = null;
  let currentVerse = null;
  let verseParts = [];
  
  const saveCurrentVerse = () => {
    if (currentChapter !== null && currentVerse !== null && verseParts.length > 0) {
      if (!chaptersMap.has(currentChapter)) {
        chaptersMap.set(currentChapter, []);
      }
      const text = verseParts.join("").replace(/\s+/g, " ").trim();
      if (text) {
        chaptersMap.get(currentChapter).push({
          type: "verse",
          number: currentVerse,
          content: [text]
        });
      }
      verseParts = [];
    }
  };

  // Loop through USJ elements
  for (const node of usjContent) {
    if (node.type === "chapter" && node.marker === "c") {
      saveCurrentVerse();
      currentChapter = parseInt(node.number, 10);
      currentVerse = null;
    } else if (node.type === "para") {
      const paraContent = node.content || [];
      for (const item of paraContent) {
        if (typeof item === "object" && item.type === "verse" && item.marker === "v") {
          saveCurrentVerse();
          currentVerse = parseInt(item.number, 10);
        } else {
          // It's a text fragment or styling element
          const txt = extractText(item);
          if (txt && currentVerse !== null) {
            verseParts.push(txt);
          }
        }
      }
    }
  }
  saveCurrentVerse(); // save trailing verse

  // Save each chapter to target Next.js JSON schema
  mkdirSync(path.join(targetDir, bookInfo.id), { recursive: true });
  
  let totalVerses = 0;
  const chaptersList = Array.from(chaptersMap.keys()).sort((a, b) => a - b);
  
  for (const chNum of chaptersList) {
    const chContent = chaptersMap.get(chNum) || [];
    totalVerses += chContent.length;
    
    const chapterJSON = {
      translation: {
        id: "zh_web",
        name: "和合本",
        shortName: "CUV",
        englishName: "Chinese Union Version",
        language: "zho",
        languageName: "繁體/简体中文"
      },
      book: {
        id: bookInfo.id,
        translationId: "zh_web",
        name: bookInfo.name,
        commonName: bookInfo.name,
        title: bookInfo.name,
        order: bookInfo.order,
        numberOfChapters: chaptersList.length
      },
      chapter: {
        number: chNum,
        content: chContent
      },
      numberOfVerses: chContent.length
    };
    
    const outPath = path.join(targetDir, bookInfo.id, `${chNum}.json`);
    writeFileSync(outPath, JSON.stringify(chapterJSON), "utf8");
  }
  
  console.log(`✅ Parsed ${bookInfo.id}: ${chaptersList.length} chapters, ${totalVerses} verses.`);
  return {
    id: bookInfo.id,
    translationId: "zh_web",
    name: bookInfo.name,
    commonName: bookInfo.name,
    title: bookInfo.name,
    order: bookInfo.order,
    numberOfChapters: chaptersList.length,
    firstChapterNumber: 1,
    firstChapterApiLink: `/api/zh_web/${bookInfo.id}/1.json`,
    lastChapterNumber: chaptersList.length,
    lastChapterApiLink: `/api/zh_web/${bookInfo.id}/${chaptersList.length}.json`,
    totalNumberOfVerses: totalVerses
  };
}

async function run() {
  if (!existsSync(srcDir)) {
    console.error(`❌ Source directory ${srcDir} does not exist.`);
    return;
  }
  
  mkdirSync(targetDir, { recursive: true });
  console.log("🚀 Starting parsing of Chinese USJ files...");
  
  const booksMetadata = [];
  
  // Find matching file for each book
  const files = readdirSync(srcDir).filter(f => f.endsWith(".json"));
  
  for (const book of BOOK_LIST) {
    const file = files.find(f => f.includes(`-${book.filePattern}`) || f.includes(book.filePattern));
    if (!file) {
      console.warn(`⚠️ Warning: No file found for book ${book.id}`);
      continue;
    }
    
    const filePath = path.join(srcDir, file);
    try {
      const meta = await parseBook(book, filePath);
      booksMetadata.push(meta);
    } catch (err) {
      console.error(`❌ Failed parsing book ${book.id}:`, err);
    }
  }
  
  // Generate books.json
  const booksContent = {
    translation: {
      id: "zh_web",
      name: "和合本",
      shortName: "CUV",
      englishName: "Chinese Union Version",
      language: "zho",
      languageName: "繁體/简体中文",
      numberOfBooks: booksMetadata.length,
      totalNumberOfChapters: booksMetadata.reduce((acc, b) => acc + b.numberOfChapters, 0),
      totalNumberOfVerses: booksMetadata.reduce((acc, b) => acc + b.totalNumberOfVerses, 0)
    },
    books: booksMetadata
  };
  
  writeFileSync(path.join(targetDir, "books.json"), JSON.stringify(booksContent), "utf8");
  await uploadToR2("bible/zh_web/books.json", booksContent);
  console.log("✅ Generated public/bible/zh_web/books.json");

  // Assemble flat index
  console.log("🔍 Assembling Chinese flat index...");
  const assembledFlatIndexZh = [];
  for (const b of BOOK_LIST) {
    const chaptersDirZh = path.join(targetDir, b.id);
    if (existsSync(chaptersDirZh)) {
      const chFiles = readdirSync(chaptersDirZh).filter(f => f.endsWith(".json"));
      chFiles.sort((x, y) => parseInt(x) - parseInt(y));
      for (const chFile of chFiles) {
        const chapterNum = parseInt(chFile);
        try {
          const content = JSON.parse(readFileSync(path.join(chaptersDirZh, chFile), "utf8"));
          const verses = content.chapter.content.filter(v => v.type === "verse");
          for (const v of verses) {
            assembledFlatIndexZh.push({
              id: `zh_web-${b.id}-${chapterNum}-${v.number}`,
              reference: `${b.name} ${chapterNum}:${v.number}`,
              book: b.name,
              bookShort: b.id,
              chapter: chapterNum,
              verse: v.number,
              translation: "CUV",
              text: v.content[0] || "",
              keywords: [b.name, `${chapterNum}:${v.number}`],
              themes: ["alkitab"]
            });
          }
        } catch (err) {
          console.error(`Failed parsing flat index for ${b.id} chapter ${chapterNum}:`, err.message);
        }
      }
    }
  }

  if (assembledFlatIndexZh.length > 0) {
    const indexPath = path.join(targetDir, "bible_zh_web.json");
    writeFileSync(indexPath, JSON.stringify(assembledFlatIndexZh), "utf8");
    await uploadToR2("backup/bible_zh_web.json", assembledFlatIndexZh);
    console.log(`✅ Chinese Flat index assembled: ${assembledFlatIndexZh.length} verses saved & uploaded.`);
  }

  // Sync all parsed JSON files to R2 in a fast batch at the end
  console.log("☁️ Syncing parsed Chinese Bible files to Cloudflare R2...");
  for (const b of BOOK_LIST) {
    const chaptersDir = path.join(targetDir, b.id);
    if (existsSync(chaptersDir)) {
      const chFiles = readdirSync(chaptersDir).filter(f => f.endsWith(".json"));
      for (const chFile of chFiles) {
        const chapterNum = parseInt(chFile);
        try {
          const content = JSON.parse(readFileSync(path.join(chaptersDir, chFile), "utf8"));
          await uploadToR2(`bible/zh_web/${b.id}/${chapterNum}.json`, content);
        } catch {}
      }
    }
  }
  
  console.log("🎉 Chinese Bible (CUV) parsing complete!");
}

import { readdirSync } from "fs";
run();
