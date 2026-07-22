"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BIBLE_BOOKS, findBook, extractBibleText } from "@/lib/bible";
import { useLanguage, type LanguageCode } from "@/lib/i18n";
import ShareVerse from "./ShareVerse";

const READING_PLAN_DAYS = [
  { day: 1, title: "Mulai dari Awal", passage: "Kejadian 1:1-31", book: "Kejadian", chapter: "1", verse: "1-31" },
  { day: 2, title: "Penciptaan Manusia", passage: "Kejadian 2:1-25", book: "Kejadian", chapter: "2", verse: "1-25" },
  { day: 3, title: "Kejatuhan Manusia", passage: "Kejadian 3:1-24", book: "Kejadian", chapter: "3", verse: "1-24" },
  { day: 4, title: "Janji Allah pada Abraham", passage: "Kejadian 12:1-9", book: "Kejadian", chapter: "12", verse: "1-9" },
  { day: 5, title: "Gembala yang Baik", passage: "Mazmur 23:1-6", book: "Mazmur", chapter: "23", verse: "1-6" },
  { day: 6, title: "Tempat Perlindungan", passage: "Mazmur 46:1-12", book: "Mazmur", chapter: "46", verse: "1-12" },
  { day: 7, title: "Doa Pengakuan Dosa", passage: "Mazmur 51:1-21", book: "Mazmur", chapter: "51", verse: "1-21" },
  { day: 8, title: "Kasih Setia Tuhan", passage: "Mazmur 103:1-22", book: "Mazmur", chapter: "103", verse: "1-22" },
  { day: 9, title: "Firman yang Hidup", passage: "Mazmur 119:1-16", book: "Mazmur", chapter: "119", verse: "1-16" },
  { day: 10, title: "Hikmat Sejati", passage: "Amsal 3:1-12", book: "Amsal", chapter: "3", verse: "1-12" },
  { day: 11, title: "Pengharapan Masa Depan", passage: "Yeremia 29:1-14", book: "Yeremia", chapter: "29", verse: "1-14" },
  { day: 12, title: "Nubuat Kelahiran Mesias", passage: "Yesaya 9:1-7", book: "Yesaya", chapter: "9", verse: "1-7" },
  { day: 13, title: "Kelahiran Yesus", passage: "Lukas 2:1-20", book: "Lukas", chapter: "2", verse: "1-20" },
  { day: 14, title: "Khotbah di Bukit: Kebahagiaan", passage: "Matius 5:1-12", book: "Matius", chapter: "5", verse: "1-12" },
  { day: 15, title: "Terang Dunia", passage: "Matius 5:13-16", book: "Matius", chapter: "5", verse: "13-16" },
  { day: 16, title: "Kekhawatiran", passage: "Matius 6:25-34", book: "Matius", chapter: "6", verse: "25-34" },
  { day: 17, title: "Kasih Terbesar", passage: "Yohanes 3:1-21", book: "Yohanes", chapter: "3", verse: "1-21" },
  { day: 18, title: "Pokok Anggur yang Benar", passage: "Yohanes 15:1-17", book: "Yohanes", chapter: "15", verse: "1-17" },
  { day: 19, title: "Damai Sejahtera", passage: "Yohanes 14:15-31", book: "Yohanes", chapter: "14", verse: "15-31" },
  { day: 20, title: "Kematian Kristus", passage: "Yohanes 19:16-37", book: "Yohanes", chapter: "19", verse: "16-37" },
  { day: 21, title: "Kebangkitan Kristus", passage: "Yohanes 20:1-31", book: "Yohanes", chapter: "20", verse: "1-31" },
  { day: 22, title: "Pencurahan Roh Kudus", passage: "Kisah Para Rasul 2:1-21", book: "Kisah Para Rasul", chapter: "2", verse: "1-21" },
  { day: 23, title: "Dibenarkan oleh Iman", passage: "Roma 5:1-11", book: "Roma", chapter: "5", verse: "1-11" },
  { day: 24, title: "Hidup dalam Roh", passage: "Roma 8:1-17", book: "Roma", chapter: "8", verse: "1-17" },
  { day: 25, title: "Kasih yang Tidak Terpisahkan", passage: "Roma 8:28-39", book: "Roma", chapter: "8", verse: "28-39" },
  { day: 26, title: "Kasih Sejati", passage: "1 Korintus 13:1-13", book: "1 Korintus", chapter: "13", verse: "1-13" },
  { day: 27, title: "Kasih Karunia yang Cukup", passage: "2 Korintus 12:1-10", book: "2 Korintus", chapter: "12", verse: "1-10" },
  { day: 28, title: "Keselamatan adalah Anugerah", passage: "Efesus 2:1-10", book: "Efesus", chapter: "2", verse: "1-10" },
  { day: 29, title: "Berlari kepada Tujuan", passage: "Filipi 3:1-14", book: "Filipi", chapter: "3", verse: "1-14" },
  { day: 30, title: "Langit dan Bumi Baru", passage: "Wahyu 21:1-8", book: "Wahyu", chapter: "21", verse: "1-8" }
];

const CONTEXTUAL_TOPICS = [
  {
    icon: "🕊️",
    labelKey: "topicPeace",
    label: "Damai Sejahtera",
    verses: [
      { ref: "Yohanes 14:27", text: "Damai sejahtera Kutinggalkan bagimu. Damai sejahtera-Ku Kuberikan kepadamu, dan apa yang Kuberikan tidak seperti yang diberikan oleh dunia..." },
      { ref: "Filipi 4:7", text: "Damai sejahtera Allah, yang melampaui segala akal, akan memelihara hati and pikiranmu dalam Kristus Yesus." },
      { ref: "Yesaya 26:3", text: "Yang hatinya teguh Kaujagai dengan damai sejahtera, sebab kepada-Mulah ia percaya." }
    ]
  },
  {
    icon: "❤️",
    labelKey: "topicLove",
    label: "Kasih & Ampunan",
    verses: [
      { ref: "Yohanes 3:16", text: "Karena Allah sangat mengasihi dunia ini, Ia memberikan Anak-Nya yang tunggal supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan memperoleh hidup yang kekal." },
      { ref: "1 Korintus 13:4-7", text: "Kasih itu sabar; kasih itu murah hati; ia tidak cemburu. Ia tidak memegahkan diri dan tidak sombong." },
      { ref: "Efesus 4:32", text: "Hendaklah kamu ramah seorang terhadap yang lain, penuh kasih mesra dan saling mengampuni, sebagaimana Allah di dalam Kristus telah mengampuni kamu." }
    ]
  },
  {
    icon: "💪",
    labelKey: "topicStrength",
    label: "Kekuatan & Harapan",
    verses: [
      { ref: "Yesaya 40:31", text: "Orang-orang yang menanti-nantikan TUHAN mendapat kekuatan baru: mereka seumpama rajawali yang naik terbang dengan kekuatan sayapnya..." },
      { ref: "Filipi 4:13", text: "Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku." },
      { ref: "Yeremia 29:11", text: "Sebab Aku mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera..." }
    ]
  },
  {
    icon: "🛡️",
    labelKey: "topicProtection",
    label: "Perlindungan",
    verses: [
      { ref: "Mazmur 23:1", text: "TUHAN adalah gembalaku, aku tidak akan kekurangan." },
      { ref: "Mazmur 91:1-2", text: "Orang yang duduk dalam lindungan Yang Mahatinggi dan bermalam dalam naungan Yang Mahakuasa akan berkata kepada TUHAN: Tempat perlindunganku..." },
      { ref: "Mazmur 46:2", text: "Allah itu bagi kita tempat perlindungan dan kekuatan, sebagai penolong dalam kesesakan sangat terbukti." }
    ]
  },
  {
    icon: "🙏",
    labelKey: "topicPrayer",
    label: "Berdoa & Bersyukur",
    verses: [
      { ref: "Filipi 4:6", text: "Janganlah khawatir tentang apa pun juga. Namun, dalam segala sesuatu, nyatakan keinginanmu kepada Allah dalam doa dan permohonan dengan ucapan syukur." },
      { ref: "1 Tesalonika 5:16-18", text: "Bersukacitalah senantiasa. Tetaplah berdoa. Mengucap syukurlah dalam segala hal, sebab itulah yang dikehendaki Allah..." },
      { ref: "Kolose 3:23", text: "Apa pun juga yang kamu perbuat, perbuatlah dengan segenap hatimu seperti untuk Tuhan dan bukan untuk manusia." }
    ]
  },
  {
    icon: "😢",
    labelKey: "topicAnxiety",
    label: "Cemas & Patah Hati",
    verses: [
      { ref: "1 Petrus 5:7", text: "Serahkanlah segala kekhawatiranmu kepada-Nya, sebab Ia yang memelihara kamu." },
      { ref: "Mazmur 34:19", text: "TUHAN itu dekat kepada orang-orang yang patah hati, dan Ia menyelamatkan orang-orang yang remuk jiwanya." },
      { ref: "Yesaya 41:10", text: "Jangan takut sebab Aku menyertai engkau; jangan bimbang sebab Aku ini Allahmu." }
    ]
  }
];

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        version: string;
        openLink: (url: string) => void;
        openTelegramLink: (url: string) => void;
        showAlert: (message: string) => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}

interface DevotionItem {
  id: string;
  title: string;
  verseRef?: string;
  verseText?: string;
  dateId?: string;
  body?: string;
  prayer?: string;
  illustrationUrl?: string;
  bannerUrl?: string;
}

interface ArticleItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt?: string;
  bannerUrl?: string;
  imageUrl?: string;
}

interface EncyclopediaItem {
  id?: string;
  keyword: string;
  kategori: string;
  slug: string;
  title?: string;
}

interface TelegramUserContext {
  source: "telegram" | "pwa" | "unknown";
  user: { id?: number; name: string; username?: string } | null;
}

export default function TelegramMiniApp() {
  const { language, setLanguage } = useLanguage();
  const [hasMounted, setHasMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>("");
  const [tgContext, setTgContext] = useState<TelegramUserContext | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [rawDevotions, setRawDevotions] = useState<DevotionItem[]>([]);
  const [rawArticles, setRawArticles] = useState<ArticleItem[]>([]);
  
  const [selectedEnsiCategory, setSelectedEnsiCategory] = useState<string>("tokoh");
  const [rawEncyclopediaEntries, setRawEncyclopediaEntries] = useState<EncyclopediaItem[]>([]);

  const [selectedBook, setSelectedBook] = useState<string>("Kejadian");
  const [chapter, setChapter] = useState<string>("1");
  const [verse, setVerse] = useState<string>("1");

  const [loadedBibleChapter, setLoadedBibleChapter] = useState<any>(null);
  const [bibleLoadError, setBibleLoadError] = useState<string | null>(null);
  const [highlightedVerses, setHighlightedVerses] = useState<number[]>([]);
  const [bibleViewMode, setBibleViewMode] = useState<boolean>(false);

  const [activeDevotionId, setActiveDevotionId] = useState<string | null>(null);
  const [activeDevotionData, setActiveDevotionData] = useState<any | null>(null);
  const [devotionFontSize, setDevotionFontSize] = useState<number>(16);
  const [devotionTimeTheme, setDevotionTimeTheme] = useState<"pagi" | "malam">("pagi");
  const [devotionLoading, setDevotionLoading] = useState<boolean>(false);
  const [devotionError, setDevotionError] = useState<string | null>(null);

  const [showCalendar, setShowCalendar] = useState<boolean>(false);

  const [verseText, setVerseText] = useState<string>("");
  const [verseRef, setVerseRef] = useState<string>("");

  const [contextVerses, setContextVerses] = useState<any[]>([]);

  const [readingPlanProgress, setReadingPlanProgress] = useState<number[]>([]);
  
  const [highlights, setHighlights] = useState<Record<string, string>>({});
  const [bookmarks, setBookmarks] = useState<Array<{ ref: string; text: string }>>([]);
  const [activeActionVerse, setActiveActionVerse] = useState<{ number: number; text: string; ref: string } | null>(null);

  const [readingPlanMode, setReadingPlanMode] = useState<"30day" | "custom">("30day");
  const [customPlanBook, setCustomPlanBook] = useState<string>("Mazmur");
  const [customPlanChaptersProgress, setCustomPlanChaptersProgress] = useState<Record<string, number[]>>({});

  const [lastRead, setLastRead] = useState<{ book: string; chapter: string; verse: string } | null>(null);

  const isDark = theme === "dark";
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const APP_URL = "https://www.gracedaily.my.id";

  const devotions = useMemo(() => {
    return rawDevotions.map((d: any) => ({
      ...d,
      title: language === "zh" && d.title_zh ? d.title_zh : language === "en" && d.title_en ? d.title_en : (d.title || "Renungan Harian"),
      verseRef: language === "zh" && d.verseRef_zh ? d.verseRef_zh : language === "en" && d.verseRef_en ? d.verseRef_en : d.verseRef,
      verseText: language === "zh" && d.verseText_zh ? d.verseText_zh : language === "en" && d.verseText_en ? d.verseText_en : d.verseText,
      body: language === "zh" && d.body_zh ? d.body_zh : language === "en" && d.body_en ? d.body_en : d.body,
      prayer: language === "zh" && d.prayer_zh ? d.prayer_zh : language === "en" && d.prayer_en ? d.prayer_en : d.prayer,
    }));
  }, [rawDevotions, language]);

  const articles = useMemo(() => {
    return rawArticles.map((a: any) => ({
      ...a,
      title: language === "zh" && a.title_zh ? a.title_zh : language === "en" && a.title_en ? a.title_en : (a.title || "Artikel Baru"),
      category: language === "zh" && a.category_zh ? a.category_zh : language === "en" && a.category_en ? a.category_en : (a.category || "Umum"),
      excerpt: language === "zh" && a.excerpt_zh ? a.excerpt_zh : language === "en" && a.excerpt_en ? a.excerpt_en : a.excerpt
    }));
  }, [rawArticles, language]);

  const encyclopediaEntries = useMemo(() => {
    return rawEncyclopediaEntries.map((e: any) => ({
      ...e,
      keyword: language === "zh" && e.keyword_zh ? e.keyword_zh : language === "en" && e.keyword_en ? e.keyword_en : e.keyword,
      title: language === "zh" && e.title_zh ? e.title_zh : language === "en" && e.title_en ? e.title_en : e.title
    }));
  }, [rawEncyclopediaEntries, language]);

  const tLocal = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      appTitle: { id: "Grace Daily TMA", en: "Grace Daily TMA", zh: "Grace Daily TMA" },
      greeting: { id: "👋 Halo", en: "👋 Hello", zh: "👋 你好" },
      pwaMode: { id: "📱 Mode PWA", en: "📱 PWA Mode", zh: "📱 PWA 模式" },
      subtitle: { id: "Portal Rohani & Pendalaman Alkitab Anda", en: "Your Spiritual & Bible Study Portal", zh: "您的属灵与读经门户" },
      themeLight: { id: "Ganti ke Light Mode", en: "Switch to Light Mode", zh: "切换至浅色模式" },
      themeDark: { id: "Ganti ke Dark Mode", en: "Switch to Dark Mode", zh: "切换至深色模式" },
      home: { id: "📱 Home", en: "📱 Home", zh: "📱 首页" },
      backHome: { id: "🏠 Beranda", en: "🏠 Web Home", zh: "🏠 主页" },
      pwaBannerTitle: { id: "Anda mengakses via Browser / PWA", en: "You are accessing via Browser / PWA", zh: "您正在通过浏览器 / PWA 访问" },
      pwaBannerDesc: {
        id: "Fitur utama tetap tersedia penuh. Bergabunglah ke komunitas kami untuk mendapatkan renungan & update terbaru.",
        en: "All main features are fully available. Join our community for the latest devotions and updates.",
        zh: "所有主要功能均可完整使用。加入我们的社区以获取最新的灵修和更新。"
      },
      waChannel: { id: "Channel WA", en: "WA Channel", zh: "微信/WA 频道" },
      tgChannel: { id: "Channel Telegram", en: "Telegram Channel", zh: "Telegram 频道" },
      searchLabel: { id: "Pencarian Cepat & Deteksi Ayat", en: "Quick Search & Verse Detection", zh: "快速搜索与经文检测" },
      searchPlaceholder: { id: "Cari \"Musa\" atau ketik \"Yohanes 3:16\"", en: "Search 'Moses' or type 'John 3:16'", zh: "搜索 \"摩西\" 或输入 \"约翰福音 3:16\"" },
      searchHelp: { id: "Format deteksi ayat: nama kitab diikuti pasal:ayat (misal: Matius 1:2)", en: "Verse detection format: book name followed by chapter:verse (e.g. Matthew 1:2)", zh: "经文检测格式：书名后跟章节:诗节（例如：马太福音 1:2）" },
      autoDetect: { id: "Deteksi Alkitab Otomatis", en: "Auto Bible Detection", zh: "自动圣经检测" },
      autoDetectDesc: { id: "Mendeteksi pencarian referensi ayat Alkitab. Ketuk tombol untuk membaca ayat lengkap.", en: "Detected Bible verse reference search. Tap button to read the full scripture.", zh: "检测到圣经经文引用搜索。点击按钮阅读完整经文。" },
      readMiniApp: { id: "📖 Baca langsung di Mini App", en: "📖 Read directly in Mini App", zh: "📖 在 Mini App 中直接阅读" },
      openDedicated: { id: "📖 Buka Halaman Khusus Alkitab", en: "📖 Open Dedicated Bible Page", zh: "📖 打开圣经专属页面" },
      noResults: { id: "Tidak ada hasil yang cocok.", en: "No matching results.", zh: "没有匹配的结果。" },
      dailyDevotions: { id: "🌅 Renungan Harian", en: "🌅 Daily Devotions", zh: "🌅 每日灵修" },
      verseRef: { id: "Ayat", en: "Verse", zh: "经文" },
      blogArticles: { id: "✍️ Artikel Blog", en: "✍️ Blog Articles", zh: "✍️ 博客文章" },
      bibleEncyclopedia: { id: "📚 Ensiklopedia Alkitab", en: "📚 Bible Encyclopedia", zh: "📚 圣经百科" },
      selectCategory: { id: "Pilih Kategori Utama", en: "Select Main Category", zh: "选择主分类" },
      selectCategoryPlaceholder: { id: "-- Pilih Fitur Menu --", en: "-- Select Menu Feature --", zh: "-- 选择菜单功能 --" },
      menuDevotions: { id: "📖 Renungan Harian", en: "📖 Daily Devotions", zh: "📖 每日灵修" },
      menuArticles: { id: "✍️ Artikel Blog", en: "✍️ Blog Articles", zh: "✍️ 博客文章" },
      menuEncyclopedia: { id: "📚 Ensiklopedia Alkitab", en: "📚 Bible Encyclopedia", zh: "📚 圣经百科" },
      menuBible: { id: "📜 Alkitab", en: "📜 Bible", zh: "📜 圣经" },
      menuPlan: { id: "📅 Rencana Baca Alkitab", en: "📅 Bible Reading Plan", zh: "📅 读经计划" },
      menuShare: { id: "🎨 Bagikan Ayat Estetik", en: "🎨 Share Aesthetic Verse", zh: "🎨 分享精美经文卡" },
      latestDevotions: { id: "🌅 Daftar Renungan Terbaru", en: "🌅 Latest Devotions List", zh: "🌅 最新灵修列表" },
      noDevotions: { id: "Tidak ada data renungan.", en: "No devotion data.", zh: "无灵修 data。" },
      latestArticles: { id: "✍️ Artikel Blog Terbaru", en: "✍️ Latest Blog Articles", zh: "✍️ 最新博客文章" },
      noArticles: { id: "Tidak ada artikel blog.", en: "No blog articles.", zh: "无博客文章。" },
      encyclopediaForm: { id: "📚 Form Ensiklopedia Alkitab", en: "📚 Bible Encyclopedia Form", zh: "📚 圣经百科表单" },
      selectSubCategory: { id: "Pilih Sub Kategori", en: "Select Subcategory", zh: "选择子分类" },
      topicsList: { id: "Daftar Topik", en: "Topics List", zh: "主题列表" },
      noTopics: { id: "Tidak ada topik tersedia dalam kategori ini.", en: "No topics available in this category.", zh: "此分类下无可用主题。" },
      bibleTitle: { id: "📜 Alkitab", en: "📜 Bible", zh: "📜 圣经" },
      bookName: { id: "Nama Kitab", en: "Book Name", zh: "书名" },
      chapter: { id: "Pasal", en: "Chapter", zh: "章" },
      verse: { id: "Ayat", en: "Verse", zh: "节" },
      readMiniAppBtn: { id: "📖 Baca di Mini App", en: "📖 Read in Mini App", zh: "📖 在 Mini App 中阅读" },
      bibleReaderTitle: { id: "📖 Pembaca Alkitab (AYT)", en: "📖 Bible Reader (AYT)", zh: "📖 圣经阅读器 (AYT)" },
      closeBtn: { id: "Tutup ✕", en: "Close ✕", zh: "关闭 ✕" },
      bibleError: { id: "Gagal memuat ayat secara langsung. Silakan gunakan link Halaman Khusus Alkitab di bawah ini.", en: "Failed to load scripture directly. Please use the Dedicated Bible Page link below.", zh: "无法直接加载经文。请使用下方的圣经专属页面链接。" },
      openDedicatedFull: { id: "📖 Buka Halaman Khusus Alkitab (Lengkap)", en: "📖 Open Dedicated Bible Page (Full)", zh: "📖 打开圣经专属页面 (完整版)" },
      joinCommunity: { id: "Bergabung dengan Komunitas", en: "Join the Community", zh: "加入社区" },
      communityDesc: { id: "Dapatkan renungan, artikel baru, dan ensiklopedia ter-update otomatis di grup dan channel.", en: "Get devotions, new articles, and encyclopedia updates automatically in groups and channels.", zh: "在群组和频道中自动获取灵修、新文章和百科更新。" },
      channelBtn: { id: "📢 Channel @gracedailybible", en: "📢 Channel @gracedailybible", zh: "📢 频道 @gracedailybible" },
      groupBtn: { id: "💬 Group Community", en: "💬 Group Community", zh: "💬 社区群组" },
      loadingDevotions: { id: "Memuat daftar renungan...", en: "Loading devotions list...", zh: "正在加载灵修列表..." },
      loadingArticles: { id: "Memuat daftar artikel...", en: "Loading articles list...", zh: "正在加载文章列表..." },
      loadingEncyclopedia: { id: "Memuat ensiklopedia kategori", en: "Loading encyclopedia category", zh: "正在加载百科分类" },
      loadingBible: { id: "Memuat Alkitab", en: "Loading Bible", zh: "正在加载圣经" },
      bookNotFound: { id: "Kitab tidak ditemukan", en: "Book not found", zh: "找不到书卷" },
      navTitle: { id: "Navigasi Fitur Utama", en: "Main Feature Navigation", zh: "核心功能导航" },
      accessBible: { id: "Akses Alkitab", en: "Access Bible", zh: "阅读圣经" },
      accessBibleDesc: { id: "Baca kitab & terakhir dibaca", en: "Read books & history", zh: "阅读圣经及 history" },
      devotionToday: { id: "🌅 Renungan Hari Ini", en: "🌅 Today's Devotion", zh: "🌅 今日灵修" },
      readFullDevotion: { id: "📖 Baca Renungan Selengkapnya", en: "📖 Read Full Devotion", zh: "📖 阅读灵修全文" },
      shareCardBtn: { id: "🎨 Bagikan Ayat (Ubah Jadi Gambar)", en: "🎨 Share Verse (Convert to Image)", zh: "🎨 分享经文（转为图片）" },
      planTitle: { id: "📅 Rencana Baca Alkitab", en: "📅 Bible Reading Plan", zh: "📅 读经计划" },
      planDesc: { id: "Program 30 hari & progress", en: "30-day program & progress", zh: "30天计划及进度" },
      shareNav: { id: "Bagikan Ayat", en: "Share Verse", zh: "分享经文" },
      shareNavDesc: { id: "Unduh gambar ayat estetik", en: "Download aesthetic verse card", zh: "下载精美经文卡片" },
      ensiNavDesc: { id: "Informasi tokoh & geografi", en: "People & geography info", zh: "人物与地理百科" },
      articleNavDesc: { id: "Update & pengajaran iman", en: "Updates & faith teachings", zh: "文章与信仰真理" },
      backBtn: { id: "← Kembali", en: "← Back", zh: "← 返回" },
      fontSizeLabel: { id: "Teks", en: "Text", zh: "字体" },
      themePagi: { id: "Tema Pagi", en: "Morning Theme", zh: "白昼模式" },
      themeMalam: { id: "Tema Malam", en: "Night Theme", zh: "黑夜模式" },
      listenBtn: { id: "🔊 Dengar", en: "🔊 Listen", zh: "🔊 朗读" },
      stopBtn: { id: "⏹ Stop", en: "⏹ Stop", zh: "⏹ 停止" },
      prayerTitle: { id: "Doa Hari Ini", en: "Today's Prayer", zh: "今日祷告" },
      calendarTitle: { id: "📅 Kalender Riwayat", en: "📅 History Calendar", zh: "📅 历史日历" },
      monthTitle: { id: "Bulan Ini", en: "This Month", zh: "本月" },
      selectReadDate: { id: "Pilih Tanggal Bacaan", en: "Select Reading Date", zh: "选择阅读日期" },
      voiceBtn: { id: "🎙️ Voice to Text", en: "🎙️ Voice to Text", zh: "🎙️ 语音输入" },
      voiceListening: { id: "🔴 Mendengarkan...", en: "🔴 Listening...", zh: "🔴 正在聆听..." },
      lastReadLabel: { id: "Terakhir Dibaca", en: "Last Read", zh: "最后阅读" },
      reopenBtn: { id: "Buka Kembali →", en: "Reopen →", zh: "重新打开 →" },
      thematicSearch: { id: "Pencarian Tematik:", en: "Thematic Search:", zh: "主题搜索：" },
      popularVerses: { id: "Ayat Populer tentang", en: "Popular Verses about", zh: "关于此主题的热门经文" },
      readBtnText: { id: "Baca 📖", en: "Read 📖", zh: "阅读 📖" },
      shareBtnText: { id: "Bagikan 🎨", en: "Share 🎨", zh: "分享 🎨" },
      bookmarkBtnText: { id: "🔖 Bookmark", en: "Bookmark", zh: "书签" },
      copyBtnText: { id: "📋 Salin", en: "Copy", zh: "复制" },
      highlightLabel: { id: "Sorotan:", en: "Highlight:", zh: "高亮标记：" },
      myBookmarks: { id: "🔖 Bookmark Saya", en: "My Bookmarks", zh: "我的书签" },
      noBookmarks: { id: "Belum ada ayat yang di-bookmark. Klik salah satu ayat di atas untuk memberi stabilo.", en: "No bookmarked verses yet. Tap a verse above to highlight or bookmark it.", zh: "暂无书签。点击上方任意经文可进行高亮 atau 添加书签。" },
      planIntro30: { id: "Selesaikan program baca 30 hari untuk memperdalam iman dan memahami Injil lebih baik.", en: "Complete the 30-day reading program to deepen your faith and understand the Gospel better.", zh: "完成30天读经计划，加深您的信仰并更好地理解福音。" },
      planIntroCustom: { id: "Pilih kitab Alkitab mana saja untuk membuat rencana baca kustom sesuai jadwal Anda sendiri.", en: "Select any Bible book to create a custom reading plan according to your own schedule.", zh: "选择任意书卷以根据您自己的时间表创建自定义读经计划。" },
      dayLabel: { id: "Hari", en: "Day", zh: "第" },
      dayLabelSuffix: { id: "", en: "", zh: "天" },
      statusDone: { id: "Selesai ✓", en: "Done ✓", zh: "已完成 ✓" },
      statusNotDone: { id: "Belum", en: "Not Done", zh: "未完成" },
      customMode30: { id: "30 Hari", en: "30 Days", zh: "30天" },
      customModeKitab: { id: "Kustom Kitab", en: "Custom Book", zh: "自定义书卷" }
    };
    return dict[key]?.[language] || dict[key]?.id || key;
  };

  const getCategoryLabel = (value: string) => {
    const map: Record<string, Record<string, string>> = {
      tokoh: { id: "Tokoh", en: "People/Characters", zh: "人物" },
      tempat: { id: "Tempat", en: "Places", zh: "地点" },
      kamus: { id: "Kamus/Istilah", en: "Dictionary/Terms", zh: "词汇字典" },
      mukjizat: { id: "Mukjizat", en: "Miracles", zh: "神迹" },
      perumpamaan: { id: "Perumpamaan", en: "Parables", zh: "比喻" },
      kitab: { id: "Kitab", en: "Books of the Bible", zh: "书卷" },
      kronologi: { id: "Kronologi", en: "Chronology", zh: "年代记" },
      silsilah: { id: "Silsilah", en: "Genealogy", zh: "家谱" },
      teologi: { id: "Teologi", en: "Theology", zh: "神学" },
      "teologi-2": { id: "Teologi (Tambahan)", en: "Theology (Extra)", zh: "神学（追加）" },
      topikal_alkitab: { id: "Topikal Alkitab", en: "Biblical Topics", zh: "圣经主题" },
      peristiwa: { id: "Peristiwa", en: "Events", zh: "事件" },
      "peristiwa-2": { id: "Peristiwa (Tambahan)", en: "Events (Extra)", zh: "事件（追加）" },
    };
    return map[value]?.[language] || map[value]?.id || value;
  };

  const getTopicLabel = (topic: any) => {
    return tLocal(topic.labelKey) || topic.label;
  };

  useEffect(() => {
    setHasMounted(true);
    const savedTheme = localStorage.getItem("tma-theme") || "light";
    setTheme(savedTheme as "light" | "dark");

    try {
      const savedPlan = localStorage.getItem("gda-reading-plan-progress");
      if (savedPlan) setReadingPlanProgress(JSON.parse(savedPlan));
    } catch (e) {
      console.error(e);
    }

    try {
      const savedLastRead = localStorage.getItem("gda-last-read");
      if (savedLastRead) setLastRead(JSON.parse(savedLastRead));
    } catch (e) {
      console.error(e);
    }

    try {
      const savedHighlights = localStorage.getItem("gda-bible-highlights");
      if (savedHighlights) setHighlights(JSON.parse(savedHighlights));
      const savedBookmarks = localStorage.getItem("gda-bible-bookmarks");
      if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
      const savedCustomPlan = localStorage.getItem("gda-custom-plan-progress");
      if (savedCustomPlan) setCustomPlanChaptersProgress(JSON.parse(savedCustomPlan));
    } catch (e) {
      console.error(e);
    }

    loadDevotions();

    const params = new URLSearchParams(window.location.search);
    const menu = params.get("menu");
    if (menu) {
      setSelectedMainCategory(menu);
      if (menu === "artikel") loadArticles();
      else if (menu === "ensiklopedia") loadEncyclopediaCategory(selectedEnsiCategory);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("tma-theme", nextTheme);
  };

  const parseVerseNumbers = (verseStr: string): number[] => {
    if (!verseStr || !verseStr.trim()) return [];
    const nums: number[] = [];
    const parts = verseStr.trim().split(/[\s,-]+/);
    if (parts.length === 1) {
      const single = parseInt(parts[0], 10);
      if (!isNaN(single)) nums.push(single);
    } else if (parts.length >= 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          nums.push(i);
        }
      }
    }
    return nums;
  };

  const loadBibleData = async (bookName: string, chapterNum: string, verseRange: string) => {
    setLoading(true);
    setStatusMessage(`${tLocal("loadingBible")} ${bookName} ${chapterNum}...`);
    setBibleLoadError(null);
    setLoadedBibleChapter(null);
    setBibleViewMode(true);

    const book = findBook(bookName);
    if (!book) {
      setBibleLoadError(`${tLocal("bookNotFound")} "${bookName}"`);
      setLoading(false);
      return;
    }

    const bookId = book.id;
    const chap = parseInt(chapterNum, 10) || 1;

    const highlightNums = parseVerseNumbers(verseRange);
    setHighlightedVerses(highlightNums);

    try {
      const res = await fetch(`/bible/ind_ayt/${bookId}/${chap}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.chapter) {
          setLoadedBibleChapter(data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn(err);
    }

    try {
      const res = await fetch(`/api/backup?file=bible/ind_ayt/${bookId}/${chap}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.chapter) {
          setLoadedBibleChapter(data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error(err);
    }

    setBibleLoadError(tLocal("bibleError"));
    setLoading(false);
  };

  const loadDevotionDetail = async (id: string) => {
    setActiveDevotionId(id);
    setDevotionLoading(true);
    setDevotionError(null);
    setActiveDevotionData(null);
    
    const currentHour = new Date().getHours();
    const isMorning = currentHour >= 5 && currentHour < 17;
    setDevotionTimeTheme(isMorning ? "pagi" : "malam");

    const cached = devotions.find(
      d => d.id === id || d.dateId === id || d.id.startsWith(`golden-${id}`)
    );
    if (cached && (cached.body || cached.verseText)) {
      setActiveDevotionData(cached);
      setDevotionLoading(false);
      return;
    }

    const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev";
    const r2Paths: string[] = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
      const existing = devotions.find(d => d.dateId === id || d.id === id || d.id.startsWith(`golden-${id}`));
      if (existing) r2Paths.push(`devotions/${existing.id}.json`);
      for (const suffix of ["05"]) {
        r2Paths.push(`devotions/golden-${id}-${suffix}.json`);
      }
      r2Paths.push(`devotions/${id}.json`);
    } else {
      r2Paths.push(`devotions/${id}.json`);
      const dateMatch = id.match(/golden-(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) r2Paths.push(`devotions/${dateMatch[1]}.json`);
    }

    let loaded = false;
    for (const r2Path of r2Paths) {
      try {
        const res = await fetch(`${R2_BASE}/${r2Path}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.title || data.body)) {
            const mapped = {
              ...data,
              title: language === "zh" && data.title_zh ? data.title_zh : language === "en" && data.title_en ? data.title_en : (data.title || "Renungan Harian"),
              verseRef: language === "zh" && data.verseRef_zh ? data.verseRef_zh : language === "en" && data.verseRef_en ? data.verseRef_en : data.verseRef,
              verseText: language === "zh" && data.verseText_zh ? data.verseText_zh : language === "en" && data.verseText_en ? data.verseText_en : data.verseText,
              body: language === "zh" && data.body_zh ? data.body_zh : language === "en" && data.body_en ? data.body_en : data.body,
              prayer: language === "zh" && data.prayer_zh ? data.prayer_zh : language === "en" && data.prayer_en ? data.prayer_en : data.prayer,
            };
            setActiveDevotionData(mapped);
            loaded = true;
            break;
          }
        }
      } catch {}
    }

    if (!loaded) {
      const indexData = devotions.find(d => d.id === id || d.dateId === id || d.id.startsWith(`golden-${id}`));
      if (indexData) {
        setActiveDevotionData({
          ...indexData,
          _fallback: !indexData.body,
        });
      } else {
        setDevotionError("Renungan belum tersedia di R2. Silakan coba tanggal lain.");
      }
    }
    setDevotionLoading(false);
  };

  const handleSelectCalendarDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    setShowCalendar(false);
    loadDevotionDetail(dateStr);
  };

  const handleTogglePlan = (dayNum: number) => {
    const nextProgress = readingPlanProgress.includes(dayNum)
      ? readingPlanProgress.filter((d) => d !== dayNum)
      : [...readingPlanProgress, dayNum];
    setReadingPlanProgress(nextProgress);
    localStorage.setItem("gda-reading-plan-progress", JSON.stringify(nextProgress));
  };

  const handleToggleCustomChapter = (bookName: string, chapNum: number) => {
    const nextProgress = { ...customPlanChaptersProgress };
    const currentList = nextProgress[bookName] || [];
    const updatedList = currentList.includes(chapNum)
      ? currentList.filter((c) => c !== chapNum)
      : [...currentList, chapNum];
      
    nextProgress[bookName] = updatedList;
    setCustomPlanChaptersProgress(nextProgress);
    localStorage.setItem("gda-custom-plan-progress", JSON.stringify(nextProgress));
  };

  const handleToggleHighlight = (vRef: string, color: string) => {
    const nextHighlights = { ...highlights };
    if (nextHighlights[vRef] === color) {
      delete nextHighlights[vRef];
    } else {
      nextHighlights[vRef] = color;
    }
    setHighlights(nextHighlights);
    localStorage.setItem("gda-bible-highlights", JSON.stringify(nextHighlights));
    setActiveActionVerse(null);
  };

  const handleToggleBookmark = (vRef: string, vText: string) => {
    let nextBookmarks = [...bookmarks];
    const exists = nextBookmarks.some((b) => b.ref === vRef);
    if (exists) {
      nextBookmarks = nextBookmarks.filter((b) => b.ref !== vRef);
    } else {
      nextBookmarks.push({ ref: vRef, text: vText });
    }
    setBookmarks(nextBookmarks);
    localStorage.setItem("gda-bible-bookmarks", JSON.stringify(nextBookmarks));
    setActiveActionVerse(null);
  };

  const handleOpenVerseInBible = (verseRef: string) => {
    if (!verseRef) return;
    const regex = /^((?:\d\s*)?[a-zA-Z\u00C0-\u024F]+(?:\s+[a-zA-Z\u00C0-\u024F]+)*)\s+(\d+)[:\s]+(\d+)(?:-(\d+))?$/i;
    const match = verseRef.trim().match(regex);
    if (match) {
      const book = match[1].trim();
      const chap = match[2];
      const start = match[3];
      const end = match[4] ? `-${match[4]}` : "";
      
      setSelectedBook(book);
      setChapter(chap);
      setVerse(`${start}${end}`);
      loadBibleData(book, chap, `${start}${end}`);
      setSelectedMainCategory("alkitab");
      
      const nextLastRead = { book, chapter: chap, verse: `${start}${end}` };
      setLastRead(nextLastRead);
      localStorage.setItem("gda-last-read", JSON.stringify(nextLastRead));
      
      setActiveDevotionId(null);
      setActiveDevotionData(null);
    } else {
      setSelectedMainCategory("alkitab");
      setActiveDevotionId(null);
      setActiveDevotionData(null);
    }
  };

  const getCalendarDays = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(year, month, d));
    return days;
  };

  const [themeVersesLoading, setThemeVersesLoading] = useState<boolean>(false);

  const fetchAiVerses = async (themeLabel: string) => {
    setThemeVersesLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "devotional",
          prompt: `Berikan 3 ayat Alkitab yang acak, bervariasi, dan sangat relevan dengan tema rohani '${themeLabel}' dalam Bahasa Indonesia Terjemahan Baru/AYT. Respon harus berupa JSON array valid tanpa penjelasan pengantar/penutup dan tanpa markdown wrapper (jangan beri tag \`\`\`json), contoh format: [{"ref": "Filipi 4:7", "text": "Damai sejahtera Allah..."}, {"ref": "Yohanes 14:27", "text": "Damai sejahtera-Ku..."}].`
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.answer) {
          let text = data.answer.trim();
          if (text.startsWith("```json")) text = text.substring(7);
          else if (text.startsWith("```")) text = text.substring(3);
          if (text.endsWith("```")) text = text.substring(0, text.length - 3);
          const parsed = JSON.parse(text.trim());
          if (Array.isArray(parsed) && parsed.length > 0) setContextVerses(parsed);
        }
      }
    } catch (err) {
      console.warn(err);
    } {
      setThemeVersesLoading(false);
    }
  };

  const [isListeningSearch, setIsListeningSearch] = useState(false);

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Anda tidak mendukung perekaman suara.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListeningSearch(true);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (text) {
        setSearchQuery(text);
        setContextVerses([]);
      }
    };
    recognition.onerror = (e: any) => console.error(e);
    recognition.onend = () => setIsListeningSearch(false);
    recognition.start();
  };

  const [isListeningBible, setIsListeningBible] = useState(false);

  const startVoiceBible = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Anda tidak mendukung perekaman suara.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListeningBible(true);
    recognition.onresult = (event: any) => {
      let text = event.results[0][0].transcript.trim();
      if (!text) return;

      text = text.toLowerCase()
        .replace(/\bpasal\b/g, "")
        .replace(/\bayat\b/g, ":")
        .replace(/\bsampai\b/g, "-")
        .replace(/\bhingga\b/g, "-")
        .replace(/\bsatu\b/g, "1").replace(/\bdua\b/g, "2")
        .replace(/\btiga\b/g, "3").replace(/\bempat\b/g, "4")
        .replace(/\blima\b/g, "5").replace(/\benam\b/g, "6")
        .replace(/\btujuh\b/g, "7").replace(/\bdelapan\b/g, "8")
        .replace(/\bsembilan\b/g, "9").replace(/\bsepuluh\b/g, "10");

      let detectedBook = "";
      let foundIndex = -1;

      const normalizedText = text.toLowerCase();
      for (const b of BIBLE_BOOKS) {
        const bookLower = b.name.toLowerCase();
        if (normalizedText.includes(bookLower)) {
          detectedBook = b.name;
          foundIndex = normalizedText.indexOf(bookLower);
          break;
        }
      }

      if (detectedBook) {
        const afterBook = text.substring(foundIndex + detectedBook.length).trim();
        const numRegex = /^(\d+)(?:\s*[:\s]\s*(\d+)(?:\s*-\s*(\d+))?)/;
        const match = afterBook.match(numRegex);
        
        let parsedChapter = "1";
        let parsedVerse = "1";
        
        if (match) {
          parsedChapter = match[1];
          if (match[2]) {
            parsedVerse = match[2];
            if (match[3]) parsedVerse += `-${match[3]}`;
          }
        }
        
        setSelectedBook(detectedBook);
        setChapter(parsedChapter);
        setVerse(parsedVerse);
        
        loadBibleData(detectedBook, parsedChapter, parsedVerse);
        const nextLastRead = { book: detectedBook, chapter: parsedChapter, verse: parsedVerse };
        setLastRead(nextLastRead);
        localStorage.setItem("gda-last-read", JSON.stringify(nextLastRead));
      } else {
        alert(`Terdeteksi: "${event.results[0][0].transcript}". Kitab tidak dikenali.`);
      }
    };
    recognition.onerror = (e: any) => console.error(e);
    recognition.onend = () => setIsListeningBible(false);
    recognition.start();
  };

  const normalizeTtsText = (text: string): string => {
    return text
      .replace(/ALLAH/g, "ALAH").replace(/Allah/g, "Alah").replace(/allah/g, "alah")
      .replace(/—/g, ", ").replace(/–/g, ", ").replace(/\.\.\./g, ". ")
      .replace(/[""]/g, "").replace(/\*/g, "");
  };

  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakWithTts = (text: string, label?: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      alert("Browser Anda tidak mendukung Text-to-Speech.");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const finalText = normalizeTtsText(label ? `${label}. ${text}` : text);
    const utter = new SpeechSynthesisUtterance(finalText);
    utter.lang = language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID";
    utter.rate = 0.85;

    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.startsWith(language));
    if (targetVoice) utter.voice = targetVoice;

    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const speakBibleChapter = () => {
    if (!loadedBibleChapter) return;
    const verses = (loadedBibleChapter.chapter?.content || [])
      .filter((item: any) => item.type === "verse")
      .map((item: any) => `Ayat ${item.number}. ${extractBibleText(item.content)}`)
      .join(" ");
    speakWithTts(verses, `${loadedBibleChapter.book?.name || selectedBook} ${loadedBibleChapter.chapter?.number || chapter}`);
  };

  const speakDevotion = () => {
    if (!activeDevotionData) return;
    const parts: string[] = [];
    if (activeDevotionData.verseRef) parts.push(`${tLocal("verseRef")}: ${activeDevotionData.verseRef}.`);
    if (activeDevotionData.verseText) parts.push(`"${activeDevotionData.verseText}".`);
    if (activeDevotionData.body) {
      const stripped = activeDevotionData.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      parts.push(stripped);
    }
    if (activeDevotionData.prayer) parts.push(`${tLocal("prayerTitle")}: ${activeDevotionData.prayer}`);
    speakWithTts(parts.join(" "), activeDevotionData.title);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const loadDevotions = async () => {
    if (rawDevotions.length > 0) return;
    setLoading(true);
    setStatusMessage(tLocal("loadingDevotions"));
    const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "[https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev](https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev)";
    try {
      const res = await fetch(`${R2_BASE}/backup/renungan.json`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (Array.isArray(data)) {
        const sorted = [...data].sort((a, b) => String(b.dateId || b.id).localeCompare(String(a.dateId || a.id)));
        setRawDevotions(sorted);
      }
    } catch {
      try {
        const res2 = await fetch(`/api/backup?file=backup/renungan.json`, { cache: "no-store" });
        const data2 = await res2.json();
        if (Array.isArray(data2)) {
          const sorted2 = [...data2].sort((a, b) => String(b.dateId || b.id).localeCompare(String(a.dateId || a.id)));
          setRawDevotions(sorted2);
        }
      } catch (err) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadArticles = async () => {
    if (rawArticles.length > 0) return;
    setLoading(true);
    setStatusMessage(tLocal("loadingArticles"));
    try {
      let res = await fetch(`/api/backup?file=articles/index.json`);
      if (!res.ok) res = await fetch(`/api/backup?file=backup/blog_posts.json`);
      const data = await res.json();
      if (Array.isArray(data)) setRawArticles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadEncyclopediaCategory = async (cat: string) => {
    setLoading(true);
    setStatusMessage(`${tLocal("loadingEncyclopedia")} ${getCategoryLabel(cat)}...`);
    try {
      const r2Cat = cat === "kamus" ? "istilah" : cat;
      const res = await fetch(`/api/backup?file=backup/${r2Cat}.json`);
      const data = await res.json();
      if (Array.isArray(data)) setRawEncyclopediaEntries(data);
      else setRawEncyclopediaEntries([]);
    } catch (err) {
      console.error(err);
      setRawEncyclopediaEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMainCategoryChange = (val: string) => {
    setSelectedMainCategory(val);
    if (val === "renungan") loadDevotions();
    else if (val === "artikel") loadArticles();
    else if (val === "ensiklopedia") loadEncyclopediaCategory(selectedEnsiCategory);
  };

  const handleEnsiCategoryChange = (val: string) => {
    setSelectedEnsiCategory(val);
    loadEncyclopediaCategory(val);
  };

  const openInApp = (url: string) => {
    if (url.startsWith("[https://t.me/](https://t.me/)") && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const parsedBibleVerse = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const clean = searchQuery.trim();
    const regex = /^((?:\d\s*)?[a-zA-Z\u00C0-\u024F]+(?:\s+[a-zA-Z\u00C0-\u024F]+)*)\s+(\d+)[:\s]+(\d+)(?:-(\d+))?$/i;
    const match = clean.match(regex);
    if (match) {
      return {
        book: match[1].trim(),
        chapter: parseInt(match[2], 10),
        verseStart: parseInt(match[3], 10),
        verseEnd: match[4] ? parseInt(match[4], 10) : undefined,
        rawString: clean
      };
    }
    return null;
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || parsedBibleVerse) return { devotions: [], articles: [], encyclopedia: [] };

    const matchedDevotions = devotions.filter(
      (d) =>
        d.title.toLowerCase().includes(query) ||
        (d.verseRef && d.verseRef.toLowerCase().includes(query)) ||
        (d.verseText && d.verseText.toLowerCase().includes(query))
    ).slice(0, 5);

    const matchedArticles = articles.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query) ||
        (a.excerpt && a.excerpt.toLowerCase().includes(query))
    ).slice(0, 5);

    const matchedEncyclopedia = encyclopediaEntries.filter(
      (e) =>
        e.keyword.toLowerCase().includes(query) ||
        (e.title && e.title.toLowerCase().includes(query))
    ).slice(0, 8);

    return {
      devotions: matchedDevotions,
      articles: matchedArticles,
      encyclopedia: matchedEncyclopedia
    };
  }, [searchQuery, devotions, articles, encyclopediaEntries, parsedBibleVerse]);

  if (!hasMounted) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#f7f4ee]">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></span>
          <span className="text-teal-800 text-xs font-bold uppercase tracking-wider">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col font-sans transition-colors duration-300 overflow-y-auto ${
      isDark ? "bg-slate-950 text-slate-100" : "bg-[#f7f4ee] text-[#1f2933]"
    }`}>
      {/* Header Banner */}
      <div className={`px-6 py-6 border-b transition-all duration-300 relative overflow-hidden shrink-0 ${
        isDark 
          ? "bg-gradient-to-r from-cyan-900 via-indigo-950 to-purple-950 border-indigo-900/40" 
          : "bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 border-teal-900/20"
      }`}>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-purple-300">
              {tLocal("appTitle")}
            </h1>
            {tgContext?.source === "telegram" && tgContext.user && (
              <p className="text-xs text-emerald-300/90 mt-1 font-medium">
                {tLocal("greeting")}, {tgContext.user.name}!
              </p>
            )}
            {tgContext?.source === "pwa" && <p className="text-xs text-amber-300/80 mt-1">{tLocal("pwaMode")}</p>}
            {!tgContext && <p className="text-xs text-indigo-200/90 mt-1">{tLocal("subtitle")}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="relative flex items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 cursor-pointer active:scale-90"
            >
              <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
                <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4.5 h-4.5 text-amber-300 absolute transition-all duration-500 ${!isDark ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.97 4.97l1.41 1.41M17.62 17.62l1.41 1.41M3.75 12h2.25m12 0h2.25m-12.8-6.23l1.41-1.41m11.3 11.3l1.41 1.41M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" /></svg>
                <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4.5 h-4.5 text-indigo-200 absolute transition-all duration-500 ${isDark ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
              </div>
            </button>
            <Link className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-xs font-semibold text-slate-100 transition-all" href="/telegram-miniapp">{tLocal("home")}</Link>
            <Link className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-xs font-semibold text-slate-100 transition-all" href="/">{tLocal("backHome")}</Link>
          </div>
        </div>

        {/* Language Switcher Row */}
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 flex-wrap gap-2 relative z-10">
          <div className="flex items-center rounded-xl overflow-hidden border border-white/15 bg-white/5">
            {(["id", "en", "zh"] as LanguageCode[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${language === lang ? "bg-white/25 text-white" : "text-white/50 hover:text-white"}`}
              >
                {lang === "id" ? "ID" : lang === "en" ? "EN" : "中"}
              </button>
            ))}
          </div>
          <span className="bg-indigo-500/25 border border-indigo-400/40 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest text-indigo-200">Mini App</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-md mx-auto w-full px-5 py-6 space-y-6">
        {tgContext?.source === "pwa" && (
          <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${isDark ? "bg-gradient-to-br from-amber-900/20 to-orange-900/10 border-amber-700/30" : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">📱</span>
              <div>
                <p className={`text-sm font-bold ${isDark ? "text-amber-300" : "text-amber-800"}`}>{tLocal("pwaBannerTitle").replace(/^[\uD800-\uDFFF\u2600-\u27BF\u2300-\u23FF\u2B50\u2B55\ufe0f]+\s*/, "")}</p>
                <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-amber-200/70" : "text-amber-700"}`}>{tLocal("pwaBannerDesc").replace(/^[\uD800-\uDFFF\u2600-\u27BF\u2300-\u23FF\u2B50\u2B55\ufe0f]+\s*/, "")}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => openInApp("https://www.whatsapp.com/channel/0029VbCUBJfG8l5A2qoOPN0w")} className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border ${isDark ? "bg-green-900/30 border-green-700/30 text-green-300" : "bg-green-100 border-green-300 text-green-800"}`}>{tLocal("waChannel")}</button>
              <button onClick={() => openInApp("https://t.me/gracedailybible")} className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border ${isDark ? "bg-sky-900/30 border-sky-700/30 text-sky-300" : "bg-sky-100 border-sky-300 text-sky-800"}`}>{tLocal("tgChannel")}</button>
            </div>
          </div>
        )}

        {/* Quick Access Buttons */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <button onClick={() => setSelectedMainCategory("alkitab")} className={`py-3 px-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 ${selectedMainCategory === "alkitab" ? (isDark ? "bg-teal-500/25 border-teal-400 text-teal-300" : "bg-teal-700 text-white") : (isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-[#dfd8ca] text-teal-850")}`}>
            <span>📜</span><span>{tLocal("accessBible")}</span>
          </button>
          <button onClick={() => { setSelectedMainCategory("renungan"); loadDevotions(); }} className={`py-3 px-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 ${selectedMainCategory === "renungan" ? (isDark ? "bg-cyan-500/25 border-cyan-400 text-cyan-300" : "bg-cyan-600 text-white") : (isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-[#dfd8ca]")}`}>
            <span>🌅</span><span>{tLocal("dailyDevotions").replace(/^[\uD800-\uDFFF\u2600-\u27BF\u2300-\u23FF\u2B50\u2B55\ufe0f]+\s*/, "")}</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xl ${isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-[#dfd8ca]"}`}>
          <label className={`block text-xs font-semibold uppercase tracking-widest mb-2 ${isDark ? "text-slate-400" : "text-teal-850"}`}>{tLocal("searchLabel")}</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">🔍</span>
            <input
              type="text"
              className={`w-full border rounded-xl py-3 pl-11 pr-12 text-sm focus:outline-none ${isDark ? "bg-slate-950 border-slate-800/80 text-slate-100 focus:ring-cyan-500" : "bg-white border-[#dfd8ca] text-[#1f2933] placeholder:text-gray-400 focus:ring-teal-650"}`}
              placeholder={tLocal("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setContextVerses([]); }}
            />
            <button type="button" onClick={startVoiceSearch} className={`absolute inset-y-0 right-0 pr-3.5 flex items-center ${isListeningSearch ? "text-red-500 animate-pulse" : isDark ? "text-slate-400" : "text-teal-650"}`}>
              {isListeningSearch ? <span>🔴</span> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>}
            </button>
          </div>

          <div className="mt-4">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-teal-850"}`}>{tLocal("thematicSearch")}</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {CONTEXTUAL_TOPICS.map((topic) => (
                <button key={topic.labelKey} onClick={() => { setSearchQuery(getTopicLabel(topic)); setContextVerses(topic.verses); fetchAiVerses(getTopicLabel(topic)); }} className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${searchQuery === getTopicLabel(topic) ? (isDark ? "bg-cyan-500/20 border-cyan-400 text-cyan-300" : "bg-teal-50 border-teal-600 font-bold text-teal-850") : (isDark ? "bg-slate-950 border-slate-800 text-slate-355" : "bg-[#fcfbf9] border-[#dfd8ca] text-[#1f2933]")}`}>
                  <span>{topic.icon}</span><span>{getTopicLabel(topic)}</span>
                </button>
              ))}
            </div>
          </div>
          <p className={`text-[11px] mt-3.5 italic ${isDark ? "text-slate-500" : "text-teal-700/80"}`}>{tLocal("searchHelp")}</p>
        </div>

        {/* Dynamic Search Results & Auto Verses */}
        {searchQuery.trim() !== "" && (
          <div className="space-y-4">
            {parsedBibleVerse && (
              <div className={`border rounded-2xl p-4 shadow-lg ${isDark ? "bg-gradient-to-br from-indigo-950/80 to-cyan-950/70 border-cyan-500/30" : "bg-gradient-to-br from-teal-50/50 to-emerald-50/30 border-teal-500/20"}`}>
                <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md">{tLocal("autoDetect")}</span>
                <h3 className={`text-lg font-bold mt-2 ${isDark ? "text-slate-100" : "text-black"}`}>{parsedBibleVerse.book} {parsedBibleVerse.chapter}:{parsedBibleVerse.verseStart}{parsedBibleVerse.verseEnd ? `-${parsedBibleVerse.verseEnd}` : ""}</h3>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-355" : "text-gray-600"}`}>{tLocal("autoDetectDesc")}</p>
                <div className="flex flex-col gap-2 mt-4">
                  <button onClick={() => { const range = parsedBibleVerse.verseStart.toString() + (parsedBibleVerse.verseEnd ? `-${parsedBibleVerse.verseEnd}` : ""); loadBibleData(parsedBibleVerse.book, parsedBibleVerse.chapter.toString(), range); }} className={`w-full font-bold py-2.5 px-4 rounded-xl text-xs ${isDark ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950" : "bg-gradient-to-r from-teal-600 to-emerald-650 text-white"}`}>{tLocal("readMiniApp")}</button>
                  <Link
                    href={`/telegram-miniapp/alkitab?book=${encodeURIComponent(parsedBibleVerse.book)}&chapter=${parsedBibleVerse.chapter}&verse=${parsedBibleVerse.verseStart}${parsedBibleVerse.verseEnd ? `-${parsedBibleVerse.verseEnd}` : ""}`}
                    className={`w-full font-semibold py-2.5 px-4 rounded-xl text-center text-xs border transition-all active:scale-95 flex items-center justify-center ${
                      isDark
                        ? "bg-slate-800/80 border-slate-700 text-slate-200"
                        : "bg-white border-[#dfd8ca] text-teal-850"
                    }`}
                  >
                    {tLocal("openDedicated")}
                  </Link>
                </div>
              </div>
            )}

            {!parsedBibleVerse && contextVerses.length > 0 && (
              <div className={`border rounded-2xl p-4 space-y-3 ${isDark ? "bg-slate-900/60 border-slate-800/85" : "bg-white border-[#dfd8ca]"}`}>
                <div className="flex justify-between items-center border-b pb-2 border-current/10">
                  <h4 className="text-xs font-bold text-teal-650 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📖 {tLocal("popularVerses")} "{searchQuery}"</span>
                    {themeVersesLoading && <span className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin inline-block" />}
                  </h4>
                  <button onClick={() => { setSearchQuery(""); setContextVerses([]); }} className="text-xs text-gray-500 font-bold">{tLocal("closeBtn")}</button>
                </div>
                <div className="space-y-3 divide-y divide-current/10">
                  {contextVerses.map((v, i) => (
                    <div key={i} className="pt-2.5 first:pt-0 text-left space-y-1">
                      <div className="text-xs font-bold text-teal-650 flex items-center justify-between">
                        <span>{v.ref}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleOpenVerseInBible(v.ref)} className="text-[10px] font-bold text-teal-600">{tLocal("readBtnText")}</button>
                          <span className="text-gray-400">|</span>
                          <button onClick={() => { setVerseRef(v.ref); setVerseText(v.text); setSelectedMainCategory("bagikan"); }} className="text-[10px] font-bold text-indigo-500">{tLocal("shareBtnText")}</button>
                        </div>
                      </div>
                      <p className={`text-xs italic ${isDark ? "text-slate-350" : "text-gray-700"}`}>"{v.text}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!parsedBibleVerse && contextVerses.length === 0 && (
              <div className="space-y-4">
                {searchResults.devotions.length === 0 && searchResults.articles.length === 0 && searchResults.encyclopedia.length === 0 ? (
                  <div className="border rounded-2xl py-8 text-center"><p className="text-sm text-slate-400">{tLocal("noResults")}</p></div>
                ) : (
                  <div className="space-y-4">
                    {searchResults.devotions.length > 0 && (
                      <div className={`border rounded-2xl p-4 space-y-2.5 ${isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-[#dfd8ca]"}`}>
                        <h4 className="text-xs font-bold text-cyan-500 uppercase tracking-wider">{tLocal("dailyDevotions")}</h4>
                        <div className="divide-y divide-current/10">
                          {searchResults.devotions.map((d) => (
                            <div key={d.id} onClick={() => openInApp(`${APP_URL}/renungan/${d.id}`)} className="py-2 cursor-pointer">
                              <div className="text-sm font-semibold">{d.title}</div>
                              {d.verseRef && <div className="text-[11px] text-slate-500 mt-0.5">{tLocal("verseRef")}: {d.verseRef}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Latest Devotion Card Component */}
        {selectedMainCategory === "" && !loading && devotions.length > 0 && (() => {
          const latest = devotions[0];
          return (
            <div className="space-y-6">
              <div className={`border rounded-2xl p-5 shadow-xl ${isDark ? "bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border-indigo-900/40 text-slate-100" : "bg-gradient-to-br from-amber-50/70 via-[#fcfaf4] to-amber-50/30 border-amber-250 text-teal-850"}`}>
                <div className="text-[10px] uppercase font-bold tracking-widest text-amber-500 mb-1">{tLocal("devotionToday")}</div>
                <h3 className="text-lg font-extrabold mb-2 leading-snug">{latest.title}</h3>
                {latest.verseRef && (
                  <div className="p-3 rounded-xl border border-current/10 bg-current/5 mb-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider mb-0.5">{tLocal("verseRef")}: {latest.verseRef}</div>
                    {latest.verseText && <blockquote className="text-xs italic leading-relaxed">"{latest.verseText}"</blockquote>}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button onClick={() => { setSelectedMainCategory("renungan"); loadDevotionDetail(latest.id); }} className={`w-full font-bold py-2.5 px-4 rounded-xl text-xs ${isDark ? "bg-cyan-550 text-slate-950 font-extrabold" : "bg-teal-700 text-white"}`}>{tLocal("readFullDevotion")}</button>
                  {latest.verseRef && <button onClick={() => { setVerseRef(latest.verseRef || ""); setVerseText(latest.verseText || ""); setSelectedMainCategory("bagikan"); }} className="w-full font-semibold py-2 px-4 rounded-xl text-xs border border-current/25 bg-transparent">{tLocal("shareCardBtn")}</button>}
                </div>
              </div>

              {/* Navigation Grid */}
              <div className="space-y-3">
                <label className={`block text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-teal-850"}`}>{tLocal("navTitle")}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setSelectedMainCategory("renungan"); loadDevotions(); }} className={`p-4 rounded-2xl border text-left flex flex-col justify-between ${isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-[#dfd8ca]"}`}>
                    <div className="text-xl">📖</div>
                    <div className="mt-3"><div className="text-xs font-bold">{tLocal("menuDevotions").replace(/^[\uD800-\uDFFF\u2600-\u27BF\u2300-\u23FF\u2B50\u2B55\ufe0f]+\s*/, "")}</div><div className="text-[10px] text-gray-500 mt-0.5">{tLocal("latestDevotions")}</div></div>
                  </button>
                  <button onClick={() => setSelectedMainCategory("rencanabaca")} className={`p-4 rounded-2xl border text-left flex flex-col justify-between ${isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-[#dfd8ca]"}`}>
                    <div className="text-xl">📅</div>
                    <div className="mt-3"><div className="text-xs font-bold">{tLocal("menuPlan").replace(/^[\uD800-\uDFFF\u2600-\u27BF\u2300-\u23FF\u2B50\u2B55\ufe0f]+\s*/, "")}</div><div className="text-[10px] text-gray-500 mt-0.5">{tLocal("planDesc")}</div></div>
                  </button>
                  <button onClick={() => setSelectedMainCategory("alkitab")} className={`p-4 rounded-2xl border text-left flex flex-col justify-between ${isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-[#dfd8ca]"}`}>
                    <div className="text-xl">📜</div>
                    <div className="mt-3"><div className="text-xs font-bold">{tLocal("menuBible").replace(/^[\uD800-\uDFFF\u2600-\u27BF\u2300-\u23FF\u2B50\u2B55\ufe0f]+\s*/, "")}</div><div className="text-[10px] text-gray-500 mt-0.5">{tLocal("accessBibleDesc")}</div></div>
                  </button>
                  <button onClick={() => setSelectedMainCategory("bagikan")} className={`p-4 rounded-2xl border text-left flex flex-col justify-between ${isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-[#dfd8ca]"}`}>
                    <div className="text-xl">🎨</div>
                    <div className="mt-3"><div className="text-xs font-bold">{tLocal("menuShare").replace(/^[\uD800-\uDFFF\u2600-\u27BF\u2300-\u23FF\u2B50\u2B55\ufe0f]+\s*/, "")}</div><div className="text-[10px] text-gray-500 mt-0.5">{tLocal("shareNavDesc")}</div></div>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Dropdown Selector */}
        <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xl space-y-4 ${isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-[#dfd8ca]"}`}>
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-widest mb-2 ${isDark ? "text-slate-400" : "text-teal-850"}`}>{tLocal("selectCategory")}</label>
            <select
              className={`w-full border rounded-xl py-3 px-4 text-sm focus:outline-none ${isDark ? "bg-slate-950 border-slate-800/80 text-slate-100" : "bg-white border-[#dfd8ca] text-[#1f2933]"}`}
              value={selectedMainCategory}
              onChange={(e) => handleMainCategoryChange(e.target.value)}
            >
              <option value="">{tLocal("selectCategoryPlaceholder")}</option>
              <option value="renungan">{tLocal("menuDevotions")}</option>
              <option value="rencanabaca">{tLocal("menuPlan")}</option>
              <option value="alkitab">{tLocal("menuBible")}</option>
              <option value="ensiklopedia">{tLocal("menuEncyclopedia")}</option>
              <option value="artikel">{tLocal("menuArticles")}</option>
              <option value="bagikan">{tLocal("menuShare")}</option>
            </select>
          </div>

          {loading && (
            <div className="flex items-center space-x-3 py-2 text-xs italic">
              <span className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></span>
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Core App Logic Conditional Rendering */}
          {selectedMainCategory === "renungan" && !loading && (
            <div className="space-y-4 pt-2">
              {activeDevotionId ? (
                <div className={`rounded-2xl border p-5 space-y-4 shadow-xl relative overflow-hidden ${devotionTimeTheme === "pagi" ? (isDark ? "bg-gradient-to-br from-[#1d1610] to-[#120a05] text-amber-100" : "bg-gradient-to-br from-amber-50 to-orange-50 text-[#3e2723]") : (isDark ? "bg-gradient-to-br from-[#080d1a] to-[#04060c] text-slate-100" : "bg-gradient-to-br from-indigo-950 to-slate-900 text-slate-100")}`}>
                  <div className="flex items-center justify-between border-b pb-3 border-current/10 relative z-10">
                    <button onClick={() => { setActiveDevotionId(null); setActiveDevotionData(null); }} className="text-xs font-bold px-2.5 py-1 rounded bg-black/10">{tLocal("backBtn")}</button>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center border border-current/20 rounded-lg overflow-hidden text-xs bg-black/5">
                        <button onClick={() => setDevotionFontSize(Math.max(12, devotionFontSize - 2))} className="px-2 py-1 font-bold">A-</button>
                        <span className="px-2 font-semibold">{devotionFontSize}px</span>
                        <button onClick={() => setDevotionFontSize(Math.min(28, devotionFontSize + 2))} className="px-2 py-1 font-bold">A+</button>
                      </div>
                      <button onClick={() => setDevotionTimeTheme(devotionTimeTheme === "pagi" ? "malam" : "pagi")} className="p-1.5 rounded-lg bg-black/5">{devotionTimeTheme === "pagi" ? "🌅" : "🌌"}</button>
                      <button onClick={speakDevotion} className={`text-[9px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border ${isSpeaking ? "bg-red-500/15 text-red-500" : "bg-black/5"}`}>{isSpeaking ? tLocal("stopBtn") : tLocal("listenBtn")}</button>
                    </div>
                  </div>

                  {devotionLoading && <div className="flex flex-col items-center py-12 text-xs italic"><span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mb-2" /></div>}
                  {activeDevotionData && !devotionLoading && (
                    <div className="space-y-4 text-left">
                      <div><h2 className="text-lg font-extrabold font-serif mt-1">{activeDevotionData.title}</h2></div>
                      <div className="p-4 rounded-xl border border-current/10 bg-current/5">
                        <div className="text-xs font-bold uppercase mb-1">{tLocal("verseRef")}: {activeDevotionData.verseRef}</div>
                        <blockquote className="text-sm italic font-serif">"{activeDevotionData.verseText}"</blockquote>
                      </div>
                      <div className="leading-relaxed font-serif" style={{ fontSize: `${devotionFontSize}px` }} dangerouslySetInnerHTML={{ __html: activeDevotionData.body || "" }} />
                      {activeDevotionData.prayer && <div className="p-4 rounded-xl border-l-4 border-amber-500 bg-amber-500/5"><span className="block text-xs font-extrabold uppercase text-amber-500 mb-1">{tLocal("prayerTitle")}</span><p className="text-xs italic">{activeDevotionData.prayer}</p></div>}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-cyan-500 uppercase tracking-wider">{tLocal("latestDevotions")}</h4>
                    <button onClick={() => setShowCalendar(!showCalendar)} className="text-xs px-2.5 py-1 rounded-lg border"><span>{tLocal("calendarTitle")}</span></button>
                  </div>
                  {showCalendar && (
                    <div className={`p-4 border rounded-2xl space-y-3 ${isDark ? "bg-slate-900/60" : "bg-white"}`}>
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {getCalendarDays().map((day, idx) => day && <button key={idx} onClick={() => handleSelectCalendarDate(day)} className="text-xs py-1.5 font-bold rounded-lg bg-gray-500/10">{day.getDate()}</button>)}
                      </div>
                    </div>
                  )}
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {devotions.map((d) => (
                      <div key={d.id} onClick={() => loadDevotionDetail(d.id)} className={`border rounded-xl p-3 text-left ${isDark ? "bg-slate-950 border-slate-800/60" : "bg-white border-[#dfd8ca]"}`}>
                        <div className="text-sm font-semibold">{d.title}</div>
                        {d.verseRef && <div className="text-[11px] font-semibold text-teal-655 mt-1">📖 {d.verseRef}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {selectedMainCategory === "artikel" && !loading && (
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-teal-500 uppercase tracking-wider text-left">{tLocal("menuArticles")}</h4>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-left">
                {articles.length === 0 ? (
                  <p className="text-xs text-gray-500 italic text-center py-4">{tLocal("noArticles")}</p>
                ) : (
                  articles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => openInApp(`${APP_URL}/blog/${art.id}`)}
                      className={`border rounded-xl p-3 cursor-pointer hover:border-teal-500 transition-colors ${
                        isDark ? "bg-slate-950 border-slate-800/60" : "bg-white border-[#dfd8ca]"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-teal-600 bg-teal-500/10 px-2.5 py-1 rounded-full">
                        {art.category}
                      </span>
                      <div className="text-sm font-semibold mt-2.5">{art.title}</div>
                      {art.excerpt && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{art.excerpt}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {selectedMainCategory === "ensiklopedia" && !loading && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col gap-2 text-left">
                <label className={`block text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-teal-850"}`}>
                  {tLocal("selectSubCategory")}
                </label>
                <select
                  className={`w-full border rounded-xl py-2.5 px-3 text-xs ${isDark ? "bg-slate-950 border-slate-800" : "bg-white"}`}
                  value={selectedEnsiCategory}
                  onChange={(e) => handleEnsiCategoryChange(e.target.value)}
                >
                  <option value="tokoh">{getCategoryLabel("tokoh")}</option>
                  <option value="tempat">{getCategoryLabel("tempat")}</option>
                  <option value="kamus">{getCategoryLabel("kamus")}</option>
                  <option value="mukjizat">{getCategoryLabel("mukjizat")}</option>
                  <option value="perumpamaan">{getCategoryLabel("perumpamaan")}</option>
                  <option value="kitab">{getCategoryLabel("kitab")}</option>
                  <option value="kronologi">{getCategoryLabel("kronologi")}</option>
                  <option value="silsilah">{getCategoryLabel("silsilah")}</option>
                  <option value="teologi">{getCategoryLabel("teologi")}</option>
                  <option value="peristiwa">{getCategoryLabel("peristiwa")}</option>
                </select>
              </div>

              <h4 className="text-xs font-bold text-teal-500 uppercase tracking-wider mt-4 text-left">
                {tLocal("topicsList")} ({getCategoryLabel(selectedEnsiCategory)})
              </h4>
              
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-left">
                {encyclopediaEntries.length === 0 ? (
                  <p className="text-xs text-gray-500 italic text-center py-4">{tLocal("noTopics")}</p>
                ) : (
                  encyclopediaEntries.map((entry, idx) => {
                    const slug = entry.slug || entry.keyword?.toLowerCase().replace(/\s+/g, "_") || "";
                    const targetCategory = selectedEnsiCategory === "kamus" ? "istilah" : selectedEnsiCategory;
                    return (
                      <div
                        key={idx}
                        onClick={() => openInApp(`${APP_URL}/ensiklopedia/${targetCategory}/${slug}`)}
                        className={`border rounded-xl p-3 cursor-pointer hover:border-teal-500 transition-colors ${
                          isDark ? "bg-slate-950 border-slate-800/60" : "bg-white border-[#dfd8ca]"
                        }`}
                      >
                        <div className="text-sm font-semibold">{entry.keyword || entry.title}</div>
                        {entry.title && entry.title !== entry.keyword && (
                          <div className="text-xs text-gray-400 mt-0.5">{entry.title}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 3. Reading Plan Render Component */}
          {selectedMainCategory === "rencanabaca" && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">{tLocal("planTitle")}</h4>
                <div className="flex bg-slate-800/10 p-0.5 rounded-lg border">
                  <button onClick={() => setReadingPlanMode("30day")} className={`text-[9px] px-2 py-1 font-bold rounded ${readingPlanMode === "30day" ? "bg-emerald-500 text-white" : "text-gray-500"}`}>{tLocal("customMode30")}</button>
                  <button onClick={() => setReadingPlanMode("custom")} className={`text-[9px] px-2 py-1 font-bold rounded ${readingPlanMode === "custom" ? "bg-emerald-500 text-white" : "text-gray-500"}`}>{tLocal("customModeKitab")}</button>
                </div>
              </div>

              <p className="text-xs leading-relaxed opacity-85">{readingPlanMode === "30day" ? tLocal("planIntro30") : tLocal("planIntroCustom")}</p>
              {readingPlanMode === "30day" ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                  {READING_PLAN_DAYS.map((day) => {
                    const checked = readingPlanProgress.includes(day.day);
                    return (
                      <div key={day.day} className={`border rounded-xl p-3 flex items-center justify-between ${checked ? "bg-emerald-500/10 border-emerald-500/30" : "bg-transparent border-current/10"}`}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={checked} onChange={() => handleTogglePlan(day.day)} className="w-4 h-4 cursor-pointer" />
                          <div className="text-left">
                            <div className="text-xs font-bold">{tLocal("dayLabel")} {day.day}{tLocal("dayLabelSuffix")}: {day.title}</div>
                            <button onClick={() => handleOpenVerseInBible(day.passage)} className="text-[11px] font-semibold text-teal-600">📖 {day.passage}</button>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-500">{checked ? tLocal("statusDone") : tLocal("statusNotDone")}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <select className={`w-full border rounded-xl py-2 px-3 text-xs ${isDark ? "bg-slate-950 border-slate-800" : "bg-white"}`} value={customPlanBook} onChange={(e) => setCustomPlanBook(e.target.value)}>
                    {BIBLE_BOOKS.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 4. Bible Reader logic section */}
          {selectedMainCategory === "alkitab" && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase text-teal-500">{tLocal("bibleTitle")}</h4>
                <button type="button" onClick={startVoiceBible} className="text-[10px] font-semibold px-2.5 py-1 rounded-full border">
                  {isListeningBible ? tLocal("voiceListening") : tLocal("voiceBtn")}
                </button>
              </div>

              {lastRead && (
                <div className={`p-3 border rounded-xl flex items-center justify-between ${isDark ? "bg-slate-900/60" : "bg-teal-50/50"}`}>
                  <div className="text-left">
                    <span className="text-[9px] font-bold text-gray-500">{tLocal("lastReadLabel")}</span>
                    <div className="text-xs font-bold text-teal-600">{lastRead.book} {lastRead.chapter}:{lastRead.verse}</div>
                  </div>
                  <button onClick={() => { setSelectedBook(lastRead.book); setChapter(lastRead.chapter); setVerse(lastRead.verse); loadBibleData(lastRead.book, lastRead.chapter, lastRead.verse); }} className="text-xs font-bold px-2.5 py-1.5 bg-teal-600 text-white rounded-xl">{tLocal("reopenBtn")}</button>
                </div>
              )}

              <div className="space-y-3">
                <select className={`w-full border rounded-xl py-2.5 px-3 text-xs ${isDark ? "bg-slate-950 border-slate-800" : "bg-white"}`} value={selectedBook} onChange={(e) => setSelectedBook(e.target.value)}>
                  {BIBLE_BOOKS.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" className={`w-full border rounded-xl py-2 px-3 text-xs ${isDark ? "bg-slate-950" : "bg-white"}`} value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder={tLocal("chapter")} />
                  <input type="text" className={`w-full border rounded-xl py-2 px-3 text-xs ${isDark ? "bg-slate-950" : "bg-white"}`} value={verse} onChange={(e) => setVerse(e.target.value)} placeholder={tLocal("verse")} />
                </div>
                <button onClick={() => { loadBibleData(selectedBook, chapter, verse); if (typeof window !== "undefined") localStorage.setItem("gda-last-read", JSON.stringify({ book: selectedBook, chapter, verse })); }} className="w-full font-bold py-2.5 text-xs bg-teal-600 text-white rounded-xl">{tLocal("readMiniAppBtn")}</button>
              </div>
            </div>
          )}

          {/* 5. Share Card layout layer */}
          {selectedMainCategory === "bagikan" && (
            <ShareVerse
              initialVerseRef={verseRef || "Yohanes 3:16"}
              initialVerseText={verseText || "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak akan binasa, melainkan beroleh hidup yang kekal."}
              isDarkGlobal={isDark}
            />
          )}
        </div>

        {/* Floating Alkitab Verse Popup */}
        {bibleViewMode && loadedBibleChapter && (
          <div className={`border rounded-2xl p-4 shadow-xl text-left space-y-4 ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-[#dfd8ca]"}`}>
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-sm font-bold text-teal-600">{loadedBibleChapter.book?.name} {loadedBibleChapter.chapter?.number}</h4>
              <button onClick={() => speakBibleChapter()} className="text-xs px-2 py-1 rounded bg-teal-600 text-white">{isSpeaking ? tLocal("stopBtn") : tLocal("listenBtn")}</button>
              <button onClick={() => { stopSpeaking(); setBibleViewMode(false); }} className="text-xs font-bold text-gray-500">{tLocal("closeBtn")}</button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-sm leading-relaxed" style={{ fontSize: `${devotionFontSize}px` }}>
              {loadedBibleChapter.chapter?.content?.map((item: any, idx: number) => {
                if (item.type === "verse") {
                  const text = extractBibleText(item.content);
                  const vRef = `${loadedBibleChapter.book?.name} ${loadedBibleChapter.chapter?.number}:${item.number}`;
                  return (
                    <p key={idx} onClick={() => { setActiveActionVerse({ number: Number(item.number), text, ref: vRef }); }} className={`py-1 px-1.5 rounded cursor-pointer ${highlightedVerses.includes(Number(item.number)) ? "bg-teal-500/10 font-semibold" : ""}`}>
                      <sup className="text-[10px] text-teal-500 font-bold mr-1.5">{item.number}</sup>{text}
                    </p>
                  );
                }
                return null;
              })}
            </div>

            {/* Float Active action menu box */}
            {activeActionVerse && (
              <div className="p-3 border rounded-xl space-y-2 text-xs bg-current/5 border-current/10">
                <div className="font-bold text-teal-600">{activeActionVerse.ref}</div>
                <div className="flex gap-2.5 flex-wrap">
                  <button onClick={() => handleToggleBookmark(activeActionVerse.ref, activeActionVerse.text)} className="px-2 py-1 border rounded font-semibold">{tLocal("bookmarkBtnText")}</button>
                  <button onClick={() => { setVerseText(activeActionVerse.text); setVerseRef(activeActionVerse.ref); setSelectedMainCategory("bagikan"); setActiveActionVerse(null); }} className="px-2 py-1 bg-teal-600 text-white rounded font-semibold">{tLocal("shareBtnText")}</button>
                  <button onClick={() => { navigator.clipboard.writeText(`"${activeActionVerse.text}" (${activeActionVerse.ref})`); alert("Copied!"); setActiveActionVerse(null); }} className="px-2 py-1 bg-gray-500/20 rounded font-semibold">{tLocal("copyBtnText")}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Support Info */}
        <div className={`border text-center rounded-2xl p-4 ${isDark ? "bg-slate-900/30 border-slate-800/40" : "bg-white border-[#dfd8ca]/60"}`}>
          <h4 className="text-xs font-semibold uppercase mb-1">{tLocal("joinCommunity")}</h4>
          <p className="text-[11px] mb-3 opacity-80">{tLocal("communityDesc")}</p>
          <div className="flex justify-center space-x-3">
            <button onClick={() => openInApp("[https://t.me/gracedailybible](https://t.me/gracedailybible)")} className="border text-xs px-3.5 py-1.5 rounded-lg font-semibold">{tLocal("channelBtn")}</button>
            <button onClick={() => openInApp("[https://t.me/+AFZz3BmnrF85Mjk1](https://t.me/+AFZz3BmnrF85Mjk1)")} className="border text-xs px-3.5 py-1.5 rounded-lg font-semibold">{tLocal("groupBtn")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}