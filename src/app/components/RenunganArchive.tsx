"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

type Devotion = {
  id: string;
  title: string;
  title_en?: string;
  title_zh?: string;
  verseRef: string;
  verseText: string;
  dateId: string;
  imageUrl: string;
  illustrationUrl: string;
  bannerUrl: string;
};

interface RenunganArchiveProps {
  devotions: Devotion[];
}

function parseDevotionDate(dateId: string, language: string) {
  const match = dateId.match(/^(?:golden-)?(\d{4})-(\d{2})-(\d{2})-(\d{2})$/);
  
  const monthsDict: Record<string, string[]> = {
    id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    zh: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
  };
  const monthsList = monthsDict[language] || monthsDict.id;

  const daysDict: Record<string, string[]> = {
    id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
    en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    zh: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
  };
  const daysOfWeek = daysDict[language] || daysDict.id;

  if (!match) {
    const simpleMatch = dateId.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (simpleMatch) {
      const [_, yearStr, monthStr, dayStr] = simpleMatch;
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const day = parseInt(dayStr);
      const monthName = monthsList[month - 1] || monthsList[0];
      return {
        year,
        month,
        day,
        hour: 0,
        monthName,
        yearStr,
        formattedDate: language === "zh"
          ? `${yearStr}年${monthName}${day}日`
          : language === "en"
          ? `${monthName} ${day}, ${yearStr}`
          : `${day} ${monthName} ${yearStr}`
      };
    }

    return {
      year: 2026,
      month: 6,
      day: 9,
      hour: 5,
      formattedDate: dateId,
      monthName: monthsList[5],
      yearStr: "2026"
    };
  }
  const [_, yearStr, monthStr, dayStr, hourStr] = match;
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);
  const hour = parseInt(hourStr);

  const monthName = monthsList[month - 1] || monthsList[0];
  
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = daysOfWeek[dateObj.getDay()] || "";

  const formattedDate = language === "zh"
    ? `${yearStr}年${monthName}${day}日`
    : language === "en"
    ? `${dayOfWeek ? dayOfWeek + ", " : ""}${monthName} ${day}, ${yearStr}`
    : `${dayOfWeek ? dayOfWeek + ", " : ""}${day} ${monthName} ${yearStr}`;

  return {
    year,
    month,
    day,
    hour,
    monthName,
    yearStr,
    formattedDate
  };
}

export function RenunganArchive({ devotions }: RenunganArchiveProps) {
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const queryParam = searchParams ? searchParams.get("q") || "" : "";
  const yearParam = searchParams ? searchParams.get("year") || "all" : "all";
  const monthParam = searchParams ? searchParams.get("month") || "all" : "all";

  const [searchQuery, setSearchQuery] = useState<string>(queryParam);
  const [selectedYear, setSelectedYear] = useState<string>(yearParam);
  const [selectedMonth, setSelectedMonth] = useState<string>(monthParam);
  const [displayLimit, setDisplayLimit] = useState<number>(30);
  const [translatedDevotionsMap, setTranslatedDevotionsMap] = useState<Record<string, { title: string }>>({});
  const [prevLanguage, setPrevLanguage] = useState(language);

  if (language !== prevLanguage) {
    setPrevLanguage(language);
    setTranslatedDevotionsMap({});
  }

  const getDevotionTitle = (d: Devotion) => {
    const mapped = translatedDevotionsMap[d.id];
    if (mapped?.title) return mapped.title;
    if (language === "en" && d.title_en) return d.title_en;
    if (language === "zh" && d.title_zh) return d.title_zh;
    return d.title;
  };

  const monthsList = language === "zh"
    ? ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]
    : language === "en"
    ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    : ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const MONTHS = monthsList.map((label, idx) => ({
    key: (idx + 1).toString(),
    label
  }));

  const tLocal = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      archiveTitle: { id: "Arsip Renungan Harian", en: "Daily Devotions Archive", zh: "每日灵修存档" },
      devotionHeader: { id: "Renungan Harian", en: "Daily Devotion", zh: "每日灵修" },
      backToHome: { id: "Kembali ke Beranda", en: "Back to Home", zh: "返回首页" },
      home: { id: "Beranda", en: "Home", zh: "首页" },
      archiveTitleBreadcrumb: { id: "Arsip Renungan", en: "Archive", zh: "存档" },
      searchTitle: { id: "Cari Renungan", en: "Search Devotions", zh: "搜索灵修" },
      searchPlaceholder: { id: "Cari judul, ayat, atau tanggal...", en: "Search title, verse, or date...", zh: "搜索标题、经文或日期..." },
      cancel: { id: "Batal", en: "Cancel", zh: "取消" },
      filterYear: { id: "Filter Tahun", en: "Filter Year", zh: "按年份筛选" },
      allYears: { id: "Semua Tahun", en: "All Years", zh: "全部年份" },
      yearLabel: { id: "Tahun", en: "Year", zh: "年" },
      filterMonth: { id: "Filter Bulan", en: "Filter Month", zh: "按月份筛选" },
      allMonths: { id: "Semua Bulan", en: "All Months", zh: "全部月份" },
      renunganCount: { id: "renungan", en: "devotions", zh: "篇灵修" },
      loadMore: { id: "Muat Lebih Banyak", en: "Load More", zh: "加载更多" },
      itemRemaining: { id: "item lagi", en: "items left", zh: "个剩余项目" },
      notFoundTitle: { id: "Renungan tidak ditemukan", en: "Devotions not found", zh: "未找到灵修" },
      notFoundDesc: { id: "Tidak ada renungan harian yang sesuai dengan kata kunci pencarian atau filter Anda.", en: "No daily devotions match your search keywords or filters.", zh: "没有符合您搜索关键字或筛选条件的每日灵修。" },
    };
    return dict[key]?.[language] || dict[key]?.id || key;
  };

  // Reset display limit when filter or search changes
  useEffect(() => {
    setDisplayLimit(30);
  }, [searchQuery, selectedYear, selectedMonth]);

  // Extract unique years from the data
  const uniqueYears = useMemo(() => {
    const years = devotions.map((d) => parseDevotionDate(d.dateId, language).yearStr);
    return Array.from(new Set(years)).sort((a, b) => b.localeCompare(a));
  }, [devotions, language]);

  // Filter items based on search and selected year/month
  const filteredDevotions = useMemo(() => {
    return devotions.filter((d) => {
      const dateInfo = parseDevotionDate(d.dateId, language);
      const devotionTitle = getDevotionTitle(d);
      
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = devotionTitle.toLowerCase().includes(q);
        const matchesVerseRef = d.verseRef.toLowerCase().includes(q);
        const matchesDate = dateInfo.formattedDate.toLowerCase().includes(q);
        if (!matchesTitle && !matchesVerseRef && !matchesDate) {
          return false;
        }
      }

      // Filter by year
      if (selectedYear !== "all" && dateInfo.yearStr !== selectedYear) {
        return false;
      }

      // Filter by month
      if (selectedMonth !== "all" && dateInfo.month.toString() !== selectedMonth) {
        return false;
      }

      return true;
    });
  }, [devotions, searchQuery, selectedYear, selectedMonth, language]);

  // Limit display items for pagination
  const paginatedDevotions = useMemo(() => {
    return filteredDevotions.slice(0, displayLimit);
  }, [filteredDevotions, displayLimit]);

  // Group paginated items by Month + Year for "Daftar Isi" style display
  const groupedDevotions = useMemo(() => {
    const groups: Record<string, Devotion[]> = {};
    const sortedGroupKeys: string[] = [];

    paginatedDevotions.forEach((d) => {
      const dateInfo = parseDevotionDate(d.dateId, language);
      const groupKey = language === "zh"
        ? `${dateInfo.yearStr}年 ${dateInfo.monthName}`
        : `${dateInfo.monthName} ${dateInfo.yearStr}`;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
        sortedGroupKeys.push(groupKey);
      }
      groups[groupKey].push(d);
    });

    return {
      groups,
      sortedGroupKeys,
      totalCount: filteredDevotions.length,
      hasMore: filteredDevotions.length > displayLimit,
    };
  }, [paginatedDevotions, filteredDevotions, displayLimit, language]);

  const loadMore = () => {
    setDisplayLimit((prev) => prev + 30);
  };

  useEffect(() => {
    if (language === "id") {
      setTranslatedDevotionsMap({});
      return;
    }

    let active = true;
    async function translateVisibleDevotions() {
      for (const d of paginatedDevotions) {
        const hasTitle = language === "en" ? !!d.title_en : !!d.title_zh;
        let title = language === "en" ? d.title_en : d.title_zh;

        if (!hasTitle && !translatedDevotionsMap[d.id]) {
          try {
            const response = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: d.title || "",
                to: language,
                type: "devotion",
                id: d.id
              })
            });

            if (response.ok && active) {
              const resData = await response.json();
              const translatedTitle = resData.translated || d.title;
              setTranslatedDevotionsMap((prev) => ({
                ...prev,
                [d.id]: {
                  title: translatedTitle
                }
              }));
            }
          } catch (err) {
            console.error("Failed to translate listing devotion:", d.id, err);
          }
        }
      }
    }

    translateVisibleDevotions();
    return () => {
      active = false;
    };
  }, [language, paginatedDevotions]);

  // Schema.org Breadcrumb JSON-LD
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.gracedaily.my.id";
  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": tLocal("home"),
        "item": `${siteUrl}/`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": tLocal("archiveTitle"),
        "item": `${siteUrl}/renungan`
      }
    ]
  };

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] px-5 py-8 text-[#1f2933] sm:px-8">
        <div className="mx-auto max-w-7xl animate-pulse">
          <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
            <div>
              <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 w-64 bg-gray-200 rounded"></div>
            </div>
            <div className="h-10 w-36 bg-gray-200 rounded"></div>
          </header>
          <div className="mt-8 space-y-4">
            <div className="h-32 bg-white border border-[#dfd8ca] rounded-2xl p-6">
              <div className="h-6 w-1/4 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-8 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              {tLocal("devotionHeader")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              {tLocal("archiveTitle")}
            </h1>
          </div>
          <Link href="/" className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white hover:bg-[#1a2e56] transition-colors">
            {tLocal("backToHome")}
          </Link>
        </header>

        <div className="w-full mt-6">
          {/* Schema.org BreadcrumbList */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
          />

          {/* Breadcrumb Navigation UI */}
          <nav className="flex items-center gap-2 text-xs font-semibold text-[#52606d] uppercase tracking-wider mb-6">
            <Link href="/" className="hover:text-[#2a6f6f] transition-colors">
              {tLocal("home")}
            </Link>
            <span>/</span>
            <span className="text-[#2a6f6f]">{tLocal("archiveTitleBreadcrumb")}</span>
          </nav>

      {/* Filter and Search Panel */}
      <div className="mb-8 rounded-2xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          
          {/* Search Box */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#52606d] mb-2" htmlFor="search-input">
              {tLocal("searchTitle")}
            </label>
            <div className="relative">
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tLocal("searchPlaceholder")}
                className="w-full rounded-lg border border-[#dfd8ca] bg-[#f7f4ee]/30 px-10 py-2.5 text-sm text-[#1f2933] outline-none transition-all focus:border-[#2a6f6f] focus:bg-white"
              />
              <span className="absolute left-3.5 top-3 text-gray-400 text-sm">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-2.5 text-xs font-semibold text-gray-400 hover:text-[#2a6f6f]"
                >
                  {tLocal("cancel")}
                </button>
              )}
            </div>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#52606d] mb-2" htmlFor="year-select">
              {tLocal("filterYear")}
            </label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full rounded-lg border border-[#dfd8ca] bg-[#f7f4ee]/30 px-3 py-2.5 text-sm text-[#1f2933] outline-none transition-all focus:border-[#2a6f6f] focus:bg-white cursor-pointer"
            >
              <option value="all">{tLocal("allYears")}</option>
              {uniqueYears.map((y) => (
                <option key={y} value={y}>
                  {language === "zh" ? `${y} ${tLocal("yearLabel")}` : `${tLocal("yearLabel")} ${y}`}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#52606d] mb-2" htmlFor="month-select">
              {tLocal("filterMonth")}
            </label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-lg border border-[#dfd8ca] bg-[#f7f4ee]/30 px-3 py-2.5 text-sm text-[#1f2933] outline-none transition-all focus:border-[#2a6f6f] focus:bg-white cursor-pointer"
            >
              <option value="all">{tLocal("allMonths")}</option>
              {MONTHS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          
        </div>
      </div>

      {/* Devotion List View */}
      {groupedDevotions.totalCount > 0 ? (
        <div className="flex flex-col gap-8">
          {groupedDevotions.sortedGroupKeys.map((groupName) => (
            <div key={groupName} className="rounded-2xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#2a6f6f] border-b border-[#dfd8ca] pb-3 mb-4 flex items-center justify-between">
                <span>📅 {groupName}</span>
                <span className="text-xs font-semibold bg-[#2a6f6f]/10 text-[#2a6f6f] px-2.5 py-1 rounded-full">
                  {groupedDevotions.groups[groupName].length} {tLocal("renunganCount")}
                </span>
              </h3>
              
              {/* Encyclopedia-like Directory List */}
              <div className="divide-y divide-[#dfd8ca]/40">
                {groupedDevotions.groups[groupName].map((devotion) => {
                  const dateInfo = parseDevotionDate(devotion.dateId, language);
                  const devotionTitle = getDevotionTitle(devotion);

                  return (
                    <div key={devotion.id} className="py-3.5 group">
                      <Link
                        href={`/renungan/${devotion.id}`}
                        className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 group"
                      >
                        {/* Date Label */}
                        <span className="text-xs font-semibold text-[#52606d] bg-[#f7f4ee] border border-[#dfd8ca]/70 px-2.5 py-1 rounded text-center sm:text-left shrink-0 sm:w-44">
                          {dateInfo.formattedDate.replace(` ${dateInfo.yearStr}`, "").replace(`年`, "")}
                        </span>
                        
                        {/* Title & Verse Info Container */}
                        <div className="flex flex-col min-w-0 grow">
                          <span className="text-sm font-bold text-[#14213d] group-hover:text-[#2a6f6f] transition-colors leading-relaxed">
                            {devotionTitle}
                          </span>
                          {devotion.verseRef && (
                            <span className="text-xs text-gray-500 italic mt-1.5 group-hover:text-[#2a6f6f]/80 transition-colors leading-relaxed line-clamp-2 sm:line-clamp-1">
                              📖 {devotion.verseRef}
                            </span>
                          )}
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {groupedDevotions.hasMore && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={loadMore}
                className="rounded-lg border border-[#2a6f6f] bg-white px-8 py-3 text-sm font-semibold text-[#2a6f6f] transition duration-300 hover:bg-[#2a6f6f] hover:text-white shadow-sm cursor-pointer"
              >
                {tLocal("loadMore")} ({filteredDevotions.length - displayLimit} {tLocal("itemRemaining")})
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#dfd8ca] bg-white p-12 text-center text-[#52606d]">
          <span className="text-3xl block mb-3">🔍</span>
          <p className="font-semibold text-lg text-[#14213d] mb-1">{tLocal("notFoundTitle")}</p>
          <p className="text-sm">{tLocal("notFoundDesc")}</p>
        </div>
      )}
        </div>
      </div>
    </main>
  );
}
