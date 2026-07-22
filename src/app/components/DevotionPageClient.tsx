"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toggleAudio, stopAudio } from "@/lib/audio";
import { downloadPdf } from "@/lib/share";
import { DEFAULT_DAILY_HERO_IMAGE, LOCAL_DAILY_HERO_FALLBACK, resolveDailyHeroImage } from "@/lib/daily-hero-images";
import { WhatsAppChannelButton } from "@/app/components/WhatsAppChannelButton";
import { buildBibleDeepLinkHref } from "@/lib/bible-deeplink";
import { AdSenseAd } from "@/app/components/AdSenseAd";
import { useLanguage } from "@/lib/i18n";

type DevotionPageClientProps = {
  devotion: {
    id: string;
    title: string;
    verseRef: string;
    verseText: string;
    body: string;
    prayer?: string;
    imageUrl?: string;
    illustrationUrl?: string;
    bannerUrl?: string;
  };
};

const colorNames: Record<string, Record<string, string>> = {
  'auto-stabilo': { id: "Auto Rotasi 🔄", en: "Auto Rotate 🔄", zh: "自动轮换 🔄" },
  'neon-yellow': { id: "Kuning Stabilo 🟡", en: "Neon Yellow 🟡", zh: "荧光黄 🟡" },
  'neon-green': { id: "Hijau Stabilo 🟢", en: "Neon Green 🟢", zh: "荧光绿 🟢" },
  'neon-pink': { id: "Pink Stabilo 🌸", en: "Neon Pink 🌸", zh: "荧光粉 🌸" },
  'neon-orange': { id: "Oranye Stabilo 🟠", en: "Neon Orange 🟠", zh: "荧光橙 🟠" },
  'neon-cyan': { id: "Biru/Sian Stabilo 🌐", en: "Neon Cyan 🌐", zh: "荧光青 🌐" },
  'neon-lime': { id: "Lemon Stabilo 🍋", en: "Neon Lime 🍋", zh: "荧光柠绿 🍋" },
  'neon-purple': { id: "Ungu Stabilo 🍇", en: "Neon Purple 🍇", zh: "荧光紫 🍇" },
  'white': { id: "Putih ⚪", en: "White ⚪", zh: "白色 ⚪" },
  'facebook-blue': { id: "Biru Facebook 🔵", en: "Facebook Blue 🔵", zh: "脸书蓝 🔵" },
  'moss-green': { id: "Hijau Lumut 🌲", en: "Moss Green 🌲", zh: "苔藓绿 🌲" },
  'spotify-green': { id: "Hijau Spotify 🟢", en: "Spotify Green 🟢", zh: "声田绿 🟢" }
};

export default function DevotionPageClient({ devotion }: DevotionPageClientProps) {
  const { language, t } = useLanguage();
  const [theme, setTheme] = useState("light");
  const [isPlaying, setIsPlaying] = useState(false);
  const [fallbackStep, setFallbackStep] = useState(0);
  const [shareUrl, setShareUrl] = useState("");
  const [activeDevotion, setActiveDevotion] = useState(devotion);

  const isDark = theme === "dark";

  // Fetch translation on-the-fly when language changes
  useEffect(() => {
    if (language === "id") {
      setActiveDevotion(devotion);
      return;
    }
    let active = true;
    const fetchTranslation = async () => {
      // Try R2 file first
      if (devotion.id && devotion.id.trim()) {
        try {
          const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev";
          const res = await fetch(`${r2Url}/devotions/${devotion.id}_${language}.json`);
          if (res.ok && active) {
            const data = await res.json();
            if (data && data.title) {
              setActiveDevotion(data);
              return;
            }
          }
        } catch (err) {
          console.warn("[DevotionPageClient] R2 fetch failed, falling back to GT:", err);
        }
      }

      // Fallback: Translate via internal API Route /api/translate
      if (!active) return;
      try {
        const resTranslate = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: [
              devotion.title || "",
              devotion.verseRef || "",
              devotion.verseText || "",
              devotion.body || "",
              devotion.prayer || "",
            ],
            to: language,
            type: "devotion",
            id: devotion.id,
          }),
        });

        if (resTranslate.ok && active) {
          const dataTranslate = await resTranslate.json();
          const translatedParts = dataTranslate.translated || [];
          setActiveDevotion({
            ...devotion,
            title: translatedParts[0] || devotion.title,
            verseRef: translatedParts[1] || devotion.verseRef,
            verseText: translatedParts[2] || devotion.verseText,
            body: translatedParts[3] || devotion.body,
            prayer: translatedParts[4] || devotion.prayer,
          });
        }
      } catch (fallbackErr) {
        console.error("[DevotionPageClient] Fallback translation failed:", fallbackErr);
      }
    };
    fetchTranslation();
    return () => {
      active = false;
    };
  }, [language, devotion]);


  // Read theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("tma-theme") || "light";
    setTheme(saved);
  }, []);

  const [selectedBg, setSelectedBg] = useState("auto-stabilo");
  const [dateBuster, setDateBuster] = useState("");

  useEffect(() => {
    setDateBuster(new Date().toISOString().split('T')[0]);
  }, []);

  const descForUrl = `${activeDevotion.verseRef} - "${activeDevotion.verseText.substring(0, 100)}${activeDevotion.verseText.length > 100 ? "..." : ""}"`;

  const bannerUrl = (selectedBg === "original" && activeDevotion.bannerUrl)
    ? activeDevotion.bannerUrl
    : `/api/admin/generate-image?title=${encodeURIComponent(activeDevotion.title)}&description=${encodeURIComponent(descForUrl)}&icon=logo&bg=${selectedBg}${dateBuster ? `&d=${dateBuster}` : ""}`;

  const verticalBannerUrl = (selectedBg === "original" && activeDevotion.bannerUrl)
    ? `/api/admin/generate-image?title=${encodeURIComponent(activeDevotion.title)}&description=${encodeURIComponent(descForUrl)}&icon=logo&bg=auto-stabilo&format=vertical${dateBuster ? `&d=${dateBuster}` : ""}`
    : `/api/admin/generate-image?title=${encodeURIComponent(activeDevotion.title)}&description=${encodeURIComponent(descForUrl)}&icon=logo&bg=${selectedBg}&format=vertical${dateBuster ? `&d=${dateBuster}` : ""}`;

  const heroImageUrl = resolveDailyHeroImage(activeDevotion.imageUrl, activeDevotion.illustrationUrl);

  // Stop audio on unmount & set share URL on mount
  useEffect(() => {
    setShareUrl(window.location.href);
    return () => {
      stopAudio();
    };
  }, []);

  const handleListenClick = () => {
    const textToRead = language === "zh"
      ? `每日灵修。${activeDevotion.title}。圣经金句：${activeDevotion.verseRef}。${activeDevotion.verseText}。灵修内容：${activeDevotion.body}。今日祷告：${activeDevotion.prayer || ""}`
      : language === "en"
      ? `Daily Devotion. ${activeDevotion.title}. Bible Verse: ${activeDevotion.verseRef}. ${activeDevotion.verseText}. Devotion: ${activeDevotion.body}. Today's Prayer: ${activeDevotion.prayer || ""}`
      : `Renungan Harian. ${activeDevotion.title}. Ayat Alkitab: ${activeDevotion.verseRef}. ${activeDevotion.verseText}. Renungan: ${activeDevotion.body}. Doa hari ini: ${activeDevotion.prayer || ""}`;
    toggleAudio(textToRead, isPlaying, setIsPlaying);
  };

  const handleDownloadPdf = () => {
    const content = [
      language === "zh" ? `**今日金句:** ${activeDevotion.verseRef}` : language === "en" ? `**Daily Verse:** ${activeDevotion.verseRef}` : `**Ayat Harian:** ${activeDevotion.verseRef}`,
      `"${activeDevotion.verseText}"`,
      activeDevotion.body,
      activeDevotion.prayer ? (language === "zh" ? `**今日祷告**\n${activeDevotion.prayer}` : language === "en" ? `**Today's Prayer**\n${activeDevotion.prayer}` : `**Doa Hari Ini**\n${activeDevotion.prayer}`) : "",
    ].filter(Boolean).join("\n\n");

    downloadPdf(activeDevotion.title, content, {
      bannerUrl,
      illustrationUrl: heroImageUrl || activeDevotion.illustrationUrl || activeDevotion.imageUrl || undefined,
      subtitle: `${activeDevotion.verseRef} - ${activeDevotion.verseText}`,
    });
  };

  const buttonStyle = isDark 
    ? "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800" 
    : "border-[#dfd8ca] bg-white text-[#1f2933] hover:bg-[#f7f4ee]";

  return (
    <main className={`min-h-screen px-5 py-12 sm:px-8 transition-colors duration-300 ${
      isDark ? "bg-slate-950 text-slate-100" : "bg-[#f7f4ee] text-[#1f2933]"
    }`}>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          {/* AdSense Header Ad */}
          <div className="mb-6">
            <AdSenseAd placement="header" />
          </div>

          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className={`inline-flex items-center gap-2 text-sm font-semibold transition ${
                isDark ? "text-cyan-400 hover:text-cyan-300" : "text-[#2a6f6f] hover:underline"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              {t("nav.home") === "Home" ? "Back to Home" : (language === "zh" ? "返回首页" : "Kembali ke Beranda")}
            </Link>

            <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              <button
                onClick={handleListenClick}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition cursor-pointer w-full sm:w-auto ${
                  isPlaying
                    ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                    : isDark
                      ? "bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold"
                      : "bg-[#2a6f6f] text-white hover:bg-[#205555]"
                }`}
              >
                {isPlaying ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                    </svg>
                    <span>{language === "zh" ? "停止朗读" : language === "en" ? "Stop Audio" : "Hentikan"}<span className="hidden sm:inline">{language === "zh" ? "" : language === "en" ? "" : " Suara"}</span></span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                    </svg>
                    <span>{language === "zh" ? "聆听灵修" : language === "en" ? "Listen Devotional" : "Dengarkan"}<span className="hidden sm:inline">{language === "zh" ? "" : language === "en" ? "" : " Renungan"}</span></span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-5 gap-2 w-full sm:flex sm:w-auto sm:items-center sm:gap-2">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-2 py-2.5 text-sm font-semibold shadow-sm transition cursor-pointer w-full sm:px-4 sm:w-auto ${buttonStyle}`}
                  title={language === "zh" ? "分享到 Facebook" : language === "en" ? "Share on Facebook" : "Bagikan ke Facebook"}
                >
                  <svg className="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="hidden sm:inline">Facebook</span>
                </a>

                <a
                  href={bannerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-2 py-2.5 text-sm font-semibold shadow-sm transition w-full sm:px-4 sm:w-auto ${buttonStyle}`}
                  title={language === "zh" ? "下载横向海报" : language === "en" ? "Download Banner" : "Download gambar horizontal untuk Facebook/Instagram Feed"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <span className="hidden sm:inline">{language === "zh" ? "海报" : language === "en" ? "Banner" : "Banner"}</span>
                </a>

                <a
                  href={verticalBannerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-2 py-2.5 text-sm font-semibold shadow-sm transition w-full sm:px-4 sm:w-auto ${buttonStyle}`}
                  title={language === "zh" ? "下载竖版海报" : language === "en" ? "Download Vertical Banner" : "Download gambar vertikal untuk TikTok/YouTube Shorts/Reels"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-pink-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                  <span className="hidden sm:inline">{language === "zh" ? "竖版" : language === "en" ? "Vertical" : "Vertikal"}</span>
                </a>

                <button
                  onClick={handleDownloadPdf}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-2 py-2.5 text-sm font-semibold shadow-sm transition cursor-pointer w-full sm:px-4 sm:w-auto ${buttonStyle}`}
                  title={language === "zh" ? "下载 PDF" : language === "en" ? "Download PDF" : "Unduh PDF Renungan"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-red-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v2.25A2.25 2.25 0 0117.25 18.75H6.75A2.25 2.25 0 014.5 16.5v-2.25m7.5-11.25v11.25m0 0l-3.75-3.75M12 14.25l3.75-3.75" />
                  </svg>
                  <span className="hidden sm:inline">PDF</span>
                </button>

                <button
                  onClick={() => {
                    const shareUrl = window.location.href;
                    navigator.clipboard.writeText(shareUrl);
                    alert(language === "zh" ? "灵修链接已复制！" : language === "en" ? "Devotional link copied!" : "Tautan renungan berhasil disalin!");
                  }}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-2 py-2.5 text-sm font-semibold shadow-sm transition cursor-pointer w-full sm:px-4 sm:w-auto ${buttonStyle}`}
                  title={language === "zh" ? "复制链接" : language === "en" ? "Copy link" : "Salin tautan renungan"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-teal-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l.09.034m-.09-.034a2.25 2.25 0 011.196-1.853l8.033-4.637a2.25 2.25 0 11.75 1.3L9.141 10.907a2.25 2.25 0 01-1.196 1.853l-8.033 4.637a2.25 2.25 0 11-.75-1.3l8.033-4.637z" />
                  </svg>
                  <span className="hidden sm:inline">{language === "zh" ? "分享" : language === "en" ? "Share" : "Bagikan"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Banner & PDF Color Customizer */}
          <div className={`mt-2 mb-6 p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-sm ${
            isDark 
              ? "border-slate-800 bg-slate-900/40 text-slate-200" 
              : "border-[#dfd8ca] bg-white text-[#1f2933]"
          }`}>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {language === "zh" ? "海报与 PDF 背景颜色" : language === "en" ? "Banner & PDF Background Color" : "Warna Background Banner & PDF"}
              </span>
              <span className="text-sm font-bold flex items-center gap-1.5">
                {selectedBg === "original" ? (
                  <>🖼️ {language === "zh" ? "原始设计" : language === "en" ? "Original Design" : "Desain Asli"}</>
                ) : (
                  <>🎨 {colorNames[selectedBg]?.[language] || selectedBg}</>
                )}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Original Banner Button if available */}
              {activeDevotion.bannerUrl && (
                <button
                  type="button"
                  onClick={() => setSelectedBg("original")}
                  className={`relative flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all border ${
                    selectedBg === "original"
                      ? isDark 
                        ? "border-cyan-400 bg-cyan-950 text-cyan-300 ring-2 ring-cyan-500" 
                        : "border-[#2a6f6f] bg-[#e9f5db] text-[#14213d] ring-2 ring-[#2a6f6f]"
                      : isDark
                        ? "border-slate-800 bg-slate-900 hover:border-slate-700"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                  title={language === "zh" ? "原始设计" : language === "en" ? "Original Design" : "Desain Asli"}
                >
                  🖼️ <span className="text-[10px] uppercase font-bold">Original</span>
                </button>
              )}

              {/* Auto Rotate Button */}
              <button
                type="button"
                onClick={() => setSelectedBg("auto-stabilo")}
                className={`relative flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all border ${
                  selectedBg === "auto-stabilo"
                    ? isDark 
                      ? "border-cyan-400 bg-cyan-950 text-cyan-300 ring-2 ring-cyan-500" 
                      : "border-[#2a6f6f] bg-[#e9f5db] text-[#14213d] ring-2 ring-[#2a6f6f]"
                    : isDark
                      ? "border-slate-800 bg-slate-900 hover:border-slate-700"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                }`}
                title={language === "zh" ? "自动每日更换" : language === "en" ? "Auto Rotate Daily" : "Ganti Otomatis Harian"}
              >
                🔄 <span className="text-[10px] uppercase font-bold">Auto</span>
              </button>

              {/* 7 neon/stabilo colors circles + 4 new colors */}
              <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "neon-yellow", hex: "#FFFF00", name: "Yellow" },
                  { id: "neon-green", hex: "#39FF14", name: "Green" },
                  { id: "neon-pink", hex: "#FF8AD8", name: "Pink" },
                  { id: "neon-orange", hex: "#FFAD33", name: "Orange" },
                  { id: "neon-cyan", hex: "#00FFFF", name: "Cyan" },
                  { id: "neon-lime", hex: "#CCFF00", name: "Lime" },
                  { id: "neon-purple", hex: "#E2B3FF", name: "Purple" },
                  { id: "white", hex: "#FFFFFF", name: "White" },
                  { id: "facebook-blue", hex: "#1877F2", name: "Facebook Blue" },
                  { id: "moss-green", hex: "#3D5446", name: "Moss Green" },
                  { id: "spotify-green", hex: "#1DB954", name: "Spotify Green" }
                ].map((color) => {
                  const isActive = selectedBg === color.id;
                  const dotColor = (color.id === "white") ? "bg-black" : (color.id === "facebook-blue" || color.id === "moss-green") ? "bg-white" : "bg-black";
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setSelectedBg(color.id)}
                      style={{ backgroundColor: color.hex }}
                      className={`w-6 h-6 rounded-full transition-all duration-200 transform hover:scale-125 focus:outline-none cursor-pointer flex items-center justify-center border border-black/20 ${
                        isActive
                          ? "ring-2 ring-offset-2 ring-cyan-500 dark:ring-offset-slate-950 scale-110"
                          : "opacity-80 hover:opacity-100"
                      }`}
                      title={colorNames[color.id]?.[language] || color.name}
                    >
                      {isActive && (
                        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <span className={`rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
            isDark ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-[#e9f5db] text-[#284b3a]"
          }`}>
            {language === "zh" ? "基督徒每日灵修" : language === "en" ? "Christian Daily Devotion" : "Renungan Harian Kristen"}
          </span>
          <h1 className={`mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl transition ${
            isDark ? "text-white" : "text-[#14213d]"
          }`}>
            {activeDevotion.title}
          </h1>

          <div className={`mt-6 flex flex-wrap items-center gap-4 border-b pb-6 text-sm transition ${
            isDark ? "border-slate-800 text-slate-400" : "border-[#dfd8ca] text-[#52606d]"
          }`}>
            <span className={`font-semibold transition ${isDark ? "text-white" : "text-[#14213d]"}`}>{language === "zh" ? "恩典每日灵修团队" : language === "en" ? "Grace Daily Team" : "Tim Grace Daily"}</span>
            <span>•</span>
            <span>{language === "zh" ? "今日灵修分享" : language === "en" ? "Today's Quiet Time" : "Sajian Teduh Hari Ini"}</span>
          </div>
        </header>

        {heroImageUrl && (
          <div className={`mb-8 overflow-hidden rounded-2xl border shadow-sm max-h-[500px] transition ${
            isDark ? "border-slate-800" : "border-[#dfd8ca]"
          }`}>
            <img
              src={heroImageUrl}
              alt={activeDevotion.verseRef}
              className="max-h-[500px] w-full bg-[#102c3a] object-contain object-center sm:object-cover"
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
          </div>
        )}

        {/* Scripture Box */}
        <div className={`mb-8 rounded-xl border-l-4 p-6 shadow-sm leading-relaxed transition-all ${
          isDark ? "border-cyan-500 bg-slate-900/60" : "border-[#2a6f6f] bg-[#fffdf8]"
        }`}>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-2 transition ${
            isDark ? "text-cyan-400" : "text-[#2a6f6f]"
          }`}>
            {language === "zh" ? "今日金句:" : language === "en" ? "Daily Verse:" : "Ayat Harian:"}{" "}
            {(() => {
              const deepLink = buildBibleDeepLinkHref(activeDevotion.verseRef);
              return deepLink ? (
                <Link
                  href={deepLink}
                  className={`hover:underline transition ${isDark ? "text-cyan-400" : "text-[#2a6f6f]"}`}
                  title={language === "zh" ? `在圣经中打开 ${activeDevotion.verseRef}` : language === "en" ? `Open ${activeDevotion.verseRef} in Bible` : `Buka ${activeDevotion.verseRef} di Alkitab`}
                >
                  {activeDevotion.verseRef}
                </Link>
              ) : (
                <span>{activeDevotion.verseRef}</span>
              );
            })()}
          </p>
          <blockquote className={`text-lg font-medium italic transition ${
            isDark ? "text-white" : "text-[#334155]"
          }`}>
            &ldquo;{activeDevotion.verseText}&rdquo;
          </blockquote>
        </div>

        {/* Devotion Content */}
        <article className={`prose prose-lg max-w-none leading-8 mb-8 space-y-4 transition ${
          isDark ? "text-[#F5F5DC]" : "text-[#334155]"
        }`}>
          {activeDevotion.body.split("\n").map((para, i) => (
            <React.Fragment key={i}>
              <p className="leading-relaxed">
                {para}
              </p>
              {/* AdSense In-Article Ad - Show after 2nd and 5th paragraphs */}
              {(i === 1 || i === 4) && (
                <div className="my-6 flex justify-center">
                  <AdSenseAd placement="inline" />
                </div>
              )}
            </React.Fragment>
          ))}
        </article>

        {/* Prayer Section */}
        {activeDevotion.prayer && (
          <div className={`rounded-xl border p-6 shadow-sm transition-all ${
            isDark ? "border-slate-800 bg-slate-900/40" : "border-[#dfd8ca] bg-[#e9f5db]/50"
          }`}>
            <p className={`text-sm font-semibold uppercase tracking-[0.22em] mb-3 transition ${
              isDark ? "text-cyan-400" : "text-[#2a6f6f]"
            }`}>
              {language === "zh" ? "今日祷告" : language === "en" ? "Today's Prayer" : "Doa Hari Ini"}
            </p>
            <div className={`italic leading-relaxed space-y-3 transition ${
              isDark ? "text-[#F5F5DC]" : "text-[#334155]"
            }`}>
              {activeDevotion.prayer.split("\n").map((para, i) => (
                <p key={i}>&ldquo;{para}&rdquo;</p>
              ))}
            </div>
          </div>
        )}

        {/* WhatsApp Channel Invite */}
        <div className={`mt-12 p-6 rounded-xl border text-center shadow-sm flex flex-col items-center gap-3 transition-all ${
          isDark ? "border-slate-800 bg-slate-900/30" : "border-[#dfd8ca] bg-white"
        }`}>
          <h3 className={`text-lg font-bold font-serif transition ${
            isDark ? "text-white" : "text-[#14213d]"
          }`}>
            {language === "zh" ? "在 WhatsApp 上获取每日灵修" : language === "en" ? "Get Daily Devotion on WhatsApp" : "Dapatkan Renungan Harian di WhatsApp"}
          </h3>
          <p className={`text-sm max-w-md transition ${isDark ? "text-slate-400" : "text-[#52606d]"}`}>
            {language === "zh" ? "加入 Grace Daily WhatsApp 频道，每天直接在手机上接收精选的每日灵修与属灵文章。" : language === "en" ? "Join the Grace Daily WhatsApp Channel to receive curated devotions and spiritual articles every day directly on your phone." : "Bergabunglah dengan WhatsApp Channel Grace Daily untuk menerima renungan teduh dan artikel rohani pilihan setiap hari langsung di ponsel Anda."}
          </p>
          <WhatsAppChannelButton variant="primary" size="md" sourcePage="devotion_detail" />
        </div>
      </div>
    </main>
  );
}
