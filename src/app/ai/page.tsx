import Link from "next/link";
import { Suspense } from "react";
import { AiConsole } from "@/app/components/AiConsole";

export default function AiPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center print:hidden">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Fitur Eksplorasi Grace Daily
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Renungan, pendeta, doa, studi Alkitab, dan PDF.
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white"
          >
            Kembali ke beranda
          </Link>
        </header>
        <div className="py-8">
          <Suspense fallback={<div className="rounded-lg border border-[#dfd8ca] bg-white p-5 text-[#52606d]">Memuat konsol...</div>}>
            <AiConsole />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
