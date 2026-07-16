"use client";

import Link from "next/link";
import { Suspense } from "react";
import { AiConsole } from "@/app/components/AiConsole";
import { useLanguage } from "@/lib/i18n";

function AiPageHeader() {
  const { language } = useLanguage();

  const texts = {
    id: {
      sub: "Fitur Eksplorasi Grace Daily",
      title: "Renungan, pendeta, doa, studi Alkitab, dan PDF.",
      back: "Kembali ke Beranda",
      loading: "Memuat konsol...",
    },
    en: {
      sub: "Grace Daily Exploration Features",
      title: "Devotional, pastor, prayer, Bible study, and PDF.",
      back: "Back to Home",
      loading: "Loading console...",
    },
    zh: {
      sub: "Grace Daily 探索功能",
      title: "灵修、问牧师、祷告、圣经研读与PDF材料。",
      back: "返回首页",
      loading: "正在加载控制台...",
    },
  };

  const t = texts[language as keyof typeof texts] || texts.id;

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center print:hidden">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              {t.sub}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              {t.title}
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white hover:bg-[#1a2d52] transition"
          >
            {t.back}
          </Link>
        </header>
        <div className="py-8">
          <Suspense fallback={<div className="rounded-lg border border-[#dfd8ca] bg-white p-5 text-[#52606d]">{t.loading}</div>}>
            <AiConsole />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

export default AiPageHeader;
