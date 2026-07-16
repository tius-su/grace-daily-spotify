/**
 * Bible Deep Link Helper
 * Parse bible references into URL-friendly deep link paths.
 *
 * Example:
 *   "Keluaran 3:1-10"  → { book: "keluaran",  chapter: 3, verse: 1 }
 *   "Yohanes 3:16"     → { book: "yohanes",   chapter: 3, verse: 16 }
 *   "1 Samuel 17:1"    → { book: "1-samuel",  chapter: 17, verse: 1 }
 */

/** Maps Indonesian book names (lowercase) to their URL slug */
const BOOK_SLUGS: Record<string, string> = {
  kejadian: "kejadian",
  keluaran: "keluaran",
  imamat: "imamat",
  bilangan: "bilangan",
  ulangan: "ulangan",
  yosua: "yosua",
  "hakim-hakim": "hakim-hakim",
  rut: "rut",
  "1 samuel": "1-samuel",
  "2 samuel": "2-samuel",
  "1 raja-raja": "1-raja-raja",
  "2 raja-raja": "2-raja-raja",
  "1 tawarikh": "1-tawarikh",
  "2 tawarikh": "2-tawarikh",
  ezra: "ezra",
  nehemia: "nehemia",
  ester: "ester",
  ayub: "ayub",
  mazmur: "mazmur",
  amsal: "amsal",
  pengkhotbah: "pengkhotbah",
  "kidung agung": "kidung-agung",
  yesaya: "yesaya",
  yeremia: "yeremia",
  ratapan: "ratapan",
  yehezkiel: "yehezkiel",
  daniel: "daniel",
  hosea: "hosea",
  yoel: "yoel",
  amos: "amos",
  obaja: "obaja",
  yunus: "yunus",
  mikha: "mikha",
  nahum: "nahum",
  habakuk: "habakuk",
  zefanya: "zefanya",
  hagai: "hagai",
  zakharia: "zakharia",
  maleakhi: "maleakhi",
  matius: "matius",
  markus: "markus",
  lukas: "lukas",
  yohanes: "yohanes",
  "kisah para rasul": "kisah-para-rasul",
  kisah: "kisah-para-rasul",
  roma: "roma",
  "1 korintus": "1-korintus",
  "2 korintus": "2-korintus",
  galatia: "galatia",
  efesus: "efesus",
  filipi: "filipi",
  kolose: "kolose",
  "1 tesalonika": "1-tesalonika",
  "2 tesalonika": "2-tesalonika",
  "1 timotius": "1-timotius",
  "2 timotius": "2-timotius",
  titus: "titus",
  filemon: "filemon",
  ibrani: "ibrani",
  yakobus: "yakobus",
  "1 petrus": "1-petrus",
  "2 petrus": "2-petrus",
  "1 yohanes": "1-yohanes",
  "2 yohanes": "2-yohanes",
  "3 yohanes": "3-yohanes",
  yudas: "yudas",
  wahyu: "wahyu",
};

/** Maps URL slugs back to display names */
const SLUG_TO_NAME: Record<string, string> = {
  kejadian: "Kejadian",
  keluaran: "Keluaran",
  imamat: "Imamat",
  bilangan: "Bilangan",
  ulangan: "Ulangan",
  yosua: "Yosua",
  "hakim-hakim": "Hakim-Hakim",
  rut: "Rut",
  "1-samuel": "1 Samuel",
  "2-samuel": "2 Samuel",
  "1-raja-raja": "1 Raja-Raja",
  "2-raja-raja": "2 Raja-Raja",
  "1-tawarikh": "1 Tawarikh",
  "2-tawarikh": "2 Tawarikh",
  ezra: "Ezra",
  nehemia: "Nehemia",
  ester: "Ester",
  ayub: "Ayub",
  mazmur: "Mazmur",
  amsal: "Amsal",
  pengkhotbah: "Pengkhotbah",
  "kidung-agung": "Kidung Agung",
  yesaya: "Yesaya",
  yeremia: "Yeremia",
  ratapan: "Ratapan",
  yehezkiel: "Yehezkiel",
  daniel: "Daniel",
  hosea: "Hosea",
  yoel: "Yoel",
  amos: "Amos",
  obaja: "Obaja",
  yunus: "Yunus",
  mikha: "Mikha",
  nahum: "Nahum",
  habakuk: "Habakuk",
  zefanya: "Zefanya",
  hagai: "Hagai",
  zakharia: "Zakharia",
  maleakhi: "Maleakhi",
  matius: "Matius",
  markus: "Markus",
  lukas: "Lukas",
  yohanes: "Yohanes",
  "kisah-para-rasul": "Kisah Para Rasul",
  roma: "Roma",
  "1-korintus": "1 Korintus",
  "2-korintus": "2 Korintus",
  galatia: "Galatia",
  efesus: "Efesus",
  filipi: "Filipi",
  kolose: "Kolose",
  "1-tesalonika": "1 Tesalonika",
  "2-tesalonika": "2 Tesalonika",
  "1-timotius": "1 Timotius",
  "2-timotius": "2 Timotius",
  titus: "Titus",
  filemon: "Filemon",
  ibrani: "Ibrani",
  yakobus: "Yakobus",
  "1-petrus": "1 Petrus",
  "2-petrus": "2 Petrus",
  "1-yohanes": "1 Yohanes",
  "2-yohanes": "2 Yohanes",
  "3-yohanes": "3 Yohanes",
  yudas: "Yudas",
  wahyu: "Wahyu",
};

export interface BibleDeepLink {
  book: string;    // URL slug, e.g. "keluaran", "1-samuel"
  chapter: number;
  verse: number;
  /** Full search string compatible with BibleExplorer existing search */
  searchString: string;
}

/**
 * Parse a raw bible reference string into a BibleDeepLink object.
 * Returns null if the reference cannot be parsed.
 *
 * Supports:
 *   "Keluaran 3:1-10"   → book=keluaran, chapter=3, verse=1
 *   "Ibrani 11:23-29"   → book=ibrani,   chapter=11, verse=23
 *   "Yohanes 3:16"      → book=yohanes,  chapter=3,  verse=16
 *   "1 Samuel 17"       → book=1-samuel, chapter=17, verse=1
 *   "Kisah Para Rasul 2:1" → book=kisah-para-rasul, chapter=2, verse=1
 */
export function parseBibleReferenceToDeepLink(reference: string): BibleDeepLink | null {
  if (!reference?.trim()) return null;

  const raw = reference.trim();

  // Regex: book name (with optional leading number) + chapter + optional :verse(s)
  const match = raw.match(
    /^(\d?\s*[a-zA-Z\u00C0-\u024F][a-zA-Z\u00C0-\u024F\s\-\.]*?)\s+(\d+)(?::(\d+)(?:[-,]\d+)*)?/i
  );
  if (!match) return null;

  const bookRaw = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : 1;

  if (isNaN(chapter) || chapter < 1) return null;

  // Normalize book name to slug
  const bookLower = bookRaw.toLowerCase().replace(/\s+/g, " ").trim();
  const slug = BOOK_SLUGS[bookLower];
  if (!slug) return null;

  const searchString = `${SLUG_TO_NAME[slug] || bookRaw} ${chapter}:${verse}`;

  return {
    book: slug,
    chapter,
    verse: isNaN(verse) ? 1 : verse,
    searchString,
  };
}

/**
 * Build a deep link href for a bible reference.
 * Example: /alkitab/keluaran/3/1
 */
export function buildBibleDeepLinkHref(ref: string): string | null {
  const parsed = parseBibleReferenceToDeepLink(ref);
  if (!parsed) return null;
  return `/alkitab/${parsed.book}/${parsed.chapter}/${parsed.verse}`;
}

/**
 * Convert a URL book slug back to the Indonesian display name.
 */
export function slugToBookName(slug: string): string | null {
  return SLUG_TO_NAME[slug] ?? null;
}

/**
 * Build a search string from URL params (book slug + chapter + verse).
 * Compatible with BibleExplorer's search input.
 */
export function buildSearchFromParams(
  bookSlug: string,
  chapter: number,
  verse?: number
): string {
  const name = SLUG_TO_NAME[bookSlug];
  if (!name) return "";
  if (verse && verse > 0) {
    return `${name} ${chapter}:${verse}`;
  }
  return `${name} ${chapter}`;
}
