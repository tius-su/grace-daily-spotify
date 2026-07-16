"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { EnsiklopediaHub } from "@/app/components/EnsiklopediaHub";
import { DaftarIsi } from "@/app/components/DaftarIsi";
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

interface EnsiklopediaContainerProps {
  initialArticles: Article[];
}

export function EnsiklopediaContainer({ initialArticles }: EnsiklopediaContainerProps) {
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const urlTab = searchParams ? searchParams.get("tab") : null;
  const initialTab = urlTab === "index" || urlTab === "daftar-isi" ? "index" : "search";

  const [activeTab, setActiveTab] = useState<"search" | "index">(initialTab);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
            {language === "zh" ? "圣经百科全书" : language === "en" ? "Bible Encyclopedia" : "Ensiklopedia Alkitab"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
            {language === "zh" ? "探索圣经人物、地点和词汇" : language === "en" ? "Explore Bible characters, places, and terms" : "Jelajahi tokoh, tempat, dan istilah Alkitab"}
          </h1>
        </div>
        <Link href="/" className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white">
          {language === "zh" ? "返回首页" : language === "en" ? "Back to Home" : "Kembali ke beranda"}
        </Link>
      </header>

      {/* Premium Tab Navigation */}
      <div className="flex border-b border-[#dfd8ca] mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("search")}
          className={`px-6 py-3 font-semibold text-sm transition-all duration-300 relative ${
            activeTab === "search"
              ? "text-[#2a6f6f] border-b-2 border-[#2a6f6f]"
              : "text-[#52606d] hover:text-[#2a6f6f] hover:bg-[#dfd8ca]/10"
          }`}
        >
          🔍 {language === "zh" ? "搜索" : language === "en" ? "Search" : "Pencarian"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("index")}
          className={`px-6 py-3 font-semibold text-sm transition-all duration-300 relative ${
            activeTab === "index"
              ? "text-[#2a6f6f] border-b-2 border-[#2a6f6f]"
              : "text-[#52606d] hover:text-[#2a6f6f] hover:bg-[#dfd8ca]/10"
          }`}
        >
          📖 {language === "zh" ? "百科目录" : language === "en" ? "Encyclopedia Index" : "Daftar Isi Ensiklopedia"}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="transition-all duration-300">
        {activeTab === "search" ? (
          <EnsiklopediaHub />
        ) : (
          <DaftarIsi initialArticles={initialArticles} />
        )}
      </div>
    </div>
  );
}
