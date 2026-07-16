"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

type BibleVerseMock = {
  reference: string;
  text: string;
  themes: string[];
};

const BIBLE_THEMATIC_MOCK: Record<string, BibleVerseMock[]> = {
  Kasih: [
    {
      reference: "1 Yohanes 4:19",
      text: "Kita mengasihi, karena Allah lebih dahulu mengasihi kita.",
      themes: ["Kasih", "Iman"],
    },
    {
      reference: "1 Korintus 13:4",
      text: "Kasih itu sabar; kasih itu murah hati; ia tidak cemburu. Ia tidak memegahkan diri dan tidak sombong.",
      themes: ["Kasih", "Kebaikan"],
    },
  ],
  Damai: [
    {
      reference: "Yohanes 14:27",
      text: "Damai sejahtera Kutinggalkan bagimu. Damai sejahtera-Ku Kuberikan kepadamu, dan apa yang Kuberikan tidak seperti yang diberikan oleh dunia kepadamu.",
      themes: ["Damai", "Penghiburan"],
    },
    {
      reference: "Filipi 4:7",
      text: "Damai sejahtera Allah, yang melampaui segala akal, akan memelihara hati dan pikiranmu dalam Kristus Yesus.",
      themes: ["Damai", "Kekuatan"],
    },
  ],
  Kekuatan: [
    {
      reference: "Filipi 4:13",
      text: "Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku.",
      themes: ["Kekuatan", "Iman"],
    },
    {
      reference: "Yesaya 40:31",
      text: "tetapi orang-orang yang menanti-nantikan TUHAN mendapat kekuatan baru: mereka seumpama rajawali yang naik terbang dengan kekuatan sayapnya...",
      themes: ["Kekuatan", "Pengharapan"],
    },
  ],
};

const AUTO_TYPING_KEYWORDS = ["Yohanes 3:16", "Mazmur 23:1", "khawatir"];

const AUTO_TYPING_VERSES: Record<string, BibleVerseMock> = {
  "Yohanes 3:16": {
    reference: "Yohanes 3:16",
    text: "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.",
    themes: ["Kasih", "Keselamatan"],
  },
  "Mazmur 23:1": {
    reference: "Mazmur 23:1",
    text: "TUHAN adalah gembalaku, takkan kekurangan aku.",
    themes: ["Perlindungan", "Penghiburan"],
  },
  "khawatir": {
    reference: "Matius 6:34",
    text: "Sebab itu janganlah kamu khawatir akan hari besok, karena hari besok mempunyai kesusahannya sendiri. Kesusahan sehari cukuplah untuk sehari.",
    themes: ["Damai", "Pengharapan"],
  },
};

export function BiblePreview() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"search" | "theme">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("Kasih");
  
  // Language-specific content
  const THEMATIC_DATA: Record<string, { label: string; icon: string; verses: { reference: string; text: string }[] }[]> = {
    id: [
      { label: "Kasih", icon: "❤️", verses: [
        { reference: "1 Yoh 4:19", text: "Kita mengasihi, karena Allah lebih dahulu mengasihi kita." },
        { reference: "1 Kor 13:4", text: "Kasih itu sabar; kasih itu murah hati; ia tidak cemburu." },
      ]},
      { label: "Damai", icon: "🕊️", verses: [
        { reference: "Yoh 14:27", text: "Damai sejahtera Kutinggalkan bagimu. Damai sejahtera-Ku Kuberikan kepadamu." },
        { reference: "Flp 4:7", text: "Damai sejahtera Allah, yang melampaui segala akal, akan memelihara hatimu." },
      ]},
      { label: "Kekuatan", icon: "💪", verses: [
        { reference: "Flp 4:13", text: "Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku." },
        { reference: "Yes 40:31", text: "Orang-orang yang menanti-nantikan TUHAN mendapat kekuatan baru." },
      ]},
    ],
    en: [
      { label: "Love", icon: "❤️", verses: [
        { reference: "1 John 4:19", text: "We love because he first loved us." },
        { reference: "1 Cor 13:4", text: "Love is patient, love is kind. It does not envy, it does not boast." },
      ]},
      { label: "Peace", icon: "🕊️", verses: [
        { reference: "John 14:27", text: "Peace I leave with you; my peace I give you." },
        { reference: "Phil 4:7", text: "The peace of God, which transcends all understanding, will guard your hearts." },
      ]},
      { label: "Strength", icon: "💪", verses: [
        { reference: "Phil 4:13", text: "I can do all this through him who gives me strength." },
        { reference: "Isa 40:31", text: "Those who hope in the LORD will renew their strength." },
      ]},
    ],
    zh: [
      { label: "爱", icon: "❤️", verses: [
        { reference: "约一 4:19", text: "我们爱，因为神先爱我们。" },
        { reference: "林前 13:4", text: "爱是恒久忍耐，又有恩慈；爱是不嫉妒。" },
      ]},
      { label: "平安", icon: "🕊️", verses: [
        { reference: "约 14:27", text: "我留下平安给你们；我将我的平安赐给你们。" },
        { reference: "腓 4:7", text: "神那超越人所能理解的平安，必在基督耶稣里保守你们的心怀意念。" },
      ]},
      { label: "力量", icon: "💪", verses: [
        { reference: "腓 4:13", text: "我靠着那加给我力量的，凡事都能做。" },
        { reference: "赛 40:31", text: "仰望耶和华的必重新得力。" },
      ]},
    ],
  };

  const thematicData = THEMATIC_DATA[language] || THEMATIC_DATA.id;

  // Typing keywords per language
  const AUTO_TYPING: Record<string, { keywords: string[]; results: Record<string, { reference: string; text: string }> }> = {
    id: {
      keywords: ["Yohanes 3:16", "Mazmur 23:1", "khawatir"],
      results: {
        "Yohanes 3:16": { reference: "Yohanes 3:16", text: "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal..." },
        "Mazmur 23:1": { reference: "Mazmur 23:1", text: "TUHAN adalah gembalaku, takkan kekurangan aku." },
        "khawatir": { reference: "Matius 6:34", text: "Sebab itu janganlah kamu khawatir akan hari besok." },
      },
    },
    en: {
      keywords: ["John 3:16", "Psalm 23:1", "worry"],
      results: {
        "John 3:16": { reference: "John 3:16", text: "For God so loved the world that he gave his one and only Son..." },
        "Psalm 23:1": { reference: "Psalm 23:1", text: "The LORD is my shepherd, I lack nothing." },
        "worry": { reference: "Matthew 6:34", text: "Therefore do not worry about tomorrow, for tomorrow will worry about itself." },
      },
    },
    zh: {
      keywords: ["约翰 3:16", "诗篇 23:1", "忧虑"],
      results: {
        "约翰 3:16": { reference: "约翰福音 3:16", text: "神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。" },
        "诗篇 23:1": { reference: "诗篇 23:1", text: "耶和华是我的牧者，我必不至缺乏。" },
        "忧虑": { reference: "马太福音 6:34", text: "所以，不要为明天忧虑，因为明天自有明天的忧虑。" },
      },
    },
  };

  const langData = AUTO_TYPING[language] || AUTO_TYPING.id;
  const [typingText, setTypingText] = useState("");
  const [showSimulatedResult, setShowSimulatedResult] = useState(true);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-typing animation simulator logic
  useEffect(() => {
    if (activeTab !== "search") {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      return;
    }

    let kwIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let currentWord = langData.keywords[kwIndex] || "";

    const type = () => {
      if (!currentWord) return;
      if (!isDeleting) {
        setTypingText(currentWord.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === currentWord.length) {
          isDeleting = true;
          setShowSimulatedResult(true);
          // Wait 3.5 seconds before deleting
          if (typingTimerRef.current) clearInterval(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => {
            typingTimerRef.current = setInterval(type, 100);
          }, 3500);
        }
      } else {
        setTypingText(currentWord.substring(0, charIndex - 1));
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          setShowSimulatedResult(false);
          kwIndex = (kwIndex + 1) % langData.keywords.length;
          currentWord = langData.keywords[kwIndex] || "";
        }
      }
    };

    typingTimerRef.current = setInterval(type, 150);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [activeTab, langData]);

  const currentSimulatedVerse = useMemo(() => {
    const matchedKey = Object.keys(langData.results).find(
      (k) => k.toLowerCase() === typingText.toLowerCase() || typingText.toLowerCase().includes(k.toLowerCase())
    );
    if (matchedKey) return langData.results[matchedKey];

    // Fallback based on substrings during typing
    if (language === "zh") {
      if (typingText.startsWith("约翰") || typingText.startsWith("约翰福音")) {
        return langData.results["约翰 3:16"];
      } else if (typingText.startsWith("诗") || typingText.startsWith("诗篇")) {
        return langData.results["诗篇 23:1"];
      } else if (typingText.startsWith("忧") || typingText.startsWith("忧虑")) {
        return langData.results["忧虑"];
      }
    } else if (language === "en") {
      if (typingText.startsWith("John") || typingText.startsWith("John 3")) {
        return langData.results["John 3:16"];
      } else if (typingText.startsWith("Psal") || typingText.startsWith("Psalm")) {
        return langData.results["Psalm 23:1"];
      } else if (typingText.startsWith("worr") || typingText.startsWith("worry")) {
        return langData.results["worry"];
      }
    } else {
      if (typingText.startsWith("Yohan") || typingText.startsWith("Yohanes")) {
        return langData.results["Yohanes 3:16"];
      } else if (typingText.startsWith("Mazm") || typingText.startsWith("Mazmur")) {
        return langData.results["Mazmur 23:1"];
      } else if (typingText.startsWith("khaw") || typingText.startsWith("khawatir")) {
        return langData.results["khawatir"];
      }
    }
    return null;
  }, [typingText, langData, language]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/alkitab?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="bg-gradient-to-r from-[#102c3a] via-[#163e52] to-[#0f2e3d] px-5 py-16 text-white sm:px-8 border-y border-white/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,209,102,0.15),transparent_40%)] pointer-events-none" />

      <div className="mx-auto max-w-7xl relative z-10">
        <div className="grid gap-10 items-center lg:grid-cols-[1.15fr_0.85fr]">
          {/* Left Column */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ffd166]">
              {t("bible.online_title")}
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {language === "zh" ? "专注聆听神的话语" : language === "en" ? "Focus Fully on God's Word" : "Fokus Penuh pada Firman Tuhan"}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/80">
              {t("bible.online_subtitle")}
            </p>

            {/* Live Search Form */}
            <form onSubmit={handleSearchSubmit} className="mt-8 max-w-lg">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("bible.search_placeholder")}
                  className="flex-1 rounded-md border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/50 outline-none ring-[#ffd166] transition-all duration-300 focus:bg-white/15 focus:ring-2 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="rounded-md bg-[#ffd166] px-6 py-3 text-sm font-bold text-[#102c3a] shadow-md transition-all duration-300 hover:bg-[#ffe3a1] hover:scale-[1.02] active:scale-[0.98]"
                >
                  {t("bible.search")}
                </button>
              </div>
            </form>

            {/* Quick Bible Shortcuts */}
            <div className="mt-8">
              <span className="text-xs font-bold text-[#ffd166] uppercase tracking-wider block mb-3">
                {t("bible.try_search")}
              </span>
              <div className="flex flex-wrap gap-2.5">
                {(language === "zh" ? [
                  { name: "律法书 (创世纪)", query: "创世纪" },
                  { name: "诗歌 (诗篇)", query: "诗篇 23" },
                  { name: "福音书 (约翰)", query: "约翰福音 3" },
                  { name: "书信 (罗马)", query: "罗马书 8" },
                ] : language === "en" ? [
                  { name: "Torah (Genesis)", query: "Genesis" },
                  { name: "Poetry (Psalms)", query: "Psalm 23" },
                  { name: "Gospels (John)", query: "John 3" },
                  { name: "Epistles (Romans)", query: "Romans 8" },
                ] : [
                  { name: "Taurat (Kejadian)", query: "Kejadian" },
                  { name: "Puisi & Hikmat (Mazmur)", query: "Mazmur 23" },
                  { name: "Injil (Yohanes)", query: "Yohanes 3" },
                  { name: "Surat-Surat (Roma)", query: "Roma 8" },
                ]).map((item) => (
                  <Link
                    key={item.name}
                    href={`/alkitab?search=${encodeURIComponent(item.query)}`}
                    className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15 hover:border-[#ffd166] hover:text-[#ffd166] transition-all duration-300"
                  >
                    📖 {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Digital Mockup Simulator */}
          <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md p-5 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none" />

            {/* Simulator Header & Tab Toggles */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                <span className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-[10px] text-white/40 font-mono ml-1.5 uppercase tracking-wider">Bible Simulator v1.0</span>
              </div>
              <div className="flex bg-black/30 rounded-lg p-0.5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab("search")}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all duration-300 ${
                    activeTab === "search"
                      ? "bg-[#ffd166] text-[#102c3a] shadow"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  🔍 {t("bible.search")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("theme")}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all duration-300 ${
                    activeTab === "theme"
                      ? "bg-[#ffd166] text-[#102c3a] shadow"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  🏷️ {t("bible.themes")}
                </button>
              </div>
            </div>

            {/* SIMULATOR SCREEN AREA */}
            <div className="min-h-[200px] flex flex-col justify-between">
              {activeTab === "search" ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="w-full bg-black/40 border border-white/10 rounded-md px-3.5 py-2.5 text-xs flex items-center justify-between text-white/80 font-mono shadow-inner">
                    <span>
                      {typingText}
                      <span className="animate-ping font-bold text-[#ffd166]">|</span>
                    </span>
                    <span className="text-white/40">🔍</span>
                  </div>

                  {showSimulatedResult && currentSimulatedVerse ? (
                    <div className="animate-in slide-in-from-bottom-2 fade-in duration-500 bg-white/10 border border-white/15 rounded-xl p-4 shadow-lg hover:border-[#ffd166]/50 transition-all duration-300">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffd166] bg-[#ffd166]/10 px-2 py-0.5 rounded-full">
                          {currentSimulatedVerse.reference}
                        </span>
                        <span className="text-[9px] text-white/40 font-semibold">AYT</span>
                      </div>
                      <p className="text-xs text-white/90 leading-relaxed italic">
                        &ldquo;{currentSimulatedVerse.text}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-xs text-white/40 italic">
                      <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/80 animate-spin mb-2" />
                      {language === "zh" ? "搜索参考文献..." : language === "en" ? "Searching references..." : "Mencari referensi..."}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex gap-2">
                    {thematicData.map((theme) => (
                      <button
                        key={theme.label}
                        type="button"
                        onClick={() => setSelectedTheme(theme.label)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all duration-300 ${
                          selectedTheme === theme.label
                            ? "bg-white/15 border-[#ffd166] text-[#ffd166] shadow-md"
                            : "border-white/10 bg-black/20 text-white/60 hover:text-white hover:border-white/20"
                        }`}
                      >
                        {theme.icon} {theme.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                    {(thematicData.find(d => d.label === selectedTheme) || thematicData[0]).verses.map((verse, i) => (
                      <div
                        key={i}
                        className="animate-in slide-in-from-bottom-2 fade-in duration-500 bg-white/10 border border-white/15 rounded-xl p-3.5 shadow hover:border-[#ffd166]/40 transition-all duration-300"
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[10px] font-bold text-[#ffd166]">{verse.reference}</span>
                          <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-white/50">{t("bible.themes")}</span>
                        </div>
                        <p className="text-[11px] text-white/90 leading-relaxed">
                          &ldquo;{verse.text}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 text-center">
              <Link
                href="/alkitab"
                className="text-xs font-semibold text-[#ffd166] hover:text-[#ffe3a1] hover:underline transition-colors inline-flex items-center gap-1"
              >
                {language === "zh" ? "打开完整圣经页面" : language === "en" ? "Open Full Bible Page" : "Buka Halaman Alkitab Lengkap"}
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
