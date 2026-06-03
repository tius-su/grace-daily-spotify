"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { downloadPdf } from "@/lib/share";

type Devotion = {
  id?: string;
  title: string;
  verseRef: string;
  verseText: string;
  body: string;
  prayer?: string;
  illustrationUrl?: string;
  bannerUrl?: string;
};

export function DevotionCard({ devotion }: { devotion: Devotion }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const bannerUrl = devotion.bannerUrl || `/api/admin/generate-image?title=${encodeURIComponent(devotion.title)}&description=${encodeURIComponent(`${devotion.verseRef} - "${devotion.verseText.substring(0, 100)}${devotion.verseText.length > 100 ? "..." : ""}"`)}&icon=logo&bg=sage`;

  useEffect(() => {
    // Selalu fetch ulang dari API berdasarkan devotion.id
    // untuk memastikan gambar yang ditampilkan sesuai dengan renungan saat ini,
    // bukan gambar renungan kemarin yang mungkin masih tersimpan di cache.
    async function fetchDailyImage() {
      try {
        const response = await fetch(`/api/daily-image?devotionId=${encodeURIComponent(devotion.id ?? "")}`);
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setImageUrl(data.url);
            return;
          }
        }
        // Fallback ke illustrationUrl dari props jika API tidak mengembalikan URL
        if (devotion.illustrationUrl) {
          setImageUrl(devotion.illustrationUrl);
        }
      } catch (error) {
        console.error("Gagal memuat gambar ilustrasi harian:", error);
        if (devotion.illustrationUrl) {
          setImageUrl(devotion.illustrationUrl);
        }
      } finally {
        setImageLoading(false);
      }
    }

    setImageLoading(true);
    fetchDailyImage();
  }, [devotion.id]); // Key: devotion.id, bukan object devotion agar tidak loop

  // Polling otomatis setiap 3 menit jika gambar belum tersedia
  // (gambar mungkin masih di-generate di background saat renungan baru dibuat)
  useEffect(() => {
    if (imageUrl) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/daily-image?devotionId=${encodeURIComponent(devotion.id ?? "")}`);
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setImageUrl(data.url);
          }
        }
      } catch {
        // Abaikan error pada polling
      }
    }, 3 * 60 * 1000); // Polling setiap 3 menit

    return () => clearInterval(interval);
  }, [devotion.id, imageUrl]);

  const handleDownloadPdf = () => {
    const content = [
      `**Ayat Harian:** ${devotion.verseRef}`,
      `"${devotion.verseText}"`,
      devotion.body,
      devotion.prayer ? `**Doa Hari Ini**\n${devotion.prayer}` : "",
    ].filter(Boolean).join("\n\n");

    downloadPdf(devotion.title, content, {
      bannerUrl,
      subtitle: `${devotion.verseRef} - ${devotion.verseText}`,
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-white/15 bg-white/12 shadow-2xl backdrop-blur">
      {/* Hero Image Section */}
      <div className="relative h-64 w-full overflow-hidden bg-[#102c3a]/50">
        {imageLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-[#ffd166]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={devotion.verseRef}
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/logo.jpg";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#102c3a] via-[#102c3a]/40 to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-5 text-center">
            <span className="text-sm font-bold uppercase tracking-widest text-[#ffd166]">Grace Daily</span>
          </div>
        )}
        <div className="absolute bottom-4 left-5 right-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffd166]">
            Ayat Harian
          </p>
          <p className="mt-1 text-sm font-semibold text-white/90">
            {devotion.verseRef}
          </p>
        </div>
      </div>

      <div className="p-5">
        <blockquote className="text-xl font-medium leading-relaxed italic text-white/90">
          &ldquo;{devotion.verseText}&rdquo;
        </blockquote>
        <h2 className="mt-5 text-xl font-semibold text-[#ffd166]">
          {devotion.title}
        </h2>
        <div className="mt-3 leading-7 text-white/90">
          {isExpanded ? (
            <div className="space-y-4">
              {devotion.body.split("\n").map((para, i) => (
                <p key={i} className="leading-7">
                  {para}
                </p>
              ))}
            </div>
          ) : (
            <p className="line-clamp-4 leading-7 whitespace-pre-line">
              {devotion.body}
            </p>
          )}
          
          {isExpanded && devotion.prayer && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ffd166]">
                Doa Hari Ini
              </p>
              <div className="mt-2 italic text-white/80 space-y-3">
                {devotion.prayer.split("\n").map((para, i) => (
                  <p key={i}>&ldquo;{para}&rdquo;</p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm font-semibold text-[#ffd166] hover:text-[#ffeaad] focus:outline-none flex items-center gap-1 cursor-pointer transition-colors"
            >
              {isExpanded ? (
                <>
                  Tutup Renungan
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </>
              ) : (
                <>
                  Baca Selengkapnya
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </>
              )}
            </button>

            {devotion.id && (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/renungan/${devotion.id}`}
                  className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>Halaman Sendiri</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </Link>

                <a
                  href={bannerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>Banner FB</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </a>

                <button
                  onClick={handleDownloadPdf}
                  className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>PDF</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v2.25A2.25 2.25 0 0117.25 18.75H6.75A2.25 2.25 0 014.5 16.5v-2.25m7.5-11.25v11.25m0 0l-3.75-3.75M12 14.25l3.75-3.75" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/renungan/${devotion.id}`;
                    navigator.clipboard.writeText(shareUrl);
                    alert("Tautan renungan berhasil disalin!");
                  }}
                  className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Bagikan</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l.09.034m-.09-.034a2.25 2.25 0 011.196-1.853l8.033-4.637a2.25 2.25 0 11.75 1.3L9.141 10.907a2.25 2.25 0 01-1.196 1.853l-8.033 4.637a2.25 2.25 0 11-.75-1.3l8.033-4.637z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

