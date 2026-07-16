"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

type Post = {
  id: string;
  title: string;
  title_en?: string;
  title_zh?: string;
  excerpt?: string;
  excerpt_en?: string;
  excerpt_zh?: string;
  imageUrl?: string;
  category?: string;
  createdAt?: any;
};

type BlogListingProps = {
  initialPosts: Post[];
  allCategories: string[];
};

export default function BlogListing({ initialPosts, allCategories }: BlogListingProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryFilter = searchParams?.get("category");
  const { t, language } = useLanguage();

  const monthLabels = language === "zh"
    ? ["所有月份","一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"]
    : language === "en"
    ? ["All Months","January","February","March","April","May","June","July","August","September","October","November","December"]
    : ["Semua Bulan","Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  const MONTH_VALUES = ["", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
  const MONTH_NAMES = MONTH_VALUES.map((val, idx) => ({
    value: val,
    label: monthLabels[idx]
  }));

  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [translatedPostsMap, setTranslatedPostsMap] = useState<Record<string, { title: string; excerpt: string }>>({});
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getPostTitle = (post: Post) => {
    const mapped = translatedPostsMap[post.id];
    if (mapped?.title) return mapped.title;
    if (language === "en" && post.title_en) return post.title_en;
    if (language === "zh" && post.title_zh) return post.title_zh;
    return post.title;
  };

  const getPostExcerpt = (post: Post) => {
    const mapped = translatedPostsMap[post.id];
    if (mapped?.excerpt) return mapped.excerpt;
    if (language === "en" && post.excerpt_en) return post.excerpt_en;
    if (language === "zh" && post.excerpt_zh) return post.excerpt_zh;
    return post.excerpt;
  };

  const getPostImageUrl = (post: Post, activeTitle: string, activeExcerpt: string) => {
    if (!post.imageUrl) return "";
    if (post.imageUrl.includes("/api/admin/generate-image")) {
      try {
        const urlObj = new URL(post.imageUrl, window.location.origin);
        urlObj.searchParams.set("title", activeTitle);
        if (activeExcerpt) {
          urlObj.searchParams.set("description", activeExcerpt.slice(0, 220));
        }
        return urlObj.pathname + urlObj.search;
      } catch (e) {
        return post.imageUrl;
      }
    }
    return post.imageUrl;
  };


  const getCategoryLabel = (catName?: string) => {
    if (!catName) return "";
    const cleanCat = catName.trim().toLowerCase();
    const map: Record<string, Record<string, string>> = {
      "renungan": { id: "Renungan", en: "Devotion", zh: "灵修" },
      "kajian": { id: "Kajian", en: "Study", zh: "研经" },
      "artikel": { id: "Artikel", en: "Article", zh: "文章" },
      "teologi": { id: "Teologi", en: "Theology", zh: "神学" },
      "renungan harian": { id: "Renungan Harian", en: "Daily Devotion", zh: "每日灵修" },
      "doa": { id: "Doa", en: "Prayer", zh: "祷告" },
      "keluarga": { id: "Keluarga", en: "Family", zh: "家庭" },
      "kesaksian": { id: "Kesaksian", en: "Testimony", zh: "见证" },
      "bible study": { id: "Bible Study", en: "Bible Study", zh: "查经" },
      "bible studi": { id: "Bible Study", en: "Bible Study", zh: "查经" }
    };
    return map[cleanCat]?.[language] || catName;
  };

  const uniqueYears = useMemo(() => {
    const years = new Set<number>();
    initialPosts.forEach((post) => {
      if (post.createdAt) {
        const d = new Date(post.createdAt);
        if (!isNaN(d.getTime())) {
          years.add(d.getFullYear());
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [initialPosts]);

  // Set category in URL helper
  const setSelectedCategory = (cat: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (cat) {
      params.set("category", cat);
    } else {
      params.delete("category");
    }
    router.push(`/blog?${params.toString()}`);
  };

  // Web Speech API Voice Search Helper
  function startVoiceSearch() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(
        language === "zh"
          ? "您的浏览器不直接支持语音转文字功能（特别是社交媒体内置浏览器）。请在 Safari (iOS) 或 Chrome (Android) 中打开此网站以使用语音搜索功能。"
          : language === "en"
          ? "Your browser does not directly support Voice-to-Text features (especially social media in-app browsers). Please open this website in Safari (iOS) or Chrome (Android) to use voice search."
          : "Browser Anda tidak mendukung fitur Voice to Text secara langsung (terutama in-app browser media sosial). Silakan buka website ini di Safari (iOS) or Chrome (Android) untuk menggunakan fitur pencarian suara."
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      
      let errorMsg = language === "zh" ? `录音失败 (错误: ${event.error})。` : language === "en" ? `Failed to record voice (Error: ${event.error}).` : `Gagal merekam suara (Error: ${event.error}).`;
      if (event.error === "not-allowed") {
        errorMsg = language === "zh"
          ? "麦克风访问被拒绝。请在设备/应用设置中为此浏览器启用麦克风权限。"
          : language === "en"
          ? "Microphone access denied. Please enable microphone permission for this browser in your device/app settings."
          : "Izin akses mikrofon ditolak. Silakan aktifkan izin mikrofon untuk browser ini di pengaturan perangkat/aplikasi Anda.";
      } else if (event.error === "no-speech") {
        errorMsg = language === "zh"
          ? "未检测到声音。请再试一次。"
          : language === "en"
          ? "No speech detected. Please try again."
          : "Tidak ada suara yang terdeteksi. Silakan coba lagi.";
      } else if (event.error === "audio-capture") {
        errorMsg = language === "zh"
          ? "未找到麦克风设备。"
          : language === "en"
          ? "Microphone device not found."
          : "Perangkat mikrofon tidak ditemukan.";
      } else if (event.error === "network") {
        errorMsg = language === "zh"
          ? "网络连接中断。"
          : language === "en"
          ? "Network connection interrupted."
          : "Koneksi jaringan terputus.";
      } else if (event.error === "service-not-allowed") {
        errorMsg = language === "zh"
          ? "听写服务未被允许。请在设备的键盘设置中启用听写 (Dictation) 功能。"
          : language === "en"
          ? "Dictation service not allowed. Please enable the Dictation feature in your device's keyboard settings."
          : "Layanan dikte tidak diizinkan. Silakan aktifkan fitur Dikte (Dictation) di pengaturan keyboard perangkat Anda.";
      }
      alert(errorMsg);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setSearchQuery(speechToText);
    };

    recognition.start();
  }

  // Filter posts based on Category, Search Query, and Date
  const filteredPosts = initialPosts.filter((post) => {
    const matchesCategory = !categoryFilter || post.category === categoryFilter;
    const activeTitle = getPostTitle(post);
    const activeExcerpt = getPostExcerpt(post) ?? "";
    const matchesSearch =
      !searchQuery.trim() ||
      activeTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activeExcerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.category && post.category.toLowerCase().includes(searchQuery.toLowerCase()));

    // Date filtering
    let matchesDate = true;
    if (post.createdAt) {
      const d = new Date(post.createdAt);
      if (!isNaN(d.getTime())) {
        if (selectedDay && d.getDate() !== parseInt(selectedDay, 10)) {
          matchesDate = false;
        }
        if (selectedMonth && d.getMonth() !== parseInt(selectedMonth, 10)) {
          matchesDate = false;
        }
        if (selectedYear && d.getFullYear() !== parseInt(selectedYear, 10)) {
          matchesDate = false;
        }
      } else {
        if (selectedDay || selectedMonth || selectedYear) {
          matchesDate = false;
        }
      }
    } else {
      if (selectedDay || selectedMonth || selectedYear) {
        matchesDate = false;
      }
    }

    return matchesCategory && matchesSearch && matchesDate;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const POSTS_PER_PAGE = 30;

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery, selectedDay, selectedMonth, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  useEffect(() => {
    if (language === "id") {
      setTranslatedPostsMap({});
      return;
    }

    let active = true;
    async function translateVisiblePosts() {
      for (const post of paginatedPosts) {
        const hasTitle = language === "en" ? !!post.title_en : !!post.title_zh;
        const hasExcerpt = language === "en" ? !!post.excerpt_en : !!post.excerpt_zh;
        
        let title = language === "en" ? post.title_en : post.title_zh;
        let excerpt = language === "en" ? post.excerpt_en : post.excerpt_zh;

        if (!hasTitle || !hasExcerpt) {
          try {
            const toTranslate = [
              !hasTitle ? (post.title || "") : "",
              !hasExcerpt ? (post.excerpt || "") : ""
            ].filter(Boolean);

            const response = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: toTranslate,
                to: language,
                type: "blog",
                id: post.id
              })
            });

            if (response.ok && active) {
              const resData = await response.json();
              const translatedList = resData.translated || [];
              let listIdx = 0;
              if (!hasTitle) {
                title = translatedList[listIdx];
                listIdx++;
              }
              if (!hasExcerpt) {
                excerpt = translatedList[listIdx];
              }

              setTranslatedPostsMap((prev) => ({
                ...prev,
                [post.id]: {
                  title: title || post.title,
                  excerpt: excerpt || post.excerpt || ""
                }
              }));
            }
          } catch (err) {
            console.error("Failed to translate listing post:", post.id, err);
          }
        }
      }
    }

    translateVisiblePosts();
    return () => {
      active = false;
    };
  }, [language, currentPage, categoryFilter, searchQuery, selectedDay, selectedMonth, selectedYear]);


  if (!isMounted) {
    return (
      <div className="space-y-6">
        <div className="py-10 text-[#52606d] italic">
          Memuat...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-[#dfd8ca] pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
            {t("blog.page_title")}
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[#14213d] sm:text-5xl">
            {t("blog.page_subtitle")}
          </h1>
        </div>
        <Link
          href="/"
          className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white transition hover:bg-[#1a2d52] self-start"
        >
          {t("blog.back_home")}
        </Link>
      </header>

      {/* Search Input with Voice to Text & Date Filters */}
      <div className="space-y-3">
        <div className="flex max-w-lg gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("blog.search_placeholder")}
              className="w-full rounded-md border border-[#dfd8ca] bg-white py-3 pl-4 pr-10 text-sm text-[#1f2933] outline-none focus:border-[#2a6f6f]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-3.5 text-gray-400 hover:text-[#1f2933]"
                title="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 11-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={startVoiceSearch}
            className={`rounded-md px-4 py-3 border border-[#dfd8ca] font-semibold text-sm flex items-center gap-1.5 transition ${
              isListening
                ? "bg-red-100 text-red-700 border-red-300 animate-pulse"
                : "bg-white text-[#14213d] hover:bg-gray-50"
            }`}
            title={language === "zh" ? "语音搜索" : language === "en" ? "Voice Search" : "Cari dengan Suara (Voice Search)"}
          >
            <span>🎙️</span>
            <span className="hidden sm:inline">
              {isListening 
                ? (language === "zh" ? "正在聆听..." : language === "en" ? "Listening..." : "Mendengarkan...") 
                : (language === "zh" ? "语音搜索" : language === "en" ? "Voice Search" : "Cari Suara")}
            </span>
          </button>
        </div>

        {/* Date Filter Selectors */}
        <div className="flex flex-wrap gap-2 items-center text-sm">
          {/* Day Select */}
          <div className="relative">
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="appearance-none rounded-md border border-[#dfd8ca] bg-white py-2 pl-3 pr-8 text-xs font-semibold text-[#14213d] outline-none focus:border-[#2a6f6f] cursor-pointer"
            >
              <option value="">{language === "zh" ? "所有日期" : language === "en" ? "All Dates" : "Semua Tanggal"}</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Month Select */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none rounded-md border border-[#dfd8ca] bg-white py-2 pl-3 pr-8 text-xs font-semibold text-[#14213d] outline-none focus:border-[#2a6f6f] cursor-pointer"
            >
              {MONTH_NAMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Year Select */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none rounded-md border border-[#dfd8ca] bg-white py-2 pl-3 pr-8 text-xs font-semibold text-[#14213d] outline-none focus:border-[#2a6f6f] cursor-pointer"
            >
              <option value="">{language === "zh" ? "所有年份" : language === "en" ? "All Years" : "Semua Tahun"}</option>
              {uniqueYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Reset Button */}
          {(selectedDay || selectedMonth || selectedYear) && (
            <button
              onClick={() => {
                setSelectedDay("");
                setSelectedMonth("");
                setSelectedYear("");
              }}
              className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 transition"
              title={language === "zh" ? "重置日期筛选" : language === "en" ? "Reset date filter" : "Reset filter tanggal"}
            >
              {t("blog.reset_filter")}
            </button>
          )}
        </div>
      </div>

      {/* Category Navigation Bar (Horizontal scroll on mobile) */}
      <div 
        className="mb-8 flex overflow-x-auto gap-2 border-b border-[#dfd8ca] pb-4 -mx-5 px-5 sm:mx-0 sm:px-0 scrollbar-thin"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        <button
          onClick={() => setSelectedCategory(null)}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition ${
            !categoryFilter
              ? "bg-[#2a6f6f] text-white"
              : "border border-[#dfd8ca] bg-white text-[#334155] hover:bg-gray-50"
          }`}
        >
          {t("blog.all_topics")}
        </button>
        {allCategories.map((cat) => (
          <button
            onClick={() => setSelectedCategory(cat)}
            key={cat}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition ${
              categoryFilter === cat
                ? "bg-[#2a6f6f] text-white"
                : "border border-[#dfd8ca] bg-white text-[#334155] hover:bg-gray-50"
            }`}
          >
            {getCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Articles View (Neat Title List when filtered, Grid Cards when not) */}
      {filteredPosts.length === 0 ? (
        <p className="text-lg text-[#52606d] italic">{t("blog.no_results")}</p>
      ) : categoryFilter ? (
        /* Neat List of Article Titles when Category is Selected */
        <div className="rounded-2xl border border-[#dfd8ca] bg-white p-6 shadow-sm max-w-4xl">
          <h2 className="text-2xl font-semibold text-[#14213d] mb-6 flex items-center gap-2">
            <span className="h-6 w-1 rounded-full bg-[#2a6f6f]" />
            {t("blog.category_list")} <span className="text-[#2a6f6f]">{getCategoryLabel(categoryFilter || "")}</span>
          </h2>
          <div className="divide-y divide-[#dfd8ca]/60">
            {paginatedPosts.map((post) => {
              const date = post.createdAt 
                ? new Intl.DateTimeFormat(
                    language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID",
                    { dateStyle: "medium", timeZone: "Asia/Jakarta" }
                  ).format(new Date(post.createdAt))
                : (language === "zh" ? "刚刚" : language === "en" ? "Just now" : "Baru saja");
              const title = getPostTitle(post);
              const excerpt = getPostExcerpt(post);
              return (
                <div key={post.id} className="py-4 first:pt-0 last:pb-0 group">
                  <Link href={`/blog/${post.id}`} className="block">
                    <span className="text-xs text-[#52606d] font-semibold">{date}</span>
                    <h3 className="mt-1 text-lg font-semibold text-[#14213d] group-hover:text-[#2a6f6f] transition">
                      {title}
                    </h3>
                    {excerpt && (
                      <p className="mt-1 text-sm text-[#52606d] line-clamp-2 leading-relaxed">{excerpt}</p>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Grid Card Previews on Blog Home Index */
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedPosts.map((post) => {
            const title = getPostTitle(post);
            const excerpt = getPostExcerpt(post);
            return (
              <Link
                href={`/blog/${post.id}`}
                key={post.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-[#dfd8ca] bg-white shadow-sm transition hover:shadow-md"
              >
                {post.imageUrl ? (
                  <img
                    src={getPostImageUrl(post, title, excerpt || "")}
                    alt={title}
                    className="h-48 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-48 w-full flex-col items-center justify-center bg-[#102c3a] gap-2">
                    <img src="/logo.png" alt="Logo" className="h-12 w-12 rounded-full object-cover border border-[#ffd166]/30" />
                    <span className="text-sm font-bold uppercase tracking-widest text-[#ffd166]">Grace Daily</span>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#2a6f6f]">{getCategoryLabel(post.category)}</p>
                  <h2 className="mt-3 text-xl font-semibold leading-tight text-[#14213d] group-hover:text-[#2a6f6f]">{title}</h2>
                  {excerpt && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#52606d]">{excerpt}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6">
          <button
            onClick={() => {
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={currentPage === 1}
            className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-xs font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition disabled:opacity-50 disabled:hover:bg-white"
          >
            {t("blog.prev")}
          </button>
          
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#52606d]">
            <span>{t("blog.page_label")}</span>
            <span className="text-[#14213d] font-bold">{currentPage}</span>
            <span>{t("blog.of_label")}</span>
            <span className="text-[#14213d] font-bold">{totalPages}</span>
          </div>

          <button
            onClick={() => {
              setCurrentPage((p) => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={currentPage === totalPages}
            className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-xs font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition disabled:opacity-50 disabled:hover:bg-white"
          >
            {t("blog.next")}
          </button>
        </div>
      )}
    </div>
  );
}
