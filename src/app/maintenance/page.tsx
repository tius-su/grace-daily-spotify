"use client";

import Link from "next/link";

export default function MaintenancePage() {
  const handleRetry = () => {
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#14213d] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background elegant circles */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#e9f5db]/40 blur-3xl -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#ffd166]/10 blur-3xl -z-10" />

      <div className="max-w-xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
        <div className="h-24 w-24 bg-white rounded-3xl shadow-xl flex items-center justify-center border border-[#14213d]/5 mb-8 hover:scale-105 transition-transform duration-300">
          <span className="text-4xl">🌅</span>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#2a6f6f] mb-3">
          Grace Daily — Ruang Teduh Digital
        </p>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-[#14213d] leading-tight mb-6">
          Sedang Pemeliharaan Berkala
        </h1>

        <p className="text-base sm:text-lg text-[#52606d] leading-relaxed mb-8">
          &ldquo;Tetapi carilah dahulu Kerajaan Allah dan kebenarannya, maka semuanya itu akan ditambahkan kepadamu.&rdquo; <br />
          <span className="text-sm font-semibold text-[#2a6f6f]">— Matius 6:33</span>
        </p>

        <p className="text-sm text-[#52606d]/90 leading-relaxed max-w-md mb-10">
          Kami sedang melakukan pemeliharaan server untuk meningkatkan kestabilan ruang saat teduh Anda. Silakan coba memuat ulang halaman dalam beberapa saat lagi.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <button
            id="retry-btn"
            onClick={handleRetry}
            className="rounded-lg bg-[#2a6f6f] px-8 py-3.5 font-bold text-white shadow-lg hover:bg-[#1f5454] transition hover:shadow-xl active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
            </svg>
            Coba Lagi
          </button>
        </div>

        <div className="mt-16 text-2xs text-[#52606d]/60 border-t border-[#14213d]/10 pt-6 w-full max-w-xs">
          &copy; {new Date().getFullYear()} Grace Daily. Segala kemuliaan bagi Tuhan.
        </div>
      </div>
    </main>
  );
}
