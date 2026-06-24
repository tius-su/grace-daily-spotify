"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BIBLE_BOOKS, findBook, extractBibleText } from "@/lib/bible";

// Telegram WebApp SDK type declaration
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        version: string;
        openLink: (url: string) => void;
        openTelegramLink: (url: string) => void;
        showAlert: (message: string) => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}


interface DevotionItem {
  id: string;
  title: string;
  verseRef?: string;
  verseText?: string;
  dateId?: string;
}

interface ArticleItem {
  id: string;
  title: string;
  category: string;
  excerpt?: string;
}

interface EncyclopediaItem {
  id?: string;
  keyword: string;
  kategori: string;
  slug: string;
  title?: string;
}

const ENCYCLOPEDIA_CATEGORIES = [
  { value: "tokoh", label: "Tokoh" },
  { value: "tempat", label: "Tempat" },
  { value: "kamus", label: "Kamus/Istilah" },
  { value: "mukjizat", label: "Mukjizat" },
  { value: "perumpamaan", label: "Perumpamaan" },
  { value: "kitab", label: "Kitab" },
  { value: "kronologi", label: "Kronologi" },
  { value: "silsilah", label: "Silsilah" },
  { value: "teologi", label: "Teologi" },
  { value: "teologi-2", label: "Teologi (Tambahan)" },
  { value: "topikal_alkitab", label: "Topikal Alkitab" },
  { value: "peristiwa", label: "Peristiwa" },
  { value: "peristiwa-2", label: "Peristiwa (Tambahan)" },
];

interface TelegramUserContext {
  source: "telegram" | "pwa" | "unknown";
  user: { id?: number; name: string; username?: string } | null;
}

export default function TelegramMiniApp() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>("");
  const [tgContext, setTgContext] = useState<TelegramUserContext | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // R2 indexes state
  const [devotions, setDevotions] = useState<DevotionItem[]>([]);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  
  // Encyclopedia state
  const [selectedEnsiCategory, setSelectedEnsiCategory] = useState<string>("tokoh");
  const [encyclopediaEntries, setEncyclopediaEntries] = useState<EncyclopediaItem[]>([]);

  // Bible state
  const [selectedBook, setSelectedBook] = useState<string>("Kejadian");
  const [chapter, setChapter] = useState<string>("1");
  const [verse, setVerse] = useState<string>("1");

  // Bible reader states
  const [loadedBibleChapter, setLoadedBibleChapter] = useState<any>(null);
  const [bibleLoadError, setBibleLoadError] = useState<string | null>(null);
  const [highlightedVerses, setHighlightedVerses] = useState<number[]>([]);
  const [bibleViewMode, setBibleViewMode] = useState<boolean>(false);

  const isDark = theme === "dark";

  // Check URL menu params and theme choice on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("tma-theme") || "light";
    setTheme(savedTheme as "light" | "dark");

    const params = new URLSearchParams(window.location.search);
    const menu = params.get("menu");
    if (menu) {
      setSelectedMainCategory(menu);
      if (menu === "renungan") {
        loadDevotions();
      } else if (menu === "artikel") {
        loadArticles();
      } else if (menu === "ensiklopedia") {
        loadEncyclopediaCategory(selectedEnsiCategory);
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("tma-theme", nextTheme);
  };

  const parseVerseNumbers = (verseStr: string): number[] => {
    if (!verseStr || !verseStr.trim()) return [];
    const nums: number[] = [];
    const parts = verseStr.trim().split(/[\s,-]+/);
    if (parts.length === 1) {
      const single = parseInt(parts[0], 10);
      if (!isNaN(single)) nums.push(single);
    } else if (parts.length >= 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          nums.push(i);
        }
      }
    }
    return nums;
  };

  const loadBibleData = async (bookName: string, chapterNum: string, verseRange: string) => {
    setLoading(true);
    setStatusMessage(`Memuat Alkitab ${bookName} ${chapterNum}...`);
    setBibleLoadError(null);
    setLoadedBibleChapter(null);
    setBibleViewMode(true);

    const book = findBook(bookName);
    if (!book) {
      setBibleLoadError(`Kitab "${bookName}" tidak ditemukan.`);
      setLoading(false);
      return;
    }

    const bookId = book.id;
    const chap = parseInt(chapterNum, 10) || 1;

    // Parse verses to highlight
    const highlightNums = parseVerseNumbers(verseRange);
    setHighlightedVerses(highlightNums);

    // 1. Try local fetch first
    try {
      const res = await fetch(`/bible/ind_ayt/${bookId}/${chap}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.chapter) {
          setLoadedBibleChapter(data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to load local bible, trying R2...", err);
    }

    // 2. Try R2 second (via local API proxy to bypass CORS/Adblockers on mobile)
    try {
      const res = await fetch(`/api/backup?file=bible/ind_ayt/${bookId}/${chap}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.chapter) {
          setLoadedBibleChapter(data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to load bible from R2:", err);
    }

    // 3. Both failed
    setBibleLoadError("Gagal memuat ayat secara langsung. Silakan gunakan link Halaman Khusus Alkitab di bawah ini.");
    setLoading(false);
  };


  // Loading states
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // R2 Public URL configuration
  const APP_URL = "https://www.gracedaily.my.id";

  // Detect user context — Telegram WebApp vs PWA/browser fallback
  useEffect(() => {
    const detect = () => {
      const twa = window.Telegram?.WebApp;

      if (twa && twa.initData && twa.initData.length > 0) {
        // Running inside Telegram Mini App
        twa.ready();
        twa.expand();
        const u = twa.initDataUnsafe?.user;
        setTgContext({
          source: "telegram",
          user: u
            ? {
                id: u.id,
                name: [u.first_name, u.last_name].filter(Boolean).join(" "),
                username: u.username,
              }
            : null,
        });
      } else {
        // Running as PWA / browser / APK wrapper — no Telegram context
        setTgContext({ source: "pwa", user: null });
      }
    };

    // SDK may already be loaded (via layout Script beforeInteractive)
    if (window.Telegram?.WebApp !== undefined) {
      detect();
    } else {
      // Fallback: wait a short tick then detect
      const t = setTimeout(detect, 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Fetch Devotions index
  const loadDevotions = async () => {
    if (devotions.length > 0) return;
    setLoading(true);
    setStatusMessage("Memuat daftar renungan...");
    try {
      const res = await fetch(`/api/backup?file=backup/renungan.json`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (Array.isArray(data)) {
        const formatted = data.map((d: any) => ({
          id: d.id || d.dateId || "",
          title: d.title || "Renungan Harian",
          verseRef: d.verseRef,
          verseText: d.verseText,
          dateId: d.dateId || d.id
        }));
        // Sort newest first
        formatted.sort((a, b) => String(b.dateId).localeCompare(String(a.dateId)));
        setDevotions(formatted);
      }
    } catch (err) {
      console.error("Failed to load devotions from R2:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Articles index
  const loadArticles = async () => {
    if (articles.length > 0) return;
    setLoading(true);
    setStatusMessage("Memuat daftar artikel...");
    try {
      const res = await fetch(`/api/backup?file=backup/blog_posts.json`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (Array.isArray(data)) {
        const formatted = data.map((a: any) => ({
          id: a.slug || a.id || "",
          title: a.title || "Artikel Baru",
          category: a.category || "Umum",
          excerpt: a.excerpt
        }));
        setArticles(formatted);
      }
    } catch (err) {
      console.error("Failed to load articles from R2:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Encyclopedia Category index
  const loadEncyclopediaCategory = async (cat: string) => {
    setLoading(true);
    setStatusMessage(`Memuat ensiklopedia kategori ${cat}...`);
    try {
      const res = await fetch(`/api/backup?file=backup/${cat}.json`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (Array.isArray(data)) {
        const formatted = data.map((e: any) => ({
          id: e.id,
          keyword: e.keyword,
          kategori: e.kategori || cat,
          slug: e.slug || "",
          title: e.title
        }));
        setEncyclopediaEntries(formatted);
      } else {
        setEncyclopediaEntries([]);
      }
    } catch (err) {
      console.error(`Failed to load encyclopedia for ${cat}:`, err);
      setEncyclopediaEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Main Category Change
  const handleMainCategoryChange = (val: string) => {
    setSelectedMainCategory(val);
    if (val === "renungan") {
      loadDevotions();
    } else if (val === "artikel") {
      loadArticles();
    } else if (val === "ensiklopedia") {
      loadEncyclopediaCategory(selectedEnsiCategory);
    }
  };

  // Handle Encyclopedia Category Change
  const handleEnsiCategoryChange = (val: string) => {
    setSelectedEnsiCategory(val);
    loadEncyclopediaCategory(val);
  };

  // Open Link in Telegram In-App Browser or Natively for Telegram links
  const openInApp = (url: string) => {
    if (url.startsWith("https://t.me/") && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  // Bible verse parsing regex
  const parsedBibleVerse = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const clean = searchQuery.trim();
    // Regex matches e.g. "Matius 1:2", "1 Yohanes 3:16", "Yoh 3:16-18", "Matius 1:2-4"
    const regex = /^((?:\d\s*)?[a-zA-Z\u00C0-\u024F]+(?:\s+[a-zA-Z\u00C0-\u024F]+)*)\s+(\d+)[:\s]+(\d+)(?:-(\d+))?$/i;
    const match = clean.match(regex);
    if (match) {
      return {
        book: match[1].trim(),
        chapter: parseInt(match[2]),
        verseStart: parseInt(match[3]),
        verseEnd: match[4] ? parseInt(match[4]) : undefined,
        rawString: clean
      };
    }
    return null;
  }, [searchQuery]);

  // Keyword search across devotions, articles and currently loaded encyclopedia category
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || parsedBibleVerse) return { devotions: [], articles: [], encyclopedia: [] };

    // Search devotions
    const matchedDevotions = devotions.filter(
      (d) =>
        d.title.toLowerCase().includes(query) ||
        (d.verseRef && d.verseRef.toLowerCase().includes(query)) ||
        (d.verseText && d.verseText.toLowerCase().includes(query))
    ).slice(0, 5);

    // Search articles
    const matchedArticles = articles.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query) ||
        (a.excerpt && a.excerpt.toLowerCase().includes(query))
    ).slice(0, 5);

    // Search loaded encyclopedia category
    const matchedEncyclopedia = encyclopediaEntries.filter(
      (e) =>
        e.keyword.toLowerCase().includes(query) ||
        (e.title && e.title.toLowerCase().includes(query))
    ).slice(0, 8);

    return {
      devotions: matchedDevotions,
      articles: matchedArticles,
      encyclopedia: matchedEncyclopedia
    };
  }, [searchQuery, devotions, articles, encyclopediaEntries, parsedBibleVerse]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col font-sans transition-colors duration-300 overflow-y-auto ${
      isDark ? "bg-slate-950 text-slate-100" : "bg-[#f7f4ee] text-[#1f2933]"
    }`}>
      {/* Header Banner */}
      <div className={`px-6 py-6 border-b transition-all duration-300 relative overflow-hidden shrink-0 ${
        isDark 
          ? "bg-gradient-to-r from-cyan-900 via-indigo-950 to-purple-950 border-indigo-900/40" 
          : "bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 border-teal-900/20"
      }`}>
        <div className={`absolute inset-0 pointer-events-none transition-all duration-300 ${
          isDark 
            ? "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent" 
            : "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-600/10 via-transparent to-transparent"
        }`}></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-purple-300">
              Grace Daily TMA
            </h1>
            {/* User greeting — shows Telegram user name or PWA indicator */}
            {tgContext?.source === "telegram" && tgContext.user && (
              <p className="text-xs text-emerald-300/90 mt-1 font-medium">
                👋 Halo, {tgContext.user.name}!
              </p>
            )}
            {tgContext?.source === "pwa" && (
              <p className="text-xs text-amber-300/80 mt-1">
                📱 Mode PWA
              </p>
            )}
            {!tgContext && (
              <p className="text-xs text-indigo-200/90 mt-1">
                Portal Rohani &amp; Pendalaman Alkitab Anda
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Sun / Moon Toggle Switch */}
            <button
              onClick={toggleTheme}
              className="relative flex items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 border border-white/10 cursor-pointer active:scale-90"
              title={isDark ? "Ganti ke Light Mode" : "Ganti ke Dark Mode"}
            >
              <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
                {/* Sun Icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className={`w-4.5 h-4.5 text-amber-300 absolute transition-all duration-500 transform ${
                    !isDark ? "translate-y-0 rotate-0 opacity-100" : "-translate-y-6 rotate-45 opacity-0"
                  }`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.97 4.97l1.41 1.41M17.62 17.62l1.41 1.41M3.75 12h2.25m12 0h2.25m-12.8-6.23l1.41-1.41m11.3 11.3l1.41 1.41M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" />
                </svg>
                {/* Moon Icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className={`w-4.5 h-4.5 text-indigo-200 absolute transition-all duration-500 transform ${
                    isDark ? "translate-y-0 rotate-0 opacity-100" : "translate-y-6 -rotate-45 opacity-0"
                  }`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              </div>
            </button>
            
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-slate-100 transition-all active:scale-95"
            >
              🏠 Beranda
            </Link>
            <span className="bg-indigo-500/25 border border-indigo-400/40 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest text-indigo-200">
              Mini App
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-md mx-auto w-full px-5 py-6 space-y-6">

        {/* PWA Fallback Banner — tampil jika tidak ada Telegram context */}
        {tgContext?.source === "pwa" && (
          <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${
            isDark
              ? "bg-gradient-to-br from-amber-900/20 to-orange-900/10 border-amber-700/30"
              : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">📱</span>
              <div>
                <p className={`text-sm font-bold ${ isDark ? "text-amber-300" : "text-amber-800" }`}>
                  Anda mengakses via Browser / PWA
                </p>
                <p className={`text-xs mt-1 leading-relaxed ${ isDark ? "text-amber-200/70" : "text-amber-700" }`}>
                  Fitur utama tetap tersedia penuh. Bergabunglah ke komunitas kami untuk mendapatkan renungan &amp; update terbaru.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => openInApp("https://www.whatsapp.com/channel/0029VbCUBJfG8l5A2qoOPN0w")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all active:scale-95 ${
                  isDark
                    ? "bg-green-900/30 border-green-700/30 text-green-300 hover:bg-green-900/50"
                    : "bg-green-100 border-green-300 text-green-800 hover:bg-green-200"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                Channel WA
              </button>
              <button
                onClick={() => openInApp("https://t.me/gracedailybible")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all active:scale-95 ${
                  isDark
                    ? "bg-sky-900/30 border-sky-700/30 text-sky-300 hover:bg-sky-900/50"
                    : "bg-sky-100 border-sky-300 text-sky-800 hover:bg-sky-200"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Channel Telegram
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xl transition-all duration-300 ${
          isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-[#dfd8ca]"
        }`}>
          <label className={`block text-xs font-semibold uppercase tracking-widest mb-2 transition-colors ${
            isDark ? "text-slate-400" : "text-teal-850"
          }`}>
            Pencarian Cepat & Deteksi Ayat
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              className={`w-full border rounded-xl py-3 pl-11 pr-4 text-sm transition-all focus:outline-none focus:ring-2 ${
                isDark 
                  ? "bg-slate-950 border-slate-800/80 text-slate-100 placeholder:text-slate-500 focus:ring-cyan-500 focus:border-transparent" 
                  : "bg-white border-[#dfd8ca] text-[#1f2933] placeholder:text-gray-400 focus:ring-teal-650 focus:border-transparent"
              }`}
              placeholder='Cari "Musa" atau ketik "Yohanes 3:16"'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Quick Help / Info */}
          <p className={`text-[11px] mt-2 italic transition-colors ${
            isDark ? "text-slate-500" : "text-teal-700/80"
          }`}>
            Format deteksi ayat: nama kitab diikuti pasal:ayat (misal: Matius 1:2)
          </p>
        </div>

        {/* Dynamic Search Results & Auto-parsed Bible Verses */}
        {searchQuery.trim() !== "" && (
          <div className="space-y-4">
            {/* Auto-parsed Bible Verse Section */}
            {parsedBibleVerse && (
              <div className={`border rounded-2xl p-4 shadow-lg animate-pulse-slow transition-all duration-300 ${
                isDark ? "bg-gradient-to-br from-indigo-950/80 to-cyan-950/70 border-cyan-500/30" : "bg-gradient-to-br from-teal-50/50 to-emerald-50/30 border-teal-500/20"
              }`}>
                <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md">
                  Deteksi Alkitab Otomatis
                </span>
                <h3 className={`text-lg font-bold mt-2 ${isDark ? "text-slate-100" : "text-black"}`}>
                  {parsedBibleVerse.book} {parsedBibleVerse.chapter}:{parsedBibleVerse.verseStart}
                  {parsedBibleVerse.verseEnd ? `-${parsedBibleVerse.verseEnd}` : ""}
                </h3>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-350" : "text-gray-600"}`}>
                  Mendeteksi pencarian referensi ayat Alkitab. Ketuk tombol untuk membaca ayat lengkap.
                </p>
                <div className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={() => {
                      const verseRange = parsedBibleVerse.verseStart.toString() + (parsedBibleVerse.verseEnd ? `-${parsedBibleVerse.verseEnd}` : "");
                      loadBibleData(parsedBibleVerse.book, parsedBibleVerse.chapter.toString(), verseRange);
                    }}
                    className={`w-full font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 ${
                      isDark 
                        ? "bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950" 
                        : "bg-gradient-to-r from-teal-600 to-emerald-650 hover:from-teal-500 hover:to-emerald-600 text-white"
                    }`}
                  >
                    📖 Baca langsung di Mini App
                  </button>
                  {/* New Dedicated Bible Page Link replacing alkitab.me */}
                  <Link
                    href={`/telegram-miniapp/alkitab?book=${encodeURIComponent(parsedBibleVerse.book)}&chapter=${parsedBibleVerse.chapter}&verse=${parsedBibleVerse.verseStart}${parsedBibleVerse.verseEnd ? `-${parsedBibleVerse.verseEnd}` : ""}`}
                    className={`w-full font-semibold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95 text-center flex items-center justify-center border ${
                      isDark 
                        ? "bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-750" 
                        : "bg-white border-[#dfd8ca] text-teal-850 hover:bg-[#fffdf8]"
                    }`}
                  >
                    📖 Buka Halaman Khusus Alkitab
                  </Link>
                </div>
              </div>
            )}

            {/* Keyword Search Results */}
            {!parsedBibleVerse && (
              <div className="space-y-4">
                {searchResults.devotions.length === 0 &&
                searchResults.articles.length === 0 &&
                searchResults.encyclopedia.length === 0 ? (
                  <div className={`border rounded-2xl py-8 text-center ${isDark ? "bg-slate-900/30 border-slate-800/40" : "bg-white border-gray-200"}`}>
                    <p className="text-sm text-slate-400">Tidak ada hasil yang cocok.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Devotions Results */}
                    {searchResults.devotions.length > 0 && (
                      <div className={`border rounded-2xl p-4 space-y-2.5 ${isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-[#dfd8ca]"}`}>
                        <h4 className="text-xs font-bold text-cyan-500 uppercase tracking-wider">
                          🌅 Renungan Harian
                        </h4>
                        <div className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-gray-100"}`}>
                          {searchResults.devotions.map((d) => (
                            <div
                              key={d.id}
                              onClick={() => openInApp(`${APP_URL}/renungan/${d.id}`)}
                              className={`py-2 cursor-pointer group transition-colors ${isDark ? "hover:text-cyan-300" : "hover:text-teal-600"}`}
                            >
                              <div className={`text-sm font-semibold transition-colors ${isDark ? "text-slate-200 group-hover:text-cyan-300" : "text-slate-900 group-hover:text-teal-600"}`}>
                                {d.title}
                              </div>
                              {d.verseRef && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Ayat: {d.verseRef}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Articles Results */}
                    {searchResults.articles.length > 0 && (
                      <div className={`border rounded-2xl p-4 space-y-2.5 ${isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-[#dfd8ca]"}`}>
                        <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                          ✍️ Artikel Blog
                        </h4>
                        <div className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-gray-100"}`}>
                          {searchResults.articles.map((a) => (
                            <div
                              key={a.id}
                              onClick={() => openInApp(`${APP_URL}/blog/${a.id}`)}
                              className={`py-2 cursor-pointer group transition-colors ${isDark ? "hover:text-indigo-300" : "hover:text-teal-600"}`}
                            >
                              <div className={`text-sm font-semibold transition-colors ${isDark ? "text-slate-200 group-hover:text-indigo-300" : "text-slate-900 group-hover:text-teal-600"}`}>
                                {a.title}
                              </div>
                              <span className={`inline-block text-[9px] border rounded px-1.5 py-0.2 mt-1 ${isDark ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-350" : "bg-teal-50 border-teal-100 text-teal-700"}`}>
                                {a.category}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Encyclopedia Results */}
                    {searchResults.encyclopedia.length > 0 && (
                      <div className={`border rounded-2xl p-4 space-y-2.5 ${isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-[#dfd8ca]"}`}>
                        <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                          📚 Ensiklopedia Alkitab
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {searchResults.encyclopedia.map((e) => (
                            <div
                              key={e.slug}
                              onClick={() => openInApp(`${APP_URL}/ensiklopedia/${e.kategori}/${e.slug}`)}
                              className={`border rounded-xl p-2.5 cursor-pointer transition-all text-left ${
                                isDark 
                                  ? "bg-slate-950 border-slate-800/60 hover:border-amber-500/30 text-slate-300" 
                                  : "bg-white border-gray-250 hover:border-teal-400 text-teal-850"
                              }`}
                            >
                              <div className="text-xs font-bold truncate">
                                {e.title || e.keyword}
                              </div>
                              <div className="text-[10px] text-gray-500 capitalize mt-1">
                                {e.kategori.replace(/-/g, " ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Category Dropdown Selection */}
        <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xl space-y-4 transition-all duration-300 ${
          isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-[#dfd8ca]"
        }`}>
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-widest mb-2 transition-colors ${
              isDark ? "text-slate-400" : "text-teal-850"
            }`}>
              Pilih Kategori Utama
            </label>
            <select
              className={`w-full border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 transition-all ${
                isDark 
                  ? "bg-slate-950 border-slate-800/80 text-slate-100 focus:ring-cyan-500" 
                  : "bg-white border-[#dfd8ca] text-[#1f2933] focus:ring-teal-650"
              }`}
              value={selectedMainCategory}
              onChange={(e) => handleMainCategoryChange(e.target.value)}
            >
              <option value="">-- Pilih Fitur Menu --</option>
              <option value="renungan">📖 Renungan Harian</option>
              <option value="artikel">✍️ Artikel Blog</option>
              <option value="ensiklopedia">📚 Ensiklopedia Alkitab</option>
              {/* Form Alkitab changed to Alkitab */}
              <option value="alkitab">📜 Alkitab</option>
            </select>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-center space-x-3 py-2 text-slate-450 text-xs italic">
              <span className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></span>
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Form conditional rendering based on selected Category */}

          {/* 1. Renungan Harian List */}
          {selectedMainCategory === "renungan" && !loading && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-cyan-500 uppercase tracking-wider">
                🌅 Daftar Renungan Terbaru
              </h4>
              {devotions.length === 0 ? (
                <p className="text-xs text-slate-500">Tidak ada data renungan.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {devotions.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => openInApp(`${APP_URL}/renungan/${d.id}`)}
                      className={`border rounded-xl p-3 cursor-pointer transition-all text-left ${
                        isDark 
                          ? "bg-slate-950 border-slate-800/60 hover:border-cyan-500/20 hover:bg-slate-900/30" 
                          : "bg-white border-[#dfd8ca] hover:border-teal-500/30 hover:bg-[#fffdf8]"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-[#1f2933]"}`}>{d.title}</div>
                      {d.verseRef && (
                        <div className={`text-[11px] font-semibold mt-1 ${isDark ? "text-cyan-400/80" : "text-teal-755"}`}>
                          📖 {d.verseRef}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Artikel Blog List */}
          {selectedMainCategory === "artikel" && !loading && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                ✍️ Artikel Blog Terbaru
              </h4>
              {articles.length === 0 ? (
                <p className="text-xs text-slate-500">Tidak ada artikel blog.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {articles.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => openInApp(`${APP_URL}/blog/${a.id}`)}
                      className={`border rounded-xl p-3 cursor-pointer transition-all text-left ${
                        isDark 
                          ? "bg-slate-950 border-slate-800/60 hover:border-indigo-500/20 hover:bg-slate-900/30" 
                          : "bg-white border-[#dfd8ca] hover:border-teal-500/30 hover:bg-[#fffdf8]"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-[#1f2933]"}`}>{a.title}</div>
                      <span className={`inline-block text-[9px] border rounded px-1.5 py-0.2 mt-1 ${isDark ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-350" : "bg-teal-50 border-teal-100 text-teal-700"}`}>
                        {a.category}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Ensiklopedia Form Selection */}
          {selectedMainCategory === "ensiklopedia" && (
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                📚 Form Ensiklopedia Alkitab
              </h4>
              <div>
                <label className={`block text-[11px] font-semibold uppercase mb-1.5 ${isDark ? "text-slate-450" : "text-teal-850"}`}>
                  Pilih Sub Kategori
                </label>
                <select
                  className={`w-full border rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 ${
                    isDark 
                      ? "bg-slate-950 border-slate-800/80 text-slate-200 focus:ring-amber-500" 
                      : "bg-white border-[#dfd8ca] text-[#1f2933] focus:ring-teal-600"
                  }`}
                  value={selectedEnsiCategory}
                  onChange={(e) => handleEnsiCategoryChange(e.target.value)}
                >
                  {ENCYCLOPEDIA_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {!loading && (
                <div className="space-y-2">
                  <label className={`block text-[11px] font-semibold uppercase ${isDark ? "text-slate-450" : "text-teal-850"}`}>
                    Daftar Topik ({selectedEnsiCategory})
                  </label>
                  {encyclopediaEntries.length === 0 ? (
                    <p className="text-xs text-slate-550">Tidak ada topik tersedia dalam kategori ini.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                      {encyclopediaEntries.map((e) => (
                        <div
                          key={e.slug}
                          onClick={() => openInApp(`${APP_URL}/ensiklopedia/${selectedEnsiCategory}/${e.slug}`)}
                          className={`border rounded-xl p-2 cursor-pointer transition-all text-left truncate text-xs font-semibold ${
                            isDark 
                              ? "bg-slate-950 border-slate-800/60 hover:border-amber-500/20 text-slate-300" 
                              : "bg-white border-[#dfd8ca] hover:border-teal-500/20 text-teal-850"
                          }`}
                        >
                          {e.keyword}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. Alkitab Form Selection */}
          {selectedMainCategory === "alkitab" && (
            <div className="space-y-4 pt-2">
              {/* Form Ayat Alkitab renamed to Alkitab */}
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-teal-400" : "text-teal-800"}`}>
                📜 Alkitab
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className={`block text-[11px] font-semibold uppercase mb-1.5 ${isDark ? "text-slate-450" : "text-teal-850"}`}>
                    Nama Kitab
                  </label>
                  <select
                    className={`w-full border rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:ring-1 ${
                      isDark 
                        ? "bg-slate-950 border-slate-800/80 text-slate-200 focus:ring-teal-500" 
                        : "bg-white border-[#dfd8ca] text-[#1f2933] focus:ring-teal-600"
                    }`}
                    value={selectedBook}
                    onChange={(e) => setSelectedBook(e.target.value)}
                  >
                    {BIBLE_BOOKS.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-semibold uppercase mb-1.5 ${isDark ? "text-slate-450" : "text-teal-850"}`}>
                      Pasal
                    </label>
                    <input
                      type="number"
                      min="1"
                      className={`w-full border rounded-xl py-2 px-3 text-xs placeholder:text-slate-600 focus:outline-none focus:ring-1 ${
                        isDark 
                          ? "bg-slate-950 border-slate-800/80 text-slate-100 focus:ring-teal-500" 
                          : "bg-white border-[#dfd8ca] text-[#1f2933] focus:ring-teal-605"
                      }`}
                      value={chapter}
                      onChange={(e) => setChapter(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-semibold uppercase mb-1.5 ${isDark ? "text-slate-450" : "text-teal-850"}`}>
                      Ayat
                    </label>
                    <input
                      type="text"
                      className={`w-full border rounded-xl py-2 px-3 text-xs placeholder:text-slate-600 focus:outline-none focus:ring-1 ${
                        isDark 
                          ? "bg-slate-950 border-slate-800/80 text-slate-100 focus:ring-teal-500" 
                          : "bg-white border-[#dfd8ca] text-[#1f2933] focus:ring-teal-605"
                      }`}
                      value={verse}
                      onChange={(e) => setVerse(e.target.value)}
                      placeholder="1-2"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => loadBibleData(selectedBook, chapter, verse)}
                    className={`w-full font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 ${
                      isDark 
                        ? "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950" 
                        : "bg-gradient-to-r from-teal-600 to-emerald-650 hover:from-teal-500 hover:to-emerald-600 text-white"
                    }`}
                  >
                    📖 Baca di Mini App
                  </button>
                  {/* Link to dedicated Bible page replacing alkitab.me */}
                  <Link
                    href={`/telegram-miniapp/alkitab?book=${encodeURIComponent(selectedBook)}&chapter=${chapter}&verse=${verse}`}
                    className={`w-full font-semibold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95 text-center flex items-center justify-center border ${
                      isDark 
                        ? "bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-750" 
                        : "bg-white border-[#dfd8ca] text-teal-850 hover:bg-[#fffdf8]"
                    }`}
                  >
                    📖 Buka Halaman Khusus Alkitab
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bible Reader Container */}
        {bibleViewMode && (
          <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xl space-y-4 transition-all duration-300 ${
            isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-[#dfd8ca]"
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? "border-slate-800/60" : "border-gray-255"}`}>
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-teal-400" : "text-teal-800"}`}>
                <span>📖 Pembaca Alkitab (AYT)</span>
              </h3>
              <button
                onClick={() => {
                  setBibleViewMode(false);
                  setLoadedBibleChapter(null);
                  setBibleLoadError(null);
                }}
                className={`text-xs transition-colors ${isDark ? "text-slate-400 hover:text-slate-200" : "text-gray-500 hover:text-black"}`}
              >
                Tutup ✕
              </button>
            </div>

            {loading && (
              <div className="flex items-center space-x-3 py-4 text-slate-450 text-xs italic">
                <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></span>
                <span>{statusMessage}</span>
              </div>
            )}

            {bibleLoadError && (
              <div className="space-y-3">
                <p className="text-xs text-red-400">{bibleLoadError}</p>
                {/* Replaced alkitab.me fallback with dedicated page */}
                <Link
                  href={`/telegram-miniapp/alkitab?book=${encodeURIComponent(selectedBook)}&chapter=${chapter}&verse=${verse}`}
                  className={`w-full text-center flex items-center justify-center font-semibold py-2 px-3 rounded-xl text-xs transition-all active:scale-95 border ${
                    isDark 
                      ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750" 
                      : "bg-white border-gray-300 text-teal-850 hover:bg-gray-50"
                  }`}
                >
                  📖 Buka Halaman Khusus Alkitab
                </Link>
              </div>
            )}

            {loadedBibleChapter && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className={`text-base font-bold ${isDark ? "text-slate-100" : "text-black"}`}>
                    {loadedBibleChapter.book?.name} {loadedBibleChapter.chapter?.number}
                  </h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${isDark ? "text-slate-500 bg-slate-950 border-slate-800" : "text-gray-600 bg-gray-50 border-gray-200"}`}>
                    AYT
                  </span>
                </div>

                <div className={`max-h-80 overflow-y-auto space-y-3 pr-1 custom-scrollbar text-sm leading-relaxed ${
                  isDark ? "text-slate-300" : "text-gray-800"
                }`}>
                  {loadedBibleChapter.chapter?.content?.map((item: any, idx: number) => {
                    if (item.type === "heading") {
                      return (
                        <h5 key={idx} className={`font-bold pt-3 border-b pb-1 mt-2 ${
                          isDark ? "text-slate-200 border-slate-800/40" : "text-black border-gray-200"
                        }`}>
                          {item.content?.join(" ")}
                        </h5>
                      );
                    }
                    if (item.type === "verse") {
                      const isHighlighted = highlightedVerses.includes(Number(item.number));
                      const text = extractBibleText(item.content);
                      return (
                        <p
                          key={idx}
                          className={`py-1.5 px-2.5 rounded transition-colors ${
                            isHighlighted
                              ? isDark
                                ? "bg-teal-500/10 border-l-2 border-teal-500 text-slate-100 font-medium"
                                : "bg-teal-50/70 border-l-2 border-teal-600 text-black font-semibold"
                              : isDark
                                ? "hover:bg-slate-800/30"
                                : "hover:bg-gray-50"
                          }`}
                        >
                          <sup className={`text-[10px] font-bold mr-2 ${isDark ? "text-teal-400" : "text-teal-650"}`}>{item.number}</sup>
                          {text}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>

                {/* Added Button to open the dedicated Bible page at the bottom of the container */}
                <div className={`pt-3 border-t ${isDark ? "border-slate-800" : "border-gray-200"} mt-2`}>
                  <Link
                    href={`/telegram-miniapp/alkitab?book=${encodeURIComponent(loadedBibleChapter.book?.name || selectedBook)}&chapter=${loadedBibleChapter.chapter?.number || chapter}&verse=${verse}`}
                    className={`w-full text-center flex items-center justify-center font-bold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95 border ${
                      isDark 
                        ? "bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 border-transparent hover:from-teal-400 hover:to-emerald-500" 
                        : "bg-teal-600 hover:bg-teal-700 text-white border-transparent"
                    }`}
                  >
                    📖 Buka Halaman Khusus Alkitab (Lengkap)
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Telegram Community Info */}
        <div className={`border text-center rounded-2xl p-4 transition-all duration-300 ${
          isDark ? "bg-slate-900/30 border-slate-800/40" : "bg-white border-[#dfd8ca]/60 shadow-sm"
        }`}>
          <h4 className={`text-xs font-semibold uppercase tracking-widest mb-1 ${isDark ? "text-indigo-400" : "text-teal-850"}`}>
            Bergabung dengan Komunitas
          </h4>
          <p className={`text-[11px] mb-3 ${isDark ? "text-slate-400" : "text-gray-650"}`}>
            Dapatkan renungan, artikel baru, dan ensiklopedia ter-update otomatis di grup dan channel.
          </p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => openInApp("https://t.me/gracedailybible")}
              className={`border text-xs px-3.5 py-1.5 rounded-lg transition-all font-semibold active:scale-95 ${
                isDark 
                  ? "bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20" 
                  : "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100"
              }`}
            >
              📢 Channel @gracedailybible
            </button>
            <button
              onClick={() => openInApp("https://t.me/+AFZz3BmnrF85Mjk1")}
              className={`border text-xs px-3.5 py-1.5 rounded-lg transition-all font-semibold active:scale-95 ${
                isDark 
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20" 
                  : "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100"
              }`}
            >
              💬 Group Community
            </button>
          </div>
        </div>
      </div>

      {/* Styles for custom scrollbars */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDark ? "rgba(15, 23, 42, 0.3)" : "rgba(223, 216, 202, 0.3)"};
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark ? "rgba(99, 102, 241, 0.3)" : "rgba(42, 111, 111, 0.3)"};
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? "rgba(99, 102, 241, 0.6)" : "rgba(42, 111, 111, 0.6)"};
        }
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.85;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
