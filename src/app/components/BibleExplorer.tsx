"use client";

import { FormEvent, useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { buildSearchFromParams } from "@/lib/bible-deeplink";
import { useLanguage } from "@/lib/i18n";
import {
  defaultBibleTranslation,
  bsbBibleTranslation,
  sampleBibleVerses,
  searchBibleVerses,
  BIBLE_BOOKS,
  type BibleVerse,
  type BibleChapterReading,
  fetchBibleChapterReading,
  cleanOldBibleCaches,
  USE_WEB_BIBLE,
} from "@/lib/bible";
import { toggleAudio, stopAudio } from "@/lib/audio";

const tabs = ["Cari Ayat", "Baca Pasal", "Rencana Baca", "Ayat Tematik", "Favorit & Catatan"] as const;

const AiDisclaimer = ({ t }: { t: (key: string) => string }) => (
  <div className="mb-6 rounded-lg border border-[#ffd166]/20 bg-[#ffd166]/5 p-4 text-sm text-white/90 leading-relaxed shadow-sm">
    <div className="flex items-start gap-3">
      <span className="text-[#ffd166] text-lg mt-0.5">⚠️</span>
      <div>
        <p className="font-bold text-[#ffd166] mb-1">{t("bible.disclaimer_title")}</p>
        <p className="text-xs text-white/70 whitespace-pre-line">
          {t("bible.disclaimer_text")}
        </p>
      </div>
    </div>
  </div>
);

function getStandardReadingPlanDay(dayNum: number): Array<{ bookShort: string; bookName: string; chapter: number }> {
  const allChapters: Array<{ bookShort: string; bookName: string; chapter: number }> = [];
  BIBLE_BOOKS.forEach(book => {
    for (let c = 1; c <= book.chapters; c++) {
      allChapters.push({ bookShort: book.id, bookName: book.name, chapter: c });
    }
  });

  const totalDays = 365;
  const totalChapters = allChapters.length;
  const baseChaptersPerDay = Math.floor(totalChapters / totalDays);
  const extraChaptersDays = totalChapters % totalDays;

  let startIndex = 0;
  for (let i = 0; i < dayNum - 1; i++) {
    const chaptersToday = baseChaptersPerDay + (i < extraChaptersDays ? 1 : 0);
    startIndex += chaptersToday;
  }
  
  const chaptersToday = baseChaptersPerDay + ((dayNum - 1) < extraChaptersDays ? 1 : 0);
  return allChapters.slice(startIndex, startIndex + chaptersToday);
}

function getCustomReadingPlanDay(bookId: string, durationDays: number, dayNum: number): Array<{ bookShort: string; bookName: string; chapter: number }> | null {
  const book = BIBLE_BOOKS.find(b => b.id === bookId);
  if (!book) return null;

  const totalChapters = book.chapters;
  const baseChaptersPerDay = Math.floor(totalChapters / durationDays);
  const extraChaptersDays = totalChapters % durationDays;

  let startIndex = 0;
  for (let i = 0; i < dayNum - 1; i++) {
    const chaptersToday = baseChaptersPerDay + (i < extraChaptersDays ? 1 : 0);
    startIndex += chaptersToday;
  }

  const chaptersToday = baseChaptersPerDay + ((dayNum - 1) < extraChaptersDays ? 1 : 0);
  
  const result: Array<{ bookShort: string; bookName: string; chapter: number }> = [];
  for (let c = startIndex + 1; c <= startIndex + chaptersToday; c++) {
    if (c <= totalChapters) {
      result.push({ bookShort: book.id, bookName: book.name, chapter: c });
    }
  }
  return result;
}

const NEW_TESTAMENT_BOOKS = [
  "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP",
  "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE",
  "1JN", "2JN", "3JN", "JUD", "REV",
];

const BOOK_CATEGORIES: Record<string, string[]> = {
  "Semua Kategori": [],
  Taurat: ["GEN", "EXO", "LEV", "NUM", "DEU"],
  "Sejarah PL": ["JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST"],
  "Puisi & Hikmat": ["JOB", "PSA", "PRO", "ECC", "SNG"],
  "Nabi-Nabi": ["ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL"],
  Injil: ["MAT", "MRK", "LUK", "JHN"],
  "Sejarah PB": ["ACT"],
  "Surat-Surat": ["ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD"],
  Wahyu: ["REV"],
};

const HIGHLIGHT_COLORS = [
  { name: "Kuning", class: "bg-yellow-100 border-yellow-300 text-yellow-900", dot: "bg-yellow-400", value: "yellow" },
  { name: "Hijau", class: "bg-green-100 border-green-300 text-green-900", dot: "bg-green-400", value: "green" },
  { name: "Biru", class: "bg-blue-100 border-blue-300 text-blue-900", dot: "bg-blue-400", value: "blue" },
  { name: "Merah", class: "bg-red-100 border-red-300 text-red-900", dot: "bg-red-400", value: "red" },
];

export function BibleExplorer() {
  const { language, t } = useLanguage();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Cari Ayat");
  const [search, setSearch] = useState("Yohanes 3:16");
  const [status, setStatus] = useState("Siap mencari ayat.");
  const [isListening, setIsListening] = useState(false);

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(language === "zh" ? "您的浏览器不支持语音识别。" : language === "en" ? "Your browser does not support speech recognition." : "Browser Anda tidak mendukung perekaman suara (Speech Recognition).");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = async (event: any) => {
      let text = event.results[0][0].transcript.trim();
      if (!text) return;

      text = text.toLowerCase()
        .replace(/\bpasal\b/g, "")
        .replace(/\bayat\b/g, ":")
        .replace(/\bsampai\b/g, "-")
        .replace(/\bhingga\b/g, "-")
        .replace(/\bsatu\b/g, "1")
        .replace(/\bdua\b/g, "2")
        .replace(/\btiga\b/g, "3")
        .replace(/\bempat\b/g, "4")
        .replace(/\blima\b/g, "5")
        .replace(/\benam\b/g, "6")
        .replace(/\btujuh\b/g, "7")
        .replace(/\bdelapan\b/g, "8")
        .replace(/\bsembilan\b/g, "9")
        .replace(/\bsepuluh\b/g, "10");

      let detectedBook = "";
      let foundIndex = -1;

      const normalizedText = text.toLowerCase();
      for (const b of BIBLE_BOOKS) {
        const bookLower = b.name.toLowerCase();
        if (normalizedText.includes(bookLower)) {
          detectedBook = b.name;
          foundIndex = normalizedText.indexOf(bookLower);
          break;
        }
      }

      if (detectedBook) {
        const afterBook = text.substring(foundIndex + detectedBook.length).trim();
        const numRegex = /^(\d+)(?:\s*[:\s]\s*(\d+)(?:\s*-\s*(\d+))?)/;
        const match = afterBook.match(numRegex);
        
        let parsedChapter = "1";
        let parsedVerse = "";
        
        if (match) {
          parsedChapter = match[1];
          if (match[2]) {
            parsedVerse = match[2];
            if (match[3]) {
              parsedVerse += `-${match[3]}`;
            }
          }
        }
        
        const finalQuery = `${detectedBook} ${parsedChapter}${parsedVerse ? `:${parsedVerse}` : ""}`;
        setSearch(finalQuery);
        setStatus("Mencari ayat di Alkitab...");
        const verses = await searchBibleVerses(finalQuery, translationId);
        setResults(verses);
        setCurrentPage(1);
        setStatus(verses.length ? `${verses.length} ayat ditemukan.` : "Belum ada hasil.");
      } else {
        setSearch(event.results[0][0].transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Deep link: target verse to highlight
  const [targetVerse, setTargetVerse] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [results, setResults] = useState<BibleVerse[]>(sampleBibleVerses);
  const [translationId, setTranslationId] = useState<"ind_ayt" | "BSB" | "ind_web" | "web" | "zh_web">(defaultBibleTranslation.id as any);

  useEffect(() => {
    if (language === "zh") {
      setTranslationId("zh_web");
    } else if (language === "en") {
      setTranslationId(USE_WEB_BIBLE ? "web" : "BSB");
    } else {
      setTranslationId(USE_WEB_BIBLE ? "ind_web" : "ind_ayt");
    }
  }, [language]);

  const [testament, setTestament] = useState<"Semua" | "PL" | "PB">("Semua");
  const [category, setCategory] = useState<string>("Semua Kategori");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // LocalStorage states for Offline Mode features
  const [bookmarks, setBookmarks] = useState<BibleVerse[]>([]);
  const [highlights, setHighlights] = useState<Record<string, string>>({}); // { verseId: colorValue }
  const [notes, setNotes] = useState<Record<string, string>>({}); // { verseId: noteText }
  
  // Interactive verse context menu state
  const [selectedVerse, setSelectedVerse] = useState<BibleVerse | null>(null);
  const [activeNoteText, setActiveNoteText] = useState("");
  const [playingVerseId, setPlayingVerseId] = useState<string | null>(null);
  
  // AI Explanations & Commentary states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContent, setAiContent] = useState("");
  const [aiType, setAiType] = useState<"explanation" | "commentary" | null>(null);

  // Tab Favorit & Catatan filter sub-tab
  const [favSubTab, setFavSubTab] = useState<"favorit" | "catatan">("favorit");

  // State untuk Panduan Alkitab
  const [showGuide, setShowGuide] = useState(false);

  // Rencana Baca States
  const [planMode, setPlanMode] = useState<"standard" | "custom">("standard");
  const [standardDay, setStandardDay] = useState(1);
  
  const [customBook, setCustomBook] = useState("MAT");
  const [customDuration, setCustomDuration] = useState(7);
  const [customDay, setCustomDay] = useState(1);
  const [customActive, setCustomActive] = useState(false);

  const [chapterReadings, setChapterReadings] = useState<BibleChapterReading[]>([]);
  const [loadingReadings, setLoadingReadings] = useState(false);
  const [dailyNote, setDailyNote] = useState("");
  const [planNotes, setPlanNotes] = useState<Record<string, string>>({});

  const noteKey = useMemo(() => {
    if (planMode === "standard") {
      return `standard-day-${standardDay}`;
    } else {
      return `custom-${customBook}-${customDuration}-day-${customDay}`;
    }
  }, [planMode, standardDay, customBook, customDuration, customDay]);

  useEffect(() => {
    setDailyNote(planNotes[noteKey] || "");
  }, [noteKey, planNotes]);

  // Load and cache chapter readings for Rencana Baca
  useEffect(() => {
    if (activeTab !== "Rencana Baca") return;
    
    let targets: Array<{ bookShort: string; bookName: string; chapter: number }> = [];
    if (planMode === "standard") {
      targets = getStandardReadingPlanDay(standardDay);
    } else {
      if (customActive) {
        const list = getCustomReadingPlanDay(customBook, customDuration, customDay);
        if (list) targets = list;
      }
    }
    
    if (targets.length === 0) {
      setChapterReadings([]);
      return;
    }
    
    let active = true;
    setLoadingReadings(true);
    
    Promise.all(
      targets.map(t => fetchBibleChapterReading(t.bookShort, t.chapter, translationId))
    ).then(results => {
      if (!active) return;
      setChapterReadings(results.filter((r): r is BibleChapterReading => r !== null));
      setLoadingReadings(false);
    }).catch(err => {
      console.error(err);
      if (active) setLoadingReadings(false);
    });
    
    return () => {
      active = false;
    };
  }, [activeTab, planMode, standardDay, customBook, customDuration, customDay, customActive, translationId]);
  
  // Load offline data on mount
  useEffect(() => {
    try {
      const storedBookmarks = localStorage.getItem("bible_bookmarks");
      if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks));

      const storedHighlights = localStorage.getItem("bible_highlights");
      if (storedHighlights) setHighlights(JSON.parse(storedHighlights));

      const storedNotes = localStorage.getItem("bible_notes");
      if (storedNotes) setNotes(JSON.parse(storedNotes));

      const storedActiveType = localStorage.getItem("bible_plan_active_type");
      if (storedActiveType) setPlanMode(storedActiveType as "standard" | "custom");

      const storedStandardDay = localStorage.getItem("bible_plan_standard_day");
      if (storedStandardDay) setStandardDay(Number(storedStandardDay));

      const storedCustomBook = localStorage.getItem("bible_plan_custom_book");
      if (storedCustomBook) setCustomBook(storedCustomBook);

      const storedCustomDuration = localStorage.getItem("bible_plan_custom_duration");
      if (storedCustomDuration) setCustomDuration(Number(storedCustomDuration));

      const storedCustomDay = localStorage.getItem("bible_plan_custom_day");
      if (storedCustomDay) setCustomDay(Number(storedCustomDay));

      const storedCustomActive = localStorage.getItem("bible_plan_custom_active");
      if (storedCustomActive) setCustomActive(storedCustomActive === "true");

      const storedPlanNotes = localStorage.getItem("bible_plan_notes_content");
      if (storedPlanNotes) setPlanNotes(JSON.parse(storedPlanNotes));

      // Clean old cache versions automatically on client side
      cleanOldBibleCaches();
    } catch (e) {
      console.error("Gagal memuat data offline dari LocalStorage", e);
    }
  }, []);

  // Deep link: on mount read URL params and load the referenced chapter
  useEffect(() => {
    const bookSlug = searchParams.get("book");
    const chapterParam = searchParams.get("chapter");
    const verseParam = searchParams.get("verse");

    if (!bookSlug || !chapterParam) return;

    const chapter = parseInt(chapterParam, 10);
    const verse = verseParam ? parseInt(verseParam, 10) : null;

    if (isNaN(chapter)) return;

    const searchStr = buildSearchFromParams(bookSlug, chapter, verse ?? undefined);
    if (!searchStr) return;

    // Switch to "Cari Ayat" tab and load the chapter
    setActiveTab("Cari Ayat");
    setSearch(searchStr);

    // After a tick, run the search so state is settled
    const t = setTimeout(async () => {
      try {
        const { searchBibleVerses } = await import("@/lib/bible");
        const verses = await searchBibleVerses(searchStr, translationId);
        setResults(verses);
        setCurrentPage(1);
        setStatus(verses.length ? `${verses.length} ayat ditemukan.` : "Belum ada hasil.");

        if (verse && verse > 0) {
          setTargetVerse(verse);
          // Allow DOM to render, then scroll
          setTimeout(() => {
            const el = document.getElementById(`verse-${verse}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            // Remove highlight after 4 seconds
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            highlightTimerRef.current = setTimeout(() => setTargetVerse(null), 4000);
          }, 600);
        }
      } catch (err) {
        console.warn("[deep-link] Failed to load chapter:", err);
      }
    }, 100);

    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Save changes helper functions
  const saveBookmarks = (newBookmarks: BibleVerse[]) => {
    setBookmarks(newBookmarks);
    localStorage.setItem("bible_bookmarks", JSON.stringify(newBookmarks));
  };

  const saveHighlights = (newHighlights: Record<string, string>) => {
    setHighlights(newHighlights);
    localStorage.setItem("bible_highlights", JSON.stringify(newHighlights));
  };

  const saveNotes = (newNotes: Record<string, string>) => {
    setNotes(newNotes);
    localStorage.setItem("bible_notes", JSON.stringify(newNotes));
  };

  const helperText = useMemo(() => {
    if (translationId === "BSB" || translationId === "web") {
      if (activeTab === "Baca Pasal") return language === "zh" ? "输入示例：诗篇 23，约翰福音 3，罗马书 8。" : "Enter example: Psalm 23, John 3, Romans 8.";
      if (activeTab === "Ayat Tematik") return language === "zh" ? "搜索主题，如：爱、祷告、平安、信心。" : "Search themes like love, prayer, peace, faith.";
      return language === "zh" ? "搜索经文或关键词：约翰福音 3:16，爱，平安。" : "Search references or keywords: John 3:16, love, peace.";
    }

    if (language === "zh") {
      if (activeTab === "Baca Pasal") return "输入示例：诗篇 23，约翰福音 3，罗马书 8。";
      if (activeTab === "Ayat Tematik") return "搜索主题，如：爱、祷告、平安、信心。";
      return "搜索经文或关键词：约翰福音 3:16，爱，平安。";
    }

    if (activeTab === "Baca Pasal") {
      return "Masukkan contoh: Mazmur 23, Yohanes 3, Roma 8.";
    }

    if (activeTab === "Ayat Tematik") {
      return "Cari tema seperti kasih, doa, damai, iman, pengampunan.";
    }

    return "Cari referensi atau kata kunci: Yohanes 3:16, kasih, khawatir.";
  }, [activeTab, translationId, language]);

  const parsedSearch = useMemo(() => {
    const defaultVal = { book: "Kejadian", chapter: 1, verse: null };
    if (!search) return defaultVal;

    const clean = search.trim().toLowerCase().replace(/\s+/g, " ");

    const processed = clean
      .replace(/\bayat\b/g, ":")
      .replace(/\bhingga\b|\bhing\b|\bsampai\b|\bs\/d\b/g, "-")
      .replace(/\bdan\b/g, ",")
      .replace(/\s*:\s*/g, ":")
      .replace(/\s*-\s*/g, "-")
      .replace(/\s*,\s*/g, ",")
      .replace(/\s+/g, " ");

    const match = processed.match(/^(.+?)\s+(\d+)(?::([\d,\-]+))?$/);
    if (!match) {
      for (const b of BIBLE_BOOKS) {
        if (clean === b.name.toLowerCase()) {
          return { book: b.name, chapter: 1, verse: null };
        }
      }
      const matchBookChap = clean.match(/^(.+?)\s+(\d+)$/);
      if (matchBookChap) {
        const bName = matchBookChap[1].trim();
        for (const b of BIBLE_BOOKS) {
          if (bName === b.name.toLowerCase() || bName.startsWith(b.name.toLowerCase().slice(0, 3))) {
            return { book: b.name, chapter: Number(matchBookChap[2]), verse: null };
          }
        }
      }
      return defaultVal;
    }

    const bName = match[1].trim();
    let resolvedBookName = "Kejadian";
    for (const b of BIBLE_BOOKS) {
      const lowerB = b.name.toLowerCase();
      if (bName === lowerB || lowerB.startsWith(bName) || bName.startsWith(lowerB.slice(0, 3))) {
        resolvedBookName = b.name;
        break;
      }
    }

    return {
      book: resolvedBookName,
      chapter: Number(match[2]),
      verse: match[3] || null,
    };
  }, [search]);

  const currentBookObj = useMemo(() => {
    return BIBLE_BOOKS.find((b) => b.name === parsedSearch.book) || BIBLE_BOOKS[0];
  }, [parsedSearch.book]);

  const chapterVersesCount = useMemo(() => {
    if (
      results.length > 0 &&
      results[0].book.toLowerCase() === parsedSearch.book.toLowerCase() &&
      results[0].chapter === parsedSearch.chapter
    ) {
      return results.length;
    }
    return 50; // fallback if not loaded yet
  }, [results, parsedSearch.book, parsedSearch.chapter]);

  const handleDropdownSelect = (newSearchVal: string) => {
    setSearch(newSearchVal);
    setStatus("Mencari ayat di Alkitab...");
    searchBibleVerses(newSearchVal, translationId).then((verses) => {
      setResults(verses);
      setCurrentPage(1);
      setStatus(
        verses.length
          ? `${verses.length} ayat ditemukan.`
          : "Belum ada hasil. Coba kata kunci lain.",
      );
    });
  };

  const filteredResults = useMemo(() => {
    return results.filter((verse) => {
      let matchTestament = true;
      if (testament !== "Semua") {
        const isPB = NEW_TESTAMENT_BOOKS.includes(verse.bookShort);
        matchTestament = testament === "PB" ? isPB : !isPB;
      }

      let matchCategory = true;
      if (category !== "Semua Kategori") {
        matchCategory = BOOK_CATEGORIES[category].includes(verse.bookShort);
      }

      return matchTestament && matchCategory;
    });
  }, [results, testament, category]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredResults.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredResults, currentPage]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch();
  }

  async function runSearch() {
    setStatus("Mencari ayat di Alkitab...");
    const verses = await searchBibleVerses(search, translationId);
    setResults(verses);
    setCurrentPage(1);
    setStatus(
      verses.length
        ? `${verses.length} ayat ditemukan.`
        : "Belum ada hasil. Coba kata kunci lain.",
    );
  }

  // Voice player using browser Web Speech API / toggleAudio
  function handlePlayVoice(verse: BibleVerse) {
    const isPlaying = playingVerseId === verse.id;
    const lang = verse.translation === "BSB" ? "en-US" : "id-ID";
    toggleAudio(verse.text, isPlaying, (status) => {
      setPlayingVerseId(status ? verse.id : null);
    }, lang);
  }

  // Share native share & copy-paste clipboard
  async function handleShareVerse(verse: BibleVerse, platform: "whatsapp" | "facebook" | "instagram" | "generic") {
    const textToShare = `"${verse.text}"\n\n— ${verse.reference} (${verse.translation} - Grace Daily)`;
    
    if (platform === "whatsapp") {
      const url = `https://wa.me/?text=${encodeURIComponent(textToShare)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (platform === "facebook") {
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}&quote=${encodeURIComponent(textToShare)}`;
      window.open(fbUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // Generic / Instagram fallback using copy clipboard & Native Web Share
    if (navigator.share && platform === "generic") {
      try {
        await navigator.share({
          title: `Grace Daily: ${verse.reference}`,
          text: textToShare,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(textToShare);
      alert(language === "zh" ? "经文文本已复制到剪贴板！可以直接粘贴到社交媒体中。" : language === "en" ? "Verse text copied to clipboard! You can paste it directly into social media." : "Teks ayat telah disalin ke clipboard! Silakan paste (tempel) langsung di Instagram Stories, Facebook, atau media sosial lainnya.");
    } catch (err) {
      alert(language === "zh" ? "自动复制经文失败。请手动复制。" : language === "en" ? "Failed to automatically copy the verse. Please copy it manually." : "Gagal menyalin ayat secara otomatis. Silakan salin manual.");
    }
  }

  // Highlights & Bookmarks interactive operations
  const toggleBookmark = (verse: BibleVerse) => {
    const isBookmarked = bookmarks.some(b => b.id === verse.id);
    if (isBookmarked) {
      saveBookmarks(bookmarks.filter(b => b.id !== verse.id));
    } else {
      saveBookmarks([...bookmarks, verse]);
    }
  };

  const applyHighlight = (verseId: string, color: string | null) => {
    const newHighlights = { ...highlights };
    if (color === null) {
      delete newHighlights[verseId];
    } else {
      newHighlights[verseId] = color;
    }
    saveHighlights(newHighlights);
  };

  const handleSaveVerseNote = (verseId: string) => {
    const newNotes = { ...notes };
    if (activeNoteText.trim() === "") {
      delete newNotes[verseId];
    } else {
      newNotes[verseId] = activeNoteText;
    }
    saveNotes(newNotes);
    alert(language === "zh" ? "反思笔记已成功保存在本地。" : language === "en" ? "Reflection note successfully saved locally." : "Catatan refleksi ayat berhasil disimpan secara lokal.");
  };

  // AI explanations & Commentary trigger
  async function handleFetchAiSupport(verse: BibleVerse, type: "explanation" | "commentary") {
    setAiLoading(true);
    setAiContent("");
    setAiType(type);
    
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: type === "explanation" ? "bible-explanation" : "bible-commentary",
          prompt: `Ayat: ${verse.reference}\nTeks: "${verse.text}"\nTerjemahan: ${verse.translation}`,
        }),
      });
      const data = await response.json();
      if (response.ok && data.answer) {
        setAiContent(data.answer);
      } else {
        setAiContent("server sibuk");
      }
    } catch (e) {
      setAiContent("server sibuk");
    } finally {
      setAiLoading(false);
    }
  }

  const handleSavePlanNote = () => {
    const updated = { ...planNotes, [noteKey]: dailyNote };
    setPlanNotes(updated);
    localStorage.setItem("bible_plan_notes_content", JSON.stringify(updated));
  };

  const handleCompleteDay = () => {
    handleSavePlanNote();

    if (planMode === "standard") {
      const nextDay = Math.min(365, standardDay + 1);
      setStandardDay(nextDay);
      localStorage.setItem("bible_plan_standard_day", String(nextDay));
      if (nextDay === 365) {
        alert(language === "zh" ? "太棒了！您正在进行365天读经计划的最后一天！" : language === "en" ? "Amazing! You are on the last day of the 365-Day Reading Plan!" : "Luar biasa! Anda berada di hari terakhir Rencana Baca 365 Hari!");
      } else {
        alert(language === "zh" ? `恭喜！您已完成第 ${standardDay} 天的阅读。继续进入第 ${nextDay} 天。` : language === "en" ? `Congratulations! You finished Day ${standardDay} reading. Continuing to Day ${nextDay}.` : `Selamat! Anda telah menyelesaikan bacaan Hari ${standardDay}. Berlanjut ke Hari ${nextDay}.`);
      }
    } else {
      if (customDay >= customDuration) {
        alert(language === "zh" ? `恭喜！您已完成 ${BIBLE_BOOKS.find(b => b.id === customBook)?.name} 自定义读经计划！` : language === "en" ? `Congratulations! You finished the custom reading plan of the Book of ${BIBLE_BOOKS.find(b => b.id === customBook)?.name}!` : `Selamat! Anda telah menyelesaikan Rencana Baca Kustom Kitab ${BIBLE_BOOKS.find(b => b.id === customBook)?.name}!`);
        setCustomActive(false);
        setCustomDay(1);
        localStorage.setItem("bible_plan_custom_active", "false");
        localStorage.setItem("bible_plan_custom_day", "1");
      } else {
        const nextDay = customDay + 1;
        setCustomDay(nextDay);
        localStorage.setItem("bible_plan_custom_day", String(nextDay));
        alert(language === "zh" ? `恭喜！您已完成第 ${customDay} 天的阅读。继续进入第 ${nextDay} 天。` : language === "en" ? `Congratulations! You finished Day ${customDay} reading. Continuing to Day ${nextDay}.` : `Selamat! Anda telah menyelesaikan bacaan Hari ${customDay}. Berlanjut ke Hari ${nextDay}.`);
      }
    }
    const element = document.getElementById("rencana-baca-viewer");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Open verse menu modal
  const openVerseMenu = (verse: BibleVerse) => {
    setSelectedVerse(verse);
    setActiveNoteText(notes[verse.id] || "");
    setAiContent("");
    setAiType(null);
    setAiLoading(false);
  };

  return (
    <section id="alkitab" className="bg-[#102c3a] px-5 py-16 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ffd166]">
              {translationId === "zh_web"
                ? (language === "zh" ? "中文圣经" : language === "en" ? "Chinese Bible" : "Alkitab bahasa Mandarin")
                : (translationId === "BSB" || translationId === "web")
                  ? (language === "zh" ? "英文圣经" : language === "en" ? "English Bible" : "Alkitab bahasa Inggris")
                  : (language === "zh" ? "印尼语圣经" : language === "en" ? "Indonesian Bible" : "Alkitab bahasa Indonesia")
              }
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl flex items-center flex-wrap gap-2">
              <span>
                {t("bible.subtitle")}
              </span>
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-[#ffd166] transition cursor-pointer"
                title={language === "zh" ? "完整功能指南" : language === "en" ? "Complete Features Guide" : "Panduan Lengkap Fitur Alkitab"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </button>
            </h2>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/82 flex items-center gap-3">
            <span>{t("bible.translation")}:</span>
            <select
              value={translationId}
              onChange={(e) => {
                const newId = e.target.value as "ind_ayt" | "BSB" | "ind_web" | "web" | "zh_web";
                setTranslationId(newId);
                if ((newId === "BSB" || newId === "web") && search === "Yohanes 3:16") setSearch("John 3:16");
                if ((newId === "ind_ayt" || newId === "ind_web") && search === "John 3:16") setSearch("Yohanes 3:16");
              }}
              className="bg-transparent text-[#ffd166] outline-none border-b border-[#ffd166]/50 pb-0.5 cursor-pointer"
            >
              {USE_WEB_BIBLE ? (
                <>
                  <option value="ind_web" className="bg-[#102c3a] text-white">Indonesia (WEB-AI)</option>
                  <option value="web" className="bg-[#102c3a] text-white">English (WEB)</option>
                  <option value="zh_web" className="bg-[#102c3a] text-white">Chinese (CUV)</option>
                </>
              ) : (
                <>
                  <option value="ind_ayt" className="bg-[#102c3a] text-white">Indonesia (AYT)</option>
                  <option value="BSB" className="bg-[#102c3a] text-white">English (BSB)</option>
                  <option value="zh_web" className="bg-[#102c3a] text-white">Chinese (CUV)</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Tab Menu Bar */}
        <div className="mt-8 overflow-x-auto">
          <div className="flex min-w-max gap-2">
            {tabs.map((tab) => {
              let tabLabel = tab as string;
              if (tab === "Cari Ayat") tabLabel = t("bible.search") === "Search" ? "Search" : (language === "zh" ? "搜索" : "Cari Ayat");
              else if (tab === "Baca Pasal") tabLabel = t("bible.read_chapter") === "Read Chapter" ? "Read Chapter" : (language === "zh" ? "阅读章节" : "Baca Pasal");
              else if (tab === "Rencana Baca") tabLabel = t("nav.reading_plan") === "Reading Plan" ? "Reading Plan" : (language === "zh" ? "读经计划" : "Rencana Baca");
              else if (tab === "Ayat Tematik") tabLabel = t("bible.themes") === "Thematic Verses" ? "Themes" : (language === "zh" ? "主题金句" : "Ayat Tematik");
              else if (tab === "Favorit & Catatan") tabLabel = t("bible.favorites") === "Favorites & Notes" ? "Favorites & Notes" : (language === "zh" ? "收藏与笔记" : "Favorit & Catatan");

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab
                      ? "bg-[#ffd166] text-[#102c3a]"
                      : "border border-white/20 bg-white/8 text-white"
                  }`}
                >
                  {tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "Rencana Baca" ? (
          <div id="rencana-baca-viewer" className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6 animate-in fade-in">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-4 md:flex-row md:items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Rencana Baca Alkitab</h3>
                <p className="text-xs text-white/70 mt-1">Tingkatkan kedisiplinan membaca Firman Tuhan setiap hari secara konsisten.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlanMode("standard");
                    localStorage.setItem("bible_plan_active_type", "standard");
                  }}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    planMode === "standard" ? "bg-[#ffd166] text-[#102c3a]" : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  Tantangan 365 Hari
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlanMode("custom");
                    localStorage.setItem("bible_plan_active_type", "custom");
                  }}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    planMode === "custom" ? "bg-[#ffd166] text-[#102c3a]" : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  Rencana Kustom (Offline)
                </button>
              </div>
            </div>

            {planMode === "standard" ? (
              <div className="mt-6 space-y-6">
                {/* Progress bar */}
                <div className="rounded-lg bg-white/5 p-5 border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-[#ffd166]">Tantangan Baca Alkitab Setahun</span>
                    <span className="text-sm font-bold text-white">{Math.round(((standardDay - 1) / 365) * 100)}% Selesai</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3 mb-3">
                    <div className="bg-[#f4a261] h-3 rounded-full transition-all duration-300" style={{ width: `${Math.round(((standardDay - 1) / 365) * 100)}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-white/60">
                    <span>Hari ke-{standardDay} dari 365 Hari</span>
                    <button
                      onClick={() => {
                        if (confirm(language === "zh" ? "您确定要将365天挑战进度重置为第一天吗？" : language === "en" ? "Are you sure you want to reset your 365-Day challenge progress back to Day 1?" : "Apakah Anda ingin mereset progres 365 Hari Anda kembali ke Hari 1?")) {
                          setStandardDay(1);
                          localStorage.setItem("bible_plan_standard_day", "1");
                        }
                      }}
                      className="text-[#ffd166] hover:underline cursor-pointer bg-transparent border-none outline-none"
                    >
                      Reset Progres
                    </button>
                  </div>
                </div>

                {/* Chapters list to read */}
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#ffd166] mb-4">
                    Target Bacaan Hari ini: {getStandardReadingPlanDay(standardDay).map(t => `${t.bookName} ${t.chapter}`).join(", ")}
                  </h4>

                  {loadingReadings ? (
                    <div className="flex items-center gap-3 text-white/70 py-10 justify-center">
                      <svg className="animate-spin h-6 w-6 text-[#ffd166]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>Memuat ayat-ayat bacaan...</span>
                    </div>
                  ) : chapterReadings.length === 0 ? (
                    <p className="text-white/60 italic text-center py-6">Pasal tidak dapat ditemukan. Coba ganti terjemahan atau periksa koneksi Anda.</p>
                  ) : (
                    <div className="space-y-6">
                      {translationId === "ind_web" && <AiDisclaimer t={t} />}
                      {chapterReadings.map((reading) => (
                        <div key={`${reading.bookShort}-${reading.chapter}`} className="rounded-lg bg-black/25 p-5 border border-white/5">
                          <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                            <h5 className="font-bold text-lg text-white">{reading.book} Pasal {reading.chapter}</h5>
                            <button
                              onClick={() => {
                                const chapterText = reading.verses.map(v => v.text).join(" ");
                                const isPlaying = playingVerseId === `${reading.bookShort}-${reading.chapter}-all`;
                                toggleAudio(chapterText, isPlaying, (status) => {
                                  setPlayingVerseId(status ? `${reading.bookShort}-${reading.chapter}-all` : null);
                                }, translationId === "BSB" ? "en-US" : "id-ID");
                              }}
                              className="inline-flex items-center gap-1.5 rounded bg-[#2a6f6f] px-3 py-1 text-xs font-semibold hover:bg-[#1f5252] text-white cursor-pointer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                              </svg>
                              {playingVerseId === `${reading.bookShort}-${reading.chapter}-all` ? "Stop" : "Dengarkan"}
                            </button>
                          </div>
                          <div className="space-y-3">
                            {reading.verses.map((verse) => {
                              const verseId = `${translationId}-${reading.bookShort}-${reading.chapter}-${verse.number}`;
                              const hColorValue = highlights[verseId];
                              const highlightStyle = hColorValue
                                ? HIGHLIGHT_COLORS.find(c => c.value === hColorValue)?.class
                                : "text-white/90 hover:bg-white/5";
                              
                              const mappedVerse: BibleVerse = {
                                id: verseId,
                                book: reading.book,
                                bookShort: reading.bookShort,
                                chapter: reading.chapter,
                                verse: verse.number,
                                translation: reading.translation,
                                reference: `${reading.book} ${reading.chapter}:${verse.number}`,
                                text: verse.text,
                                themes: ["rencana-baca"],
                                normalizedText: "",
                                keywords: [],
                              };

                              return (
                                <p
                                  key={verse.number}
                                  onClick={() => openVerseMenu(mappedVerse)}
                                  className={`rounded px-2 py-1 leading-relaxed text-base cursor-pointer transition ${highlightStyle}`}
                                >
                                  <sup className="text-[10px] font-bold text-[#ffd166] mr-1.5">{verse.number}</sup>
                                  {verse.text}
                                </p>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reflection Notes */}
                <div className="rounded-lg bg-black/20 p-5 border border-white/10 space-y-3">
                  <label className="text-sm font-semibold text-[#ffd166] block" htmlFor="ref-notes-365">
                    {language === "zh" ? "今日反思与承诺" : language === "en" ? "Reflection Notes & Today's Commitment" : "Catatan Refleksi & Komitmen Hari Ini"}
                  </label>
                  <textarea
                    id="ref-notes-365"
                    value={dailyNote}
                    onChange={(e) => setDailyNote(e.target.value)}
                    placeholder={language === "zh" ? "写下今天上帝通过阅读圣经对您说的话..." : language === "en" ? "Write down what God spoke to you through today's Bible reading..." : "Tuliskan apa yang Tuhan bicarakan lewat pembacaan Alkitab hari ini..."}
                    className="w-full min-h-[100px] rounded border border-white/20 bg-[#102c3a] p-3 text-sm text-white outline-none focus:border-[#ffd166]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSavePlanNote}
                      className="rounded border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 cursor-pointer"
                    >
                      {language === "zh" ? "仅保存笔记" : language === "en" ? "Save Notes Only" : "Simpan Catatan Saja"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteDay}
                      className="rounded bg-[#ffd166] px-5 py-2 text-xs font-bold text-[#102c3a] hover:bg-[#ffe094] transition cursor-pointer"
                    >
                      {language === "zh" ? "完成阅读并进入下一天" : language === "en" ? "Done & Next Day" : "Selesai Baca & Lanjut Hari Berikutnya"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Custom Plan view */
              <div className="mt-6 space-y-6">
                {!customActive ? (
                  <div className="rounded-lg bg-white/5 p-6 border border-white/10 max-w-lg mx-auto space-y-4">
                    <h4 className="font-bold text-white text-base text-center">{language === "zh" ? "创建您的自定义读经计划" : language === "en" ? "Create Your Custom Reading Plan" : "Buat Rencana Baca Kustom Anda"}</h4>
                    <p className="text-xs text-white/70 text-center">{language === "zh" ? "在您选择的时间内集中阅读特定经卷。" : language === "en" ? "Intensive reading of a specific book within your chosen timeframe." : "Membaca kitab tertentu secara intensif dalam jangka waktu pilihan Anda."}</p>
                    
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-xs text-white/80 block mb-1">{language === "zh" ? "选择书卷：" : language === "en" ? "Select Book:" : "Pilih Kitab:"}</label>
                        <select
                          value={customBook}
                          onChange={(e) => setCustomBook(e.target.value)}
                          className="w-full rounded border border-white/20 bg-[#102c3a] px-3 py-2 text-sm text-white outline-none"
                        >
                          {BIBLE_BOOKS.map((b) => (
                            <option key={b.id} value={b.id}>{b.name} ({b.chapters} {language === "zh" ? "章" : language === "en" ? "Chapters" : "Pasal"})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-white/80 block mb-1">{language === "zh" ? "阅读天数：" : language === "en" ? "Reading Duration:" : "Durasi Membaca:"}</label>
                        <select
                          value={customDuration}
                          onChange={(e) => setCustomDuration(Number(e.target.value))}
                          className="w-full rounded border border-white/20 bg-[#102c3a] px-3 py-2 text-sm text-white outline-none"
                        >
                          <option value={7}>{language === "zh" ? "7 天" : language === "en" ? "7 Days" : "7 Hari"}</option>
                          <option value={10}>{language === "zh" ? "10 天" : language === "en" ? "10 Days" : "10 Hari"}</option>
                          <option value={14}>{language === "zh" ? "14 天" : language === "en" ? "14 Days" : "14 Hari"}</option>
                          <option value={21}>{language === "zh" ? "21 天" : language === "en" ? "21 Days" : "21 Hari"}</option>
                          <option value={30}>{language === "zh" ? "30 天" : language === "en" ? "30 Days" : "30 Hari"}</option>
                        </select>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setCustomActive(true);
                          setCustomDay(1);
                          localStorage.setItem("bible_plan_custom_active", "true");
                          localStorage.setItem("bible_plan_custom_book", customBook);
                          localStorage.setItem("bible_plan_custom_duration", String(customDuration));
                          localStorage.setItem("bible_plan_custom_day", "1");
                          alert(language === "zh" ? `新自定义计划已启动！您将阅读 ${BIBLE_BOOKS.find(b => b.id === customBook)?.name}，共 ${customDuration} 天。` : language === "en" ? `New custom plan has started! You will read the Book of ${BIBLE_BOOKS.find(b => b.id === customBook)?.name} for ${customDuration} Days.` : `Rencana Kustom baru telah dimulai! Anda akan membaca Kitab ${BIBLE_BOOKS.find(b => b.id === customBook)?.name} selama ${customDuration} Hari.`);
                        }}
                        className="w-full rounded bg-[#f4a261] py-2 text-sm font-bold text-[#102c3a] hover:bg-[#ffd166] transition cursor-pointer text-center"
                      >
                        {language === "zh" ? "开始自定义计划" : language === "en" ? "Start Custom Plan" : "Mulai Rencana Kustom"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Active Custom Plan progress */}
                    <div className="rounded-lg bg-white/5 p-5 border border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="text-sm font-semibold text-[#ffd166] block">{language === "zh" ? "书卷" : language === "en" ? "Book" : "Kitab"} {BIBLE_BOOKS.find(b => b.id === customBook)?.name || customBook}</span>
                          <span className="text-[10px] text-white/60">{language === "zh" ? `目标：${customDuration} 天` : language === "en" ? `Target: ${customDuration} Days` : `Target: ${customDuration} Hari`}</span>
                        </div>
                        <span className="text-sm font-bold text-white">{Math.round(((customDay - 1) / customDuration) * 100)}% {language === "zh" ? "完成" : language === "en" ? "Done" : "Selesai"}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-3 mb-3">
                        <div className="bg-[#f4a261] h-3 rounded-full transition-all duration-300" style={{ width: `${Math.round(((customDay - 1) / customDuration) * 100)}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-white/60">
                        <span>{language === "zh" ? `第 ${customDay} 天，共 ${customDuration} 天` : language === "en" ? `Day ${customDay} of ${customDuration} Days` : `Hari ke-${customDay} dari ${customDuration} Hari`}</span>
                        <button
                          onClick={() => {
                            if (confirm(language === "zh" ? "您确定要取消/停止此自定义计划吗？当前进度将丢失。" : language === "en" ? "Are you sure you want to cancel/stop this custom plan? Current progress will be lost." : "Apakah Anda ingin membatalkan/menghentikan Rencana Kustom ini? Progres rencana kustom saat ini akan hilang.")) {
                              setCustomActive(false);
                              setCustomDay(1);
                              localStorage.setItem("bible_plan_custom_active", "false");
                              localStorage.setItem("bible_plan_custom_day", "1");
                            }
                          }}
                          className="text-red-400 hover:text-red-300 cursor-pointer bg-transparent border-none outline-none"
                        >
                          {language === "zh" ? "停止计划" : language === "en" ? "Stop Plan" : "Hentikan Rencana"}
                        </button>
                      </div>
                    </div>

                    {/* Target Custom Chapters */}
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[#ffd166] mb-4">
                        {language === "zh" ? "今日读经：" : language === "en" ? "Today's Reading:" : "Target Bacaan Hari ini:"} {getCustomReadingPlanDay(customBook, customDuration, customDay)?.map(t => `${t.bookName} ${t.chapter}`).join(", ")}
                      </h4>

                      {loadingReadings ? (
                        <div className="flex items-center gap-3 text-white/70 py-10 justify-center">
                          <svg className="animate-spin h-6 w-6 text-[#ffd166]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span>{language === "zh" ? "正在加载经文..." : language === "en" ? "Loading verses..." : "Memuat ayat-ayat bacaan..."}</span>
                        </div>
                      ) : chapterReadings.length === 0 ? (
                        <p className="text-white/60 italic text-center py-6">{language === "zh" ? "未找到章节。" : language === "en" ? "Chapter not found." : "Pasal tidak dapat ditemukan."}</p>
                      ) : (
                        <div className="space-y-6">
                          {translationId === "ind_web" && <AiDisclaimer t={t} />}
                          {chapterReadings.map((reading) => (
                            <div key={`${reading.bookShort}-${reading.chapter}`} className="rounded-lg bg-black/25 p-5 border border-white/5">
                              <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                                <h5 className="font-bold text-lg text-white">{reading.book} {language === "zh" ? "第" : ""} {reading.chapter} {language === "zh" ? "章" : "Pasal"}</h5>
                                <button
                                  onClick={() => {
                                    const chapterText = reading.verses.map(v => v.text).join(" ");
                                    const isPlaying = playingVerseId === `${reading.bookShort}-${reading.chapter}-all`;
                                    toggleAudio(chapterText, isPlaying, (status) => {
                                      setPlayingVerseId(status ? `${reading.bookShort}-${reading.chapter}-all` : null);
                                    }, translationId === "BSB" ? "en-US" : "id-ID");
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded bg-[#2a6f6f] px-3 py-1 text-xs font-semibold hover:bg-[#1f5252] text-white cursor-pointer"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                                  </svg>
                                  {playingVerseId === `${reading.bookShort}-${reading.chapter}-all` ? (language === "zh" ? "停止" : "Stop") : (language === "zh" ? "收听" : "Dengarkan")}
                                </button>
                              </div>
                              <div className="space-y-3">
                                {reading.verses.map((verse) => {
                                  const verseId = `${translationId}-${reading.bookShort}-${reading.chapter}-${verse.number}`;
                                  const hColorValue = highlights[verseId];
                                  const highlightStyle = hColorValue
                                    ? HIGHLIGHT_COLORS.find(c => c.value === hColorValue)?.class
                                    : "text-white/90 hover:bg-white/5";

                                  const mappedVerse: BibleVerse = {
                                    id: verseId,
                                    book: reading.book,
                                    bookShort: reading.bookShort,
                                    chapter: reading.chapter,
                                    verse: verse.number,
                                    translation: reading.translation,
                                    reference: `${reading.book} ${reading.chapter}:${verse.number}`,
                                    text: verse.text,
                                    themes: ["rencana-baca"],
                                    normalizedText: "",
                                    keywords: [],
                                  };

                                  return (
                                    <p
                                      key={verse.number}
                                      onClick={() => openVerseMenu(mappedVerse)}
                                      className={`rounded px-2 py-1 leading-relaxed text-base cursor-pointer transition ${highlightStyle}`}
                                    >
                                      <sup className="text-[10px] font-bold text-[#ffd166] mr-1.5">{verse.number}</sup>
                                      {verse.text}
                                    </p>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reflection input */}
                    <div className="rounded-lg bg-black/20 p-5 border border-white/10 space-y-3">
                      <label className="text-sm font-semibold text-[#ffd166] block" htmlFor="ref-notes-custom">
                        {language === "zh" ? "今日反思与承诺" : language === "en" ? "Reflection Notes & Today's Commitment" : "Catatan Refleksi & Komitmen Hari Ini"}
                      </label>
                      <textarea
                        id="ref-notes-custom"
                        value={dailyNote}
                        onChange={(e) => setDailyNote(e.target.value)}
                        placeholder={language === "zh" ? "写下今天上帝通过阅读圣经对您说的话..." : language === "en" ? "Write down what God spoke to you through today's Bible reading..." : "Tuliskan refleksi pribadi Anda untuk bacaan hari ini..."}
                        className="w-full min-h-[100px] rounded border border-white/20 bg-[#102c3a] p-3 text-sm text-white outline-none focus:border-[#ffd166]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleSavePlanNote}
                          className="rounded border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 cursor-pointer"
                        >
                          Simpan Catatan Saja
                        </button>
                        <button
                          type="button"
                          onClick={handleCompleteDay}
                          className="rounded bg-[#ffd166] px-5 py-2 text-xs font-bold text-[#102c3a] hover:bg-[#ffe094] transition cursor-pointer"
                        >
                          {customDay >= customDuration ? (language === "zh" ? "完成阅读并结束计划" : language === "en" ? "Finish Reading & Complete Plan" : "Selesai Membaca & Selesaikan Rencana") : (language === "zh" ? "完成阅读并进入下一天" : language === "en" ? "Done & Next Day" : "Selesai Baca & Lanjut Hari Berikutnya")}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : activeTab !== "Favorit & Catatan" ? (
          <>
            {/* Search/Query Form */}
            <form
              onSubmit={onSubmit}
              className="mt-6 flex flex-col gap-3 rounded-lg border border-white/15 bg-white/10 p-4 sm:grid sm:grid-cols-[1fr_auto]"
            >
              <label className="grid gap-2">
                <span className="text-sm text-white/72">{helperText}</span>
                {activeTab !== "Ayat Tematik" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/50">{language === "zh" ? "快速选择：" : language === "en" ? "Quick select:" : "Pilih cepat:"}</span>
                    <select
                      className="cursor-pointer rounded border border-white/20 bg-[#102c3a] px-2 py-1 text-xs text-white outline-none min-w-0 flex-shrink"
                      onChange={(e) => {
                        const bookName = e.target.value;
                        handleDropdownSelect(`${bookName} 1`);
                      }}
                      value={parsedSearch.book}
                    >
                      {BIBLE_BOOKS.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                    <select
                      className="cursor-pointer rounded border border-white/20 bg-[#102c3a] px-2 py-1 text-xs text-white outline-none min-w-0 flex-shrink"
                      onChange={(e) => {
                        const chap = e.target.value;
                        handleDropdownSelect(`${parsedSearch.book} ${chap}`);
                      }}
                      value={parsedSearch.chapter}
                    >
                      {Array.from({ length: currentBookObj.chapters }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>Pasal {i + 1}</option>
                      ))}
                    </select>
                    <select
                      className="cursor-pointer rounded border border-white/20 bg-[#102c3a] px-2 py-1 text-xs text-white outline-none min-w-0 flex-shrink"
                      onChange={(e) => {
                        const v = e.target.value;
                        handleDropdownSelect(v ? `${parsedSearch.book} ${parsedSearch.chapter}:${v}` : `${parsedSearch.book} ${parsedSearch.chapter}`);
                      }}
                      value={parsedSearch.verse || ""}
                    >
                      <option value="">{language === "zh" ? "所有节" : language === "en" ? "All Verses" : "Semua Ayat"}</option>
                      {Array.from({ length: chapterVersesCount }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>{language === "zh" ? `第 ${i + 1} 节` : language === "en" ? `Verse ${i + 1}` : `Ayat ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="relative">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-md border border-white/15 bg-white pl-4 pr-11 py-3 text-[#1f2933] outline-none ring-[#ffd166] focus:ring-2"
                    placeholder="Yohanes 3:16"
                  />
                  <button
                    type="button"
                    onClick={startVoiceSearch}
                    className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-all duration-300 hover:scale-110 active:scale-95 ${
                      isListening 
                        ? "text-red-500 animate-pulse" 
                        : "text-slate-400 hover:text-teal-650"
                    }`}
                    title="Cari menggunakan suara (Voice to Text)"
                  >
                    {isListening ? (
                      <span className="w-5 h-5 flex items-center justify-center bg-red-500/20 rounded-full text-xs">🔴</span>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>
              <button
                type="submit"
                className="w-full sm:w-auto self-end rounded-md bg-[#f4a261] px-5 py-3 font-semibold text-[#102c3a] transition hover:bg-[#ffd166]"
              >
                {language === "zh" ? "搜索经文" : language === "en" ? "Search Verse" : "Cari Ayat"}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-wrap gap-2">
                  {["Semua", "PL", "PB"].map((testamentKey) => (
                    <button
                      key={testamentKey}
                      type="button"
                      onClick={() => {
                        setTestament(testamentKey as any);
                        setCurrentPage(1);
                      }}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                        testament === testamentKey
                          ? "bg-[#2a6f6f] text-white"
                          : "border border-white/20 bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {testamentKey === "PL"
                        ? (language === "zh" ? "旧约" : language === "en" ? "Old Testament" : "Perjanjian Lama")
                        : testamentKey === "PB"
                          ? (language === "zh" ? "新约" : language === "en" ? "New Testament" : "Perjanjian Baru")
                          : (language === "zh" ? "全部书卷" : language === "en" ? "All Books" : "Semua Kitab")}
                    </button>
                  ))}
                </div>

                <select
                  value={category}
                  onChange={async (e) => {
                    const selectedCat = e.target.value;
                    setCategory(selectedCat);
                    setCurrentPage(1);

                    if (selectedCat === "Semua Kategori") {
                      // Reset to current search results
                      setStatus("Menampilkan semua hasil.");
                      return;
                    }

                    // Fetch chapter 1 of ALL books in this category so the filter has data
                    const bookIds = BOOK_CATEGORIES[selectedCat] ?? [];
                    if (bookIds.length === 0) return;

                    setStatus("Memuat ayat kategori...");
                    try {
                      // Batch-fetch chapter 1 from each book in the category
                      const readings = await Promise.all(
                        bookIds.map(id => fetchBibleChapterReading(id, 1, translationId))
                      );

                      const aggregated: BibleVerse[] = [];
                      readings.forEach(reading => {
                        if (!reading) return;
                        reading.verses.forEach(v => {
                          aggregated.push({
                            id: `${translationId}-${reading.bookShort}-${reading.chapter}-${v.number}`,
                            book: reading.book,
                            bookShort: reading.bookShort,
                            chapter: reading.chapter,
                            verse: v.number,
                            translation: reading.translation,
                            reference: `${reading.book} ${reading.chapter}:${v.number}`,
                            text: v.text,
                            themes: [selectedCat.toLowerCase()],
                            normalizedText: v.text.toLowerCase(),
                            keywords: [],
                          });
                        });
                      });

                      setResults(aggregated);
                      setSearch(selectedCat);
                      setStatus(
                        aggregated.length > 0
                          ? `${aggregated.length} ayat dari kategori "${selectedCat}".`
                          : "Belum ada hasil."
                      );
                    } catch {
                      setStatus("Gagal memuat ayat kategori.");
                    }
                  }}
                  className="rounded-md border border-white/20 bg-[#102c3a] px-3 py-1.5 text-sm font-semibold text-white/80 outline-none transition focus:ring-2 focus:ring-[#ffd166]"
                >
                  {Object.keys(BOOK_CATEGORIES).map((cat) => {
                    const catLabel: Record<string, Record<string, string>> = {
                      "Semua Kategori": { id: "Semua Kategori", en: "All Categories", zh: "所有分类" },
                      "Taurat": { id: "Taurat", en: "Torah", zh: "摩西五经" },
                      "Sejarah PL": { id: "Sejarah PL", en: "OT History", zh: "旧约历史" },
                      "Puisi & Hikmat": { id: "Puisi & Hikmat", en: "Poetry & Wisdom", zh: "诗歌与智慧" },
                      "Nabi-Nabi": { id: "Nabi-Nabi", en: "Prophets", zh: "先知书" },
                      "Injil": { id: "Injil", en: "Gospels", zh: "福音书" },
                      "Sejarah PB": { id: "Sejarah PB", en: "NT History", zh: "新约历史" },
                      "Surat-Surat": { id: "Surat-Surat", en: "Epistles", zh: "书信" },
                      "Wahyu": { id: "Wahyu", en: "Revelation", zh: "启示录" },
                    };
                    const label = catLabel[cat]?.[language] || cat;
                    return (
                      <option key={cat} value={cat}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <p className="text-sm text-white/68">{status}</p>
            </div>

            {translationId === "ind_web" && <AiDisclaimer t={t} />}

            {/* Verse grid rendering */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {paginatedResults.map((verse) => {
                const hColorValue = highlights[verse.id];
                const isTargetVerse = targetVerse !== null && verse.verse === targetVerse;
                const highlightStyle = isTargetVerse
                  ? "bg-[#ffd166] text-[#102c3a] ring-2 ring-[#ffd166] shadow-lg animate-pulse"
                  : hColorValue
                    ? HIGHLIGHT_COLORS.find(c => c.value === hColorValue)?.class
                    : "bg-white text-[#1f2933]";
                const isBookmarked = bookmarks.some(b => b.id === verse.id);
                const hasNote = !!notes[verse.id];

                return (
                  <article
                    key={verse.id}
                    id={`verse-${verse.verse}`}
                    onClick={() => openVerseMenu(verse)}
                    className={`rounded-lg border border-white/12 p-5 cursor-pointer transition hover:shadow-lg scroll-mt-24 ${highlightStyle}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-bold uppercase tracking-[0.18em] ${hColorValue ? 'text-black/70' : 'text-[#2a6f6f]'}`}>
                        {verse.reference}
                      </p>
                      <div className="flex gap-2 text-yellow-600">
                        {isBookmarked && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                          </svg>
                        )}
                        {hasNote && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-lg leading-8">{verse.text}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {verse.themes.map((theme) => (
                        <span
                          key={theme}
                          className="rounded-md bg-black/5 border border-black/10 px-2 py-0.5 text-xs font-semibold"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            {paginatedResults.length === 0 && results.length > 0 && (
              <p className="mt-8 text-center text-sm text-white/70">
                Tidak ada ayat yang cocok dengan filter yang dipilih.
              </p>
            )}

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-white/5"
                >
                  Sebelumnya
                </button>
                <span className="text-sm font-medium text-white/70">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-white/5"
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </>
        ) : (
          /* Offline Tab: Favorit & Catatan */
          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6 animate-in fade-in">
            <div className="flex gap-2 border-b border-white/10 pb-4">
              <button
                onClick={() => setFavSubTab("favorit")}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                  favSubTab === "favorit" ? "bg-[#ffd166] text-[#102c3a]" : "bg-transparent text-white/70"
                }`}
              >
                Ayat Favorit ({bookmarks.length})
              </button>
              <button
                onClick={() => setFavSubTab("catatan")}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                  favSubTab === "catatan" ? "bg-[#ffd166] text-[#102c3a]" : "bg-transparent text-white/70"
                }`}
              >
                Catatan Refleksi ({Object.keys(notes).length})
              </button>
            </div>

            {favSubTab === "favorit" ? (
              <div className="mt-6 grid gap-4">
                {bookmarks.length === 0 ? (
                  <p className="text-[#ffd166]/70 italic text-center py-6">Belum ada ayat favorit yang disimpan secara offline.</p>
                ) : (
                  bookmarks.map((verse) => (
                    <div
                      key={verse.id}
                      onClick={() => openVerseMenu(verse)}
                      className="rounded-lg border border-white/10 bg-white/10 p-5 cursor-pointer hover:bg-white/15 transition"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[#ffd166] font-bold text-sm">{verse.reference} ({verse.translation})</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(verse);
                          }}
                          className="text-red-400 hover:text-red-600 transition"
                        >
                          Hapus
                        </button>
                      </div>
                      <p className="mt-2 text-white/90 leading-7">{verse.text}</p>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {Object.keys(notes).length === 0 ? (
                  <p className="text-[#ffd166]/70 italic text-center py-6">Belum ada catatan refleksi yang ditulis.</p>
                ) : (
                  bookmarks
                    .filter((v) => !!notes[v.id])
                    .map((verse) => (
                      <div
                        key={verse.id}
                        onClick={() => openVerseMenu(verse)}
                        className="rounded-lg border border-[#ffd166]/20 bg-white/10 p-5 cursor-pointer hover:bg-white/15 transition"
                      >
                        <span className="text-[#ffd166] font-bold text-sm block mb-2">{verse.reference}</span>
                        <div className="rounded bg-black/20 p-3 text-sm italic text-white/80 border-l-4 border-[#ffd166]">
                          {notes[verse.id]}
                        </div>
                        <p className="mt-3 text-xs text-white/50 leading-relaxed truncate">Ayat: {verse.text}</p>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Premium Verse Action Sheet / Overlay Modal */}
      {selectedVerse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/20 bg-[#102c3a] p-6 text-white shadow-2xl animate-in zoom-in-95 duration-200 scrollbar-thin">
            {/* Close Button */}
            <button
              onClick={() => setSelectedVerse(null)}
              className="absolute right-4 top-4 text-white/70 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Verse Title & Text */}
            <div className="border-b border-white/10 pb-4 pr-6">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#ffd166] block mb-1">
                Aksi Ayat • {selectedVerse.translation}
              </span>
              <h3 className="text-xl font-bold text-white">{selectedVerse.reference}</h3>
              <p className="mt-3 text-lg leading-relaxed italic bg-black/20 p-3 rounded border border-white/5">
                &ldquo;{selectedVerse.text}&rdquo;
              </p>
              {selectedVerse.translation === "WEB-AI" && (
                <p className="mt-2 text-xs text-white/50 italic">
                  * Terjemahan Bahasa Indonesia di atas merupakan hasil terjemahan otomatis menggunakan AI.
                </p>
              )}
            </div>

            {/* Grid Options */}
            <div className="grid gap-6 py-6 md:grid-cols-2 border-b border-white/10">
              {/* Left Column: Interactive Tools */}
              <div className="grid gap-4 h-fit">
                {/* Highlights */}
                <div>
                  <h4 className="text-sm font-semibold text-[#ffd166] mb-2">Stabilo Ayat (Highlight)</h4>
                  <div className="flex gap-2">
                    {HIGHLIGHT_COLORS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => applyHighlight(selectedVerse.id, color.value)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border transition hover:scale-105 ${color.dot} ${
                          highlights[selectedVerse.id] === color.value ? "ring-2 ring-white scale-105 border-white" : "border-white/20"
                        }`}
                        title={color.name}
                      >
                        {highlights[selectedVerse.id] === color.value && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-black">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    ))}
                    {highlights[selectedVerse.id] && (
                      <button
                        onClick={() => applyHighlight(selectedVerse.id, null)}
                        className="rounded-md border border-white/20 bg-white/10 px-3 text-xs font-semibold hover:bg-white/20"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>

                {/* Bookmark Toggle */}
                <div>
                  <h4 className="text-sm font-semibold text-[#ffd166] mb-2">Simpan ke Favorit</h4>
                  <button
                    onClick={() => toggleBookmark(selectedVerse)}
                    className={`flex items-center gap-2 rounded-md border px-4 py-2 font-semibold transition ${
                      bookmarks.some(b => b.id === selectedVerse.id)
                        ? "bg-[#ffd166] border-transparent text-[#102c3a]"
                        : "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                    </svg>
                    {bookmarks.some(b => b.id === selectedVerse.id) ? "Tersimpan di Favorit" : "Jadikan Favorit"}
                  </button>
                </div>

                {/* Audio Reader */}
                <div>
                  <h4 className="text-sm font-semibold text-[#ffd166] mb-2">Suara Audio Ayat (Read Aloud)</h4>
                  <button
                    onClick={() => handlePlayVoice(selectedVerse)}
                    className="flex items-center gap-2 rounded-md bg-[#f4a261] px-4 py-2 font-semibold text-[#102c3a] transition hover:bg-[#ffd166]"
                  >
                    {playingVerseId === selectedVerse.id ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
                        </svg>
                        Hentikan Suara
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.063.922-2.063 2.063v4.875c0 1.141.922 2.062 2.063 2.062h1.932l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 0 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 0 0-1.06-1.06l-1.72 1.72-1.72-1.72Z" />
                        </svg>
                        Dengarkan Suara Ayat
                      </>
                    )}
                  </button>
                </div>

                {/* Share social */}
                <div>
                  <h4 className="text-sm font-semibold text-[#ffd166] mb-2">Bagikan Ayat</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleShareVerse(selectedVerse, "whatsapp")}
                      className="rounded bg-[#25d366] px-3 py-1.5 text-xs font-semibold text-[#102c3a] hover:bg-[#20ba59]"
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => handleShareVerse(selectedVerse, "facebook")}
                      className="rounded bg-[#1877f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#145dbf]"
                    >
                      Facebook
                    </button>
                    <button
                      onClick={() => handleShareVerse(selectedVerse, "instagram")}
                      className="rounded bg-gradient-to-tr from-[#f9ce3f] via-[#e1306c] to-[#833ab4] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Instagram (Copy)
                    </button>
                    <button
                      onClick={() => handleShareVerse(selectedVerse, "generic")}
                      className="rounded bg-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/30"
                    >
                      Lainnya
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Personal Notes Form */}
              <div className="rounded-lg bg-black/25 p-4 border border-white/5 flex flex-col gap-3 h-full">
                <label className="text-sm font-semibold text-[#ffd166] flex items-center justify-between" htmlFor="verse-ref-note">
                  Tulis Refleksi Pribadi
                  <span className="text-[10px] text-white/50">(Tersimpan secara Offline)</span>
                </label>
                <textarea
                  id="verse-ref-note"
                  value={activeNoteText}
                  onChange={(e) => setActiveNoteText(e.target.value)}
                  className="flex-1 min-h-[140px] rounded border border-white/20 bg-white/5 p-3 text-sm text-white outline-none focus:border-[#ffd166]"
                  placeholder="Tuliskan pelajaran, hikmat, atau komitmen iman Anda setelah membaca ayat ini..."
                />
                <button
                  type="button"
                  onClick={() => handleSaveVerseNote(selectedVerse.id)}
                  className="rounded bg-[#2a6f6f] py-2 font-semibold text-white transition hover:bg-[#1a4a4a]"
                >
                  Simpan Catatan
                </button>
              </div>
            </div>

            {/* AI Assistance Action Tools */}
            <div className="pt-6">
              <h4 className="text-sm font-semibold text-[#ffd166] mb-3">Bantuan Pendalaman AI (Online)</h4>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => handleFetchAiSupport(selectedVerse, "explanation")}
                  className={`flex-1 rounded-md py-2.5 px-4 font-semibold text-sm transition ${
                    aiType === "explanation" ? "bg-[#2a6f6f] text-white" : "border border-white/20 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  💡 Penjelasan Ayat (Konteks & Makna)
                </button>
                <button
                  onClick={() => handleFetchAiSupport(selectedVerse, "commentary")}
                  className={`flex-1 rounded-md py-2.5 px-4 font-semibold text-sm transition ${
                    aiType === "commentary" ? "bg-[#2a6f6f] text-white" : "border border-white/20 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  📖 Tafsiran Ayat (Komentari)
                </button>
              </div>

              {/* AI Content Display */}
              {aiType && (
                <div className="rounded-lg bg-black/35 p-5 border border-white/10 animate-in fade-in duration-300">
                  <h5 className="font-bold text-sm text-[#ffd166] uppercase tracking-wider mb-3">
                    {aiType === "explanation" ? "Hasil Penjelasan AI" : "Hasil Tafsiran AI"}
                  </h5>
                  
                  {aiLoading ? (
                    <div className="flex items-center gap-3 text-white/70 py-4">
                      <svg className="animate-spin h-5 w-5 text-[#ffd166]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>Menganalisis teks Alkitab secara teologis...</span>
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none text-white/90 leading-relaxed text-sm">
                      <ReactMarkdown
                        components={{
                          h1: ({ ...props }) => <strong {...props} className="block mt-2 text-base text-[#ffd166]" />,
                          h2: ({ ...props }) => <strong {...props} className="block mt-2 text-sm text-[#ffd166]" />,
                          h3: ({ ...props }) => <strong {...props} className="block mt-2 text-sm text-[#ffd166]" />,
                        }}
                      >
                        {aiContent}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Panduan Alkitab */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/20 bg-[#102c3a] p-6 text-white shadow-2xl animate-in zoom-in-95 duration-200 scrollbar-thin">
            {/* Close Button */}
            <button
              onClick={() => setShowGuide(false)}
              className="absolute right-4 top-4 text-white/70 hover:text-white transition p-1 rounded-md hover:bg-white/10"
              title="Tutup Panduan"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="border-b border-white/10 pb-4 mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#ffd166]">
                Panduan Pengguna
              </span>
              <h3 className="text-2xl font-bold text-white mt-1">📖 Fitur & Panduan Alkitab</h3>
            </div>

            {/* Content */}
            <div className="space-y-6 text-sm text-white/90 leading-relaxed max-h-[55vh] overflow-y-auto pr-2 scrollbar-thin">
              <div>
                <h4 className="font-bold text-[#ffd166] text-base mb-2">🔍 1. Pencarian Ayat Custom</h4>
                <p className="mb-2">
                  Fitur pencarian Alkitab di Grace Daily sangat fleksibel dan mendukung pencarian ayat secara detail dengan format berikut:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-white/80">
                  <li>
                    <strong className="text-white">Pencarian Kitab & Pasal:</strong> Ketik nama kitab dan pasalnya secara utuh.
                    <br />
                    <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Yohanes 3</code> atau <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Mazmur 23</code>
                  </li>
                  <li>
                    <strong className="text-white">Pencarian Ayat Spesifik:</strong> Gunakan tanda titik dua (<code className="text-[#ffd166]">:</code>) setelah pasal untuk menentukan nomor ayat.
                    <br />
                    <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Yohanes 3:16</code> atau <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Matius 6:33</code>
                  </li>
                  <li>
                    <strong className="text-white">Pencarian Rentang Ayat (Range):</strong> Gunakan tanda hubung (<code className="text-[#ffd166]">-</code>) untuk mencari beberapa ayat berurutan.
                    <br />
                    <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Yohanes 3:16-18</code> atau <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Roma 8:28-30</code>
                  </li>
                  <li>
                    <strong className="text-white">Pencarian Multi-Ayat Terpisah:</strong> Pisahkan dengan tanda koma (<code className="text-[#ffd166]">,</code>) untuk memuat beberapa ayat yang tidak berurutan dalam pasal yang sama.
                    <br />
                    <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Yohanes 3:16,18,21</code> atau <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Mazmur 23:1,3,6</code>
                  </li>
                  <li>
                    <strong className="text-white">Pencarian Multi-Kitab / Multi-Pasal:</strong> Gunakan tanda titik koma (<code className="text-[#ffd166]">;</code>) untuk memuat referensi dari kitab atau pasal yang berbeda sekaligus.
                    <br />
                    <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Yohanes 3:16; Roma 8:28</code> atau <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">Matius 6:33; Filipi 4:6</code>
                  </li>
                  <li>
                    <strong className="text-white">Pencarian Kata Kunci (Keyword Search):</strong> Ketik kata atau konsep yang ingin dicari (minimal 3 huruf) untuk menyaring ayat.
                    <br />
                    Contoh: ketik <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">kasih</code>, <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">damai</code>, atau <code className="bg-black/35 px-1.5 py-0.5 rounded text-[#f4a261]">khawatir</code>.
                  </li>
                </ul>
              </div>

              <div className="border-t border-white/10 pt-4">
                <h4 className="font-bold text-[#ffd166] text-base mb-2">⚡ 2. Fitur Interaktif Ayat</h4>
                <p className="mb-2">
                  Ketuk atau klik pada salah satu kartu ayat untuk memunculkan <strong>Aksi Ayat</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-white/80">
                  <li>
                    <strong className="text-white">Stabilo Ayat (Highlight):</strong> Pilih salah satu warna (Kuning, Hijau, Biru, Merah) untuk mewarnai teks ayat.
                  </li>
                  <li>
                    <strong className="text-white">Favorit (Bookmarking):</strong> Simpan ayat favorit Anda sehingga dapat diakses kapan saja secara offline di tab "Favorit & Catatan".
                  </li>
                  <li>
                    <strong className="text-white">Dengarkan Suara Ayat (Read Aloud):</strong> Fitur pembacaan teks otomatis (text-to-speech) dalam bahasa Indonesia atau Inggris (sesuai terjemahan aktif).
                  </li>
                  <li>
                    <strong className="text-white">Tulis Refleksi Pribadi (Notes):</strong> Tulis pemikiran, catatan khotbah, atau doa rohani Anda langsung di bawah ayat pilihan. Catatan ini tersimpan secara lokal di browser Anda.
                  </li>
                </ul>
              </div>

              <div className="border-t border-white/10 pt-4">
                <h4 className="font-bold text-[#ffd166] text-base mb-2">🤖 3. Pendalaman Alkitab berbasis AI</h4>
                <p className="mb-2">
                  Dapatkan bimbingan studi rohani langsung dari asisten teologi AI kami melalui menu Aksi Ayat:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-white/80">
                  <li>
                    <strong className="text-white">💡 Penjelasan Ayat:</strong> Menganalisis konteks sejarah, makna teologis dasar, dan aplikasi praktis kehidupan modern.
                  </li>
                  <li>
                    <strong className="text-white">📖 Tafsiran Ayat (Komentari):</strong> Memberikan penjelasan teologis terperinci dari perikop Alkitab untuk menggali makna lebih dalam.
                  </li>
                </ul>
              </div>

              <div className="border-t border-white/10 pt-4">
                <h4 className="font-bold text-[#ffd166] text-base mb-2">📢 4. Bagikan Firman Tuhan</h4>
                <p className="text-white/80">
                  Bagikan inspirasi firman Tuhan dengan mudah ke platform media sosial seperti WhatsApp, Facebook, Instagram (otomatis menyalin teks ke clipboard), atau aplikasi lainnya dengan menekan tombol "Bagikan Ayat".
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 pt-4 mt-6 flex justify-end">
              <button
                onClick={() => setShowGuide(false)}
                className="rounded-md bg-[#ffd166] px-5 py-2 font-bold text-[#102c3a] transition hover:bg-[#ffeaad] cursor-pointer text-sm"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
