"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { downloadPdf } from "@/lib/share";
import { useLanguage } from "@/lib/i18n";
import { DEFAULT_DAILY_HERO_IMAGE, LOCAL_DAILY_HERO_FALLBACK, resolveDailyHeroImage } from "@/lib/daily-hero-images";

type Devotion = {
  id?: string;
  title: string;
  verseRef: string;
  verseText: string;
  body: string;
  prayer?: string;
  imageUrl?: string;
  illustrationUrl?: string;
  bannerUrl?: string;
};

export function DevotionCard({ devotion }: { devotion: Devotion }) {
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [fallbackStep, setFallbackStep] = useState(0);
  const [activeDevotion, setActiveDevotion] = useState<Devotion>(devotion);

  useEffect(() => {
    if (language === "id") {
      setActiveDevotion(devotion);
      return;
    }
    let active = true;
    const fetchTranslation = async () => {
      // Try R2 translation file first (only if we have a valid ID)
      if (devotion.id && devotion.id.trim()) {
        try {
          const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev";
          const res = await fetch(`${r2Url}/devotions/${devotion.id}_${language}.json`);
          if (res.ok && active) {
            const data = await res.json();
            if (data && data.title) {
              // Jika bahasa Mandarin, pastikan data cache lama sudah memuat Pinyin
              if (language === "zh" && (!data.title.includes("Pinyin:") && !data.body.includes("Pinyin:"))) {
                // Fallthrough untuk diterjemahkan ulang dengan pypinyin
              } else {
                setActiveDevotion(data);
                return;
              }
            }
          }
        } catch (err) {
          console.warn("[DevotionCard] R2 fetch failed, falling back to API:", err);
        }
      }

      // Fallback: translate on-the-fly via internal API route /api/translate
      if (!active) return;
      try {
        const fields = ["title", "verseRef", "verseText", "body", "prayer"];
        const textsToTranslate = fields.map(f => (devotion as any)[f] || "");

        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: textsToTranslate,
            to: language,
            type: "devotion",
            id: devotion.id
          })
        });

        if (response.ok && active) {
          const resData = await response.json();
          const translatedFields = resData.translated || [];
          setActiveDevotion({
            ...devotion,
            title: translatedFields[0] || devotion.title,
            verseRef: translatedFields[1] || devotion.verseRef,
            verseText: translatedFields[2] || devotion.verseText,
            body: translatedFields[3] || devotion.body,
            prayer: translatedFields[4] || devotion.prayer,
          });
        }
      } catch (fallbackErr) {
        console.error("[DevotionCard] Client-side fallback translation failed:", fallbackErr);
      }
    };
    fetchTranslation();
    return () => {
      active = false;
    };
  }, [language, devotion]);


  const initialHeroImage = resolveDailyHeroImage(activeDevotion.imageUrl, activeDevotion.illustrationUrl);
  const bannerUrl = (language !== "id")
    ? `/api/admin/generate-image?title=${encodeURIComponent(activeDevotion.title)}&description=${encodeURIComponent(`${activeDevotion.verseRef} - "${activeDevotion.verseText.substring(0, 100)}${activeDevotion.verseText.length > 100 ? "..." : ""}"`)}&icon=logo&bg=sage`
    : (activeDevotion.bannerUrl || `/api/admin/generate-image?title=${encodeURIComponent(activeDevotion.title)}&description=${encodeURIComponent(`${activeDevotion.verseRef} - "${activeDevotion.verseText.substring(0, 100)}${activeDevotion.verseText.length > 100 ? "..." : ""}"`)}&icon=logo&bg=sage`);
  const verticalBannerUrl = `/api/admin/generate-image?title=${encodeURIComponent(activeDevotion.title)}&description=${encodeURIComponent(`${activeDevotion.verseRef} - "${activeDevotion.verseText.substring(0, 100)}${activeDevotion.verseText.length > 100 ? "..." : ""}"`)}&icon=logo&bg=sage&format=vertical`;

  useEffect(() => {
    // Selalu fetch ulang dari API berdasarkan devotion.id
    // untuk memastikan gambar yang ditampilkan sesuai dengan renungan saat ini.
    async function fetchDailyImage() {
      try {
        // Tambah timestamp agar mobile browser tidak cache response
        const ts = Date.now();
        const response = await fetch(
          `/api/daily-image?devotionId=${encodeURIComponent(activeDevotion.id ?? "")}&_t=${ts}`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setImageUrl(resolveDailyHeroImage(data.url));
            return;
          }
        }
        setImageUrl(initialHeroImage);
      } catch (error) {
        console.error("Gagal memuat gambar ilustrasi harian:", error);
        setImageUrl(initialHeroImage);
      } finally {
        setImageLoading(false);
      }
    }

    setImageLoading(true);
    setFallbackStep(0);
    fetchDailyImage();
  }, [activeDevotion.id, initialHeroImage]); // Key stabil agar tidak loop

  // Polling otomatis setiap 3 menit jika gambar belum tersedia
  // (gambar mungkin masih di-generate di background saat renungan baru dibuat)
  useEffect(() => {
    if (imageUrl) return;

    const interval = setInterval(async () => {
      try {
        const ts = Date.now();
        const response = await fetch(
          `/api/daily-image?devotionId=${encodeURIComponent(activeDevotion.id ?? "")}&_t=${ts}`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setImageUrl(resolveDailyHeroImage(data.url));
          }
        }
      } catch {
        // Abaikan error pada polling
      }
    }, 3 * 60 * 1000); // Polling setiap 3 menit

    return () => clearInterval(interval);
  }, [activeDevotion.id, imageUrl]);

  const handleDownloadPdf = () => {
    const content = [
      `**Ayat Harian:** ${activeDevotion.verseRef}`,
      `"${activeDevotion.verseText}"`,
      activeDevotion.body,
      activeDevotion.prayer ? `**Doa Hari Ini**\n${activeDevotion.prayer}` : "",
    ].filter(Boolean).join("\n\n");

    downloadPdf(activeDevotion.title, content, {
      bannerUrl,
      illustrationUrl: imageUrl || activeDevotion.illustrationUrl || activeDevotion.imageUrl || undefined,
      subtitle: `${activeDevotion.verseRef} - ${activeDevotion.verseText}`,
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
              alt={activeDevotion.verseRef}
              className="h-full w-full bg-[#102c3a] object-contain object-center transition-transform duration-700 hover:scale-105 sm:object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (fallbackStep === 0 && target.src !== DEFAULT_DAILY_HERO_IMAGE) {
                  setFallbackStep(1);
                  target.src = DEFAULT_DAILY_HERO_IMAGE;
                  return;
                }
                setFallbackStep(2);
                target.src = LOCAL_DAILY_HERO_FALLBACK;
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
            {language === "zh" ? "今日金句" : language === "en" ? "Daily Verse" : "Ayat Harian"}
          </p>
          <p className="mt-1 text-sm font-semibold text-white/90">
            {activeDevotion.verseRef}
          </p>
        </div>
      </div>

      <div className="p-5">
        <blockquote className="text-xl font-medium leading-relaxed italic text-white/90">
          &ldquo;{activeDevotion.verseText}&rdquo;
        </blockquote>
        <h2 className="mt-5 text-xl font-semibold text-[#ffd166]">
          {activeDevotion.title}
        </h2>
        <div className="mt-3 leading-7 text-white/90">
          {isExpanded ? (
            <div className="space-y-4">
              {activeDevotion.body.split("\n").map((para, i) => (
                <p key={i} className="leading-7">
                  {para}
                </p>
              ))}
            </div>
          ) : (
            <p className="line-clamp-4 leading-7 whitespace-pre-line">
              {activeDevotion.body}
            </p>
          )}
          
          {isExpanded && activeDevotion.prayer && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ffd166]">
                {language === "zh" ? "今日祷告" : language === "en" ? "Today's Prayer" : "Doa Hari Ini"}
              </p>
              <div className="mt-2 italic text-white/80 space-y-3">
                {activeDevotion.prayer.split("\n").map((para, i) => (
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
                  {language === "zh" ? "收起灵修" : language === "en" ? "Close Devotional" : "Tutup Renungan"}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </>
              ) : (
                <>
                  {language === "zh" ? "阅读全文" : language === "en" ? "Read More" : "Baca Selengkapnya"}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </>
              )}
            </button>

            {activeDevotion.id && (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/renungan/${activeDevotion.id}`}
                  className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>{language === "zh" ? "专属页面" : language === "en" ? "Single Page" : "Halaman Sendiri"}</span>
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
                  <span>{language === "zh" ? "海报" : language === "en" ? "Banner" : "Banner"}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </a>

                <a
                  href={verticalBannerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>{language === "zh" ? "竖版海报" : language === "en" ? "Vertical Banner" : "Banner Vertikal"}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
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

                <Link
                  href="/renungan"
                  className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>{language === "zh" ? "灵修归档" : language === "en" ? "Devotional Archive" : "Arsip Renungan"}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </Link>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/renungan/${activeDevotion.id}`;
                    navigator.clipboard.writeText(shareUrl);
                    alert(language === "zh" ? "灵修链接已复制！" : language === "en" ? "Devotional link copied!" : "Tautan renungan berhasil disalin!");
                  }}
                  className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{language === "zh" ? "分享" : language === "en" ? "Share" : "Bagikan"}</span>
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
