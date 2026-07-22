"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toggleAudio, stopAudio } from "@/lib/audio";
import { downloadPdf, shareToWhatsApp } from "@/lib/share";
import { WhatsAppChannelButton } from "@/app/components/WhatsAppChannelButton";
import { AdSenseAd } from "@/app/components/AdSenseAd";
import { useLanguage } from "@/lib/i18n";

type BlogPost = {
  id: string;
  title: string;
  title_en?: string;
  title_zh?: string;
  category: string;
  status: string;
  authorName?: string;
  createdAt?: any;
  imageUrl?: string;
  excerpt?: string;
  excerpt_en?: string;
  excerpt_zh?: string;
  body: string;
  body_en?: string;
  body_zh?: string;
  bannerUrl?: string;
};

type BlogPostClientProps = {
  post: BlogPost;
  publishDate: string;
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

export default function BlogPostClient({ post, publishDate }: BlogPostClientProps) {
  const { t, language } = useLanguage();
  const [theme, setTheme] = useState("light");
  const [isPlaying, setIsPlaying] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [activePost, setActivePost] = useState<BlogPost>(post);
  const [processedContent, setProcessedContent] = useState<React.ReactNode | null>(null);

  const isDark = theme === "dark";

  const getCategoryLabel = (catName?: string) => {
    if (!catName) return "";
    const cleanCat = catName.trim().toLowerCase();
    const map: Record<string, Record<string, string>> = {
      "renungan": { id: "Renungan", en: "Devotion", zh: "灵修" },
      "kajian": { id: "Kajian", en: "Study", zh: "研经" },
      "artikel": { id: "Artikel", en: "Article", zh: "文章" },
      "teologi": { id: "Teologi", en: "Theology", zh: "神学" },
      "renungan harian": { id: "Renungan Harian", en: "Daily Devotion", zh: "每日灵修" },
      "doa": { id: "Doa", en: "Prayer", zh: "祷告" },
      "keluarga": { id: "Keluarga", en: "Family", zh: "家庭" },
      "kesaksian": { id: "Kesaksian", en: "Testimony", zh: "见证" },
      "bible study": { id: "Bible Study", en: "Bible Study", zh: "查经" },
      "bible studi": { id: "Bible Study", en: "Bible Study", zh: "查经" }
    };
    return map[cleanCat]?.[language] || catName;
  };

  // Load translations from R2 on-the-fly for non-ID languages
  useEffect(() => {
    if (language === "id") {
      setActivePost(post);
      return;
    }

    if (language === "en" && post.title_en && post.body_en) {
      setActivePost({
        ...post,
        title: post.title_en,
        excerpt: post.excerpt_en || post.excerpt,
        body: post.body_en
      });
      return;
    }

    if (language === "zh" && post.title_zh && post.body_zh) {
      setActivePost({
        ...post,
        title: post.title_zh,
        excerpt: post.excerpt_zh || post.excerpt,
        body: post.body_zh
      });
      return;
    }

    let active = true;
    async function fetchTranslation() {
      // Try R2 first
      try {
        const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev";
        const res = await fetch(`${r2Url}/articles/${post.id}_${language}.json`);
        if (res.ok && active) {
          const data = await res.json();
          if (data && data.title) {
            setActivePost(data);
            return;
          }
        }
      } catch (err) {
        console.warn("[BlogPostClient] R2 fetch failed, falling back to GT:", err);
      }

      // Fallback: Translate via internal API Route /api/translate
      if (!active) return;
      try {
        const resTranslate = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: [post.title || "", post.excerpt || "", post.body || ""],
            to: language,
            type: "blog",
            id: post.id
          })
        });

        if (resTranslate.ok && active) {
          const dataTranslate = await resTranslate.json();
          const translatedParts = dataTranslate.translated || [];
          setActivePost({
            ...post,
            title: translatedParts[0] || post.title,
            excerpt: translatedParts[1] || post.excerpt,
            body: translatedParts[2] || post.body,
          });
        }
      } catch (fallbackErr) {
        console.error("[BlogPostClient] Fallback translation failed:", fallbackErr);
      }
    }
    fetchTranslation();
    return () => {
      active = false;
    };
  }, [language, post]);


  // Read theme preference on mount
  useEffect(() => {
    const saved = localStorage.getItem("tma-theme") || "light";
    setTheme(saved);
  }, []);

  /**
   * Insert AdSense ads into article content at strategic positions
   */
  function insertAdsInContent(htmlContent: string) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const paragraphs = tempDiv.querySelectorAll('p');
    if (paragraphs.length === 0) {
      return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }
    
    const adPositions = [1, 4];
    const result: React.ReactNode[] = [];
    
    Array.from(paragraphs).forEach((paragraph, index) => {
      result.push(<div key={`para-${index}`} dangerouslySetInnerHTML={{ __html: paragraph.outerHTML }} />);
      if (adPositions.includes(index)) {
        result.push(
          <div key={`ad-${index}`} className="my-6 flex justify-center">
            <AdSenseAd placement="inline" />
          </div>
        );
      }
    });
    
    return result;
  }

  // Process content on mount/client-side when activePost body updates
  useEffect(() => {
    if (typeof window !== "undefined") {
      setProcessedContent(insertAdsInContent(activePost.body));
    }
  }, [activePost.body]);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const handleListenClick = () => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = activePost.body;
    const textToRead = `${activePost.title}. Kategori: ${activePost.category}. ${activePost.excerpt || ""}. ${tempDiv.textContent || tempDiv.innerText || ""}`;
    toggleAudio(textToRead, isPlaying, setIsPlaying);
  };

  const [selectedBg, setSelectedBg] = useState("auto-stabilo");
  const [dateBuster, setDateBuster] = useState("");

  useEffect(() => {
    setDateBuster(new Date().toISOString().split('T')[0]);
  }, []);

  const bannerUrl = (selectedBg === "original" && activePost.bannerUrl)
    ? activePost.bannerUrl
    : `/api/admin/generate-image?title=${encodeURIComponent(activePost.title)}&description=${encodeURIComponent(activePost.excerpt || activePost.category)}&icon=logo&bg=${selectedBg}${dateBuster ? `&d=${dateBuster}` : ""}`;

  const verticalBannerUrl = (selectedBg === "original" && activePost.bannerUrl)
    ? `/api/admin/generate-image?title=${encodeURIComponent(activePost.title)}&description=${encodeURIComponent(activePost.excerpt || activePost.category)}&icon=logo&bg=auto-stabilo&format=vertical${dateBuster ? `&d=${dateBuster}` : ""}`
    : `/api/admin/generate-image?title=${encodeURIComponent(activePost.title)}&description=${encodeURIComponent(activePost.excerpt || activePost.category)}&icon=logo&bg=${selectedBg}&format=vertical${dateBuster ? `&d=${dateBuster}` : ""}`;

  const displayImageUrl = (() => {
    const rawUrl = (language !== "id")
      ? (activePost.imageUrl && !activePost.imageUrl.includes("/api/admin/generate-image") ? activePost.imageUrl : bannerUrl)
      : (activePost.imageUrl || activePost.bannerUrl || bannerUrl);

    if (rawUrl && rawUrl.includes("/api/admin/generate-image")) {
      try {
        const urlObj = new URL(rawUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
        urlObj.searchParams.set("title", activePost.title);
        urlObj.searchParams.set("description", activePost.excerpt || activePost.category);
        return urlObj.pathname + urlObj.search;
      } catch (e) {
        return rawUrl;
      }
    }
    return rawUrl;
  })();
  const articleUrl = typeof window !== "undefined" ? `${window.location.origin}/blog/${activePost.id}` : "";

  const getPlainBody = () => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = activePost.body;
    return tempDiv.textContent || tempDiv.innerText || "";
  };

  const handleDownloadPdf = () => {
    const content = [
      activePost.category ? `Kategori: ${activePost.category}` : "",
      activePost.excerpt || "",
      activePost.body,
      articleUrl ? `<p><strong>Baca online:</strong> ${articleUrl}</p>` : "",
    ].filter(Boolean).join("\n\n");

    downloadPdf(activePost.title, content, {
      bannerUrl: (selectedBg === "original" && activePost.imageUrl) ? activePost.imageUrl : bannerUrl,
      illustrationUrl: activePost.imageUrl || undefined,
      subtitle: activePost.excerpt || `${activePost.category} - ${publishDate}`,
    });
  };

  const handleNativeShare = async () => {
    const url = articleUrl || window.location.href;
    const text = activePost.excerpt || getPlainBody().slice(0, 160);

    if (navigator.share) {
      try {
        await navigator.share({ title: activePost.title, text, url });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    await navigator.clipboard.writeText(url);
    setShareStatus(t("blog.link_copied"));
    window.setTimeout(() => setShareStatus(""), 2200);
  };

  const handleFacebookShare = () => {
    const url = encodeURIComponent(articleUrl || window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener,noreferrer");
  };

  const handleTwitterShare = () => {
    const url = encodeURIComponent(articleUrl || window.location.href);
    const text = encodeURIComponent(activePost.title);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, "_blank", "noopener,noreferrer");
  };

  const handleWhatsAppShare = () => {
    shareToWhatsApp(activePost.title, `${activePost.excerpt || getPlainBody().slice(0, 500)}\n\n${articleUrl || window.location.href}`);
  };

  const outlineBtn = isDark
    ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 shadow-sm transition"
    : "border-[#dfd8ca] bg-white text-[#1f2933] shadow-sm hover:bg-[#f7f4ee] transition";

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

          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/blog"
              className={`inline-flex items-center gap-2 text-sm font-semibold hover:underline transition ${
                isDark ? "text-cyan-400" : "text-[#2a6f6f]"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              {t("blog.back_to_blog")}
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleListenClick}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition cursor-pointer ${
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
                    {t("blog.stop_audio")}
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                    </svg>
                    {t("blog.listen")}
                  </>
                )}
              </button>

              <a
                href={bannerUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition ${outlineBtn}`}
                title="Download gambar horizontal untuk Facebook/Instagram Feed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                Banner
              </a>

              <a
                href={verticalBannerUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition ${outlineBtn}`}
                title="Download gambar vertikal untuk TikTok/YouTube Shorts/Reels"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-pink-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
                {language === "zh" ? "竖版海报" : language === "en" ? "Vertical Banner" : "Banner Vertikal"}
              </a>

              <button
                onClick={handleDownloadPdf}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition cursor-pointer ${outlineBtn}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v2.25A2.25 2.25 0 0 1 17.25 18.75H6.75A2.25 2.25 0 0 1 4.5 16.5v-2.25m7.5-11.25v11.25m0 0-3.75-3.75M12 14.25l3.75-3.75" />
                </svg>
                PDF
              </button>
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
              {activePost.bannerUrl && (
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
            {getCategoryLabel(activePost.category)}
          </span>
          <h1 className={`mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl transition ${
            isDark ? "text-white" : "text-[#14213d]"
          }`}>
            {activePost.title}
          </h1>

          <div className={`mt-6 flex flex-wrap items-center gap-4 border-b pb-6 text-sm transition ${
            isDark ? "border-slate-800 text-slate-400" : "border-[#dfd8ca] text-[#52606d]"
          }`}>
            <div className="flex items-center gap-2">
              <span className={`font-semibold transition ${isDark ? "text-white" : "text-[#14213d]"}`}>
                {activePost.authorName || "Tim Grace Daily"}
              </span>
            </div>
            <span>•</span>
            <time>{publishDate}</time>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={`mr-1 text-xs font-bold uppercase tracking-wider transition ${
              isDark ? "text-slate-400" : "text-[#52606d]"
            }`}>{t("blog.share")}</span>
            <button onClick={handleWhatsAppShare} className="rounded-full bg-[#25d366] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1fb85a]">
              WhatsApp
            </button>
            <button onClick={handleFacebookShare} className="rounded-full bg-[#1877f2] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f63ce]">
              Facebook
            </button>
            <button onClick={handleTwitterShare} className="rounded-full bg-[#111827] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-black">
              X
            </button>
            <button onClick={handleNativeShare} className={`rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm transition ${
              isDark ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-[#dfd8ca] bg-white text-[#14213d] hover:border-[#2a6f6f] hover:text-[#2a6f6f]"
            }`}>
              {shareStatus || (language === "zh" ? "复制/分享" : language === "en" ? "Copy/Share" : "Salin/Share")}
            </button>
          </div>
        </header>

        {displayImageUrl && (
          <div className={`mb-8 overflow-hidden rounded-2xl border shadow-sm transition ${
            isDark ? "border-slate-800" : "border-[#dfd8ca]"
          }`}>
            {displayImageUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov)($|\?)/) ? (
              <video
                src={displayImageUrl}
                controls
                autoPlay
                muted
                playsInline
                className="h-auto max-h-[480px] w-full object-cover"
              />
            ) : (
              <img
                src={displayImageUrl}
                alt={activePost.title}
                className="h-auto max-h-[480px] w-full object-cover"
              />
            )}
          </div>
        )}

        {activePost.excerpt && (
          <div className={`mb-8 rounded-xl border-l-4 p-5 italic shadow-sm leading-relaxed transition-all ${
            isDark
              ? "border-cyan-500 bg-slate-900/60 text-[#F5F5DC]"
              : "border-[#2a6f6f] bg-[#fffdf8] text-[#52606d]"
          }`}>
            {activePost.excerpt}
          </div>
        )}

        <article className={`prose prose-lg max-w-none leading-8 transition ${
          isDark ? "prose-invert text-[#F5F5DC]" : "text-[#334155]"
        }`}>
          <div className="rich-text-content">
            {processedContent || <div dangerouslySetInnerHTML={{ __html: activePost.body }} />}
          </div>
        </article>

        {/* WhatsApp Channel Invite */}
        <div className={`mt-12 p-6 rounded-xl border text-center shadow-sm flex flex-col items-center gap-3 transition-all ${
          isDark ? "border-slate-800 bg-slate-900/30" : "border-[#dfd8ca] bg-white"
        }`}>
          <h3 className={`text-lg font-bold font-serif transition ${
            isDark ? "text-white" : "text-[#14213d]"
          }`}>{t("blog.whatsapp_cta")}</h3>
          <p className={`text-sm max-w-md transition ${
            isDark ? "text-slate-400" : "text-[#52606d]"
          }`}>
            {t("blog.whatsapp_desc")}
          </p>
          <WhatsAppChannelButton variant="primary" size="md" sourcePage="blog_detail" />
        </div>
      </div>
    </main>
  );
}
