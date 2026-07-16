import Link from "next/link";
import { BibleExplorer } from "@/app/components/BibleExplorer";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Alkitab Online",
  description: "Pelajari dan renungkan kebenaran firman Tuhan melalui Alkitab online yang mudah dibaca dan bebas gangguan.",
  openGraph: {
    title: "Alkitab Online | Grace Daily",
    description: "Pelajari dan renungkan kebenaran firman Tuhan melalui Alkitab online yang mudah dibaca dan bebas gangguan.",
  },
};

export default function BiblePage() {
  return (
    <main className="min-h-screen bg-[#102c3a] text-white">
      <header className="border-b border-white/12 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ffd166]">
              Grace Daily
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Alkitab Online</h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-white/20 px-4 py-2 text-center font-semibold text-white"
          >
            Kembali
          </Link>
        </div>
      </header>
      <Suspense fallback={<div className="p-8 text-center text-[#ffd166] text-sm animate-pulse">Memuat Penjelajah Alkitab...</div>}>
        <BibleExplorer />
      </Suspense>
    </main>
  );
}
