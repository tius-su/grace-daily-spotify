"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

type Article = {
  id: string;
  title: string;
  slug: string;
  kategori: string;
  summary: string;
};

interface EnsiklopediaPreviewProps {
  stats: Record<string, number>;
  sampleArticles: Article[];
}

export function EnsiklopediaPreview({ stats, sampleArticles }: EnsiklopediaPreviewProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"search" | "index">("search");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typingText, setTypingText] = useState<string>("");
  const [showSimulatedResult, setShowSimulatedResult] = useState<boolean>(true);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Categories are translated via t()
  const CATEGORIES = [
    { key: "tokoh", label: t("encyclopedia.cat_tokoh"), icon: "👤" },
    { key: "tempat", label: t("encyclopedia.cat_tempat"), icon: "📍" },
    { key: "kamus", label: language === "id" ? "Kamus Istilah" : language === "zh" ? "词汇表" : "Glossary", icon: "📚" },
    { key: "mukjizat", label: language === "id" ? "Mukjizat" : language === "zh" ? "神迹" : "Miracles", icon: "🔥" },
    { key: "perumpamaan", label: t("encyclopedia.cat_perumpamaan"), icon: "📜" },
    { key: "kitab", label: language === "id" ? "Kitab" : language === "zh" ? "圣经书卷" : "Books", icon: "📕" },
    { key: "kronologi", label: language === "id" ? "Kronologi" : language === "zh" ? "年表" : "Chronology", icon: "🕰️" },
  ];

  // Typing keywords based on language
  const keywords = language === "zh"
    ? ["耶路撒冷", "摩西", "法利赛人", "亚伯拉罕"]
    : language === "en"
    ? ["Jerusalem", "Moses", "Pharisees", "Abraham"]
    : ["Yerusalem", "Musa", "Farisi", "Abraham"];

  // Auto-typing simulation effect for "Pencarian" tab
  useEffect(() => {
    if (activeTab !== "search") {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      return;
    }

    let kwIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let currentWord = keywords[kwIndex];

    const type = () => {
      if (!isDeleting) {
        setTypingText(currentWord.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === currentWord.length) {
          isDeleting = true;
          setShowSimulatedResult(true);
          if (typingTimerRef.current) clearInterval(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => {
            typingTimerRef.current = setInterval(type, 100);
          }, 3000);
        }
      } else {
        setTypingText(currentWord.substring(0, charIndex - 1));
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          setShowSimulatedResult(false);
          kwIndex = (kwIndex + 1) % keywords.length;
          currentWord = keywords[kwIndex];
        }
      }
    };

    typingTimerRef.current = setInterval(type, 150);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [activeTab, language]);

  // Simulated results based on language
  const simulatedResults: Record<string, Record<string, { title: string; kategori: string; summary: string; slug: string }>> = {
    id: {
      yerusa: { title: "Yerusalem", kategori: "tempat", summary: "Kota suci kuno di pegunungan Yudea, tempat berdirinya Bait Allah.", slug: "yerusalem" },
      musa: { title: "Musa", kategori: "tokoh", summary: "Nabi besar pembebas bangsa Israel dari Mesir.", slug: "musa" },
      faris: { title: "Farisi", kategori: "kamus", summary: "Golongan keagamaan Yahudi yang menekankan ketaatan hukum Taurat.", slug: "farisi" },
      abra: { title: "Abraham", kategori: "tokoh", summary: "Bapa segala orang beriman yang menerima perjanjian abadi dengan Allah.", slug: "abraham" },
    },
    en: {
      jerusalem: { title: "Jerusalem", kategori: "tempat", summary: "Ancient holy city in the Judean highlands, home of the Temple of God.", slug: "yerusalem" },
      moses: { title: "Moses", kategori: "tokoh", summary: "Great prophet who liberated Israel from Egypt.", slug: "musa" },
      pharis: { title: "Pharisees", kategori: "kamus", summary: "Jewish religious group emphasizing strict observance of Mosaic Law.", slug: "farisi" },
      abra: { title: "Abraham", kategori: "tokoh", summary: "Father of all the faithful who received an eternal covenant with God.", slug: "abraham" },
    },
    zh: {
      耶路: { title: "耶路撒冷", kategori: "tempat", summary: "犹大山地的古老圣城，圣殿的所在地。", slug: "yerusalem" },
      摩西: { title: "摩西", kategori: "tokoh", summary: "带领以色列人出埃及的伟大先知。", slug: "musa" },
      法利: { title: "法利赛人", kategori: "kamus", summary: "强调严格遵守摩西律法的犹太宗教团体。", slug: "farisi" },
      亚伯: { title: "亚伯拉罕", kategori: "tokoh", summary: "所有信徒的父，与神立永约之人。", slug: "abraham" },
    },
  };

  const currentSimulatedArticle = useMemo(() => {
    const matched = sampleArticles.find(
      (a) => a.title.toLowerCase() === typingText.toLowerCase()
    );
    if (matched) return matched;

    const results = simulatedResults[language] || simulatedResults.id;
    for (const key of Object.keys(results)) {
      if (typingText.toLowerCase().includes(key.toLowerCase()) || typingText.includes(key)) {
        return results[key];
      }
    }
    return null;
  }, [typingText, sampleArticles, language]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/ensiklopedia?tab=search&q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const searchModeLabel = language === "zh" ? "🔍 搜索模式" : language === "en" ? "🔍 Search Mode" : "🔍 Mode Pencarian";
  const indexModeLabel = language === "zh" ? "📖 目录模式" : language === "en" ? "📖 Index Mode" : "📖 Mode Daftar Isi";
  const indexTitle = language === "zh" ? "人物 & 地点索引 (A-Z)" : language === "en" ? "Figures & Places Index (A-Z)" : "Indeks Tokoh & Tempat (A-Z)";
  const viewAllLabel = language === "zh" ? "查看完整目录 →" : language === "en" ? "View Full Index →" : "Buka Halaman Daftar Isi Lengkap →";
  const waitingLabel = language === "zh" ? "等待关键词..." : language === "en" ? "Waiting for keyword..." : "Menunggu kata kunci...";

  return (
    <div className="rounded-2xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
        {/* Left Side */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
            {t("encyclopedia.section_title")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#14213d] md:text-3xl">
            {language === "zh"
              ? "深度搜索与探索圣经术语"
              : language === "en"
              ? "Search & explore Bible terms in depth"
              : "Cari & telusuri istilah Alkitab lebih mendalam"}
          </h2>
          <p className="mt-3 text-sm text-[#52606d] leading-relaxed">
            {t("encyclopedia.section_subtitle")}
          </p>

          {/* Quick Search Input */}
          <form onSubmit={handleSearchSubmit} className="mt-6">
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("encyclopedia.search_placeholder")}
                className="flex-1 rounded-md border border-[#dfd8ca] bg-[#f7f4ee] px-3.5 py-2.5 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2a6f6f] focus:bg-white"
              />
              <button
                type="submit"
                className="rounded-md bg-[#2a6f6f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a4a4a] hover:shadow-sm"
              >
                {t("encyclopedia.search_button")}
              </button>
            </div>
          </form>

          {/* Quick Category Badges */}
          <div className="mt-6">
            <span className="text-xs font-bold text-[#2a6f6f] uppercase tracking-wider block mb-2.5">
              {t("encyclopedia.categories_label")}
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.slice(0, 4).map((c) => (
                <Link
                  key={c.key}
                  href={`/ensiklopedia?tab=index&category=${c.key}`}
                  className="group rounded-md border border-[#dfd8ca] bg-[#f7f4ee] px-3 py-1.5 text-xs font-semibold text-[#14213d] hover:bg-white hover:border-[#2a6f6f] transition-all duration-300"
                >
                  {c.icon} {c.label}{" "}
                  <span className="text-gray-400 group-hover:text-[#2a6f6f] font-normal">
                    ({stats[c.key] || 0})
                  </span>
                </Link>
              ))}
              <Link
                href="/ensiklopedia?tab=index"
                className="rounded-md border border-[#2a6f6f] bg-white px-3 py-1.5 text-xs font-semibold text-[#2a6f6f] hover:bg-[#2a6f6f] hover:text-white transition-all duration-300"
              >
                {t("encyclopedia.open_button")} →
              </Link>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Mockup */}
        <div className="rounded-xl border border-[#dfd8ca] bg-[#f7f4ee]/40 p-4 shadow-inner">
          <div className="flex gap-2 border-b border-[#dfd8ca] pb-3 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded transition-all duration-300 ${
                activeTab === "search"
                  ? "bg-white text-[#2a6f6f] shadow-sm"
                  : "text-[#52606d] hover:text-[#14213d]"
              }`}
            >
              {searchModeLabel}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("index")}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded transition-all duration-300 ${
                activeTab === "index"
                  ? "bg-white text-[#2a6f6f] shadow-sm"
                  : "text-[#52606d] hover:text-[#14213d]"
              }`}
            >
              {indexModeLabel}
            </button>
          </div>

          <div className="min-h-[175px] flex flex-col justify-between">
            {activeTab === "search" ? (
              <div className="flex flex-col gap-3">
                <div className="w-full bg-white border border-[#dfd8ca] rounded-md px-3 py-2 text-xs flex items-center justify-between text-gray-500 font-mono shadow-sm">
                  <span>{typingText}<span className="animate-pulse">|</span></span>
                  <span>🔍</span>
                </div>

                {showSimulatedResult && currentSimulatedArticle ? (
                  <Link
                    href={`/ensiklopedia/${encodeURIComponent(currentSimulatedArticle.kategori)}/${encodeURIComponent(currentSimulatedArticle.slug || "")}`}
                    className="animate-fadeIn block bg-white border border-[#dfd8ca] rounded-lg p-3 shadow-md hover:border-[#2a6f6f] hover:scale-[1.01] transition-all duration-300"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2a6f6f] bg-[#2a6f6f]/10 px-2 py-0.5 rounded-full">
                        {currentSimulatedArticle.kategori}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#14213d] hover:text-[#2a6f6f] transition-colors">
                      {currentSimulatedArticle.title}
                    </h4>
                    <p className="mt-1 text-[11px] text-[#52606d] line-clamp-2 leading-relaxed">
                      {currentSimulatedArticle.summary}
                    </p>
                  </Link>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-xs text-[#52606d] italic">
                    {waitingLabel}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#dfd8ca] pb-1.5">
                  <span className="text-[11px] font-bold text-[#14213d] uppercase tracking-wider">
                    {indexTitle}
                  </span>
                  <span className="text-[10px] font-semibold text-[#2a6f6f]">Live Preview</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-xs font-bold text-[#2a6f6f] border-b border-[#dfd8ca] pb-0.5 mb-1.5">A</h5>
                    <ul className="flex flex-col gap-1">
                      <li>
                        <Link href="/ensiklopedia/tokoh/abraham" className="text-[11px] font-semibold text-[#14213d] hover:text-[#2a6f6f] transition-colors">
                          • Abraham
                        </Link>
                      </li>
                      <li>
                        <Link href="/ensiklopedia/tokoh/adam" className="text-[11px] font-semibold text-[#14213d] hover:text-[#2a6f6f] transition-colors">
                          • Adam
                        </Link>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#2a6f6f] border-b border-[#dfd8ca] pb-0.5 mb-1.5">B</h5>
                    <ul className="flex flex-col gap-1">
                      <li>
                        <Link href="/ensiklopedia/tempat/yerusalem" className="text-[11px] font-semibold text-[#14213d] hover:text-[#2a6f6f] transition-colors">
                          • Betlehem
                        </Link>
                      </li>
                      <li>
                        <Link href="/ensiklopedia/kamus/farisi" className="text-[11px] font-semibold text-[#14213d] hover:text-[#2a6f6f] transition-colors">
                          • Babel
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                <Link
                  href="/ensiklopedia?tab=index"
                  className="mt-2 text-center text-[10px] font-bold text-[#2a6f6f] hover:underline"
                >
                  {viewAllLabel}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
