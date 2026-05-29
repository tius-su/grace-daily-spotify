"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  defaultBibleTranslation,
  bsbBibleTranslation,
  sampleBibleVerses,
  searchBibleVerses,
  BIBLE_BOOKS,
  type BibleVerse,
} from "@/lib/bible";
import { toggleAudio, stopAudio } from "@/lib/audio";

const tabs = ["Cari Ayat", "Baca Pasal", "Ayat Tematik", "Favorit & Catatan"] as const;

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
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Cari Ayat");
  const [search, setSearch] = useState("Yohanes 3:16");
  const [status, setStatus] = useState("Siap mencari ayat.");
  const [results, setResults] = useState<BibleVerse[]>(sampleBibleVerses);
  const [translationId, setTranslationId] = useState<"ind_ayt" | "BSB">("ind_ayt");

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
  
  // Load offline data on mount
  useEffect(() => {
    try {
      const storedBookmarks = localStorage.getItem("bible_bookmarks");
      if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks));

      const storedHighlights = localStorage.getItem("bible_highlights");
      if (storedHighlights) setHighlights(JSON.parse(storedHighlights));

      const storedNotes = localStorage.getItem("bible_notes");
      if (storedNotes) setNotes(JSON.parse(storedNotes));
    } catch (e) {
      console.error("Gagal memuat data offline dari LocalStorage", e);
    }
  }, []);

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
    if (translationId === "BSB") {
      if (activeTab === "Baca Pasal") return "Enter example: Psalm 23, John 3, Romans 8.";
      if (activeTab === "Ayat Tematik") return "Search themes like love, prayer, peace, faith.";
      return "Search references or keywords: John 3:16, love, peace.";
    }

    if (activeTab === "Baca Pasal") {
      return "Masukkan contoh: Mazmur 23, Yohanes 3, Roma 8.";
    }

    if (activeTab === "Ayat Tematik") {
      return "Cari tema seperti kasih, doa, damai, iman, pengampunan.";
    }

    return "Cari referensi atau kata kunci: Yohanes 3:16, kasih, khawatir.";
  }, [activeTab, translationId]);

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
      alert("Teks ayat telah disalin ke clipboard! Silakan paste (tempel) langsung di Instagram Stories, Facebook, atau media sosial lainnya.");
    } catch (err) {
      alert("Gagal menyalin ayat secara otomatis. Silakan salin manual.");
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
    alert("Catatan refleksi ayat berhasil disimpan secara lokal.");
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
        setAiContent(data.error || "Gagal memperoleh penjelasan AI saat ini.");
      }
    } catch (e) {
      setAiContent("Koneksi gagal. Pastikan Anda online untuk menggunakan penjelasan AI.");
    } finally {
      setAiLoading(false);
    }
  }

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
              {translationId === "ind_ayt" ? "Alkitab bahasa Indonesia" : "English Bible"}
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl flex items-center flex-wrap gap-2">
              <span>
                {translationId === "ind_ayt" ? "Cari ayat, baca pasal, dan jelajahi tema rohani." : "Search verses, read chapters, and explore themes."}
              </span>
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-[#ffd166] transition cursor-pointer"
                title="Panduan Lengkap Fitur Alkitab"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </button>
            </h2>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/82 flex items-center gap-3">
            <span>Translation:</span>
            <select
              value={translationId}
              onChange={(e) => {
                const newId = e.target.value as "ind_ayt" | "BSB";
                setTranslationId(newId);
                if (newId === "BSB" && search === "Yohanes 3:16") setSearch("John 3:16");
                if (newId === "ind_ayt" && search === "John 3:16") setSearch("Yohanes 3:16");
              }}
              className="bg-transparent text-[#ffd166] outline-none border-b border-[#ffd166]/50 pb-0.5 cursor-pointer"
            >
              <option value="ind_ayt" className="bg-[#102c3a] text-white">Indonesia (AYT)</option>
              <option value="BSB" className="bg-[#102c3a] text-white">English (BSB)</option>
            </select>
          </div>
        </div>

        {/* Tab Menu Bar */}
        <div className="mt-8 overflow-x-auto">
          <div className="flex min-w-max gap-2">
            {tabs.map((tab) => (
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
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab !== "Favorit & Catatan" ? (
          <>
            {/* Search/Query Form */}
            <form
              onSubmit={onSubmit}
              className="mt-6 grid gap-3 rounded-lg border border-white/15 bg-white/10 p-4 md:grid-cols-[1fr_auto]"
            >
              <label className="grid gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-white/72">{helperText}</span>
                  {activeTab !== "Ayat Tematik" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">Pilih cepat:</span>
                      <select
                        className="cursor-pointer rounded border border-white/20 bg-[#102c3a] px-2 py-1 text-xs text-white outline-none"
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
                        className="cursor-pointer rounded border border-white/20 bg-[#102c3a] px-2 py-1 text-xs text-white outline-none"
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
                        className="cursor-pointer rounded border border-white/20 bg-[#102c3a] px-2 py-1 text-xs text-white outline-none"
                        onChange={(e) => {
                          const v = e.target.value;
                          handleDropdownSelect(v ? `${parsedSearch.book} ${parsedSearch.chapter}:${v}` : `${parsedSearch.book} ${parsedSearch.chapter}`);
                        }}
                        value={parsedSearch.verse || ""}
                      >
                        <option value="">Semua Ayat</option>
                        {Array.from({ length: chapterVersesCount }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>Ayat {i + 1}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="rounded-md border border-white/15 bg-white px-4 py-3 text-[#1f2933] outline-none ring-[#ffd166] focus:ring-2"
                  placeholder="Yohanes 3:16"
                />
              </label>
              <button
                type="submit"
                className="self-end rounded-md bg-[#f4a261] px-5 py-3 font-semibold text-[#102c3a] transition hover:bg-[#ffd166]"
              >
                Cari Ayat
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-wrap gap-2">
                  {["Semua", "PL", "PB"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTestament(t as any);
                        setCurrentPage(1);
                      }}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                        testament === t
                          ? "bg-[#2a6f6f] text-white"
                          : "border border-white/20 bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {t === "PL"
                        ? "Perjanjian Lama"
                        : t === "PB"
                          ? "Perjanjian Baru"
                          : "Semua Kitab"}
                    </button>
                  ))}
                </div>

                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (e.target.value !== "Semua Kategori") {
                      setSearch(e.target.value);
                    }
                    setCurrentPage(1);
                  }}
                  className="rounded-md border border-white/20 bg-[#102c3a] px-3 py-1.5 text-sm font-semibold text-white/80 outline-none transition focus:ring-2 focus:ring-[#ffd166]"
                >
                  {Object.keys(BOOK_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {category !== "Semua Kategori" && (
                  <button
                    type="button"
                    onClick={runSearch}
                    className="rounded-md bg-[#ffd166] px-3 py-1.5 text-sm font-semibold text-[#102c3a]"
                  >
                    Cari kategori ini
                  </button>
                )}
              </div>
              <p className="text-sm text-white/68">{status}</p>
            </div>

            {/* Verse grid rendering */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {paginatedResults.map((verse) => {
                const hColorValue = highlights[verse.id];
                const highlightStyle = hColorValue
                  ? HIGHLIGHT_COLORS.find(c => c.value === hColorValue)?.class
                  : "bg-white text-[#1f2933]";
                const isBookmarked = bookmarks.some(b => b.id === verse.id);
                const hasNote = !!notes[verse.id];

                return (
                  <article
                    key={verse.id}
                    onClick={() => openVerseMenu(verse)}
                    className={`rounded-lg border border-white/12 p-5 cursor-pointer transition hover:shadow-lg ${highlightStyle}`}
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
