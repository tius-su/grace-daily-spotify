"use client";

import { useState, useEffect } from "react";

type Devotion = {
  title: string;
  verseRef: string;
  verseText: string;
  body: string;
  prayer?: string;
  illustrationUrl?: string;
};

export function DevotionCard({ devotion }: { devotion: Devotion }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(devotion.illustrationUrl || null);
  const [imageLoading, setImageLoading] = useState(!devotion.illustrationUrl);

  useEffect(() => {
    if (devotion.illustrationUrl) {
      setImageUrl(devotion.illustrationUrl);
      setImageLoading(false);
      return;
    }

    async function fetchDailyImage() {
      try {
        const response = await fetch("/api/daily-image");
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setImageUrl(data.url);
          }
        }
      } catch (error) {
        console.error("Gagal memuat gambar ilustrasi harian:", error);
      } finally {
        setImageLoading(false);
      }
    }
    fetchDailyImage();
  }, [devotion]);

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
        <div className="mt-3 leading-7 text-white/78">
          <p className={isExpanded ? "whitespace-pre-line" : "line-clamp-4"}>
            {devotion.body}
          </p>
          
          {isExpanded && devotion.prayer && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ffd166]">
                Doa Hari Ini
              </p>
              <p className="mt-2 italic text-white/80 whitespace-pre-line">
                &ldquo;{devotion.prayer}&rdquo;
              </p>
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-4 text-sm font-semibold text-[#ffd166] hover:text-[#ffeaad] focus:outline-none flex items-center gap-1 cursor-pointer transition-colors"
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
        </div>
      </div>
    </div>
  );
}


