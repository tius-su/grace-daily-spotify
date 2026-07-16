"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

type Article = {
  id: string;
  title: string;
  title_en?: string;
  title_zh?: string;
  slug: string;
  kategori: string;
  summary: string;
  bannerUrl: string;
  illustrationUrl: string;
  updatedAt: string;
};

interface DaftarIsiProps {
  initialArticles: Article[];
}

const CATEGORIES = [
  { key: "tokoh", label: "Tokoh", icon: "📖" },
  { key: "tempat", label: "Tempat", icon: "📍" },
  { key: "kamus", label: "Kamus Istilah", icon: "📚" },
  { key: "mukjizat", label: "Mukjizat", icon: "🔥" },
  { key: "perumpamaan", label: "Perumpamaan", icon: "📜" },
  { key: "kitab", label: "Kitab", icon: "📕" },
  { key: "kronologi", label: "Kronologi", icon: "🕰️" },
  { key: "silsilah", label: "Silsilah", icon: "👨‍👩‍👧‍👦" },
  { key: "teologi", label: "Teologi", icon: "⛪" },
  { key: "teologi-2", label: "Teologi 2", icon: "⛪" },
  { key: "topikal_alkitab", label: "Topikal Alkitab", icon: "📖" },
  { key: "peristiwa", label: "Peristiwa", icon: "🎭" },
  { key: "peristiwa-2", label: "Peristiwa 2", icon: "🎭" },
];

export function DaftarIsi({ initialArticles }: DaftarIsiProps) {
  const searchParams = useSearchParams();
  const queryParam = searchParams ? searchParams.get("q") || "" : "";
  const categoryParam = searchParams ? searchParams.get("category") || searchParams.get("cat") || "tokoh" : "tokoh";
  const { language } = useLanguage();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [searchQuery, setSearchQuery] = useState<string>(queryParam);
  const [displayLimit, setDisplayLimit] = useState<number>(30);
  const [expandedMobileCategories, setExpandedMobileCategories] = useState<Record<string, boolean>>({
    [categoryParam]: true,
  });

  const [translatedArticlesMap, setTranslatedArticlesMap] = useState<Record<string, { title: string }>>({});

  const getArticleTitle = (article: Article) => {
    const mapped = translatedArticlesMap[article.id];
    if (mapped?.title) return mapped.title;
    if (language === "en" && article.title_en) return article.title_en;
    if (language === "zh" && article.title_zh) return article.title_zh;
    return article.title;
  };

  const getCategoryLabel = (key: string) => {
    const map: Record<string, Record<string, string>> = {
      tokoh: { id: "Tokoh", en: "People/Characters", zh: "人物" },
      tempat: { id: "Tempat", en: "Places", zh: "地点" },
      kamus: { id: "Kamus Istilah", en: "Dictionary/Terms", zh: "词汇字典" },
      mukjizat: { id: "Mukjizat", en: "Miracles", zh: "神迹" },
      perumpamaan: { id: "Perumpamaan", en: "Parables", zh: "比喻" },
      kitab: { id: "Kitab", en: "Books of the Bible", zh: "书卷" },
      kronologi: { id: "Kronologi", en: "Chronology", zh: "年代记" },
      silsilah: { id: "Silsilah", en: "Genealogy", zh: "家谱" },
      teologi: { id: "Teologi", en: "Theology", zh: "神学" },
      "teologi-2": { id: "Teologi 2", en: "Theology 2", zh: "神学 2" },
      topikal_alkitab: { id: "Topikal Alkitab", en: "Biblical Topics", zh: "圣经主题" },
      peristiwa: { id: "Peristiwa", en: "Events", zh: "事件" },
      "peristiwa-2": { id: "Peristiwa 2", en: "Events 2", zh: "事件 2" },
    };
    return map[key]?.[language] || key;
  };

  // Reset display limit when category changes
  useEffect(() => {
    setDisplayLimit(30);
  }, [selectedCategory]);



  // Statistics: Dynamic count per category
  const stats = useMemo(() => {
    const counts: Record<string, number> = {
      tokoh: 0,
      tempat: 0,
      kamus: 0,
      mukjizat: 0,
      perumpamaan: 0,
      kitab: 0,
      kronologi: 0,
      silsilah: 0,
      teologi: 0,
      "teologi-2": 0,
      topikal_alkitab: 0,
      peristiwa: 0,
      "peristiwa-2": 0,
    };
    initialArticles.forEach((article) => {
      if (counts[article.kategori] !== undefined) {
        counts[article.kategori]++;
      }
    });
    return counts;
  }, [initialArticles]);

  // Handle mobile accordion toggle
  const toggleMobileCategory = (categoryKey: string) => {
    setExpandedMobileCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }));
    setSelectedCategory(categoryKey);
  };

  // Filter and sort items for the selected category (normal view)
  const categoryArticles = useMemo(() => {
    return initialArticles.filter((a) => a.kategori === selectedCategory);
  }, [initialArticles, selectedCategory]);

  // Cross-category search articles
  const searchFilteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return initialArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        (a.title_en && a.title_en.toLowerCase().includes(query)) ||
        (a.title_zh && a.title_zh.toLowerCase().includes(query)) ||
        a.summary.toLowerCase().includes(query) ||
        a.kategori.toLowerCase().includes(query)
    );
  }, [initialArticles, searchQuery]);

  const visibleArticles = useMemo(() => {
    const sorted = [...categoryArticles].sort((a, b) =>
      a.title.localeCompare(b.title, "id")
    );
    return sorted.slice(0, displayLimit);
  }, [categoryArticles, displayLimit]);

  const visibleSearchArticles = useMemo(() => {
    return searchFilteredArticles.slice(0, 50);
  }, [searchFilteredArticles]);

  const visibleIdsStr = useMemo(() => {
    const list = searchQuery.trim() ? visibleSearchArticles : visibleArticles;
    return list.map((a) => a.id).join(",");
  }, [visibleArticles, visibleSearchArticles, searchQuery]);

  useEffect(() => {
    if (language === "id") {
      if (Object.keys(translatedArticlesMap).length > 0) {
        setTranslatedArticlesMap({});
      }
      return;
    }

    let active = true;
    const articlesToTranslate = searchQuery.trim() ? visibleSearchArticles : visibleArticles;

    async function translateVisibleArticles() {
      for (const a of articlesToTranslate) {
        const hasTitle = language === "en" ? !!a.title_en : !!a.title_zh;
        let title = language === "en" ? a.title_en : a.title_zh;

        if (!hasTitle && !translatedArticlesMap[a.id]) {
          try {
            const response = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: a.title || "",
                to: language,
                type: "encyclopedia",
                id: a.id
              })
            });

            if (response.ok && active) {
              const resData = await response.json();
              const translatedTitle = resData.translated || a.title;
              setTranslatedArticlesMap((prev) => ({
                ...prev,
                [a.id]: {
                  title: translatedTitle
                }
              }));
            }
          } catch (err) {
            console.error("Failed to translate listing article:", a.id, err);
          }
        }
      }
    }

    translateVisibleArticles();
    return () => {
      active = false;
    };
  }, [language, visibleIdsStr]);

  // Normal view grouping and sorting with localeCompare
  const sortedAndGrouped = useMemo(() => {
    // Sort alphabetically by original title (stable, prevents layout shift & translation feedback loops)
    const sorted = [...categoryArticles].sort((a, b) =>
      a.title.localeCompare(b.title, "id")
    );

    const totalCount = sorted.length;
    const paginated = sorted.slice(0, displayLimit);

    // Group by first letter of original title
    const grouped = paginated.reduce((acc, item) => {
      const firstChar = item.title.charAt(0).toUpperCase();
      const groupKey = /[A-Z]/.test(firstChar) ? firstChar : "#";
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, Article[]>);

    // Sort the group keys (letters A-Z)
    const sortedGroupKeys = Object.keys(grouped).sort((a, b) =>
      a.localeCompare(b, "id")
    );

    return {
      grouped,
      sortedGroupKeys,
      totalCount,
      hasMore: totalCount > displayLimit,
    };
  }, [categoryArticles, displayLimit]);

  const loadMore = () => {
    setDisplayLimit((prev) => prev + 30);
  };

  // Schema.org Breadcrumb JSON-LD
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.gracedaily.my.id";
  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Beranda",
        "item": `${siteUrl}/`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Ensiklopedia",
        "item": `${siteUrl}/ensiklopedia`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Daftar Isi",
        "item": `${siteUrl}/ensiklopedia?tab=daftar-isi`
      }
    ]
  };

  if (!isMounted) {
    return (
      <div className="w-full animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded mb-6"></div>
        <div className="mb-8 rounded-2xl border border-[#dfd8ca] bg-white p-6 md:p-8 shadow-sm">
          <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-full bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Schema.org BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />

      {/* Breadcrumb Navigation UI */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-[#52606d] uppercase tracking-wider mb-6">
        <Link href="/" className="hover:text-[#2a6f6f] transition-colors">
          {language === "zh" ? "首页" : language === "en" ? "Home" : "Beranda"}
        </Link>
        <span>/</span>
        <Link href="/ensiklopedia" className="hover:text-[#2a6f6f] transition-colors">
          {language === "zh" ? "百科全书" : language === "en" ? "Encyclopedia" : "Ensiklopedia"}
        </Link>
        <span>/</span>
        <span className="text-[#2a6f6f]">
          {language === "zh" ? "目录" : language === "en" ? "Index" : "Daftar Isi"}
        </span>
      </nav>

      {/* Hero Section */}
      <div className="mb-8 rounded-2xl border border-[#dfd8ca] bg-white p-6 md:p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-[#14213d] md:text-3xl">
          {language === "zh" ? "圣经百科全书目录" : language === "en" ? "Bible Encyclopedia Index" : "Daftar Isi Ensiklopedia Alkitab"}
        </h2>
        <p className="mt-2 text-sm text-[#52606d] md:text-base leading-relaxed">
          {language === "zh"
            ? "完整探索圣经人物、地点、词汇、神迹、比喻、书卷和年代记。"
            : language === "en"
            ? "Explore Bible characters, places, terms, miracles, parables, books, and chronology in full."
            : "Jelajahi tokoh, tempat, istilah, mukjizat, perumpamaan, kitab, dan kronologi Alkitab secara lengkap."}
        </p>

        {/* Real-time Search Bar */}
        <div className="mt-6">
          <label className="block text-sm font-bold text-[#2a6f6f] mb-2" htmlFor="index-search">
            {language === "zh" ? "快速搜索百科" : language === "en" ? "Quick Encyclopedia Search" : "Pencarian Cepat Ensiklopedia"}
          </label>
          <div className="relative max-w-xl">
            <input
              id="index-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === "zh"
                  ? "跨类别搜索... (例如：大卫，耶路撒冷，法利赛人)"
                  : language === "en"
                  ? "Search across categories... (e.g., David, Jerusalem, Pharisees)"
                  : "Cari lintas kategori... (misal: Daud, Yerusalem, Farisi)"
              }
              className="w-full rounded-md border border-[#dfd8ca] bg-[#f7f4ee] pl-10 pr-4 py-2.5 text-sm text-[#1f2933] outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2a6f6f] focus:bg-white"
            />
            <span className="absolute left-3.5 top-3 text-gray-400 text-sm">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-2.5 text-xs font-semibold text-gray-400 hover:text-[#2a6f6f]"
              >
                {language === "zh" ? "清除" : language === "en" ? "Clear" : "Hapus"}
              </button>
            )}
          </div>
        </div>
      </div>

      {searchQuery.trim() ? (
        /* SEARCH RESULTS VIEW */
        <div className="rounded-2xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-[#14213d] mb-4">
            {language === "zh"
              ? `搜索结果: `
              : language === "en"
              ? `Search Results: `
              : `Hasil Pencarian: `}
            <span className="text-[#2a6f6f]">
              {searchFilteredArticles.length}{" "}
              {language === "zh" ? "篇文章" : language === "en" ? "articles found" : "artikel ditemukan"}
            </span>
          </h3>

          {searchFilteredArticles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {searchFilteredArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/ensiklopedia/${encodeURIComponent(article.kategori)}/${encodeURIComponent(article.slug)}`}
                  className="group flex flex-col justify-between p-4 rounded-xl border border-[#dfd8ca] bg-[#f7f4ee]/35 transition-all duration-300 hover:bg-white hover:border-[#2a6f6f] hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#2a6f6f] bg-[#2a6f6f]/10 px-2.5 py-0.5 rounded-full">
                        {CATEGORIES.find((c) => c.key === article.kategori)?.icon}{" "}
                        {getCategoryLabel(article.kategori)}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-[#14213d] group-hover:text-[#2a6f6f] transition-colors">
                      {getArticleTitle(article)}
                    </h4>
                    <p className="mt-1.5 text-xs text-[#52606d] line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                  </div>
                  <span className="mt-3 text-xs font-semibold text-[#2a6f6f] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    {language === "zh" ? "阅读全文" : language === "en" ? "Read more" : "Baca selengkapnya"} <span>→</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#52606d]">
              {language === "zh" ? `没有找到与关键词 “${searchQuery}” 匹配的结果。请尝试其他词汇。` : language === "en" ? `No results matched the keyword "${searchQuery}". Try another term.` : `Tidak ada hasil yang cocok dengan kata kunci "${searchQuery}". Coba cari istilah lain.`}
            </div>
          )}
        </div>
      ) : (
        /* NORMAL CATEGORY / INDEX VIEW */
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* DESKTOP SIDEBAR (STICKY) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2a6f6f] mb-4">
                {language === "zh" ? "分类列表" : language === "en" ? "Category List" : "Daftar Kategori"}
              </h3>
              <div className="grid gap-2">
                {CATEGORIES.map((c) => {
                  const isActive = selectedCategory === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setSelectedCategory(c.key)}
                      className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                        isActive
                          ? "border-[#2a6f6f] bg-[#2a6f6f]/5 text-[#2a6f6f] shadow-sm font-bold"
                          : "border-[#dfd8ca] bg-[#f7f4ee]/30 text-[#52606d] hover:bg-[#dfd8ca]/20 hover:text-[#14213d]"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span>{c.icon}</span>
                        <span>{getCategoryLabel(c.key)}</span>
                      </span>
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 group-hover:bg-[#2a6f6f]/10 group-hover:text-[#2a6f6f] px-2 py-0.5 rounded-full">
                        {stats[c.key] || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* RIGHT CONTENT AREA & MOBILE ACCORDION */}
          <div className="flex flex-col gap-4">
            {/* MOBILE ACCORDIONS VIEW */}
            <div className="lg:hidden flex flex-col gap-3">
              {CATEGORIES.map((c) => {
                const isExpanded = !!expandedMobileCategories[c.key];
                const isActive = selectedCategory === c.key;
                return (
                  <div
                    key={c.key}
                    className={`rounded-xl border transition-all duration-300 bg-white ${
                      isActive ? "border-[#2a6f6f] shadow-sm" : "border-[#dfd8ca]"
                    }`}
                  >
                    {/* Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleMobileCategory(c.key)}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left font-bold text-[#14213d]"
                    >
                      <span className="flex items-center gap-2">
                        <span>{c.icon}</span>
                        <span>{getCategoryLabel(c.key)}</span>
                        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {stats[c.key] || 0}
                        </span>
                      </span>
                      <span className={`text-sm transform transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                        ▼
                      </span>
                    </button>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="border-t border-[#dfd8ca] p-4 bg-[#f7f4ee]/15">
                        {categoryArticles.length > 0 ? (
                          <div className="flex flex-col gap-6">
                            {sortedAndGrouped.sortedGroupKeys.map((letter) => (
                              <div key={letter} className="flex flex-col">
                                <h4 className="text-lg font-bold text-[#2a6f6f] border-b border-[#dfd8ca] pb-1 mb-2">
                                  {letter}
                                </h4>
                                <ul className="grid gap-2">
                                  {sortedAndGrouped.grouped[letter].map((article) => (
                                    <li key={article.id}>
                                      <Link
                                        href={`/ensiklopedia/${encodeURIComponent(article.kategori)}/${encodeURIComponent(article.slug)}`}
                                        className="inline-block py-1 text-sm font-semibold text-[#14213d] hover:text-[#2a6f6f] transition-colors"
                                      >
                                        • {getArticleTitle(article)}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}

                            {sortedAndGrouped.hasMore && (
                              <button
                                type="button"
                                onClick={loadMore}
                                className="w-full rounded-md border border-[#2a6f6f] bg-white py-2 text-center text-sm font-semibold text-[#2a6f6f] transition hover:bg-[#2a6f6f] hover:text-white"
                              >
                                {language === "zh" ? `加载更多 (还有 ${categoryArticles.length - displayLimit} 项)` : language === "en" ? `Load More (${categoryArticles.length - displayLimit} more)` : `Muat Lebih Banyak (${categoryArticles.length - displayLimit} item lagi)`}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-xs text-[#52606d]">
                            {language === "zh" ? "该分类下暂无文章。" : language === "en" ? "No articles in this category yet." : "Belum ada artikel dalam kategori ini."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DESKTOP CONTENT VIEW */}
            <div className="hidden lg:block rounded-2xl border border-[#dfd8ca] bg-white p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#dfd8ca] pb-4 mb-6">
                <h3 className="text-xl font-bold text-[#14213d]">
                  {language === "zh" ? "分类:" : language === "en" ? "Category:" : "Kategori:"} {getCategoryLabel(selectedCategory)}
                </h3>
                      <span className="text-xs font-semibold bg-[#2a6f6f]/10 px-2.5 py-1 rounded-full text-[#2a6f6f]">
                        Total: {categoryArticles.length} {language === "zh" ? "篇文章" : language === "en" ? "articles" : "artikel"}
                      </span>
              </div>

              {categoryArticles.length > 0 ? (
                <div className="flex flex-col gap-8">
                  {/* Grid of A-Z Groups */}
                  <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
                    {sortedAndGrouped.sortedGroupKeys.map((letter) => (
                      <div key={letter} className="flex flex-col">
                        <h4 className="text-xl font-extrabold text-[#2a6f6f] border-b-2 border-[#dfd8ca] pb-1 mb-3">
                          {letter}
                        </h4>
                        <ul className="flex flex-col gap-2">
                          {sortedAndGrouped.grouped[letter].map((article) => (
                            <li key={article.id} className="group">
                              <Link
                                href={`/ensiklopedia/${encodeURIComponent(article.kategori)}/${encodeURIComponent(article.slug)}`}
                                className="text-sm font-semibold text-[#14213d] group-hover:text-[#2a6f6f] transition-colors leading-relaxed"
                              >
                                {getArticleTitle(article)}
                              </Link>
                              {article.summary && (
                                <p className="text-xs text-gray-400 line-clamp-1 mt-0.5 font-normal">
                                  {article.summary}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Pagination trigger button */}
                  {sortedAndGrouped.hasMore && (
                    <div className="flex justify-center border-t border-[#dfd8ca] pt-6">
                      <button
                        type="button"
                        onClick={loadMore}
                        className="rounded-md border border-[#2a6f6f] bg-white px-6 py-2.5 text-sm font-semibold text-[#2a6f6f] transition-all duration-300 hover:bg-[#2a6f6f] hover:text-white hover:shadow-sm"
                      >
                        {language === "zh" ? `加载更多 (还有 ${categoryArticles.length - displayLimit} 项)` : language === "en" ? `Load More (${categoryArticles.length - displayLimit} more)` : `Muat Lebih Banyak (${categoryArticles.length - displayLimit} item lagi)`}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-[#52606d]">
                  {language === "zh" ? "该分类下暂无文章。" : language === "en" ? "No articles in this category yet." : "Belum ada artikel dalam kategori ini."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
