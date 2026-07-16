import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Verse } from "@/lib/data";
import storageConfig from "../../storage-config.json";

export type BibleVerse = Verse & {
  id: string;
  reference: string;
  normalizedText: string;
  keywords: string[];
};

export type BibleChapterReading = {
  book: string;
  bookShort: string;
  chapter: number;
  translation: string;
  verses: Array<{
    number: number;
    text: string;
  }>;
};

export const USE_WEB_BIBLE = process.env.NEXT_PUBLIC_USE_WEB_BIBLE === "true";

export const defaultBibleTranslation = USE_WEB_BIBLE
  ? {
    id: "ind_web" as const,
    name: "World English Bible Terjemahan AI",
    language: "Indonesia",
  }
  : {
    id: "ind_ayt" as const,
    name: "Alkitab Yang Terbuka",
    language: "Indonesia",
  };

export const bsbBibleTranslation = USE_WEB_BIBLE
  ? {
    id: "web" as const,
    name: "World English Bible",
    language: "English",
  }
  : {
    id: "BSB" as const,
    name: "Berean Standard Bible",
    language: "English",
  };

export const sampleBibleVerses: BibleVerse[] = USE_WEB_BIBLE
  ? [
    {
      id: "ind_web-JHN-3-16",
      book: "Yohanes",
      bookShort: "JHN",
      chapter: 3,
      verse: 16,
      translation: "WEB-AI",
      reference: "Yohanes 3:16",
      text: "Karena Allah sangat mengasihi dunia ini, sehingga Ia memberikan Anak Tunggal-Nya, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan memperoleh hidup yang kekal.",
      themes: ["kasih", "iman", "keselamatan"],
      normalizedText:
        "karena allah sangat mengasihi dunia ini sehingga ia memberikan anak tunggal nya supaya setiap orang yang percaya kepada nya tidak binasa melainkan memperoleh hidup yang kekal",
      keywords: ["allah", "kasih", "dunia", "percaya", "hidup", "kekal"],
    },
    {
      id: "ind_web-PSA-23-1",
      book: "Mazmur",
      bookShort: "PSA",
      chapter: 23,
      verse: 1,
      translation: "WEB-AI",
      reference: "Mazmur 23:1",
      text: "Tuhan adalah gembalaku. Aku tidak akan kekurangan.",
      themes: ["penghiburan", "pemeliharaan"],
      normalizedText: "yahweh adalah gembalaku aku tidak akan kekurangan",
      keywords: ["yahweh", "gembala", "kekurangan"],
    },
    {
      id: "ind_web-PHP-4-6",
      book: "Filipi",
      bookShort: "PHP",
      chapter: 4,
      verse: 6,
      translation: "WEB-AI",
      reference: "Filipi 4:6",
      text: "Jangan khawatir tentang apa pun, tetapi dalam segala hal, melalui doa dan permohonan dengan ucapan syukur, nyatakan keinginanmu kepada Allah.",
      themes: ["doa", "damai", "syukur"],
      normalizedText:
        "jangan khawatir tentang apa pun tetapi dalam segala hal melalui doa dan permohonan dengan ucapan syukur nyatakan keinginanmu kepada allah",
      keywords: ["khawatir", "allah", "doa", "permohonan", "syukur"],
    },
  ]
  : [
    {
      id: "ind_ayt-JHN-3-16",
      book: "Yohanes",
      bookShort: "JHN",
      chapter: 3,
      verse: 16,
      translation: "AYT",
      reference: "Yohanes 3:16",
      text: "Karena Allah sangat mengasihi dunia ini, Ia memberikan Anak-Nya yang tunggal supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan memperoleh hidup yang kekal.",
      themes: ["kasih", "iman", "keselamatan"],
      normalizedText:
        "karena allah sangat mengasihi dunia ini ia memberikan anak nya yang tunggal supaya setiap orang yang percaya kepada nya tidak binasa melainkan memperoleh hidup yang kekal",
      keywords: ["allah", "kasih", "dunia", "percaya", "hidup", "kekal"],
    },
    {
      id: "ind_ayt-PSA-23-1",
      book: "Mazmur",
      bookShort: "PSA",
      chapter: 23,
      verse: 1,
      translation: "AYT",
      reference: "Mazmur 23:1",
      text: "TUHAN adalah gembalaku, aku tidak akan kekurangan.",
      themes: ["penghiburan", "pemeliharaan"],
      normalizedText: "tuhan adalah gembalaku aku tidak akan kekurangan",
      keywords: ["tuhan", "gembala", "kekurangan"],
    },
    {
      id: "ind_ayt-PHP-4-6",
      book: "Filipi",
      bookShort: "PHP",
      chapter: 4,
      verse: 6,
      translation: "AYT",
      reference: "Filipi 4:6",
      text: "Janganlah khawatir tentang apa pun juga. Namun, dalam segala sesuatu, nyatakan keinginanmu kepada Allah dalam doa dan permohonan dengan ucapan syukur.",
      themes: ["doa", "damai", "syukur"],
      normalizedText:
        "janganlah khawatir tentang apa pun juga namun dalam segala sesuatu nyatakan keinginanmu kepada allah dalam doa dan permohonan dengan ucapan syukur",
      keywords: ["khawatir", "allah", "doa", "permohonan", "syukur"],
    },
  ];

export const BIBLE_BOOKS = [
  { id: "GEN", name: "Kejadian", chapters: 50 },
  { id: "EXO", name: "Keluaran", chapters: 40 },
  { id: "LEV", name: "Imamat", chapters: 27 },
  { id: "NUM", name: "Bilangan", chapters: 36 },
  { id: "DEU", name: "Ulangan", chapters: 34 },
  { id: "JOS", name: "Yosua", chapters: 24 },
  { id: "JDG", name: "Hakim-Hakim", chapters: 21 },
  { id: "RUT", name: "Rut", chapters: 4 },
  { id: "1SA", name: "1 Samuel", chapters: 31 },
  { id: "2SA", name: "2 Samuel", chapters: 24 },
  { id: "1KI", name: "1 Raja-Raja", chapters: 22 },
  { id: "2KI", name: "2 Raja-Raja", chapters: 25 },
  { id: "1CH", name: "1 Tawarikh", chapters: 29 },
  { id: "2CH", name: "2 Tawarikh", chapters: 36 },
  { id: "EZR", name: "Ezra", chapters: 10 },
  { id: "NEH", name: "Nehemia", chapters: 13 },
  { id: "EST", name: "Ester", chapters: 10 },
  { id: "JOB", name: "Ayub", chapters: 42 },
  { id: "PSA", name: "Mazmur", chapters: 150 },
  { id: "PRO", name: "Amsal", chapters: 31 },
  { id: "ECC", name: "Pengkhotbah", chapters: 12 },
  { id: "SNG", name: "Kidung Agung", chapters: 8 },
  { id: "ISA", name: "Yesaya", chapters: 66 },
  { id: "JER", name: "Yeremia", chapters: 52 },
  { id: "LAM", name: "Ratapan", chapters: 5 },
  { id: "EZK", name: "Yehezkiel", chapters: 48 },
  { id: "DAN", name: "Daniel", chapters: 12 },
  { id: "HOS", name: "Hosea", chapters: 14 },
  { id: "JOL", name: "Yoel", chapters: 3 },
  { id: "AMO", name: "Amos", chapters: 9 },
  { id: "OBA", name: "Obaja", chapters: 1 },
  { id: "JON", name: "Yunus", chapters: 4 },
  { id: "MIC", name: "Mikha", chapters: 7 },
  { id: "NAM", name: "Nahum", chapters: 3 },
  { id: "HAB", name: "Habakuk", chapters: 3 },
  { id: "ZEP", name: "Zefanya", chapters: 3 },
  { id: "HAG", name: "Hagai", chapters: 2 },
  { id: "ZEC", name: "Zakharia", chapters: 14 },
  { id: "MAL", name: "Maleakhi", chapters: 4 },
  { id: "MAT", name: "Matius", chapters: 28 },
  { id: "MRK", name: "Markus", chapters: 16 },
  { id: "LUK", name: "Lukas", chapters: 24 },
  { id: "JHN", name: "Yohanes", chapters: 21 },
  { id: "ACT", name: "Kisah Para Rasul", chapters: 28 },
  { id: "ROM", name: "Roma", chapters: 16 },
  { id: "1CO", name: "1 Korintus", chapters: 16 },
  { id: "2CO", name: "2 Korintus", chapters: 13 },
  { id: "GAL", name: "Galatia", chapters: 6 },
  { id: "EPH", name: "Efesus", chapters: 6 },
  { id: "PHP", name: "Filipi", chapters: 4 },
  { id: "COL", name: "Kolose", chapters: 4 },
  { id: "1TH", name: "1 Tesalonika", chapters: 5 },
  { id: "2TH", name: "2 Tesalonika", chapters: 3 },
  { id: "1TI", name: "1 Timotius", chapters: 6 },
  { id: "2TI", name: "2 Timotius", chapters: 4 },
  { id: "TIT", name: "Titus", chapters: 3 },
  { id: "PHM", name: "Filemon", chapters: 1 },
  { id: "HEB", name: "Ibrani", chapters: 13 },
  { id: "JAS", name: "Yakobus", chapters: 5 },
  { id: "1PE", name: "1 Petrus", chapters: 5 },
  { id: "2PE", name: "2 Petrus", chapters: 3 },
  { id: "1JN", name: "1 Yohanes", chapters: 5 },
  { id: "2JN", name: "2 Yohanes", chapters: 1 },
  { id: "3JN", name: "3 Yohanes", chapters: 1 },
  { id: "JUD", name: "Yudas", chapters: 1 },
  { id: "REV", name: "Wahyu", chapters: 22 }
];

const bookAliases: Record<string, { id: string; name: string }> = {};
for (const book of BIBLE_BOOKS) {
  const lower = book.name.toLowerCase();
  bookAliases[lower] = { id: book.id, name: book.name };

  // Normalized query name (e.g. replace hyphens/symbols with space)
  const norm = lower.replace(/[^a-z0-9\s:]/g, " ").replace(/\s+/g, " ").trim();
  if (norm !== lower) {
    bookAliases[norm] = { id: book.id, name: book.name };
  }

  // Stripped (alphanumeric only)
  const stripped = lower.replace(/[^a-z0-9]/g, "");
  if (stripped !== lower && stripped !== norm) {
    bookAliases[stripped] = { id: book.id, name: book.name };
  }
}
bookAliases["kisah"] = { id: "ACT", name: "Kisah Para Rasul" };
bookAliases["korintus"] = { id: "1CO", name: "1 Korintus" };
bookAliases["tesalonika"] = { id: "1TH", name: "1 Tesalonika" };
bookAliases["timotius"] = { id: "1TI", name: "1 Timotius" };
bookAliases["petrus"] = { id: "1PE", name: "1 Petrus" };
bookAliases["samuel"] = { id: "1SA", name: "1 Samuel" };
bookAliases["raja-raja"] = { id: "1KI", name: "1 Raja-Raja" };
bookAliases["raja raja"] = { id: "1KI", name: "1 Raja-Raja" };
bookAliases["tawarikh"] = { id: "1CH", name: "1 Tawarikh" };

export function normalizeBibleQuery(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractBibleText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(extractBibleText).join("");
  }

  if (content && typeof content === "object") {
    const value = content as { content?: unknown; text?: unknown };
    return extractBibleText(value.content ?? value.text ?? "");
  }

  return "";
}

const CHAPTERS_CACHE_NAME = "bible-chapters-cache-v2";

export async function cleanOldBibleCaches(): Promise<void> {
  if (typeof window === "undefined" || !window.caches) return;
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      if (key.startsWith("bible-chapters-cache-") && key !== CHAPTERS_CACHE_NAME) {
        await caches.delete(key);
        console.log(`[bible] Deleted old bible cache: ${key}`);
      }
    }
  } catch (error) {
    console.warn("[bible] Failed to clear old bible caches:", error);
  }
}

async function fetchWithCache(url: string): Promise<Response> {
  if (typeof window === "undefined") {
    let serverUrl = url;
    if (url.startsWith("/")) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      serverUrl = `${appUrl}${url}`;
    }
    try {
      let response = await fetch(serverUrl);
      if (!response.ok && url.startsWith("/bible/")) {
        const r2Url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev"}${url}`;
        console.log(`[bible server] Local fetch failed for ${url}. Falling back to R2: ${r2Url}`);
        const r2Response = await fetch(r2Url);
        if (r2Response.ok) {
          response = r2Response;
        }
      }
      return response;
    } catch (e) {
      if (url.startsWith("/bible/")) {
        const r2Url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev"}${url}`;
        return fetch(r2Url);
      }
      throw e;
    }
  }
  try {
    const cache = await caches.open(CHAPTERS_CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      return cachedResponse;
    }
    let response = await fetch(url);
    if (!response.ok && response.status === 404 && url.startsWith("/bible/")) {
      const backupUrl = `/api/backup?file=${encodeURIComponent(url.substring(1))}`;
      console.log(`[bible] Local file not found: ${url}. Falling back to R2: ${backupUrl}`);
      const backupResponse = await fetch(backupUrl);
      if (backupResponse.ok) {
        response = backupResponse;
      }
    }
    if (response.ok) {
      cache.put(url, response.clone());
    }
    return response;
  } catch (error) {
    console.warn("Cache fetch failed, falling back to network:", error);
    return fetch(url);
  }
}

export const BIBLE_BOOK_TRANSLATIONS: Record<string, { id: string; idName: string; en: string; zh: string }> = {
  GEN: { id: "GEN", idName: "Kejadian", en: "Genesis", zh: "创世记" },
  EXO: { id: "EXO", idName: "Keluaran", en: "Exodus", zh: "出埃及记" },
  LEV: { id: "LEV", idName: "Imamat", en: "Leviticus", zh: "利未记" },
  NUM: { id: "NUM", idName: "Bilangan", en: "Numbers", zh: "民数记" },
  DEU: { id: "DEU", idName: "Ulangan", en: "Deuteronomy", zh: "申命记" },
  JOS: { id: "JOS", idName: "Yosua", en: "Joshua", zh: "约书亚记" },
  JDG: { id: "JDG", idName: "Hakim-Hakim", en: "Judges", zh: "士师记" },
  RUT: { id: "RUT", idName: "Rut", en: "Ruth", zh: "路得记" },
  "1SA": { id: "1SA", idName: "1 Samuel", en: "1 Samuel", zh: "撒母耳记上" },
  "2SA": { id: "2SA", idName: "2 Samuel", en: "2 Samuel", zh: "撒母耳记下" },
  "1KI": { id: "1KI", idName: "1 Raja-Raja", en: "1 Kings", zh: "列王纪上" },
  "2KI": { id: "2KI", idName: "2 Raja-Raja", en: "2 Kings", zh: "列王纪下" },
  "1CH": { id: "1CH", idName: "1 Tawarikh", en: "1 Chronicles", zh: "历代志上" },
  "2CH": { id: "2CH", idName: "2 Tawarikh", en: "2 Chronicles", zh: "历代志下" },
  EZR: { id: "EZR", idName: "Ezra", en: "Ezra", zh: "以斯拉记" },
  NEH: { id: "NEH", idName: "Nehemia", en: "Nehemiah", zh: "尼希米记" },
  EST: { id: "EST", idName: "Ester", en: "Esther", zh: "以斯帖记" },
  JOB: { id: "JOB", idName: "Ayub", en: "Job", zh: "约伯记" },
  PSA: { id: "PSA", idName: "Mazmur", en: "Psalms", zh: "诗篇" },
  PRO: { id: "PRO", idName: "Amsal", en: "Proverbs", zh: "箴言" },
  ECC: { id: "ECC", idName: "Pengkhotbah", en: "Ecclesiastes", zh: "传道书" },
  SNG: { id: "SNG", idName: "Kidung Agung", en: "Song of Songs", zh: "雅歌" },
  ISA: { id: "ISA", idName: "Yesaya", en: "Isaiah", zh: "以赛亚书" },
  JER: { id: "JER", idName: "Yeremia", en: "Jeremiah", zh: "耶利米书" },
  LAM: { id: "LAM", idName: "Ratapan", en: "Lamentations", zh: "耶利米哀歌" },
  EZK: { id: "EZK", idName: "Yehezkiel", en: "Ezekiel", zh: "以西结书" },
  DAN: { id: "DAN", idName: "Daniel", en: "Daniel", zh: "但以理书" },
  HOS: { id: "HOS", idName: "Hosea", en: "Hosea", zh: "何西阿书" },
  JOL: { id: "JOL", idName: "Yoel", en: "Joel", zh: "约珥书" },
  AMO: { id: "AMO", idName: "Amos", en: "Amos", zh: "阿摩司书" },
  OBA: { id: "OBA", idName: "Obaja", en: "Obadiah", zh: "俄巴底亚书" },
  JON: { id: "JON", idName: "Yunus", en: "Jonah", zh: "约拿书" },
  MIC: { id: "MIC", idName: "Mikha", en: "Micah", zh: "弥迦书" },
  NAM: { id: "NAM", idName: "Nahum", en: "Nahum", zh: "那鸿书" },
  HAB: { id: "HAB", idName: "Habakuk", en: "Habakkuk", zh: "哈巴谷书" },
  ZEP: { id: "ZEP", idName: "Zefanya", en: "Zephaniah", zh: "西番雅书" },
  HAG: { id: "HAG", idName: "Hagai", en: "Haggai", zh: "哈该书" },
  ZEC: { id: "ZEC", idName: "Zakharia", en: "Zechariah", zh: "撒迦利亚书" },
  MAL: { id: "MAL", idName: "Maleakhi", en: "Malachi", zh: "玛拉基书" },
  MAT: { id: "MAT", idName: "Matius", en: "Matthew", zh: "马太福音" },
  MRK: { id: "MRK", idName: "Markus", en: "Mark", zh: "马可福音" },
  LUK: { id: "LUK", idName: "Lukas", en: "Luke", zh: "路加福音" },
  JHN: { id: "JHN", idName: "Yohanes", en: "John", zh: "约翰福音" },
  ACT: { id: "ACT", idName: "Kisah Para Rasul", en: "Acts", zh: "使徒行传" },
  ROM: { id: "ROM", idName: "Roma", en: "Romans", zh: "罗马书" },
  "1CO": { id: "1CO", idName: "1 Korintus", en: "1 Corinthians", zh: "哥林多前书" },
  "2CO": { id: "2CO", idName: "2 Korintus", en: "2 Corinthians", zh: "哥林多后书" },
  GAL: { id: "GAL", idName: "Galatia", en: "Galatians", zh: "加拉太书" },
  EPH: { id: "EPH", idName: "Efesus", en: "Ephesians", zh: "以弗所书" },
  PHP: { id: "PHP", idName: "Filipi", en: "Philippians", zh: "腓立比书" },
  COL: { id: "COL", idName: "Kolose", en: "Colossians", zh: "歌罗西书" },
  "1TH": { id: "1TH", idName: "1 Tesalonika", en: "1 Thessalonians", zh: "帖撒罗尼迦前书" },
  "2TH": { id: "2TH", idName: "2 Tesalonika", en: "2 Thessalonians", zh: "帖撒罗尼迦后书" },
  "1TI": { id: "1TI", idName: "1 Timotius", en: "1 Timothy", zh: "提摩太前书" },
  "2TI": { id: "2TI", idName: "2 Timotius", en: "2 Timothy", zh: "提摩太后书" },
  TIT: { id: "TIT", idName: "Titus", en: "Titus", zh: "提多书" },
  PHM: { id: "PHM", idName: "Filemon", en: "Philemon", zh: "腓利门书" },
  HEB: { id: "HEB", idName: "Ibrani", en: "Hebrews", zh: "希伯来书" },
  JAS: { id: "JAS", idName: "Yakobus", en: "James", zh: "雅各书" },
  "1PE": { id: "1PE", idName: "1 Petrus", en: "1 Peter", zh: "彼得前书" },
  "2PE": { id: "2PE", idName: "2 Petrus", en: "2 Peter", zh: "彼得后书" },
  "1JN": { id: "1JN", idName: "1 Yohanes", en: "1 John", zh: "约翰一书" },
  "2JN": { id: "2JN", idName: "2 Yohanes", en: "2 John", zh: "约翰二书" },
  "3JN": { id: "3JN", idName: "3 Yohanes", en: "3 John", zh: "约翰三书" },
  JUD: { id: "JUD", idName: "Yudas", en: "Jude", zh: "犹大书" },
  REV: { id: "REV", idName: "Wahyu", en: "Revelation", zh: "启示录" }
};

export function getBookName(nameOrId: string, lang: string): string {
  const book = findBook(nameOrId);
  if (!book) return nameOrId;
  const translation = BIBLE_BOOK_TRANSLATIONS[book.id];
  if (!translation) return book.name;
  if (lang === "zh") return translation.zh;
  if (lang === "en") return translation.en;
  return translation.idName;
}

export function findBook(searchBook: string) {
  const clean = searchBook.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Direct lookup
  if (bookAliases[clean]) return bookAliases[clean];

  // 2. Check common abbreviations and prefix matches
  if (clean.startsWith("mat")) return { id: "MAT", name: "Matius" };
  if (clean.startsWith("mar") || clean.startsWith("mrk")) return { id: "MRK", name: "Markus" };
  if (clean.startsWith("luk")) return { id: "LUK", name: "Lukas" };
  if (clean.startsWith("yoh") || clean.startsWith("jhn")) return { id: "JHN", name: "Yohanes" };
  if (clean.startsWith("kis") || clean.startsWith("act")) return { id: "ACT", name: "Kisah Para Rasul" };
  if (clean.startsWith("rom")) return { id: "ROM", name: "Roma" };
  if (clean.startsWith("kor") || clean.startsWith("1co") || clean.startsWith("2co")) return { id: "1CO", name: "1 Korintus" };
  if (clean.startsWith("gal")) return { id: "GAL", name: "Galatia" };
  if (clean.startsWith("efe")) return { id: "EPH", name: "Efesus" };
  if (clean.startsWith("fil") || clean.startsWith("php")) return { id: "PHP", name: "Filipi" };
  if (clean.startsWith("kol") || clean.startsWith("col")) return { id: "COL", name: "Kolose" };
  if (clean.startsWith("tes") || clean.startsWith("1th") || clean.startsWith("2th")) return { id: "1TH", name: "1 Tesalonika" };
  if (clean.startsWith("tim") || clean.startsWith("1ti") || clean.startsWith("2ti")) return { id: "1TI", name: "1 Timotius" };
  if (clean.startsWith("tit")) return { id: "TIT", name: "Titus" };
  if (clean.startsWith("phm")) return { id: "PHM", name: "Filemon" };
  if (clean.startsWith("ibr") || clean.startsWith("heb")) return { id: "HEB", name: "Ibrani" };
  if (clean.startsWith("yak") || clean.startsWith("jas")) return { id: "JAS", name: "Yakobus" };
  if (clean.startsWith("pet") || clean.startsWith("1pe") || clean.startsWith("2pe")) return { id: "1PE", name: "1 Petrus" };
  if (clean.startsWith("wah") || clean.startsWith("rev")) return { id: "REV", name: "Wahyu" };
  if (clean.startsWith("kej") || clean.startsWith("gen")) return { id: "GEN", name: "Kejadian" };
  if (clean.startsWith("kel") || clean.startsWith("exo")) return { id: "EXO", name: "Keluaran" };
  if (clean.startsWith("ima") || clean.startsWith("lev")) return { id: "LEV", name: "Imamat" };
  if (clean.startsWith("bil") || clean.startsWith("num")) return { id: "BIL", name: "Bilangan" };
  if (clean.startsWith("ula") || clean.startsWith("deu")) return { id: "DEU", name: "Ulangan" };
  if (clean.startsWith("yos") || clean.startsWith("jos")) return { id: "JOS", name: "Yosua" };
  if (clean.startsWith("hak") || clean.startsWith("jdg")) return { id: "JDG", name: "Hakim-Hakim" };
  if (clean.startsWith("rut")) return { id: "RUT", name: "Rut" };
  if (clean.startsWith("sam") || clean.startsWith("1sa") || clean.startsWith("2sa")) return { id: "1SA", name: "1 Samuel" };
  if (clean.startsWith("raj") || clean.startsWith("1ki") || clean.startsWith("2ki")) return { id: "1KI", name: "1 Raja-Raja" };
  if (clean.startsWith("taw") || clean.startsWith("1ch") || clean.startsWith("2ch")) return { id: "1CH", name: "1 Tawarikh" };
  if (clean.startsWith("ezr")) return { id: "EZR", name: "Ezra" };
  if (clean.startsWith("neh")) return { id: "NEH", name: "Nehemia" };
  if (clean.startsWith("est")) return { id: "EST", name: "Ester" };
  if (clean.startsWith("ayu") || clean.startsWith("job")) return { id: "JOB", name: "Ayub" };
  if (clean.startsWith("maz") || clean.startsWith("psa")) return { id: "PSA", name: "Mazmur" };
  if (clean.startsWith("ams") || clean.startsWith("pro")) return { id: "PRO", name: "Amsal" };
  if (clean.startsWith("pen") || clean.startsWith("ecc")) return { id: "ECC", name: "Pengkhotbah" };
  if (clean.startsWith("kid") || clean.startsWith("sng")) return { id: "SNG", name: "Kidung Agung" };
  if (clean.startsWith("yes") || clean.startsWith("isa")) return { id: "ISA", name: "Yesaya" };
  if (clean.startsWith("yer") || clean.startsWith("jer")) return { id: "JER", name: "Yeremia" };
  if (clean.startsWith("rat") || clean.startsWith("lam")) return { id: "LAM", name: "Ratapan" };
  if (clean.startsWith("yeh") || clean.startsWith("ezk")) return { id: "EZK", name: "Yehezkiel" };
  if (clean.startsWith("dan")) return { id: "DAN", name: "Daniel" };
  if (clean.startsWith("hos")) return { id: "HOS", name: "Hosea" };
  if (clean.startsWith("yoe") || clean.startsWith("jol")) return { id: "JOL", name: "Yoel" };
  if (clean.startsWith("amo")) return { id: "AMO", name: "Amos" };
  if (clean.startsWith("oba")) return { id: "OBA", name: "Obaja" };
  if (clean.startsWith("yun") || clean.startsWith("jon")) return { id: "JON", name: "Yunus" };
  if (clean.startsWith("mik") || clean.startsWith("mic")) return { id: "MIC", name: "Mikha" };
  if (clean.startsWith("nah") || clean.startsWith("nam")) return { id: "NAM", name: "Nahum" };
  if (clean.startsWith("hab")) return { id: "HAB", name: "Habakuk" };

  // 3. Check Chinese/English full name and abbreviation matches
  const cleanLower = searchBook.toLowerCase().trim();
  for (const b of Object.values(BIBLE_BOOK_TRANSLATIONS)) {
    const zhClean = b.zh.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
    const enClean = b.en.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idClean = b.idName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const searchClean = cleanLower.replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");

    if (
      searchClean === zhClean ||
      searchClean === enClean ||
      searchClean === idClean ||
      zhClean.startsWith(searchClean) ||
      enClean.startsWith(searchClean) ||
      idClean.startsWith(searchClean)
    ) {
      return { id: b.id, name: b.idName };
    }
  }

  for (const book of BIBLE_BOOKS) {
    if (book.name.toLowerCase().startsWith(clean)) {
      return { id: book.id, name: book.name };
    }
  }
  return null;
}

export function parseMultipleReferences(search: string) {
  const parts = search.split(/[,;]/);
  const parsedRefs: Array<{ book: string; chapter: number; verseSpec: string | null }> = [];
  let lastRef: { book: string; chapter: number; verseSpec: string | null } | null = null;

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    // Check if it starts a new reference (contains letters)
    const hasLetters = /[a-zA-Z]/.test(part);

    if (hasLetters) {
      const clean = part.toLowerCase().replace(/\s+/g, " ");
      const processed = clean
        .replace(/\bayat\b/g, ":")
        .replace(/\bhingga\b|\bhing\b|\bsampai\b|\bs\/d\b/g, "-")
        .replace(/\bdan\b/g, ",")
        .replace(/\s*:\s*/g, ":")
        .replace(/\s*-\s*/g, "-")
        .replace(/\s*,\s*/g, ",")
        .replace(/\s+/g, " ");

      const match = processed.match(/^((?:\d\s*)?[a-z\s]+)\s*(\d+)(?::([\d,\-]+))?$/);
      if (match) {
        lastRef = {
          book: match[1].trim(),
          chapter: Number(match[2]),
          verseSpec: match[3] || null,
        };
        parsedRefs.push(lastRef);
      }
    } else {
      if (lastRef) {
        if (lastRef.verseSpec) {
          lastRef.verseSpec += "," + part;
        } else {
          lastRef.verseSpec = part;
        }
      }
    }
  }

  return parsedRefs;
}

function parseReference(search: string) {
  const clean = search.trim().toLowerCase().replace(/\s+/g, " ");

  const processed = clean
    .replace(/\bayat\b/g, ":")
    .replace(/\bhingga\b|\bhing\b|\bsampai\b|\bs\/d\b/g, "-")
    .replace(/\bdan\b/g, ",")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ");

  const match = processed.match(/^((?:\d\s*)?[a-z\s]+)\s*(\d+)(?::([\d,\-]+))?$/);

  if (!match) {
    return null;
  }

  return {
    book: match[1].trim(),
    chapter: Number(match[2]),
    verseSpec: match[3] || null,
  };
}

async function fetchBibleReference(search: string, translationId: "ind_ayt" | "BSB" | "ind_web" | "web" | "zh_web"): Promise<BibleVerse[]> {
  const refs = parseMultipleReferences(search);
  if (refs.length === 0) {
    return [];
  }

  const combinedResults: BibleVerse[] = [];

  for (const ref of refs) {
    const book = findBook(ref.book);
    if (!book) continue;

    try {
      const res = await fetchWithCache(`/bible/${translationId}/${book.id}/${ref.chapter}.json`);
      if (!res.ok) continue;

      const chapterData = await res.json();
      const verses = chapterData.chapter.content.filter((item: any) => item.type === "verse");
      const translationName = translationId === "ind_ayt"
        ? "AYT"
        : translationId === "ind_web"
          ? "WEB-AI"
          : translationId === "BSB"
            ? "BSB"
            : translationId === "zh_web"
              ? "CUV"
              : "WEB";

      let matchesVerse = (num: number) => true;

      if (ref.verseSpec) {
        const allowedVerses = new Set<number>();
        const parts = ref.verseSpec.split(",");
        for (const part of parts) {
          if (part.includes("-")) {
            const [start, end] = part.split("-").map(Number);
            if (!isNaN(start) && !isNaN(end)) {
              const minV = Math.min(start, end);
              const maxV = Math.max(start, end);
              for (let i = minV; i <= maxV; i++) {
                allowedVerses.add(i);
              }
            }
          } else {
            const val = Number(part);
            if (!isNaN(val)) {
              allowedVerses.add(val);
            }
          }
        }
        matchesVerse = (num: number) => allowedVerses.has(num);
      }

      const matchedVerses = verses
        .filter((verse: any) => matchesVerse(Number(verse.number)))
        .map((verse: any) => {
          const text = extractBibleText(verse.content).replace(/\s+/g, " ").trim();
          const reference = `${book.name} ${ref.chapter}:${verse.number}`;

          return {
            id: `${translationId}-${book.id}-${ref.chapter}-${verse.number}`,
            book: book.name,
            bookShort: book.id,
            chapter: ref.chapter,
            verse: Number(verse.number),
            translation: translationName,
            reference,
            text,
            themes: ["alkitab"],
            normalizedText: normalizeBibleQuery(text),
            keywords: normalizeBibleQuery(`${reference} ${text}`).split(" ").slice(0, 30),
          };
        });

      combinedResults.push(...matchedVerses);
    } catch (error) {
      console.error("Local fetch error for ref:", ref, error);
    }
  }

  return combinedResults;
}

export async function fetchBibleChapterReading(
  bookShort: string,
  chapter: number,
  translationId: "ind_ayt" | "BSB" | "ind_web" | "web" | "zh_web" = "BSB",
): Promise<BibleChapterReading | null> {
  const book = BIBLE_BOOKS.find((item) => item.id === bookShort);

  if (!book) {
    return null;
  }

  try {
    const res = await fetchWithCache(`/bible/${translationId}/${bookShort}/${chapter}.json`);
    if (!res.ok) return null;

    const chapterData = await res.json();
    const verses = (chapterData.chapter?.content ?? [])
      .filter((item: any) => item.type === "verse")
      .map((verse: any) => ({
        number: Number(verse.number),
        text: extractBibleText(verse.content).replace(/\s+/g, " ").trim(),
      }))
      .filter((verse: { number: number; text: string }) => verse.number && verse.text);

    return {
      book: book.name,
      bookShort,
      chapter,
      translation: translationId === "ind_ayt"
        ? "AYT"
        : translationId === "ind_web"
          ? "WEB-AI"
          : translationId === "BSB"
            ? "BSB"
            : translationId === "zh_web"
              ? "CUV"
              : "WEB",
      verses,
    };
  } catch (error) {
    console.error("Local chapter fetch error:", error);
    return null;
  }
}

const searchCache = new Map<string, BibleVerse[]>();

export async function searchBibleVerses(
  search: string,
  translationId: "ind_ayt" | "BSB" | "ind_web" | "web" | "zh_web" = defaultBibleTranslation.id as any,
): Promise<BibleVerse[]> {
  const normalized = normalizeBibleQuery(search);

  if (!normalized) {
    return sampleBibleVerses;
  }

  const cacheKey = `${translationId}-${normalized}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  const results = await _executeBibleSearch(search, normalized, translationId);
  searchCache.set(cacheKey, results);
  return results;
}

async function _executeBibleSearch(search: string, normalized: string, translationId: "ind_ayt" | "BSB" | "ind_web" | "web" | "zh_web"): Promise<BibleVerse[]> {
  const fallback = sampleBibleVerses.filter((verse) =>
    [verse.reference, verse.normalizedText, verse.themes.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );

  const refs = parseMultipleReferences(search);

  // If we could parse at least one valid reference, fetch it statically
  if (refs.length > 0) {
    const localResults = await fetchBibleReference(search, translationId);
    if (localResults.length > 0) return localResults;
  }

  if (!db || storageConfig.bibleVerse === "vercel") {
    const apiResults = await fetchBibleReference(search, translationId);
    return apiResults.length
      ? apiResults
      : fallback.length
        ? fallback
        : sampleBibleVerses;
  }

  const bibleCollection = collection(db, "bible_verses");

  try {
    const words = normalized
      .split(" ")
      .filter((word) => word.length > 2)
      .slice(0, 10);
    const unique = new Map<string, BibleVerse & { score?: number }>();

    for (const word of words.slice(0, 5)) {
      const snapshot = await getDocs(
        query(bibleCollection, where("keywords", "array-contains", word), limit(80)),
      );

      for (const item of snapshot.docs) {
        const verse = item.data() as BibleVerse;
        const haystack = `${verse.normalizedText} ${verse.reference.toLowerCase()} ${(verse.themes ?? []).join(" ")}`;
        const score = words.reduce((total, queryWord) => total + (haystack.includes(queryWord) ? 1 : 0), 0);
        const current = unique.get(item.id);
        unique.set(item.id, { ...verse, score: Math.max(current?.score ?? 0, score) });
      }
    }

    let results = Array.from(unique.values())
      .filter((verse) => (verse.score ?? 0) > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 100);

    // Filter to requested translation if applicable. 
    // If Firestore only has 'ind_ayt', BSB searches will return empty, which is intended since it's unseeded.
    if (results.length > 0 && results[0].translation) {
      results = results.filter((v: any) => v.translation === translationId || v.translationId === translationId);
    }

    return results.length ? results : fallback;
  } catch (error) {
    console.error("Firestore search error:", error);
    return fallback.length ? fallback : sampleBibleVerses;
  }
}
