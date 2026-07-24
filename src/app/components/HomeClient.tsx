"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import {
  features,
  testimonials,
} from "@/lib/data";
import { getFromCache, saveToCache, clearOldCache } from "@/lib/indexeddb-cache";
import { DevotionCard } from "@/app/components/DevotionCard";
import { AdPopup } from "@/app/components/AdPopup";
import { EnsiklopediaPreview } from "@/app/components/EnsiklopediaPreview";
import { BiblePreview } from "@/app/components/BiblePreview";
import { RecommendationSection } from "@/app/components/RecommendationSection";
import { WhatsAppChannelButton } from "@/app/components/WhatsAppChannelButton";
import { AdSenseAd } from "@/app/components/AdSenseAd";
import DonationCards from "@/app/components/DonationCards";
import { PodcastDropdown } from "@/app/components/PodcastDropdown";

const landingTranslations = {
  id: {
    heroSub: "Renungan harian Kristen",
    heroTitle: "Grace Daily",
    heroDesc: "Ruang teduh digital Anda. Temukan inspirasi ayat harian, ruang doa, bimbingan rohani, dan komunitas yang mendukung pertumbuhan iman Anda setiap hari.",
    heroBtnDevotional: "Buka Renungan Hari Ini",
    heroBtnAsk: "Tanya Pendeta",
    heroBtnAbout: "Tentang Kami",
    heroBtnTelegramMiniApp: "App Grace Daily",
    heroBtnSpotify: "Spotify Podcast",
    heroWaDesc: "Dapatkan renungan dan artikel terbaru setiap hari langsung di WhatsApp, Telegram, & Spotify Podcast.",
    
    demoTitle: "Layanan Bimbingan Rohani",
    demoUserLabel: "Kamu",
    demoPastorLabel: "Pendeta",
    demoUserMsg: "Bagaimana saya tetap percaya saat doa belum dijawab?",
    demoPastorMsg: "Mulailah dari kejujuran di hadapan Tuhan. Mazmur mengajarkan bahwa iman tidak menolak air mata, tetapi membawa air mata itu kepada Allah.",

    featuresSub: "Fitur Unggulan",
    featuresTitle: "Dirancang untuk Kedisiplinan Rohani Anda",
    features: [
      {
        title: "Pendeta",
        description: "Tanya jawab rohani, teologi praktis, dan pendampingan refleksi secara pastoral."
      },
      {
        title: "Renungan Harian",
        description: "Renungan otomatis dari ayat harian, dilengkapi doa, pertanyaan refleksi, dan ringkasan singkat."
      },
      {
        title: "Ayat Emas",
        description: "Koleksi ayat bertema kasih, iman, pengharapan, pengampunan, keluarga, dan kekuatan."
      },
      {
        title: "Jurnal Spiritual",
        description: "Catat pergumulan, mood rohani, jawaban doa, dan bahan evaluasi pertumbuhan iman."
      },
      {
        title: "PDF Devotional",
        description: "Siapkan bahan renungan pribadi, kelompok sel, atau keluarga dalam format siap bagikan."
      },
      {
        title: "Komunitas Doa",
        description: "Ruang doa dan curhat dengan moderasi, privasi, dan dukungan awal."
      }
    ],

    blogSub: "Artikel Terbaru",
    blogTitle: "Blog & Kabar Jemaat",
    blogBtn: "Buka Halaman Blog",
    blogReadMore: "Baca selengkapnya",

    pricingSub: "Biaya Berlangganan",
    pricingTitle: "Dukungan Pelayanan Grace Daily",
    pricingDesc: "Dukungan finansial Anda membantu kami membiayai server Kami, pengembangan fitur pastoral, dan operasional layanan beranda gratis bagi ribuan pengguna lainnya.",

    testimonialsTitle: "Review pengguna",
    testimonials: [
      {
        name: "Maya",
        role: "Pemimpin komsel",
        quote: "Bahan renungan jadi lebih rapi, mudah dibagikan, dan tetap terasa personal untuk anggota komsel."
      },
      {
        name: "Yosua",
        role: "Mahasiswa",
        quote: "Fitur tanya ayat membantu saya memahami konteks tanpa merasa sedang membaca bahan yang berat."
      },
      {
        name: "Lina",
        role: "Ibu rumah tangga",
        quote: "Jurnal doa membuat saya bisa melihat kembali cara Tuhan menuntun dari hari ke hari."
      }
    ],

    newsletterSub: "Langganan Harian",
    newsletterTitle: "Dapatkan Renungan & Artikel Terbaru",
    newsletterDesc: "Daftarkan email Anda untuk menerima renungan teduh Kristen dan artikel pemahaman Alkitab terbaru secara gratis langsung di inbox Anda.",
    newsletterInputLabel: "Alamat Email Anda",
    newsletterPlaceholder: "nama@email.com",
    newsletterOption1: "Dapatkan Renungan Harian (Setiap Pagi)",
    newsletterOption2: "Dapatkan Artikel & Pemahaman Alkitab Baru",
    newsletterBtn: "Berlangganan Sekarang",
    newsletterLoading: "Memproses...",
    newsletterSuccessTitle: "Berhasil berlangganan!",
    newsletterSuccessDesc: "Terima kasih telah bergabung bersama kami.",
    newsletterInvalidEmail: "Alamat email tidak valid.",
    newsletterConnectionError: "Terjadi kesalahan koneksi.",

    waTitle: "Jangan Lewatkan Renungan Harian",
    waDesc: "Dapatkan artikel dan renungan terbaru setiap hari melalui WhatsApp Channel Grace Daily.",
    waFollow: "Ikuti Channel",
    waLater: "Nanti Saja"
  },
  en: {
    heroSub: "Daily Christian Devotional",
    heroTitle: "Grace Daily",
    heroDesc: "Your digital quiet space. Discover daily verse inspiration, prayer rooms, spiritual guidance, and a community supporting your faith journey every day.",
    heroBtnDevotional: "Read Today's Devotion",
    heroBtnAsk: "Ask Pastor",
    heroBtnAbout: "About Us",
    heroBtnTelegramMiniApp: "Grace Daily App",
    heroBtnSpotify: "Spotify Podcast",
    heroWaDesc: "Get the latest devotions and articles daily directly on WhatsApp, Telegram, & Spotify.",

    demoTitle: "Spiritual Guidance Service",
    demoUserLabel: "You",
    demoPastorLabel: "Pastor",
    demoUserMsg: "How do I keep believing when my prayers aren't answered yet?",
    demoPastorMsg: "Start with honesty before God. The Psalms teach us that faith does not reject tears, but brings those tears to God.",

    featuresSub: "Key Features",
    featuresTitle: "Designed for Your Spiritual Discipline",
    features: [
      {
        title: "Ask Pastor",
        description: "Spiritual Q&A, practical theology, and pastoral guidance for reflection."
      },
      {
        title: "Daily Devotional",
        description: "Automated devotions from the daily verse, complete with prayer, reflection, and a brief summary."
      },
      {
        title: "Golden Verses",
        description: "A collection of verses themed around love, faith, hope, forgiveness, family, and strength."
      },
      {
        title: "Spiritual Journal",
        description: "Record your struggles, spiritual mood, answered prayers, and faith growth evaluations."
      },
      {
        title: "PDF Devotional",
        description: "Prepare materials for personal study, cell group, or family in a share-ready format."
      },
      {
        title: "Prayer Community",
        description: "A prayer and sharing room with moderation, privacy, and initial support."
      }
    ],

    blogSub: "Latest Articles",
    blogTitle: "Blog & Congregation News",
    blogBtn: "Go to Blog Page",
    blogReadMore: "Read more",

    pricingSub: "Subscription Cost",
    pricingTitle: "Support Grace Daily Ministry",
    pricingDesc: "Your financial support helps us cover server costs, develop pastoral features, and maintain free access for thousands of other users.",

    testimonialsTitle: "User Reviews",
    testimonials: [
      {
        name: "Maya",
        role: "Cell group leader",
        quote: "The devotion materials are now neat, easy to share, and still feel personal to the cell group members."
      },
      {
        name: "Yosua",
        role: "Student",
        quote: "The verse lookup feature helps me understand context without feeling like I'm reading a heavy textbook."
      },
      {
        name: "Lina",
        role: "Housewife",
        quote: "The prayer journal lets me look back and see how God has guided me day by day."
      }
    ],

    newsletterSub: "Daily Subscription",
    newsletterTitle: "Get Latest Devotions & Articles",
    newsletterDesc: "Subscribe with your email to receive Christian quiet time devotions and the latest Bible study articles for free, delivered directly to your inbox.",
    newsletterInputLabel: "Your Email Address",
    newsletterPlaceholder: "name@email.com",
    newsletterOption1: "Receive Daily Devotionals (Every Morning)",
    newsletterOption2: "Receive New Articles & Bible Study Guides",
    newsletterBtn: "Subscribe Now",
    newsletterLoading: "Processing...",
    newsletterSuccessTitle: "Subscribed successfully!",
    newsletterSuccessDesc: "Thank you for joining us.",
    newsletterInvalidEmail: "Invalid email address.",
    newsletterConnectionError: "Connection error occurred.",

    waTitle: "Never Miss a Daily Devotion",
    waDesc: "Get the latest articles and devotions every day through the Grace Daily WhatsApp Channel.",
    waFollow: "Follow Channel",
    waLater: "Maybe Later"
  },
  zh: {
    heroSub: "基督徒每日灵修",
    heroTitle: "Grace Daily",
    heroDesc: "您的数字安静空间。每天探索每日金句启示、祷告室、属灵指导以及支持您信仰成长之旅的社区。",
    heroBtnDevotional: "阅读今日灵修",
    heroBtnAsk: "问牧师",
    heroBtnAbout: "关于我们",
    heroBtnTelegramMiniApp: "Grace Daily 应用",
    heroBtnSpotify: "Spotify 播客",
    heroWaDesc: "每天直接在 WhatsApp、Telegram 和 Spotify 播客上接收最新的灵修和文章。",

    demoTitle: "属灵辅导服务",
    demoUserLabel: "你",
    demoPastorLabel: "牧师",
    demoUserMsg: "当祷告尚未得到回应时，我该如何保持信心？",
    demoPastorMsg: "从在上帝面前诚实开始。诗篇告诉我们，信心并不排斥眼泪，而是将眼泪带到上帝面前。",

    featuresSub: "特色功能",
    featuresTitle: "为您的属灵操练而设计",
    features: [
      {
        title: "问牧师",
        description: "属灵问答、实践神学和牧养辅导的个人反思空间。"
      },
      {
        title: "每日灵修",
        description: "根据每日金句自动生成灵修，包含祷告、反思问题及简短总结。"
      },
      {
        title: "黄金金句",
        description: "包含爱心、信心、盼望、宽恕、家庭与力量等主题的金句合集。"
      },
      {
        title: "属灵日记",
        description: "记录挣扎、属灵心情、祷告蒙应允以及信仰成长评估。"
      },
      {
        title: "PDF 灵修材料",
        description: "为个人研读、小组或家庭准备现成的分享格式材料。"
      },
      {
        title: "祷告社区",
        description: "一个有审核、注重隐私并提供初始支持的祷告与倾诉空间。"
      }
    ],

    blogSub: "最新文章",
    blogTitle: "博客与会众消息",
    blogBtn: "打开博客页面",
    blogReadMore: "阅读更多",

    pricingSub: "订阅费用",
    pricingTitle: "支持 Grace Daily 事工",
    pricingDesc: "您的资金支持将帮助我们支付服务器费用、开发牧养功能，并确保成千上万的其他用户可以免费使用。",

    testimonialsTitle: "用户评价",
    testimonials: [
      {
        name: "玛雅",
        role: "小组长",
        quote: "灵修材料变得更整洁、更易于分享，且对小组内成员依然充满个人化的关怀。"
      },
      {
        name: "约书亚",
        role: "学生",
        quote: "金句查询功能帮助我理解语境，而不会觉得在阅读沉重难懂的材料。"
      },
      {
        name: "丽娜",
        role: "家庭主妇",
        quote: "祷告日记让我能够回顾并看见上帝日复一日如何引领我。"
      }
    ],

    newsletterSub: "每日订阅",
    newsletterTitle: "获取最新灵修与文章",
    newsletterDesc: "注册您的电子邮件，即可免费直接在收件箱中接收基督徒安静时刻的灵修和最新的圣经研读文章。",
    newsletterInputLabel: "您的电子邮件地址",
    newsletterPlaceholder: "name@email.com",
    newsletterOption1: "接收每日灵修 (每日早晨)",
    newsletterOption2: "接收新文章与圣经研读指南",
    newsletterBtn: "立即订阅",
    newsletterLoading: "处理中...",
    newsletterSuccessTitle: "订阅成功！",
    newsletterSuccessDesc: "感谢您加入我们。",
    newsletterInvalidEmail: "电子邮件地址无效。",
    newsletterConnectionError: "发生连接错误。",

    waTitle: "绝不错过每日灵修",
    waDesc: "每天通过 Grace Daily WhatsApp 频道获取最新文章与灵修材料。",
    waFollow: "关注频道",
    waLater: "稍后再说"
  }
};

function NewsletterSubscribeForm() {
  const { language } = useLanguage();
  const t = landingTranslations[language] || landingTranslations.id;
  const [email, setEmail] = useState("");
  const [devotionEnabled, setDevotionEnabled] = useState(true);
  const [articleEnabled, setArticleEnabled] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage(t.newsletterInvalidEmail);
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/subscribe/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, devotionEnabled, articleEnabled }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Gagal memproses langganan.");
      }

      setStatus("success");
      setMessage(resData.message || t.newsletterSuccessTitle);
      setEmail("");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || t.newsletterConnectionError);
    }
  };

  return (
    <div className="mt-8 max-w-md mx-auto bg-white p-6 rounded-2xl border border-[#dfd8ca] shadow-sm text-left">
      {status === "success" ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-200">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h4 className="text-base font-bold text-[#14213d]">{message}</h4>
          <p className="text-xs text-[#52606d] mt-1">{t.newsletterSuccessDesc}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="sub-email" className="block text-xs font-bold uppercase tracking-wider text-[#52606d] mb-2">
              {t.newsletterInputLabel}
            </label>
            <input
              id="sub-email"
              type="email"
              placeholder={t.newsletterPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-[#dfd8ca] bg-[#f7f4ee]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6f6f] focus:border-transparent transition-all"
            />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2.5 text-xs text-[#1f2933] cursor-pointer">
              <input
                type="checkbox"
                checked={devotionEnabled}
                onChange={(e) => setDevotionEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-[#dfd8ca] text-[#2a6f6f] focus:ring-[#2a6f6f]"
              />
              <span>{t.newsletterOption1}</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-[#1f2933] cursor-pointer">
              <input
                type="checkbox"
                checked={articleEnabled}
                onChange={(e) => setArticleEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-[#dfd8ca] text-[#2a6f6f] focus:ring-[#2a6f6f]"
              />
              <span>{t.newsletterOption2}</span>
            </label>
          </div>

          {status === "error" && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-md border border-red-100">{message}</p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-2.5 bg-[#2a6f6f] hover:bg-[#1f5252] text-white rounded-lg text-sm font-semibold shadow transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === "loading" ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                {t.newsletterLoading}
              </>
            ) : (
              t.newsletterBtn
            )}
          </button>
        </form>
      )}
    </div>
  );
}

interface HomeClientProps {
  serverData: any;
}

function isEmpty(d: any): boolean {
  return !d || !d.plans || d.plans.length === 0;
}

export function HomeClient({ serverData }: HomeClientProps) {
  const { language } = useLanguage();
  const [data, setData] = useState<any>(serverData && !isEmpty(serverData) ? serverData : null);
  const [loading, setLoading] = useState(serverData && !isEmpty(serverData) ? false : true);
  const [maintenance, setMaintenance] = useState(false);
  const [showWaPopup, setShowWaPopup] = useState(false);
  const [translatedPosts, setTranslatedPosts] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getPostImageUrl = (post: any, activeTitle: string, activeExcerpt: string) => {
    if (!post.imageUrl) return "";
    if (post.imageUrl.includes("/api/admin/generate-image")) {
      try {
        const urlObj = new URL(post.imageUrl, window.location.origin);
        urlObj.searchParams.set("title", activeTitle);
        if (activeExcerpt) {
          urlObj.searchParams.set("description", activeExcerpt.slice(0, 220));
        }
        return urlObj.pathname + urlObj.search;
      } catch (e) {
        return post.imageUrl;
      }
    }
    return post.imageUrl;
  };

  useEffect(() => {
    const dynamicPosts = data?.posts;
    if (!dynamicPosts || dynamicPosts.length === 0) return;
    
    setTranslatedPosts(dynamicPosts);
    
    if (language === "id") {
      return;
    }
    
    let active = true;
    async function translateAll() {
      const gtLang = language === "zh" ? "zh-CN" : language;
      const newPosts = [];
      
      for (const post of dynamicPosts) {
        const hasTitle = language === "en" ? !!post.title_en : !!post.title_zh;
        const hasExcerpt = language === "en" ? !!post.excerpt_en : !!post.excerpt_zh;
        
        let title = language === "en" ? post.title_en : post.title_zh;
        let excerpt = language === "en" ? post.excerpt_en : post.excerpt_zh;
        
        if (!hasTitle || !hasExcerpt) {
          try {
            const toTranslate = [
              !hasTitle ? (post.title || "") : "",
              !hasExcerpt ? (post.excerpt || "") : ""
            ].filter(Boolean);

            const response = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: toTranslate,
                to: language,
                type: "blog",
                id: post.id
              })
            });

            if (response.ok) {
              const resData = await response.json();
              const translatedList = resData.translated || [];
              let listIdx = 0;
              if (!hasTitle) {
                title = translatedList[listIdx];
                listIdx++;
              }
              if (!hasExcerpt) {
                excerpt = translatedList[listIdx];
              }
            }
          } catch (err) {
            console.error("Failed to client translate post:", post.id, err);
          }
        }
        
        newPosts.push({
          ...post,
          translatedTitle: title || post.title,
          translatedExcerpt: excerpt || post.excerpt,
        });
      }
      
      if (active) {
        setTranslatedPosts(newPosts);
      }
    }
    
    translateAll();
    return () => {
      active = false;
    };
  }, [language, data?.posts]);

  useEffect(() => {
    if (loading || maintenance || !data) return;
    const lastSeen = localStorage.getItem("grace-daily-wa-popup-seen");
    const now = Date.now();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    
    if (!lastSeen || (now - Number(lastSeen) > thirtyDaysInMs)) {
      const timer = setTimeout(() => {
        setShowWaPopup(true);
        if (typeof window !== "undefined" && (window as any).gtag) {
          (window as any).gtag("event", "whatsapp_channel_popup_open");
        }
      }, 5000); // 5 seconds delay for better UX
      return () => clearTimeout(timer);
    }
  }, [loading, maintenance, data]);

  const handleCloseWaPopup = () => {
    localStorage.setItem("grace-daily-wa-popup-seen", Date.now().toString());
    setShowWaPopup(false);
  };

  const handleFollowWaCta = () => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "whatsapp_channel_follow_cta");
    }
    localStorage.setItem("grace-daily-wa-popup-seen", Date.now().toString());
    setShowWaPopup(false);
  };

  // isEmpty is defined at module scope above

  useEffect(() => {
    const start = Date.now();
    async function init() {
      // Clean up old cache entries older than 30 days
      await clearOldCache();

      let finalData: any = null;
      if (serverData && !isEmpty(serverData)) {
        // Server fetch succeeded, cache it in IndexedDB
        await saveToCache("home-data", serverData);
        finalData = serverData;
      } else {
        // Server fetch failed (or empty), attempt to load from IndexedDB cache
        console.warn("[HomeClient] Server data empty for 'home-data'. Falling back to IndexedDB...");
        const cached = await getFromCache("home-data");
        if (cached && !isEmpty(cached)) {
          console.log("[HomeClient] Successfully loaded 'home-data' from IndexedDB.");
          finalData = cached;
        }
      }

      const elapsed = Date.now() - start;
      // If we already have serverData, do not impose a minimum splash screen delay
      const minDuration = (serverData && !isEmpty(serverData)) ? 0 : 1200;
      const delay = Math.max(0, minDuration - elapsed);

      setTimeout(() => {
        if (finalData) {
          setData(finalData);
        } else {
          console.error("[HomeClient] IndexedDB cache is empty for 'home-data'. Directing to maintenance...");
          setMaintenance(true);
        }
        setLoading(false);
      }, delay);
    }
    init();
  }, [serverData]);

  if (!isMounted || loading) {
    return (
      <div className="min-h-screen bg-[#14213d] flex flex-col items-center justify-center text-white p-4">
        <style>{`
          @keyframes loadProgress {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0); }
            100% { transform: translateX(100%); }
          }
          .animate-progress-bar {
            animation: loadProgress 1.6s infinite ease-in-out;
          }
        `}</style>

        <div className="flex flex-col items-center max-w-sm text-center gap-6 animate-pulse">
          {/* Splash Image Container with Pulsing Glow */}
          <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <img
              src="/logo1.jpg"
              alt="Grace Daily Splash"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Loading details */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold uppercase tracking-widest text-[#ffd166]">
              Grace Daily
            </h1>
            <p className="text-xs text-white/60 tracking-widest uppercase">
              {language === "zh" ? "正在准备您的灵修时光..." : language === "en" ? "Preparing Your Quiet Time..." : "Menyiapkan Saat Teduh Anda..."}
            </p>
          </div>

          {/* Premium Loader Bar */}
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full bg-[#ffd166] rounded-full animate-progress-bar"></div>
          </div>
        </div>
      </div>
    );
  }

  if (maintenance) {
    if (typeof window !== "undefined") {
      window.location.href = "/maintenance";
    }
    return null;
  }

  if (!data) return null;

  const bulletin = data.bulletin;
  const adsConfig = data.adsConfig;
  const devotion = data.devotion;
  const dynamicPosts = data.posts;
  const dynamicPlans = data.plans;
  const encyclopediaStats = data.encyclopediaStats;
  const encyclopediaSamples = data.encyclopediaSamples;

  const t = landingTranslations[language] || landingTranslations.id;
  const demoMessages = [
    {
      label: t.demoUserLabel,
      text: t.demoUserMsg,
    },
    {
      label: t.demoPastorLabel,
      text: t.demoPastorMsg,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#1f2933]">
      <AdPopup adConfig={adsConfig} />
      {bulletin?.isActive && (
        <div className="bg-[#ffd166] px-5 py-3 text-center text-[#14213d] sm:px-8 shadow-sm relative z-50">
          <p className="text-sm font-bold uppercase tracking-[0.1em]">{bulletin.title}</p>
          <p className="mt-1 text-sm font-medium">{bulletin.content}</p>
          {bulletin.url && (
            <a href={bulletin.url} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-md bg-[#14213d] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#2a6f6f]">
              {language === "zh" ? "打开链接" : language === "en" ? "Open Link" : "Buka Tautan"}
            </a>
          )}
        </div>
      )}
      <section className="relative isolate overflow-hidden bg-[#14213d] text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(244,162,97,0.28),transparent_34%),linear-gradient(135deg,#14213d_0%,#25415f_52%,#2a6f6f_100%)]" />

        {/* AdSense Header Ad */}
        <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-4">
          <AdSenseAd placement="header" />
        </div>

        <div className="mx-auto grid min-h-[calc(100vh-84px)] max-w-7xl items-center gap-10 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-[#ffd166]">
              {t.heroSub}
            </p>
            <h1 className="text-5xl font-semibold leading-tight sm:text-6xl lg:text-7xl">
              {t.heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82">
              {t.heroDesc}
            </p>
            <div className="mt-8 flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="#mulai"
                  className="rounded-md bg-white px-5 py-3 text-center font-semibold text-[#14213d] transition hover:bg-[#e9f5db] text-sm"
                >
                  {t.heroBtnDevotional}
                </a>
                <a
                  href="/tanya-pendeta"
                  className="rounded-md border border-white/35 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10 text-sm"
                >
                  {t.heroBtnAsk}
                </a>
                <Link
                  href="/tentang-kami"
                  className="rounded-md border border-white/35 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10 text-sm"
                >
                  {t.heroBtnAbout}
                </Link>
              </div>
              <div className="flex flex-col gap-3 items-start mt-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap w-full sm:w-auto">
                  <WhatsAppChannelButton variant="primary" size="md" sourcePage="home_hero" className="w-full sm:w-auto" />
                  <Link
                    href="/telegram-miniapp"
                    className="inline-flex items-center justify-center font-sans tracking-wide active:scale-[0.98] transition-transform bg-[#24A1DE] hover:bg-[#208ebe] text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 border border-transparent px-5 py-2.5 text-sm rounded-lg gap-2 w-full sm:w-auto"
                  >
                    <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.87.03-.23.35-.47.96-.71 3.76-1.64 6.27-2.72 7.54-3.25 3.58-1.48 4.32-1.74 4.81-1.75.11 0 .35.03.5.16.13.12.17.27.18.39-.01.07-.01.14-.02.21z"/>
                    </svg>
                    <span>{t.heroBtnTelegramMiniApp}</span>
                  </Link>
                  <a
                    href="https://open.spotify.com/show/033TJ6MdOOn5mIhWPv2Geo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center font-sans tracking-wide active:scale-[0.98] transition-transform bg-[#1DB954] hover:bg-[#1ed760] text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 border border-transparent px-5 py-2.5 text-sm rounded-lg gap-2 w-full sm:w-auto"
                  >
                    <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.076-.67-.135-.746-.472-.076-.336.135-.67.472-.746 3.852-.879 7.144-.504 9.822 1.135.295.18.387.565.207.858zm1.225-2.72c-.228.37-.712.49-1.083.262-2.72-1.67-6.87-2.154-10.077-1.182-.413.125-.85-.107-.975-.52-.125-.413.107-.85.52-.975 3.667-1.11 8.232-.573 11.353 1.345.37.228.49.713.262 1.083zm.106-2.825C14.302 8.78 8.334 8.583 4.883 9.63c-.53.16-1.09-.14-1.25-.67-.16-.53.14-1.09.67-1.25 3.968-1.203 10.548-.973 14.73 1.51.48.28.64.9.36 1.38-.28.48-.9.64-1.38.36z"/>
                    </svg>
                    <span>{t.heroBtnSpotify || "Spotify Podcast"}</span>
                  </a>
                </div>
                <span className="text-xs text-white/60 pl-1">{t.heroWaDesc}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4" id="mulai">
            <DevotionCard devotion={devotion} />
            <div
              id="demo"
              className="rounded-lg border border-white/15 bg-[#f7f4ee] p-5 text-[#1f2933] shadow-2xl"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
                {t.demoTitle}
              </p>
              <div className="mt-4 grid gap-3">
                {demoMessages.map((message, idx) => (
                  <div key={idx} className="rounded-md bg-white p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#2a6f6f]">
                        {message.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#334155] leading-relaxed">
                      {message.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="ensiklopedia-hero" className="px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <EnsiklopediaPreview stats={encyclopediaStats} sampleArticles={encyclopediaSamples} />
        </div>
      </section>

      <section id="fitur" className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
            {t.featuresSub}
          </p>
          <h2 className="mt-3 text-4xl font-semibold text-[#14213d] sm:text-5xl">
            {t.featuresTitle}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((item, idx) => {
              const featureLinks = [
                "/tanya-pendeta",
                "/renungan",
                "/alkitab",
                "/jurnal",
                "/jurnal",
                "/komunitas-doa"
              ];
              const targetLink = featureLinks[idx] || "/";
              return (
                <Link
                  key={idx}
                  href={targetLink}
                  className="block rounded-xl border border-[#dfd8ca] bg-white p-6 text-left shadow-sm hover:shadow-md transition hover:border-[#2a6f6f] group"
                >
                  <h3 className="text-lg font-semibold text-[#14213d] group-hover:text-[#2a6f6f] transition-colors">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#52606d]">{item.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <BiblePreview />
        </div>
      </section>

      <RecommendationSection />

      <section id="blog" className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
                {t.blogSub}
              </p>
              <h2 className="mt-3 text-4xl font-semibold text-[#14213d]">
                {t.blogTitle}
              </h2>
            </div>
            <Link
              href="/blog"
              className="rounded-md border border-[#dfd8ca] bg-white px-5 py-2.5 font-semibold text-[#14213d] transition hover:bg-[#f7f4ee] text-center"
            >
              {t.blogBtn}
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {translatedPosts.map((post: any, idx: number) => {
              const dateVal = post.createdAt;
              const formattedDate = dateVal
                ? new Date(dateVal).toLocaleString(
                    language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID",
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Jakarta",
                    }
                  )
                : (language === "zh" ? "刚刚" : language === "en" ? "Just now" : "Baru saja");

              const activeTitle = language === "id" ? post.title : (post.translatedTitle || post.title_en || post.title_zh || post.title);
              const activeExcerpt = language === "id" ? post.excerpt : (post.translatedExcerpt || post.excerpt_en || post.excerpt_zh || post.excerpt);

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

              return (
                <article
                  key={post.id ? `post-${post.id}` : `post-idx-${idx}`}
                  className="flex flex-col rounded-xl border border-[#dfd8ca] bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {post.imageUrl && (
                    <div className="relative h-48 w-full bg-gray-100">
                      <img
                        src={getPostImageUrl(post, activeTitle, activeExcerpt)}
                        alt={activeTitle}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex justify-between items-center text-xs font-semibold text-[#52606d] mb-1">
                      <span className="uppercase tracking-wider text-[#2a6f6f]">
                        {getCategoryLabel(post.category)}
                      </span>
                      <span suppressHydrationWarning>{formattedDate}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-[#14213d] line-clamp-2">
                      {activeTitle}
                    </h3>
                    <p className="mt-2 flex-1 text-sm text-[#52606d] line-clamp-3 leading-relaxed">
                      {activeExcerpt}
                    </p>
                    <Link
                      href={`/blog/${post.id}`}
                      className="mt-4 inline-flex items-center text-sm font-semibold text-[#2a6f6f] hover:underline"
                    >
                      {t.blogReadMore}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="paket" className="bg-[#14213d] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#ffd166]">
            {t.pricingSub}
          </p>
          <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">
            {t.pricingTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/80">
            {t.pricingDesc}
          </p>
            {/* Replaced old Pricing Cards with new Kemitraan Pelayanan UI */}
            <div className="mt-12 col-span-full">
              <DonationCards plans={dynamicPlans} />
            </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-semibold text-[#14213d]">
            {t.testimonialsTitle}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {t.testimonials.map((item, idx) => (
              <article
                key={idx}
                className="rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-5"
              >
                <p className="leading-7 text-[#334155]">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <p className="mt-4 font-semibold text-[#14213d]">
                  {item.name}
                </p>
                <p className="text-sm text-[#52606d]">{item.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Public Newsletter Subscription Form */}
      <section className="bg-gradient-to-br from-[#f7f4ee] to-[#e9f5db]/30 border-t border-b border-[#dfd8ca] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
            {t.newsletterSub}
          </p>
          <h2 className="mt-3 text-3xl font-bold text-[#14213d] sm:text-4xl font-serif">
            {t.newsletterTitle}
          </h2>
          <p className="mt-4 text-sm text-[#52606d] leading-relaxed">
            {t.newsletterDesc}
          </p>
          <NewsletterSubscribeForm />
        </div>
      </section>
      <footer className="border-t border-[#dfd8ca] bg-white px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <p className="text-sm text-[#52606d] order-3 sm:order-1">
            &copy; {new Date().getFullYear()} Grace Daily. All rights reserved.
          </p>
          <div className="flex gap-5 items-center order-1 sm:order-2">
            {/* Facebook */}
            <a href="https://www.facebook.com/share/p/14dJJ2vgNDa/" target="_blank" rel="noreferrer" className="text-[#52606d] hover:text-[#1877F2] transition" aria-label="Facebook">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
            </a>
            {/* Instagram */}
            <a href="https://www.instagram.com/dailygrace168/" target="_blank" rel="noreferrer" className="text-[#52606d] hover:text-[#E1306C] transition" aria-label="Instagram">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.163c3.204 0 3.585.012 4.849.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.644.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
            {/* X (Twitter) */}
            <a href="https://x.com/gracedailybible" target="_blank" rel="noreferrer" className="text-[#52606d] hover:text-[#000000] transition" aria-label="X (Twitter)">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            {/* TikTok */}
            <a href="https://www.tiktok.com/@gracedaily168?is_from_webapp=1&sender_device=pc" target="_blank" rel="noreferrer" className="text-[#52606d] hover:text-[#000000] transition" aria-label="TikTok">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a10.15 10.15 0 006.19 2.09V7.34a4.85 4.85 0 01-2.42-.65z"/>
              </svg>
            </a>
            {/* YouTube */}
            <a href="https://www.youtube.com/@gracedaily-d8i" target="_blank" rel="noreferrer" className="text-[#52606d] hover:text-[#FF0000] transition" aria-label="YouTube">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            {/* Telegram */}
            <a href="https://t.me/gracedailybible" target="_blank" rel="noreferrer" className="text-[#52606d] hover:text-[#229ED9] transition" aria-label="Telegram">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-[#52606d] order-2 sm:order-3 justify-center">
            <PodcastDropdown />
            <Link href="/tentang-kami" className="hover:text-[#2a6f6f] hover:underline">
              {language === "zh" ? "关于我们" : language === "en" ? "About Us" : "Tentang Kami"}
            </Link>
            <Link href="/kontak" className="hover:text-[#2a6f6f] hover:underline">
              {language === "zh" ? "联系我们" : language === "en" ? "Contact Us" : "Hubungi Kami"}
            </Link>
            <Link href="/tanya-pendeta" className="hover:text-[#2a6f6f] hover:underline">
              {language === "zh" ? "问牧师" : language === "en" ? "Ask Pastor" : "Tanya Pendeta"}
            </Link>
            <Link href="/telegram-miniapp" className="hover:text-[#2a6f6f] hover:underline inline-flex items-center gap-1">
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.012 9.479c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.875.742z"/></svg>
              {language === "zh" ? "Telegram 小程序" : language === "en" ? "Telegram Mini App" : "Mini App Telegram"}
            </Link>
            <Link href="/syarat-dan-ketentuan" className="hover:text-[#2a6f6f] hover:underline">
              {language === "zh" ? "服务条款" : language === "en" ? "Terms & Conditions" : "Syarat dan Ketentuan"}
            </Link>
          </div>
        </div>
      </footer>


      {/* WhatsApp Channel Popup Invite */}
      {showWaPopup && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-white border border-[#dfd8ca] rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <button
            onClick={handleCloseWaPopup}
            className="absolute top-3 right-3 text-[#52606d] hover:text-[#14213d] transition-colors"
            aria-label="Tutup"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#25D366]/10 rounded-full flex items-center justify-center shrink-0 text-xl">
              🟢
            </div>
            <div className="text-left">
              <h3 className="text-base font-bold text-[#14213d]">{t.waTitle}</h3>
              <p className="text-xs text-[#52606d] mt-1 leading-relaxed">
                {t.waDesc}
              </p>
              <div className="mt-4 flex gap-2">
                <a
                  href="https://whatsapp.com/channel/0029VbCUBJfG8l5A2qoOPN0w"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleFollowWaCta}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-xs font-semibold text-white hover:bg-[#20ba56] transition shadow-sm active:scale-95"
                >
                  {t.waFollow}
                </a>
                <button
                  onClick={handleCloseWaPopup}
                  className="rounded-lg border border-[#dfd8ca] px-3 py-2 text-xs font-semibold text-[#52606d] hover:bg-[#f7f4ee]/30 transition"
                >
                  {t.waLater}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
