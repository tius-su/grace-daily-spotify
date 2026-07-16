"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { toggleAudio, stopAudio } from "@/lib/audio";
import { cleanEncyclopediaArticle, encyclopediaSlug } from "@/lib/encyclopedia";
import { downloadPdf } from "@/lib/share";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { buildBibleDeepLinkHref } from "@/lib/bible-deeplink";
import { AdSenseAd } from "@/app/components/AdSenseAd";
import { useLanguage } from "@/lib/i18n";


type EncyclopediaClientProps = {
  title: string;
  title_en?: string;
  title_zh?: string;
  kategori: string;
  keyword: string;
  slug: string;
  bannerUrl?: string;
  illustrationUrl?: string;
  isi_artikel: string;
  isi_artikel_en?: string;
  isi_artikel_zh?: string;
};

// Regex to replace scripture references with clickable links
export function renderTextWithBibleLinks(text: string) {
  const bibleRegex = /\b(Kejadian|Keluaran|Imamat|Bilangan|Ulangan|Yosua|Hakim-hakim|Hakim|Rut|1\s*Samuel|2\s*Samuel|1\s*Raja-raja|2\s*Raja-raja|1\s*Tawarikh|2\s*Tawarikh|Ezra|Nehemia|Ester|Ayub|Mazmur|Amsal|Pengkhotbah|Kidung\s*Agung|Kidung|Yesaya|Yeremia|Ratapan|Yehezkiel|Daniel|Hosea|Yoel|Amos|Obaja|Yunus|Mikha|Nahum|Habakuk|Zefanya|Hagai|Zakharia|Maleakhi|Matius|Markus|Lukas|Yohanes|Kisah\s*Para\s*Rasul|Kisah|Roma|1\s*Korintus|2\s*Korintus|Galatia|Efesus|Filipi|Kolose|1\s*Tesalonika|2\s*Tesalonika|1\s*Timotius|2\s*Timotius|Titus|Filemon|Ibrani|Yakobus|1\s*Petrus|2\s*Petrus|1\s*Yohanes|2\s*Yohanes|3\s*Yohanes|Yudas|Wahyu|Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Rut|1\s*Kings|2\s*Kings|1\s*Chronicles|2\s*Chronicles|Psalms|Psalm|Proverbs|Ecclesiastes|Song\s*of\s*Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Joel|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1\s*Corinthians|2\s*Corinthians|Galatians|Ephesians|Philippians|Colossians|1\s*Thessalonians|2\s*Thessalonians|1\s*Timothy|2\s*Timothy|Philemon|Hebrews|James|1\s*Peter|2\s*Peter|1\s*John|2\s*John|3\s*John|Jude|Revelation)\s+(\d+)(?::([\d\-,\s]+))?/gi;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = bibleRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const reference = match[0];
    const deepLink = buildBibleDeepLinkHref(reference);
    const href = deepLink ?? `/alkitab?search=${encodeURIComponent(reference.trim())}`;
    parts.push(
      <Link
        key={matchIndex}
        href={href}
        className="text-[#2a6f6f] font-semibold hover:underline"
      >
        {reference}
      </Link>
    );

    lastIndex = bibleRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export function extractBibleReference(text: string): string {
  const bibleRegex = /\b(Kejadian|Keluaran|Imamat|Bilangan|Ulangan|Yosua|Hakim-hakim|Hakim|Rut|1\s*Samuel|2\s*Samuel|1\s*Raja-raja|2\s*Raja-raja|1\s*Tawarikh|2\s*Tawarikh|Ezra|Nehemia|Ester|Ayub|Mazmur|Amsal|Pengkhotbah|Kidung\s*Agung|Kidung|Yesaya|Yeremia|Ratapan|Yehezkiel|Daniel|Hosea|Yoel|Amos|Obaja|Yunus|Mikha|Nahum|Habakuk|Zefanya|Hagai|Zakharia|Maleakhi|Matius|Markus|Lukas|Yohanes|Kisah\s*Para\s*Rasul|Kisah|Roma|1\s*Korintus|2\s*Korintus|Galatia|Efesus|Filipi|Kolose|1\s*Tesalonika|2\s*Tesalonika|1\s*Timotius|2\s*Timotius|Titus|Filemon|Ibrani|Yakobus|1\s*Petrus|2\s*Petrus|1\s*Yohanes|2\s*Yohanes|3\s*Yohanes|Yudas|Wahyu|Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Rut|1\s*Kings|2\s*Kings|1\s*Chronicles|2\s*Chronicles|Psalms|Psalm|Proverbs|Ecclesiastes|Song\s*of\s*Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Joel|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1\s*Corinthians|2\s*Corinthians|Galatians|Ephesians|Philippians|Colossians|1\s*Thessalonians|2\s*Thessalonians|1\s*Timothy|2\s*Timothy|Philemon|Hebrews|James|1\s*Peter|2\s*Peter|1\s*John|2\s*John|3\s*John|Jude|Revelation)\s+(\d+)(?::([\d\-,\s]+))?/gi;
  const match = text.match(bibleRegex);
  return match ? match[0].trim() : text.trim();
}

export function renderAsParagraphs(items: string[], isDark = false) {
  const lines: string[] = [];
  items.forEach((item) => {
    item.split(/\n+/).forEach((line) => {
      const cleaned = line.replace(/^\s*[-*•\d\.\)\(\s]+\s*/, "").trim();
      if (cleaned) lines.push(cleaned);
    });
  });
  return lines.map((line, idx) => (
    <p key={idx} className={`mb-4 leading-relaxed last:mb-0 ${isDark ? "text-[#F5F5DC]" : "text-[#334155]"}`}>
      {renderTextWithBibleLinks(line)}
    </p>
  ));
}

export default function EncyclopediaClient(props: EncyclopediaClientProps) {
  const { title, title_en, title_zh, isi_artikel, isi_artikel_en, isi_artikel_zh, bannerUrl, illustrationUrl, kategori, slug } = props;
  const { language } = useLanguage();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const renderLanguage = isMounted ? language : "id";

  const tLocal = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      back: { id: "← Kembali ke Daftar Isi", en: "← Back to Table of Contents", zh: "← 返回目录" },
      audioListen: { id: "Dengarkan", en: "Listen", zh: "听取音频" },
      audioStop: { id: "Hentikan", en: "Stop", zh: "停止" },
      audioTitle: { id: "Audio Ensiklopedia", en: "Audio Encyclopedia", zh: "百科音频" },
      shareFacebook: { id: "Bagikan", en: "Share", zh: "分享" },
      pdf: { id: "PDF", en: "PDF", zh: "PDF" },
      copied: { id: "Tautan berhasil disalin!", en: "Link copied successfully!", zh: "链接已成功复制！" },
      copyLink: { id: "Salin Tautan", en: "Copy Link", zh: "复制链接" },
      koreksi: { id: "⚠️ Koreksi", en: "⚠️ Correct", zh: "⚠️ 纠错" },
      modeRingkas: { id: "Mode Ringkas", en: "Summary Mode", zh: "摘要模式" },
      modeMendalam: { id: "Mode Mendalam", en: "Deep Mode", zh: "深度模式" },
      ringkasanKunci: { id: "Ringkasan Kunci", en: "Key Summary", zh: "核心摘要" },
      informasiSingkat: { id: "Informasi Singkat", en: "Fast Info", zh: "简要信息" },
      peristiwaPenting: { id: "⚡ Peristiwa Penting & Kronologi", en: "⚡ Major Events & Chronology", zh: "⚡ 重大事件与年代记" },
      pelajaranRohani: { id: "🌱 Pelajaran Rohani & Penerapan", en: "🌱 Spiritual Lessons & Application", zh: "🌱 属灵教训与应用" },
      ayatReferensi: { id: "📖 Daftar Ayat Referensi", en: "📖 Scripture References", zh: "📖 经文引用列表" },
      faq: { id: "❓ Pertanyaan yang Sering Diajukan (FAQ)", en: "❓ Frequently Asked Questions (FAQ)", zh: "❓ 常见问题解答 (FAQ)" },
      compareTitle: { id: "⚖️ Bandingkan Tokoh Alkitab", en: "⚖️ Compare Biblical Figures", zh: "⚖️ 圣经人物对比" },
      compareHide: { id: "Sembunyikan", en: "Hide", zh: "隐藏" },
      compareOpen: { id: "Buka Perbandingan", en: "Open Comparison", zh: "展开对比" },
      compareDesc: { id: "Bandingkan karakter, panggilan rohani, dan kontribusi teologis", en: "Compare character, spiritual calling, and theological contributions", zh: "对比人物性格、属灵呼召及神学贡献" },
      comparePlaceholder: { id: "Masukkan nama tokoh (contoh: Yosua, Saul, Daud)", en: "Enter character name (e.g. Joshua, Saul, David)", zh: "输入人物名称 (例如: 约书亚, 扫罗, 大卫)" },
      compareBtn: { id: "Bandingkan", en: "Compare", zh: "对比" },
      compareLoading: { id: "Memuat...", en: "Loading...", zh: "加载中..." },
      compareRecommend: { id: "Rekomendasi:", en: "Recommended:", zh: "推荐对比:" },
      compareCriteria: { id: "Kriteria", en: "Criteria", zh: "对比维度" },
      comparePanggilan: { id: "Panggilan / Latar Belakang", en: "Calling / Background", zh: "呼召 / 背景" },
      comparePeristiwa: { id: "Peristiwa Kunci", en: "Key Events", zh: "关键事件" },
      compareKelemahan: { id: "Ujian / Kelemahan", en: "Test / Weakness", zh: "考验 / 软弱" },
      comparePelajaran: { id: "Pelajaran Character", en: "Character Lessons", zh: "性格启示" },
      comparePersamaan: { id: "🔗 Persamaan Utama", en: "🔗 Key Similarities", zh: "🔗 主要相同点" },
      comparePerbedaan: { id: "📊 Perbedaan Utama", en: "📊 Key Differences", zh: "📊 主要不同点" },
      sourcesTitle: { id: "Sumber & Batasan Informasi", en: "Information Scope & Sources", zh: "信息来源与范围" },
      sourcesDesc: { id: "Artikel ensiklopedia ini disusun secara eksklusif berdasarkan teks Alkitab Perjanjian Lama dan Perjanjian Baru. Platform ini menghindari spekulasi sejarah eksternal atau tradisi sekuler non-alkitabiah guna menjaga kemurnian dan ketepatan materi teologis untuk studi Anda.", en: "This encyclopedia article is compiled exclusively based on the texts of the Old and New Testaments. This platform avoids external historical speculations or secular non-biblical traditions to maintain the purity and accuracy of theological materials for your study.", zh: "本百科文章完全基于新旧约圣经文本编写。本平台避免外部历史推测或世俗的非圣经传统，以确保为您学习提供最纯粹和最准确的神学材料。" },
      relatedDevotions: { id: "Renungan Terkait", en: "Related Devotions", zh: "相关灵修" },
      myBookmarks: { id: "Bookmark Saya", en: "My Bookmarks", zh: "我的书签" },
      lastViewed: { id: "Terakhir Dilihat", en: "Recently Viewed", zh: "最近浏览" },
      reportTitle: { id: "Laporkan Koreksi Artikel", en: "Report Article Correction", zh: "报告文章纠错" },
      reportDesc: { id: "Apakah Anda menemukan kekeliruan kutipan ayat atau kekeliruan historis alkitabiah di artikel? Silakan kirim detailnya untuk tim teologi kami tinjau.", en: "Did you find any scripture reference errors or historical biblical errors in this article? Please submit the details for our theological team to review.", zh: "您是否在此文章中发现经文引用错误或圣经历史错误？请提交详细信息供我们的神学团队审核。" },
      reportPlaceholder: { id: "Tuliskan ayat yang kurang pas atau koreksi Anda...", en: "Write down the incorrect verse or your correction...", zh: "写下不准确的经文 or 您的纠正意见..." },
      cancel: { id: "Batal", en: "Cancel", zh: "取消" },
      submitReport: { id: "Kirim Laporan", en: "Submit Report", zh: "提交报告" },
      reportSuccess: { id: "Laporan berhasil dikirim. Terima kasih atas masukan Anda!", en: "Report submitted successfully. Thank you for your feedback!", zh: "报告提交成功。感谢您的反馈！" }
    };
    return dict[key]?.[renderLanguage] || dict[key]?.id || key;
  };

  const [activeTitle, setActiveTitle] = useState(title);
  const [activeIsiArtikel, setActiveIsiArtikel] = useState(isi_artikel);
  const [isTranslating, setIsTranslating] = useState(false);
  const [theme, setTheme] = useState("light");
  const [shareErr, setShareErr] = useState<string>("");
  const [mode, setMode] = useState<"ringkas" | "mendalam">("mendalam");

  const isDark = theme === "dark";

  useEffect(() => {
    if (language === "id") {
      setActiveTitle(title);
      setActiveIsiArtikel(isi_artikel);
      return;
    }
    
    // Check if pre-translated props exist
    const preTranslatedTitle = language === "en" ? title_en : title_zh;
    const preTranslatedIsi = language === "en" ? isi_artikel_en : isi_artikel_zh;
    
    if (preTranslatedTitle && preTranslatedIsi) {
      setActiveTitle(preTranslatedTitle);
      setActiveIsiArtikel(preTranslatedIsi);
      return;
    }

    let active = true;
    setIsTranslating(true);
    const fetchTranslation = async () => {
      try {
        const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev";
        const res = await fetch(`${r2Url}/encyclopedia/${kategori}/${slug}_${language}.json`);
        if (res.ok && active) {
          const data = await res.json();
          if (data) {
            setActiveTitle(data.title || data.keyword || title);
            setActiveIsiArtikel(data.isi_artikel || isi_artikel);
            setIsTranslating(false);
            return;
          }
        }
        
        // Dynamic fetch fallback via /api/translate
        if (active) {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: [title, isi_artikel],
              to: language,
              type: "encyclopedia",
              id: `${kategori}-${slug}`
            })
          });
          if (response.ok && active) {
            const resData = await response.json();
            if (resData && Array.isArray(resData.translated)) {
              setActiveTitle(resData.translated[0] || title);
              setActiveIsiArtikel(resData.translated[1] || isi_artikel);
            }
          }
        }
      } catch (err) {
        console.error("Gagal mengambil terjemahan ensiklopedia:", err);
      } finally {
        if (active) setIsTranslating(false);
      }
    };
    fetchTranslation();
    return () => {
      active = false;
    };
  }, [language, title, isi_artikel, kategori, slug]);

  // Read theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("tma-theme") || "light";
    setTheme(saved);
  }, []);
  
  // Bookmarks & History
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [relatedDevotions, setRelatedDevotions] = useState<Array<{ id: string; title: string; verseRef: string }>>([]);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportComment, setReportComment] = useState("");
  const [activeSpeechText, setActiveSpeechText] = useState<string | null>(null);

  // Tokoh Comparison
  const [compareTarget, setCompareTarget] = useState("");
  const [compareResult, setCompareResult] = useState<any>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [showCompareSection, setShowCompareSection] = useState(false);

  const handleCompare = async (target: string) => {
    if (!target.trim()) return;
    setCompareLoading(true);
    setCompareError("");
    setCompareResult(null);
    try {
      const res = await fetch(`/api/ensiklopedia/compare?name1=${encodeURIComponent(title)}&name2=${encodeURIComponent(target)}`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data perbandingan.");
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setCompareResult(data);
    } catch (err: any) {
      setCompareError(err.message || "Gagal membuat perbandingan.");
    } finally {
      setCompareLoading(false);
    }
  };

  const cleanArticle = useMemo(() => cleanEncyclopediaArticle(activeIsiArtikel), [activeIsiArtikel]);

  // Load Bookmarks & History from localStorage
  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem("encyclopedia_bookmarks");
      if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));

      const savedHistory = localStorage.getItem("encyclopedia_history");
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.warn("LocalStorage bookmarks/history not available:", e);
    }
  }, []);

  // Save current page to history
  useEffect(() => {
    if (!title) return;
    try {
      const savedHistory = localStorage.getItem("encyclopedia_history");
      const currentHist: string[] = savedHistory ? JSON.parse(savedHistory) : [];
      const filtered = currentHist.filter(h => h !== title);
      const next = [title, ...filtered].slice(0, 10);
      setHistory(next);
      localStorage.setItem("encyclopedia_history", JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to save history:", e);
    }
  }, [title]);

  // Load Related Devotions
  useEffect(() => {
    async function fetchRelated() {
      try {
        const res = await fetch(`/api/ensiklopedia/related-devotions?keyword=${encodeURIComponent(title)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.devotions) {
            setRelatedDevotions(data.devotions);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch related devotions:", err);
      }
    }
    fetchRelated();
  }, [title]);

  const isBookmarked = bookmarks.includes(title);

  const toggleBookmark = () => {
    let next: string[];
    if (isBookmarked) {
      next = bookmarks.filter(b => b !== title);
    } else {
      next = [...bookmarks, title];
    }
    setBookmarks(next);
    try {
      localStorage.setItem("encyclopedia_bookmarks", JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to save bookmarks:", e);
    }
  };

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // Parse sections dynamically — supports ID, EN, ZH headings
  const sections = useMemo(() => {
    const paragraphs = cleanArticle.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    const parsed: {
      ringkasan: string[];
      infoSingkat: string[];
      peristiwaPenting: string[];
      ayatReferensi: string[];
      pelajaranRohani: string[];
      faq: string[];
      lainnya: string[];
    } = {
      ringkasan: [],
      infoSingkat: [],
      peristiwaPenting: [],
      ayatReferensi: [],
      pelajaranRohani: [],
      faq: [],
      lainnya: [],
    };

    let current: keyof typeof parsed = "lainnya";

    for (const p of paragraphs) {
      const stripped = p.replace(/^##\s*/i, "").trim();
      const cleanLower = stripped.toLowerCase().replace(/[^a-z0-9\s&\u4e00-\u9fff]/g, "").trim();
      const isHeading = p.startsWith("##");

      // Summary / Ringkasan / 摘要
      if (
        (isHeading || !isHeading) && (
          cleanLower.startsWith("ringkasan") ||
          cleanLower.startsWith("summary") ||
          cleanLower.startsWith("key summary") ||
          cleanLower.startsWith("摘要") ||
          cleanLower.startsWith("核心摘要")
        )
      ) {
        current = "ringkasan";
        const content = stripped.replace(/^(ringkasan kunc[i]?|summary|key summary|摘要|核心摘要)\s*:?/i, "").trim();
        if (content) parsed.ringkasan.push(content);
      // Fast Info / Informasi Singkat / 简要信息
      } else if (
        (isHeading || !isHeading) && (
          cleanLower.startsWith("informasi singkat") ||
          cleanLower.startsWith("info singkat") ||
          cleanLower.startsWith("fast info") ||
          cleanLower.startsWith("brief info") ||
          cleanLower.startsWith("简要信息") ||
          cleanLower.startsWith("快速信息")
        )
      ) {
        current = "infoSingkat";
        const content = stripped.replace(/^(informasi singkat|info singkat|fast info|brief info|简要信息|快速信息)\s*:?/i, "").trim();
        if (content) parsed.infoSingkat.push(content);
      // Events / Peristiwa Penting / 重大事件
      } else if (
        (isHeading || !isHeading) && (
          cleanLower.startsWith("peristiwa penting") ||
          cleanLower.startsWith("kronologi") ||
          cleanLower.startsWith("major events") ||
          cleanLower.startsWith("key events") ||
          cleanLower.startsWith("chronology") ||
          cleanLower.startsWith("重大事件") ||
          cleanLower.startsWith("年代记")
        )
      ) {
        current = "peristiwaPenting";
        const content = stripped.replace(/^(peristiwa penting.*?kronologi|peristiwa penting|kronologi|major events.*?chronology|major events|key events|chronology|重大事件|年代记)\s*:?/i, "").trim();
        if (content) parsed.peristiwaPenting.push(content);
      // Spiritual Lessons / Pelajaran Rohani / 属灵教训
      } else if (
        (isHeading || !isHeading) && (
          cleanLower.startsWith("pelajaran rohani") ||
          cleanLower.startsWith("penerapan") ||
          cleanLower.startsWith("spiritual lesson") ||
          cleanLower.startsWith("application") ||
          cleanLower.startsWith("属灵教训") ||
          cleanLower.startsWith("应用")
        )
      ) {
        current = "pelajaranRohani";
        const content = stripped.replace(/^(pelajaran rohani.*?penerapan|pelajaran rohani|pelajaran|spiritual lessons.*?application|spiritual lessons|application|属灵教训|应用)\s*:?/i, "").trim();
        if (content) parsed.pelajaranRohani.push(content);
      // Scripture References / Ayat Referensi / 经文引用
      } else if (
        (isHeading || !isHeading) && (
          cleanLower.startsWith("ayat referensi") ||
          cleanLower.startsWith("daftar ayat") ||
          cleanLower.startsWith("scripture reference") ||
          cleanLower.startsWith("bible reference") ||
          cleanLower.startsWith("经文引用") ||
          cleanLower.startsWith("相关经文")
        )
      ) {
        current = "ayatReferensi";
        const content = stripped.replace(/^(daftar ayat referensi|ayat referensi|ayat penting|scripture references|bible references|经文引用|相关经文)\s*:?/i, "").trim();
        if (content) parsed.ayatReferensi.push(content);
      // FAQ / Sources
      } else if (
        (isHeading || !isHeading) && (
          cleanLower.startsWith("sumber") ||
          cleanLower.startsWith("batasan") ||
          cleanLower.startsWith("faq") ||
          cleanLower.startsWith("pertanyaan") ||
          cleanLower.startsWith("frequently asked") ||
          cleanLower.startsWith("常见问题") ||
          cleanLower.startsWith("信息来源")
        )
      ) {
        current = "faq";
        const content = stripped.replace(/^(sumber.*?batasan informasi|sumber|batasan|faq|pertanyaan|frequently asked questions|常见问题|信息来源)\s*:?/i, "").trim();
        if (content) parsed.faq.push(content);
      } else {
        if (current === "lainnya" && parsed.ringkasan.length === 0) {
          parsed.ringkasan.push(p);
          current = "ringkasan";
        } else {
          parsed[current].push(p);
        }
      }
    }

    return parsed;
  }, [cleanArticle]);

  // Audio narrations
  const handleTextToSpeech = async (customText?: string, label?: string) => {
    const text = customText || `${activeTitle}. ${cleanArticle}`.trim();
    if (!text) return;

    if (activeSpeechText === label) {
      stopAudio();
      setActiveSpeechText(null);
      return;
    }

    try {
      stopAudio();
      setActiveSpeechText(label || "all");
      const speechLang = language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID";
      toggleAudio(text, false, (status) => {
        if (!status) setActiveSpeechText(null);
      }, speechLang);
    } catch {
      setActiveSpeechText(null);
    }
  };

  const handleShare = async () => {
    try {
      const url = window.location.href;
      const shareText = `${activeTitle} — Ensiklopedia Alkitab`;
      if (navigator.share) {
        await navigator.share({ title: activeTitle, text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(`${activeTitle} — ${url}`);
      alert(language === "zh" ? "文章链接已复制。" : language === "en" ? "Article link copied." : "Link artikel telah disalin.");
    } catch {
      setShareErr("Gagal share.");
    }
  };


  const submitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportComment.trim()) return;

    try {
      if (db) {
        await addDoc(collection(db, "ensiklopedia_corrections"), {
          articleId: `${kategori}-${encyclopediaSlug(title)}`,
          articleTitle: title,
          kategori: kategori,
          comment: reportComment.trim(),
          status: "pending",
          createdAt: serverTimestamp(),
          userId: auth?.currentUser?.uid || "guest",
          userEmail: auth?.currentUser?.email || "anonymous",
        });
      }
      setReportSuccess(true);
      setReportComment("");
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportModal(false);
      }, 2500);
    } catch (err) {
      console.error("Gagal mengirim koreksi ke Firestore:", err);
      // Fallback: still show success to user so they are not blocked
      setReportSuccess(true);
      setReportComment("");
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportModal(false);
      }, 2500);
    }
  };

  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

  // Parse Q&A pairs for FAQ accordion
  const faqPairs = useMemo(() => {
    const pairs: Array<{ q: string; a: string }> = [];
    let currentQ = "";
    let currentA = "";

    sections.faq.forEach((line) => {
      const cleanLine = line.trim();
      const cleanLower = cleanLine.toLowerCase();
      if (cleanLower.startsWith("q:") || cleanLower.startsWith("p:") || cleanLine.startsWith("?")) {
        if (currentQ && currentA) {
          pairs.push({ q: currentQ, a: currentA });
        }
        currentQ = cleanLine.replace(/^(q|p)\s*:\s*/i, "").trim();
        currentA = "";
      } else if (cleanLower.startsWith("a:") || cleanLower.startsWith("j:")) {
        currentA = cleanLine.replace(/^(a|j)\s*:\s*/i, "").trim();
      } else {
        if (currentQ) {
          currentA = currentA ? `${currentA} ${cleanLine}` : cleanLine;
        }
      }
    });

    if (currentQ && currentA) {
      pairs.push({ q: currentQ, a: currentA });
    }

    // fallback
    if (pairs.length === 0 && sections.faq.length > 0) {
      sections.faq.forEach((item, index) => {
        if (index % 2 === 0) {
          currentQ = item;
        } else {
          pairs.push({ q: currentQ, a: item });
        }
      });
    }

    return pairs;
  }, [sections.faq]);

  // Clean Info Singkat Key Value pairs
  const infoSingkatPairs = useMemo(() => {
    const items: Array<{ key: string; val: string }> = [];
    sections.infoSingkat.forEach(line => {
      // Support new "Detail:..." paragraph format
      const detailLines = line.split(/\n/).map(x => x.trim()).filter(Boolean);
      for (const dl of detailLines) {
        const detailMatch = dl.match(/^Detail\s*:\s*(.+)/i);
        if (detailMatch) {
          items.push({ key: "Detail", val: detailMatch[1].trim() });
          continue;
        }
        // Legacy bullet format
        const bullets = dl.split(/[•\-\*]/).map(x => x.trim()).filter(Boolean);
        bullets.forEach(b => {
          const parts = b.split(/[:\-=]/);
          if (parts.length >= 2) {
            items.push({
              key: parts[0].trim(),
              val: parts.slice(1).join(":").trim()
            });
          } else {
            items.push({
              key: "Detail",
              val: b
            });
          }
        });
      }
    });
    return items;
  }, [sections.infoSingkat]);

  const fullContentForPdf = useMemo(() => {
    let text = `${cleanArticle}\n\n`;

    if (infoSingkatPairs.length > 0) {
      text += `INFORMASI SINGKAT\n`;
      infoSingkatPairs.forEach((pair) => {
        text += `- ${pair.key}: ${pair.val}\n`;
      });
      text += `\n`;
    }

    const events = sections.peristiwaPenting.flatMap(p => p.split(/\n+/)).map(e => e.replace(/^\s*[-*•\d\.\)\(\s]+\s*/, "").trim()).filter(Boolean);
    if (events.length > 0) {
      text += `PERISTIWA PENTING & KRONOLOGI\n`;
      events.forEach((event, idx) => {
        text += `${idx + 1}. ${event}\n`;
      });
      text += `\n`;
    }

    const lessons = sections.pelajaranRohani.flatMap(p => p.split(/\n+/)).map(p => p.replace(/^\s*[-*•\d\.\)\(\s]+\s*/, "").trim()).filter(Boolean);
    if (lessons.length > 0) {
      text += `PELAJARAN ROHANI & PENERAPAN\n`;
      lessons.forEach((p) => {
        text += `${p}\n\n`;
      });
    }

    const verses = sections.ayatReferensi.flatMap(p => p.split(/[,\n]/)).map(x => x.trim()).filter(Boolean);
    if (verses.length > 0) {
      text += `AYAT REFERENSI\n`;
      text += verses.join(", ") + `\n\n`;
    }

    if (faqPairs.length > 0) {
      text += `PERTANYAAN YANG SERING DIAJUKAN (FAQ)\n`;
      faqPairs.forEach((pair) => {
        text += `Tanya: ${pair.q}\n`;
        text += `Jawab: ${pair.a}\n\n`;
      });
    }

    return text.trim();
  }, [cleanArticle, infoSingkatPairs, sections, faqPairs]);

  return (
    <main className={`min-h-screen px-5 py-8 sm:px-8 transition-colors duration-300 ${
      isDark ? "bg-slate-950 text-slate-100" : "bg-[#f7f4ee] text-[#1f2933]"
    }`}>
    <div className="mx-auto max-w-3xl w-full">
      {/* Breadcrumb Header */}
      <header className={`mb-6 border-b pb-4 transition ${
        isDark ? "border-slate-800" : "border-[#dfd8ca]"
      }`}>
        <nav className={`text-sm mb-2 transition ${isDark ? "text-slate-400" : "text-[#52606d]"}`}>
          <Link href="/ensiklopedia" className={`hover:underline transition ${
            isDark ? "text-cyan-400" : "text-[#2a6f6f]"
          }`}>
            {renderLanguage === "zh" ? "百科全书" : renderLanguage === "en" ? "Encyclopedia" : "Ensiklopedia"}
          </Link>
          <span className="mx-2">›</span>
          <span className="font-semibold capitalize">{kategori}</span>
        </nav>
        <h1 className={`text-3xl font-semibold transition ${
          isDark ? "text-white" : "text-[#14213d]"
        }`}>{activeTitle}</h1>
        {isTranslating && (
          <div className={`flex items-center gap-2 mt-2 text-xs ${isDark ? "text-slate-400" : "text-[#52606d]"}`}>
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
            {renderLanguage === "zh" ? "正在翻译文章..." : renderLanguage === "en" ? "Translating article..." : "Menerjemahkan artikel..."}
          </div>
        )}
      </header>

      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerUrl}
          alt={activeTitle}
          className={`w-full max-h-[260px] object-cover rounded-lg border mb-6 transition ${
            isDark ? "border-slate-800" : "border-[#dfd8ca]"
          }`}
        />
      )}

      {/* AdSense Header Ad */}
      <div className="mb-6">
        <AdSenseAd placement="header" />
      </div>

      {/* Top Banner and Floating Illustration Info */}
      <div className="relative mb-6">
        <img
          src={illustrationUrl || "/fallback.webp"}
          alt={`${activeTitle} ilustrasi`}
          className={`w-full max-h-[300px] object-cover rounded-xl border bg-white shadow-md transition ${
            isDark ? "border-slate-800" : "border-[#dfd8ca]"
          }`}
        />
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={toggleBookmark}
            className={`rounded-full p-2.5 shadow-md transition ${
              isBookmarked
                ? "bg-[#ffd166] text-[#14213d]"
                : isDark
                  ? "bg-slate-800/90 text-slate-300 hover:bg-slate-700"
                  : "bg-white/80 text-[#52606d] hover:bg-white"
            }`}
            title={isBookmarked ? (renderLanguage === "zh" ? "取消书签" : renderLanguage === "en" ? "Remove Bookmark" : "Hapus Bookmark") : (renderLanguage === "zh" ? "添加书签" : renderLanguage === "en" ? "Bookmark Article" : "Bookmark Artikel")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Buttons / Toolbar */}
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 border-b pb-5 transition ${
        isDark ? "border-slate-800" : "border-[#dfd8ca]"
      }`}>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleTextToSpeech(undefined, "all")}
            className={`flex-1 sm:flex-none justify-center rounded-md px-4 py-2 text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeSpeechText === "all"
                ? "bg-red-500 text-white animate-pulse"
                : isDark
                  ? "bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold"
                  : "bg-[#2a6f6f] text-white hover:bg-[#1a4a4a]"
            }`}
          >
            {activeSpeechText === "all" ? (renderLanguage === "zh" ? "⏸ 停止" : renderLanguage === "en" ? "⏸ Stop" : "⏸ Hentikan") : (renderLanguage === "zh" ? "🔊 朗读" : renderLanguage === "en" ? "🔊 Narrate" : "🔊 Narasi")}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className={`flex-1 sm:flex-none justify-center rounded-md border px-4 py-2 text-sm font-semibold transition flex items-center gap-1 ${
              isDark ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-[#dfd8ca] bg-white text-[#14213d] hover:bg-[#f7f4ee]"
            }`}
          >
            {renderLanguage === "zh" ? "↗ 分享" : renderLanguage === "en" ? "↗ Share" : "↗ Bagikan"}
          </button>

          <button
            type="button"
            onClick={() =>
              downloadPdf(activeTitle, fullContentForPdf, {
                bannerUrl,
                illustrationUrl,
                subtitle: kategori,
              })
            }
            className={`flex-1 sm:flex-none justify-center rounded-md border px-4 py-2 text-sm font-semibold transition flex items-center gap-1 cursor-pointer ${
              isDark ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-[#dfd8ca] bg-[#f7f4ee] text-[#14213d] hover:bg-white"
            }`}
          >
            ⬇ PDF
          </button>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="flex-1 sm:flex-none justify-center rounded-md border border-red-200 bg-red-50/50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition cursor-pointer"
          >
            {renderLanguage === "zh" ? "⚠️ 纠错" : renderLanguage === "en" ? "⚠️ Correct" : "⚠️ Koreksi"}
          </button>
        </div>

        {/* Mode Toggler: Ringkas vs Mendalam */}
        <div className={`flex rounded-lg border p-1 w-full sm:w-auto justify-center sm:justify-start ${
          isDark ? "border-slate-700 bg-slate-900" : "border-[#dfd8ca] bg-[#f7f4ee]"
        }`}>
          <button
            onClick={() => setMode("ringkas")}
            className={`flex-1 sm:flex-none text-center rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              mode === "ringkas" ? "bg-white text-[#14213d] shadow-sm" : "text-[#52606d] hover:text-[#14213d]"
            }`}
          >
            {tLocal("modeRingkas")}
          </button>
          <button
            onClick={() => setMode("mendalam")}
            className={`flex-1 sm:flex-none text-center rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              mode === "mendalam" ? "bg-white text-[#14213d] shadow-sm" : "text-[#52606d] hover:text-[#14213d]"
            }`}
          >
            {tLocal("modeMendalam")}
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="space-y-8">
          {/* Ringkasan */}
          {sections.ringkasan.length > 0 && (
            <section className={`rounded-xl border-l-4 border-[#2a6f6f] p-6 shadow-sm transition ${
              isDark ? "bg-slate-900/60" : "bg-white"
            }`}>
              <div className="flex justify-between items-center mb-3">
                <h2 className={`text-xs font-bold uppercase tracking-widest transition ${
                  isDark ? "text-cyan-400" : "text-[#2a6f6f]"
                }`}>
                  {tLocal("ringkasanKunci")}
                </h2>
                <button
                  onClick={() => handleTextToSpeech(sections.ringkasan.join(" "), "ringkasan")}
                  className={`text-xs hover:underline transition ${
                    isDark ? "text-cyan-400" : "text-[#2a6f6f]"
                  }`}
                >
                  {activeSpeechText === "ringkasan" ? "Pause" : "🔊 Putar"}
                </button>
              </div>
              <div className={`text-lg leading-relaxed italic transition ${
                isDark ? "text-[#F5F5DC]" : "text-[#1f2933]"
              }`}>
                {renderAsParagraphs(sections.ringkasan, isDark)}
              </div>
            </section>
          )}

          {/* Informasi Singkat */}
          {infoSingkatPairs.length > 0 && (
            <section className={`rounded-xl border p-6 shadow-sm transition ${
              isDark ? "border-slate-800 bg-slate-900/60" : "border-[#dfd8ca] bg-white"
            }`}>
              <h2 className={`text-sm font-bold uppercase tracking-widest mb-4 transition ${
                isDark ? "text-slate-300" : "text-[#14213d]"
              }`}>
                {tLocal("informasiSingkat")}
              </h2>
              <div className="space-y-3">
                {infoSingkatPairs.map((pair, i) => (
                  <p key={i} className={`text-sm leading-relaxed transition ${
                    isDark ? "text-[#F5F5DC]" : "text-[#1f2933]"
                  }`}>
                    <strong className={`uppercase tracking-wider text-xs mr-2 transition ${
                      isDark ? "text-cyan-400" : "text-[#14213d]"
                    }`}>{pair.key}:</strong>
                    {renderTextWithBibleLinks(pair.val)}
                  </p>
                ))}
              </div>
            </section>
          )}

          {/* Mode Mendalam Sections */}
          {mode === "mendalam" && (
            <>
              {/* Peristiwa Penting & Kronologi */}
              {sections.peristiwaPenting.length > 0 && (
                <section className={`rounded-xl border p-6 shadow-sm transition ${
                  isDark ? "border-slate-800 bg-slate-900/60" : "border-[#dfd8ca] bg-white"
                }`}>
                  <div className={`flex justify-between items-center mb-4 border-b pb-3 transition ${
                    isDark ? "border-slate-800" : "border-[#dfd8ca]"
                  }`}>
                    <h2 className={`text-sm font-bold uppercase tracking-widest flex items-center gap-1.5 transition ${
                      isDark ? "text-slate-300" : "text-[#14213d]"
                    }`}>
                      {tLocal("peristiwaPenting")}
                    </h2>
                    <button
                      onClick={() => handleTextToSpeech(sections.peristiwaPenting.join(" "), "timeline")}
                      className={`text-xs hover:underline transition ${
                        isDark ? "text-cyan-400" : "text-[#2a6f6f]"
                      }`}
                    >
                      {activeSpeechText === "timeline" ? "Pause" : "🔊 Putar"}
                    </button>
                  </div>
                  <div className={`leading-relaxed space-y-3 transition ${
                    isDark ? "text-[#F5F5DC]" : "text-[#1f2933]"
                  }`}>
                    {renderAsParagraphs(sections.peristiwaPenting, isDark)}
                  </div>
                </section>
              )}

              {/* Pelajaran Rohani */}
              {sections.pelajaranRohani.length > 0 && (
                <section className={`rounded-xl border p-6 shadow-sm transition ${
                  isDark ? "border-slate-800 bg-teal-900/10" : "border-[#dfd8ca] bg-[#e9f5db]/40"
                }`}>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className={`text-sm font-bold uppercase tracking-widest flex items-center gap-1.5 transition ${
                      isDark ? "text-emerald-400" : "text-[#2a6f6f]"
                    }`}>
                      {tLocal("pelajaranRohani")}
                    </h2>
                    <button
                      onClick={() => handleTextToSpeech(sections.pelajaranRohani.join(" "), "pelajaran")}
                      className={`text-xs hover:underline transition ${
                        isDark ? "text-cyan-400" : "text-[#2a6f6f]"
                      }`}
                    >
                      {activeSpeechText === "pelajaran" ? "Pause" : "🔊 Putar"}
                    </button>
                  </div>
                  <div className={`leading-relaxed space-y-3 transition ${
                    isDark ? "text-[#F5F5DC]" : "text-[#1f2933]"
                  }`}>
                    {renderAsParagraphs(sections.pelajaranRohani, isDark)}
                  </div>
                </section>
              )}

              {/* Ayat Referensi */}
              {sections.ayatReferensi.length > 0 && (
                <section className="rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-[#14213d] mb-4">
                    {tLocal("ayatReferensi")}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {sections.ayatReferensi.flatMap(p => p.split(/[,\n]/)).map(x => x.trim()).filter(Boolean).map((verse, i) => {
                      const cleanRef = extractBibleReference(verse);
                      const deepLink = buildBibleDeepLinkHref(cleanRef);
                      const href = deepLink ?? `/alkitab?search=${encodeURIComponent(cleanRef)}`;
                      return (
                        <Link
                          key={i}
                          href={href}
                          className="rounded-full bg-[#f7f4ee] border border-[#dfd8ca] px-3.5 py-1.5 text-xs font-semibold text-[#2a6f6f] hover:bg-white hover:border-[#2a6f6f] transition"
                        >
                          📖 {verse}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Lain-lain */}
              {sections.lainnya.length > 0 && (
                <article className="prose prose-sm max-w-none text-[#1f2933] leading-8 space-y-4">
                  {sections.lainnya.map((p, i) => (
                    <p key={i}>{renderTextWithBibleLinks(p)}</p>
                  ))}
                </article>
              )}

              {/* FAQ Accordion */}
              {faqPairs.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-[#14213d] mb-4">
                    {tLocal("faq")}
                  </h2>
                  <div className="space-y-3">
                    {faqPairs.map((pair, index) => (
                      <div key={index} className="rounded-lg border border-[#dfd8ca] bg-white overflow-hidden shadow-sm">
                        <button
                          type="button"
                          onClick={() => setFaqOpenIndex(faqOpenIndex === index ? null : index)}
                          className="w-full flex items-center justify-between p-4 text-left font-semibold text-[#14213d] hover:bg-[#f7f4ee]/30 transition"
                        >
                          <span>{pair.q}</span>
                          <span className="text-[#2a6f6f] text-lg font-bold">{faqOpenIndex === index ? "−" : "+"}</span>
                        </button>
                        {faqOpenIndex === index && (
                          <div className="p-4 bg-[#f7f4ee]/20 text-[#52606d] border-t border-[#dfd8ca] leading-relaxed">
                            {renderTextWithBibleLinks(pair.a)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* Bandingkan Tokoh Section */}
          <section className="rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
            <button
              type="button"
              onClick={() => setShowCompareSection(!showCompareSection)}
              className="flex w-full items-center justify-between font-bold uppercase tracking-widest text-[#14213d] text-sm"
            >
              <span>{tLocal("compareTitle")}</span>
              <span className="text-[#2a6f6f] text-xs font-semibold hover:underline">
                {showCompareSection ? tLocal("compareHide") : tLocal("compareOpen")}
              </span>
            </button>

            {showCompareSection && (
              <div className="mt-5 space-y-4">
                <p className="text-xs text-[#52606d] -mt-1">
                  {tLocal("compareDesc")} {activeTitle} {renderLanguage === "zh" ? "与其他圣经人物并排进行对比。" : renderLanguage === "en" ? "with other Biblical characters side-by-side." : "dengan tokoh Alkitab lainnya secara berdampingan."}
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={compareTarget}
                    onChange={(e) => setCompareTarget(e.target.value)}
                    placeholder={tLocal("comparePlaceholder")}
                    className="flex-1 rounded-md border border-[#dfd8ca] px-3.5 py-2 text-sm bg-white text-[#1f2933]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCompare(compareTarget);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleCompare(compareTarget)}
                    disabled={compareLoading || !compareTarget.trim()}
                    className="rounded-md bg-[#2a6f6f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a4a4a] transition disabled:opacity-50"
                  >
                    {compareLoading ? tLocal("compareLoading") : tLocal("compareBtn")}
                  </button>
                </div>

                {/* Preset Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#52606d]">
                  <span>{tLocal("compareRecommend")}</span>
                  {["Musa", "Yosua", "Saul", "Daud", "Petrus", "Paulus", "Abraham", "Yusuf"]
                    .filter((t) => t.toLowerCase() !== title.toLowerCase())
                    .slice(0, 4)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setCompareTarget(preset);
                          handleCompare(preset);
                        }}
                        className="rounded bg-[#f7f4ee] border border-[#dfd8ca] px-2.5 py-1 text-[#2a6f6f] font-semibold hover:bg-white transition"
                      >
                        {preset}
                      </button>
                    ))}
                </div>

                {compareError && (
                  <p className="text-xs text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                    {compareError}
                  </p>
                )}

                {compareLoading && (
                  <div className="space-y-3 animate-pulse pt-4">
                    <div className="h-8 bg-[#f7f4ee] rounded w-full"></div>
                    <div className="h-24 bg-[#f7f4ee] rounded w-full"></div>
                    <div className="h-24 bg-[#f7f4ee] rounded w-full"></div>
                  </div>
                )}

                {compareResult && (
                  <div className="border border-[#dfd8ca] rounded-lg overflow-x-auto mt-4 shadow-sm">
                    <table className="w-full min-w-[500px] text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#f7f4ee] border-b border-[#dfd8ca]">
                          <th className="p-3 font-semibold text-[#14213d] w-1/4">{tLocal("compareCriteria")}</th>
                          <th className="p-3 font-bold text-[#2a6f6f] w-3/8 border-l border-[#dfd8ca]">
                            {compareResult.tokoh1?.nama || activeTitle}
                          </th>
                          <th className="p-3 font-bold text-[#2a6f6f] w-3/8 border-l border-[#dfd8ca]">
                            {compareResult.tokoh2?.nama || compareTarget}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-[#dfd8ca]/60">
                          <td className="p-3 font-semibold text-[#52606d] bg-[#f7f4ee]/20 text-xs uppercase tracking-wider">
                            {tLocal("comparePanggilan")}
                          </td>
                          <td className="p-3 border-l border-[#dfd8ca]/60 text-xs text-[#1f2933] leading-relaxed">
                            {compareResult.tokoh1?.panggilan}
                          </td>
                          <td className="p-3 border-l border-[#dfd8ca]/60 text-xs text-[#1f2933] leading-relaxed">
                            {compareResult.tokoh2?.panggilan}
                          </td>
                        </tr>
                        <tr className="border-b border-[#dfd8ca]/60">
                          <td className="p-3 font-semibold text-[#52606d] bg-[#f7f4ee]/20 text-xs uppercase tracking-wider">
                            {tLocal("comparePeristiwa")}
                          </td>
                          <td className="p-3 border-l border-[#dfd8ca]/60 text-xs text-[#1f2933] leading-relaxed">
                            {compareResult.tokoh1?.peristiwaKunci}
                          </td>
                          <td className="p-3 border-l border-[#dfd8ca]/60 text-xs text-[#1f2933] leading-relaxed">
                            {compareResult.tokoh2?.peristiwaKunci}
                          </td>
                        </tr>
                        <tr className="border-b border-[#dfd8ca]/60">
                          <td className="p-3 font-semibold text-[#52606d] bg-[#f7f4ee]/20 text-xs uppercase tracking-wider">
                            {tLocal("compareKelemahan")}
                          </td>
                          <td className="p-3 border-l border-[#dfd8ca]/60 text-xs text-[#1f2933] leading-relaxed">
                            {compareResult.tokoh1?.kelemahanUjian}
                          </td>
                          <td className="p-3 border-l border-[#dfd8ca]/60 text-xs text-[#1f2933] leading-relaxed">
                            {compareResult.tokoh2?.kelemahanUjian}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-[#52606d] bg-[#f7f4ee]/20 text-xs uppercase tracking-wider">
                            {tLocal("comparePelajaran")}
                          </td>
                          <td className="p-3 border-l border-[#dfd8ca]/60 text-xs text-[#1f2933] leading-relaxed">
                            {compareResult.tokoh1?.pelajaran}
                          </td>
                          <td className="p-3 border-l border-[#dfd8ca]/60 text-xs text-[#1f2933] leading-relaxed">
                            {compareResult.tokoh2?.pelajaran}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="bg-[#f7f4ee]/30 p-4 border-t border-[#dfd8ca] space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-[#14213d] uppercase tracking-wider mb-1">
                          {tLocal("comparePersamaan")}
                        </h4>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-[#52606d] leading-relaxed">
                          {compareResult.kesamaan?.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#14213d] uppercase tracking-wider mb-1">
                          {tLocal("comparePerbedaan")}
                        </h4>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-[#52606d] leading-relaxed">
                          {compareResult.perbedaan?.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Sumber & Batasan disclaimer */}
          <section className="rounded-xl border border-[#dfd8ca] bg-[#f7f4ee]/50 p-5 text-xs text-[#52606d] leading-relaxed">
            <p className="font-semibold text-[#14213d] uppercase tracking-wider mb-1">{tLocal("sourcesTitle")}</p>
            {tLocal("sourcesDesc")}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Related Devotions */}
          {relatedDevotions.length > 0 && (
            <div className="rounded-xl border border-[#dfd8ca] bg-[#f7f4ee]/60 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#2a6f6f] mb-3">
                {tLocal("relatedDevotions")}
              </p>
              <div className="space-y-3">
                {relatedDevotions.map((dev) => (
                  <Link
                    key={dev.id}
                    href={`/renungan/${dev.id}`}
                    className="block p-3 rounded-lg bg-white border border-[#dfd8ca] hover:border-[#2a6f6f] transition"
                  >
                    <p className="text-xs text-[#2a6f6f] font-semibold">{dev.verseRef}</p>
                    <p className="text-sm font-bold text-[#14213d] mt-1 line-clamp-1">{dev.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Bookmarks */}
          {bookmarks.length > 0 && (
            <div className="rounded-xl border border-[#dfd8ca] bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#52606d] mb-3">
                {tLocal("myBookmarks")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {bookmarks.map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      const slug = b.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                      window.location.href = `/ensiklopedia/${kategori}/${slug}`;
                    }}
                    className="text-xs border border-[#dfd8ca] hover:border-[#2a6f6f] hover:bg-[#f7f4ee]/20 px-2 py-1 rounded bg-[#f7f4ee]/30 transition"
                  >
                    👤 {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 1 && (
            <div className="rounded-xl border border-[#dfd8ca] bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#52606d] mb-3">
                {tLocal("lastViewed")}
              </p>
              <div className="space-y-2 text-xs text-[#52606d]">
                {history.slice(1, 6).map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const slug = h.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                      window.location.href = `/ensiklopedia/${kategori}/${slug}`;
                    }}
                    className="block text-left w-full hover:text-[#2a6f6f] truncate hover:underline"
                  >
                    • {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {shareErr && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {shareErr}
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#14213d]">{tLocal("reportTitle")}</h3>
            <p className="text-xs text-[#52606d] mt-1.5">
              {tLocal("reportDesc")}
            </p>
            <form onSubmit={submitCorrection} className="mt-4 space-y-4">
              <textarea
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value)}
                placeholder={tLocal("reportPlaceholder")}
                rows={4}
                className="w-full rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-3 text-sm text-[#1f2933] outline-none focus:ring-2 focus:ring-[#2a6f6f]"
                required
              />
              <div className="flex gap-2 justify-end text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-[#52606d] hover:bg-[#f7f4ee] transition"
                >
                  {tLocal("cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#2a6f6f] px-4 py-2 text-white hover:bg-[#1a4a4a] transition"
                >
                  {tLocal("submitReport")}
                </button>
              </div>
            </form>
            {reportSuccess && (
              <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-700 text-center animate-pulse">
                {tLocal("reportSuccess")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </main>
  );
}
