"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { AiMode } from "@/lib/ai";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { shareToWhatsApp, downloadPdf } from "@/lib/share";
import { toggleAudio } from "@/lib/audio";
import { useLanguage } from "@/lib/i18n";

const HISTORY_ITEMS_PER_PAGE = 6;

function toDate(value: any) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.toMillis === "function") return new Date(value.toMillis());
  if (value.seconds) return new Date(value.seconds * 1000);
  if (value._seconds) return new Date(value._seconds * 1000);
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function AiConsole() {
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  const [userAllowedModes, setUserAllowedModes] = useState<string[] | null>(null);
  const [canExportPdf, setCanExportPdf] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editPromptValue, setEditPromptValue] = useState("");
  const [editAnswerValue, setEditAnswerValue] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [aiQuota, setAiQuota] = useState(0);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  const tools = useMemo(() => {
    return [
      {
        mode: "devotional" as AiMode,
        label: t("ai.mode_devotional"),
        prompt: language === "zh"
          ? "根据约翰福音 3:16 撰写一篇每日灵修。包含标题、经文、反思、应用和祷告。"
          : language === "en"
          ? "Create a daily devotional from John 3:16. Include a title, verse, reflection, application, and prayer."
          : "Buat renungan harian dari Yohanes 3:16. Sertakan judul, ayat, refleksi, aplikasi, dan doa.",
        placeholder: language === "zh"
          ? "输入经文或灵修主题，例如：诗篇 23 关于神的同在。"
          : language === "en"
          ? "Type a verse or devotional theme, e.g.: Psalm 23 about God's presence."
          : "Tulis ayat atau tema renungan, contoh: Mazmur 23 tentang penyertaan Tuhan.",
      },
      {
        mode: "devotional_pdf" as AiMode,
        label: t("ai.mode_devotional_pdf"),
        prompt: language === "zh"
          ? "编写一份以“在基督里的盼望”为主题的 7 天 PDF 灵修材料。包含开篇页、每日核心经文、灵修内容、反思问题、笔记空间、祷告以及家庭/小组讨论指南。"
          : language === "en"
          ? "Compile a 7-day PDF devotional on hope in Christ. Include an opening page, main verse for each day, devotional reflection, discussion questions, notes space, prayer, and family/cell group discussion guide."
          : "Susun bahan PDF devotional 7 hari bertema pengharapan dalam Kristus. Sertakan halaman pembuka, ayat utama tiap hari, renungan, pertanyaan refleksi, ruang catatan, doa, dan panduan diskusi keluarga/komsel.",
        placeholder: language === "zh"
          ? "输入 PDF 灵修材料的主题、时长、受众和具体需求。"
          : language === "en"
          ? "Type theme, duration, audience, and PDF devotional needs."
          : "Tulis tema, durasi, audiens, dan kebutuhan bahan PDF devotional.",
      },
      {
        mode: "pastor" as AiMode,
        label: t("ai.mode_pastor"),
        prompt: language === "zh"
          ? "我发现很难静下心来祷告，感觉与神有些疏远。请以牧者心肠并基于圣经给予我回应。"
          : language === "en"
          ? "I am finding it hard to pray and feel distant from God. Please respond pastorally and biblically."
          : "Saya sedang sulit berdoa dan merasa jauh dari Tuhan. Tolong jawab secara pastoral dan alkitabiah.",
        placeholder: language === "zh"
          ? "写下您想要探讨的属灵问题或信仰挣扎。"
          : language === "en"
          ? "Write a spiritual question or struggle you'd like to discuss."
          : "Tulis pertanyaan rohani atau pergumulan yang ingin didiskusikan.",
      },
      {
        mode: "bible-study" as AiMode,
        label: t("ai.mode_bible_study"),
        prompt: language === "zh"
          ? "帮助我理解罗马书 8:28 的背景、核心主题以及讨论问题。"
          : language === "en"
          ? "Help me understand Romans 8:28 with context, key themes, and discussion questions."
          : "Bantu saya memahami Roma 8:28 dengan konteks, tema utama, dan pertanyaan diskusi.",
        placeholder: language === "zh"
          ? "输入您要研读的圣经经文引用或主题。"
          : language === "en"
          ? "Enter a Bible verse reference or topic for study."
          : "Masukkan referensi ayat atau topik studi Alkitab.",
      },
      {
        mode: "prayer" as AiMode,
        label: t("ai.mode_prayer"),
        prompt: language === "zh"
          ? "为正在经历焦虑但渴望信靠神的人写一篇简短的祷告词。"
          : language === "en"
          ? "Write a short prayer for someone experiencing anxiety who wants to trust God."
          : "Buatkan doa singkat untuk orang yang sedang cemas tetapi ingin percaya kepada Tuhan.",
        placeholder: language === "zh"
          ? "写下祷告的需求，例如：家庭、工作、健康、饶恕。"
          : language === "en"
          ? "Write prayer needs, e.g.: family, work, health, forgiveness."
          : "Tulis kebutuhan doa, contoh: keluarga, pekerjaan, kesehatan, pengampunan.",
      },
      {
        mode: "song_recommendation" as AiMode,
        label: t("ai.mode_song"),
        prompt: language === "zh"
          ? "推荐一些关于信心与盼望、适合个人灵修的敬拜赞美歌曲。"
          : language === "en"
          ? "Recommend worship songs about faith and hope suitable for quiet time."
          : "Rekomendasikan lagu penyembahan tentang iman dan pengharapan yang cocok untuk saat teduh.",
        placeholder: language === "zh"
          ? "写下您的心情或想要寻找的歌曲主题。"
          : language === "en"
          ? "Mention your mood or the song topic you're looking for."
          : "Sebutkan suasana hati atau topik lagu yang ingin dicari.",
      },
      {
        mode: "sermon_guide" as AiMode,
        label: t("ai.mode_sermon"),
        prompt: language === "zh"
          ? "制作一份关于‘饶恕伤害我们的人’的完整讲道/小组指南。包含核心经文、至少8节支持经文、文本背景、大主旨、4点大纲、深入剖析、在家庭/职场/教会中的实际案例、3个日常生活中的比喻、讨论问题、实际应用、回应呼召以及结束祷告。"
          : language === "en"
          ? "Create a comprehensive sermon/cell group guide on forgiving those who hurt us. Include main verse, at least 8 supporting verses, text background, big idea, 4-point outline, deep explanation, real case examples in family/work/church, 3 life illustrations, discussion questions, practical application, altar call response, and closing prayer."
          : "Buat panduan khotbah/komsel lengkap tentang mengampuni orang yang melukai kita. Sertakan ayat utama, minimal 8 ayat pendukung, latar belakang teks, ide besar, outline 4 poin, penjabaran mendalam, contoh kasus nyata di keluarga/pekerjaan/gereja, 3 ilustrasi kehidupan sehari-hari, pertanyaan diskusi, aplikasi praktis, ajakan respons, dan doa penutup.",
        placeholder: language === "zh"
          ? "写下您将要讨论的主题、经文、受众或服事需求。"
          : language === "en"
          ? "Write theme, passage, audience, or ministry needs to be discussed."
          : "Tulis tema, perikop, audiens, atau kebutuhan pelayanan yang akan dibahas.",
      },
      {
        mode: "counseling" as AiMode,
        label: t("ai.mode_counseling"),
        prompt: language === "zh"
          ? "我感到心里非常疲惫。请给予我安全且具建设性的属灵反思步骤。"
          : language === "en"
          ? "I feel mentally exhausted. Provide safe and constructive spiritual reflection steps."
          : "Saya merasa lelah secara batin. Berikan langkah refleksi rohani yang aman dan membangun.",
        placeholder: language === "zh"
          ? "简要描述您的情况，请避免输入敏感个人信息。"
          : language === "en"
          ? "Briefly tell your situation. Avoid sensitive personal data."
          : "Ceritakan situasi secara singkat. Hindari data pribadi yang sensitif.",
      },
    ];
  }, [t, language]);

  const [mode, setMode] = useState<AiMode>("devotional");
  const selected = useMemo(
    () => tools.find((tool) => tool.mode === mode) ?? tools[0],
    [mode, tools],
  );
  
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerPageUrl, setAnswerPageUrl] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setPrompt(selected.prompt);
  }, [selected]);

  const visibleTools = useMemo(() => {
    return tools;
  }, [tools]);

  const modeHistory = useMemo(() => {
    const keyword = historySearch.toLowerCase().trim();
    return history
      .filter((item) => item.mode === selected.label)
      .filter((item) => {
        if (!keyword) return true;
        return [item.mode, item.prompt, item.answer]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
  }, [history, historySearch, selected.label]);

  const historyTotalPages = Math.max(1, Math.ceil(modeHistory.length / HISTORY_ITEMS_PER_PAGE));
  const paginatedHistory = modeHistory.slice(
    (historyPage - 1) * HISTORY_ITEMS_PER_PAGE,
    historyPage * HISTORY_ITEMS_PER_PAGE,
  );

  useEffect(() => {
    if (!auth || !db) return;
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      let activeUserId = currentUser?.uid || "";
      let isGuest = false;

      if (!currentUser) {
        const guestId = typeof window !== "undefined" ? localStorage.getItem("guestPremiumId") : null;
        if (guestId) {
          activeUserId = guestId;
          isGuest = true;
        } else {
          const allModes = tools.map((t) => t.mode);
          setUserAllowedModes(allModes); 
          setCanExportPdf(true);
          setIsAdminUser(false);
          setAiQuota(0);
          setAiRemaining(null);
          setStatus(language === "zh" ? "免费模式。登录以同步历史。" : language === "en" ? "Free mode. Login to sync history." : "Mode gratis. Login untuk menyimpan riwayat.");
          return;
        }
      }
      
      try {
        if (!db) return;
        
        const q = query(collection(db, "ai_requests"), where("userId", "==", activeUserId));
        const snap = await getDocs(q);
        const historyData = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        historyData.sort((a: any, b: any) => {
          const ta = a.createdAt?.toMillis() || 0;
          const tb = b.createdAt?.toMillis() || 0;
          return tb - ta;
        });
        setHistory(historyData);
        const userDoc = await getDoc(doc(db, "users", activeUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setStreak(userData.streakCount || 0);
          
          if (userData.role === "admin") {
            const allModes = tools.map((t) => t.mode);
            setUserAllowedModes(allModes);
            setCanExportPdf(true);
            setIsAdminUser(true);
            setAiQuota(0);
            setAiRemaining(null);
            setStatus(language === "zh" ? "管理员：全功能已解锁。" : language === "en" ? "Admin: Full access enabled." : "Admin: Akses penuh terbuka.");
            return;
          }

          setIsAdminUser(false);

          const selectedPlanName = userData.selectedPlan;
          if (selectedPlanName) {
            const planSnap = await getDocs(query(collection(db, "plans")));
            const planDoc = planSnap.docs.find(d => d.data().name === selectedPlanName);
            if (planDoc) {
              const planData = planDoc.data();
              const expiresAt = toDate(userData.premiumExpiresAt);
              const isExpired = Boolean(expiresAt && expiresAt.getTime() < Date.now());

              if (isExpired) {
                const allModes = tools.map((t) => t.mode);
                setUserAllowedModes(allModes);
                setCanExportPdf(true);
                setAiQuota(0);
                setAiRemaining(0);
                setStatus(language === "zh" ? "方案已过期。切换为免费限制模式。" : language === "en" ? "Plan expired. Switched to free limited mode." : "Paket kedaluwarsa. Dialihkan ke mode gratis terbatas.");
                return;
              }

              const quota = Number(userData.aiRequestsQuota ?? planData.aiRequests ?? 0);
              const activatedAt = toDate(userData.premiumActivatedAt);
              const startMs = activatedAt?.getTime() ?? 0;
              const usedThisPeriod = historyData.filter((item: any) => {
                const createdAt = toDate(item.createdAt);
                return createdAt ? createdAt.getTime() >= startMs : false;
              }).length;
              const storedRemaining = Number(userData.aiRequestsRemaining);
              const calculatedRemaining = quota === -1 ? null : Math.max(0, quota - usedThisPeriod);
              const remaining = quota === -1
                ? null
                : Number.isFinite(storedRemaining) && storedRemaining >= 0
                  ? Math.min(storedRemaining, calculatedRemaining ?? 0)
                  : calculatedRemaining;

              setAiQuota(quota);
              setAiRemaining(remaining);
              const allModes = tools.map((t) => t.mode);
              setUserAllowedModes(allModes);
              setCanExportPdf(true);

              if (quota === -1 || (remaining ?? 0) > 0) {
                setStatus(quota === -1 ? (language === "zh" ? "无限额度激活中。" : language === "en" ? "Unlimited quota active." : "Kuota Unlimited aktif.") : (language === "zh" ? "已准备好生成回复。" : language === "en" ? "Ready to generate response." : "Siap membuat respons."));
              } else {
                setStatus(language === "zh" ? "您的 AI 额度已用尽。" : language === "en" ? "AI quota has been exhausted." : "Kuota AI paket ini sudah habis.");
              }
              return;
            }
          }
        }
        const allModes = tools.map((t) => t.mode);
        setUserAllowedModes(allModes);
        setCanExportPdf(true);
        setAiQuota(0);
        setAiRemaining(null);
        setStatus(language === "zh" ? "未找到方案。免费模式已激活。" : language === "en" ? "Plan not found. Free mode active." : "Paket tidak ditemukan. Mode gratis aktif.");
      } catch (err) {
        console.error("Gagal memuat batas paket:", err);
        setStatus(language === "zh" ? "加载方案状态失败。" : language === "en" ? "Failed to load plan status." : "Gagal memuat status paket.");
      }
    });
  }, [language, tools]);

  useEffect(() => {
    const requestedMode = searchParams?.get("mode") as AiMode | null;
    if (requestedMode && tools.some((tool) => tool.mode === requestedMode)) {
      changeMode(requestedMode);
    }
  }, [searchParams, tools]);

  function changeMode(nextMode: AiMode) {
    const nextTool = tools.find((tool) => tool.mode === nextMode) ?? tools[0];
    setMode(nextMode);
    setPrompt(nextTool.prompt);
    setAnswer("");
    setAnswerPageUrl("");
    setHistorySearch("");
    setHistoryPage(1);
    setExpandedHistoryId(null);
    setStatus(language === "zh" ? `模式 ${nextTool.label} 已就绪。` : language === "en" ? `Mode ${nextTool.label} ready.` : `Mode ${nextTool.label} siap.`);
  }

  function formatHistoryDate(value: any) {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value?.seconds
          ? new Date(value.seconds * 1000)
          : value?._seconds
            ? new Date(value._seconds * 1000)
            : null;

    return date
      ? new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date)
      : (language === "zh" ? "暂无日期" : language === "en" ? "Date unavailable" : "Tanggal belum tersedia");
  }

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user && mode !== "devotional") {
      setStatus(
        language === "zh" ? "请登录或免费注册以使用此 AI 功能。" :
        language === "en" ? "Please sign in or register for free to use this AI feature." :
        "Silakan login atau daftar gratis untuk menggunakan fitur AI ini."
      );
      return;
    }

    setStatus(language === "zh" ? "处理中..." : language === "en" ? "Processing..." : "Memproses...");
    setAnswer("");
    setAnswerPageUrl("");

    if (user && !isAdminUser && aiQuota !== -1 && aiRemaining !== null && aiRemaining <= 0) {
      setStatus(language === "zh" ? "您的 AI 额度已用尽。请续费或升级方案。" : language === "en" ? "Your AI quota has run out. Please renew or upgrade plan." : "Kuota AI kamu sudah habis. Silakan perpanjang atau upgrade paket.");
      return;
    }

    const token = user ? await user.getIdToken().catch(() => null) : null;
    let data;
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode, prompt }),
      });
      data = (await response.json()) as {
        answer?: string;
        provider?: string;
        error?: string;
        aiRequestsRemaining?: number | null;
      };

      if (!response.ok) {
        setStatus(language === "zh" ? "服务器繁忙" : language === "en" ? "server busy" : "server sibuk");
        return;
      }
    } catch (e) {
      setStatus(language === "zh" ? "服务器繁忙" : language === "en" ? "server busy" : "server sibuk");
      return;
    }

    setAnswer(data.answer ?? "");
    setStatus(
      data.provider === "demo"
        ? (language === "zh" ? "演示模式已激活。请填写 DEEPSEEK_API_KEY 以获取实时回复。" : language === "en" ? "Demo mode active. Fill DEEPSEEK_API_KEY for live answers." : "Mode demo aktif. Isi DEEPSEEK_API_KEY untuk jawaban live.")
        : (language === "zh" ? "回答完毕。" : language === "en" ? "Answer completed." : "Jawaban selesai."),
    );

    const activeUserId = user ? user.uid : (typeof window !== "undefined" ? localStorage.getItem("guestPremiumId") : null);

    if (activeUserId && db && data.answer) {
      let sharePageUrl = "";
      try {
        const tokenForPage = user ? await user.getIdToken().catch(() => null) : null;
        if (tokenForPage) {
          const pageResponse = await fetch("/api/share-page", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokenForPage}`,
            },
            body: JSON.stringify({
              type: selected.label,
              title: `Grace Daily | ${selected.label}`,
              subtitle: language === "zh" ? "AI 辅导结果" : language === "en" ? "AI Guidance results" : "Hasil pendampingan AI Grace Daily",
              prompt,
              content: data.answer,
            }),
          });
          const pageData = await pageResponse.json().catch(() => ({}));
          if (pageResponse.ok && pageData.url) {
            sharePageUrl = pageData.url;
            setAnswerPageUrl(pageData.url);
          }
        }
      } catch (err) {
        console.error("Gagal membuat halaman hasil AI", err);
      }

      if (mode === "devotional") {
        try {
          const userRef = doc(db, "users", activeUserId);
          const uDoc = await getDoc(userRef);
          const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
          
          if (uDoc.exists()) {
            const uData = uDoc.data();
            const lastDate = uData.lastDevotionDate || "";
            let currentStreak = uData.streakCount || 0;
            
            if (lastDate !== today) {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yesterdayStr = yesterday.toLocaleDateString("en-CA");
              
              if (lastDate === yesterdayStr) {
                currentStreak += 1;
              } else {
                currentStreak = 1;
              }
              
              await updateDoc(userRef, {
                streakCount: currentStreak,
                lastDevotionDate: today
              });
              setStreak(currentStreak);
            }
          }
        } catch (e) {
          console.error("Gagal update streak", e);
        }
      }

      try {
        const newRef = await addDoc(collection(db, "ai_requests"), {
          userId: activeUserId,
          mode: selected.label,
          prompt,
          answer: data.answer,
          sharePageUrl,
          createdAt: serverTimestamp()
        });
        setHistory([{
          id: newRef.id,
          mode: selected.label,
          prompt,
          answer: data.answer,
          sharePageUrl,
          createdAt: Timestamp.now()
        }, ...history]);
        await addDoc(collection(db, "users", activeUserId, "activities"), {
          type: mode,
          title: selected.label,
          description: prompt.slice(0, 160),
          createdAt: serverTimestamp(),
        });
        if (!isAdminUser && aiRemaining !== null) {
          const nextRemaining = typeof data.aiRequestsRemaining === "number"
            ? data.aiRequestsRemaining
            : Math.max(0, aiRemaining - 1);
          setAiRemaining(nextRemaining);
          if (aiQuota > 0 && nextRemaining <= 0) {
            setStatus(language === "zh" ? "回答已完成。您的 AI 额度现已用尽。" : language === "en" ? "Answer completed. Your AI quota is now exhausted." : "Jawaban selesai. Kuota AI kamu sekarang habis.");
          }
        }
      } catch (err) {
        console.error("Gagal menyimpan riwayat", err);
      }
    }
  }

  function handleShareCurrent() {
    shareToWhatsApp(`Grace Daily | ${selected.label}`, `*Topik:*\n_${prompt}_\n\n*Jawaban:*\n${answer}`);
  }

  function handlePrintCurrent() {
    downloadPdf(`Grace Daily | ${selected.label}`, `<p><strong>Topik:</strong> ${prompt}</p><br/>${answer}`);
  }

  async function ensureHistoryPage(h: any) {
    if (h.sharePageUrl) {
      window.open(h.sharePageUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (!user || !db) {
      alert(language === "zh" ? "请先登录以创建结果页面。" : language === "en" ? "Please sign in to create results page." : "Silakan login untuk membuat halaman hasil.");
      return;
    }

    try {
      const token = await user.getIdToken().catch(() => null);
      const pageResponse = await fetch("/api/share-page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: h.mode || selected.label,
          title: `Grace Daily | ${h.mode || selected.label}`,
          subtitle: language === "zh" ? "AI 辅导结果" : language === "en" ? "AI Guidance results" : "Hasil pendampingan AI Grace Daily",
          prompt: h.prompt,
          content: h.answer,
          sourceId: h.id,
        }),
      });
      const pageData = await pageResponse.json();
      if (!pageResponse.ok || !pageData.url) {
        throw new Error(pageData.error || "Gagal membuat halaman hasil.");
      }
      await updateDoc(doc(db, "ai_requests", h.id), { sharePageUrl: pageData.url });
      setHistory(history.map((item) => item.id === h.id ? { ...item, sharePageUrl: pageData.url } : item));
      window.open(pageData.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      alert(err.message || "Gagal membuat halaman hasil.");
    }
  }

  return (
    <section>
      <div className="print:hidden">
        <div className="grid gap-6 md:grid-cols-[250px_1fr]">
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-semibold text-[#14213d]">{t("ai.select_mode")}</h2>
              <div className="mt-4 grid gap-2">
                {visibleTools.map((tool) => (
                <button
                  key={tool.mode}
                  type="button"
                  onClick={() => changeMode(tool.mode)}
                  className={`rounded-md border px-4 py-3 text-left font-semibold ${
                    mode === tool.mode
                      ? "border-[#2a6f6f] bg-[#e9f5db] text-[#14213d]"
                      : "border-[#dfd8ca] bg-white text-[#334155]"
                  }`}
                >
                  {tool.label}
                </button>
              ))}
              </div>
            </div>
            
            {user && streak > 0 && (
              <div className="mt-auto pt-5 border-t border-[#dfd8ca]">
                <div className="rounded-md bg-[#fff4e6] p-4 text-center shadow-sm">
                  <p className="text-sm font-semibold text-[#d97706] mb-1">{t("ai.streak_label")}</p>
                  <p className="text-3xl font-bold text-[#b45309]">🔥 {streak}</p>
                  <p className="text-xs text-[#92400e] mt-1">{t("ai.streak_days")}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
            <form onSubmit={submitPrompt} className="grid gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
                  {selected.label}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#14213d]">
                  {t("ai.tagline")}
                </h2>
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-40 rounded-md border border-[#dfd8ca] px-4 py-3 leading-7 outline-none ring-[#2a6f6f] focus:ring-2"
                placeholder={selected.placeholder}
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="rounded-md bg-[#14213d] px-5 py-3 font-semibold text-white cursor-pointer"
                >
                  {t("ai.run")}
                </button>
                {canExportPdf && (
                  <button
                    type="button"
                    onClick={handlePrintCurrent}
                    className="rounded-md border border-[#dfd8ca] px-5 py-3 font-semibold text-[#14213d] cursor-pointer"
                  >
                    {t("ai.print_pdf")}
                  </button>
                )}
                {answer && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleAudio(answer, playingId === "current", (isPlaying) => {
                        setPlayingId(isPlaying ? "current" : null);
                      });
                    }}
                    className="rounded-md bg-[#e9f5db] px-5 py-3 font-semibold text-[#284b3a] transition hover:bg-[#cde4b4] cursor-pointer"
                  >
                    {playingId === "current" ? t("ai.stop_audio") : t("ai.listen")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShareCurrent}
                  className="rounded-md bg-[#2a6f6f] px-5 py-3 font-semibold text-white cursor-pointer"
                >
                  {t("ai.share_wa")}
                </button>
              </div>
            </form>

            <p className="mt-4 text-sm text-[#52606d]">{status}</p>
            <article className="mt-5 min-h-56 whitespace-pre-wrap rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-5 leading-8 text-[#334155]">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...props }) => {
                      const href = props.href || "";
                      if (href.includes("youtube.com")) {
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ff0000] px-4 py-2 text-sm font-bold text-white no-underline shadow-sm transition hover:bg-[#cc0000]"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                            {props.children || "Buka di YouTube"}
                          </a>
                        );
                      }
                      return (
                        <a
                          {...props}
                          className="font-semibold text-[#2a6f6f] underline hover:text-[#1a4a4a]"
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      );
                    },
                    h1: ({ node, ...props }) => <h1 {...props} className="mt-6 text-2xl font-bold text-[#14213d]" />,
                    h2: ({ node, ...props }) => <h2 {...props} className="mt-5 text-xl font-bold text-[#14213d]" />,
                    h3: ({ node, ...props }) => <h3 {...props} className="mt-4 text-lg font-bold text-[#14213d]" />,
                    ul: ({ node, ...props }) => <ul {...props} className="mt-2 list-inside list-disc pl-2" />,
                    ol: ({ node, ...props }) => <ol {...props} className="mt-2 list-inside list-decimal pl-2" />,
                  }}
                >
                  {answer || t("ai.result_placeholder")}
                </ReactMarkdown>
              </div>
            </article>
            {answerPageUrl && (
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={answerPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-[#ffd166] px-4 py-2 text-sm font-bold text-[#102c3a] transition hover:bg-[#f4a261]"
                >
                  {t("ai.open_page")}
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    const fullUrl = `${window.location.origin}${answerPageUrl}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: `Grace Daily | ${selected.label}`, text: prompt, url: fullUrl });
                        return;
                      } catch {
                        // Clipboard fallback.
                      }
                    }
                    await navigator.clipboard.writeText(fullUrl);
                    alert(t("ai.copied"));
                  }}
                  className="rounded-md border border-[#dfd8ca] px-4 py-2 text-sm font-semibold text-[#14213d] hover:bg-[#f7f4ee] cursor-pointer"
                >
                  {t("ai.share_page")}
                </button>
              </div>
            )}
          </div>
        </div>

        {user && (
          <div className="mt-8 rounded-lg border border-[#dfd8ca] bg-white p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-xl font-semibold text-[#14213d]">{t("ai.history_title").replace("{mode}", selected.label)}</h2>
              <input
                type="search"
                value={historySearch}
                onChange={(event) => {
                  setHistorySearch(event.target.value);
                  setHistoryPage(1);
                  setExpandedHistoryId(null);
                }}
                className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm"
                placeholder={t("ai.search_history")}
              />
            </div>
            <div className="mt-4 grid gap-3">
              {modeHistory.length === 0 ? (
                <p className="text-sm text-[#52606d]">{t("ai.no_history").replace("{mode}", selected.label)}</p>
              ) : (
                paginatedHistory.map((h) => (
                  <article key={h.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedHistoryId((current) => current === h.id ? null : h.id)}
                      className="flex w-full flex-col justify-between gap-2 text-left sm:flex-row sm:items-center cursor-pointer"
                    >
                      <span className="font-semibold text-[#14213d] line-clamp-2">
                        {h.prompt || h.mode}
                      </span>
                      <time className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[#2a6f6f]">
                        {formatHistoryDate(h.createdAt)}
                      </time>
                    </button>

                    {expandedHistoryId === h.id && (
                      editingHistoryId === h.id ? (
                        <div className="mt-4 rounded-md bg-white p-4">
                          <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!db) return;
                            setIsSavingEdit(true);
                            try {
                              await updateDoc(doc(db, "ai_requests", h.id), {
                                prompt: editPromptValue,
                                answer: editAnswerValue
                              });
                              setHistory(history.map(item => item.id === h.id ? { ...item, prompt: editPromptValue, answer: editAnswerValue } : item));
                              setEditingHistoryId(null);
                            } catch (err) {
                              console.error("Gagal menyimpan perubahan:", err);
                              alert(t("ai.saving") + " error");
                            } finally {
                              setIsSavingEdit(false);
                            }
                          }} className="grid gap-4">
                            <div className="grid gap-2">
                              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">{t("ai.topic_label")}</label>
                              <textarea
                                value={editPromptValue}
                                onChange={(e) => setEditPromptValue(e.target.value)}
                                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none text-[#1f2933] bg-white"
                                rows={3}
                                required
                              />
                            </div>
                            <div className="grid gap-2 border-t border-[#dfd8ca] pt-3">
                              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">{t("ai.answer_label")}</label>
                              <textarea
                                value={editAnswerValue}
                                onChange={(e) => setEditAnswerValue(e.target.value)}
                                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none text-[#1f2933] bg-white"
                                rows={6}
                                required
                              />
                            </div>
                            <div className="flex gap-2 justify-end border-t border-[#dfd8ca] pt-4">
                              <button
                                type="submit"
                                disabled={isSavingEdit}
                                className="rounded-md bg-[#14213d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2d52] disabled:opacity-50 cursor-pointer"
                              >
                                {isSavingEdit ? t("ai.saving") : t("ai.save")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingHistoryId(null)}
                                className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#14213d] transition hover:bg-gray-50 cursor-pointer"
                              >
                                {t("ai.cancel")}
                              </button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-md bg-white p-4">
                          <div className="rounded-md bg-[#f7f4ee] p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">{t("ai.topic_label")}</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#334155]">{h.prompt}</p>
                          </div>
                          <div className="mt-4 border-t border-[#dfd8ca] pt-4">
                            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">{t("ai.answer_label")}</p>
                            <div className="prose prose-sm max-w-none text-[#334155] leading-7">
                              <ReactMarkdown
                                components={{
                                  h1: ({ node, ...props }) => <strong {...props} className="block mt-2 text-base text-[#14213d]" />,
                                  h2: ({ node, ...props }) => <strong {...props} className="block mt-2 text-sm text-[#14213d]" />,
                                  h3: ({ node, ...props }) => <strong {...props} className="block mt-2 text-sm text-[#14213d]" />,
                                }}
                              >
                                {h.answer}
                              </ReactMarkdown>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-4 border-t border-[#dfd8ca] pt-4">
                            <button 
                              onClick={() => shareToWhatsApp(`Grace Daily | ${h.mode}`, `*Topik:*\n_${h.prompt}_\n\n*Jawaban:*\n${h.answer}`)}
                              className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a] cursor-pointer"
                            >
                              {t("ai.share_history")}
                            </button>
                            <button
                              onClick={() => ensureHistoryPage(h)}
                              className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a] cursor-pointer"
                            >
                              {t("ai.open_history_page")}
                            </button>
                            <button 
                              onClick={() => downloadPdf(`Grace Daily | ${h.mode}`, `<p><strong>Topik:</strong> ${h.prompt}</p><br/>${h.answer}`)}
                              className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a] cursor-pointer"
                            >
                              {t("ai.print_history")}
                            </button>
                            <button 
                              onClick={() => {
                                toggleAudio(h.answer, playingId === h.id, (isPlaying) => {
                                  setPlayingId(isPlaying ? h.id : null);
                                });
                              }}
                              className="text-sm font-semibold text-[#d97706] hover:text-[#b45309] cursor-pointer"
                            >
                              {playingId === h.id ? t("ai.stop_audio") : t("ai.listen")}
                            </button>
                            <button
                              onClick={() => {
                                setEditingHistoryId(h.id);
                                setEditPromptValue(h.prompt || "");
                                setEditAnswerValue(h.answer || "");
                              }}
                              className="text-sm font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                            >
                              {t("ai.edit_history")}
                            </button>
                            <button
                              onClick={async () => {
                                if (!db || !window.confirm("Apakah Anda yakin ingin menghapus riwayat ini?")) return;
                                try {
                                  await deleteDoc(doc(db, "ai_requests", h.id));
                                  setHistory(history.filter(item => item.id !== h.id));
                                  setExpandedHistoryId(null);
                                } catch (err) {
                                  console.error("Gagal menghapus riwayat:", err);
                                  alert("Gagal menghapus riwayat.");
                                }
                              }}
                              className="text-sm font-semibold text-red-600 hover:text-red-800 cursor-pointer"
                            >
                              {t("ai.delete_history")}
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </article>
                ))
              )}
            </div>
            {modeHistory.length > HISTORY_ITEMS_PER_PAGE && (
              <div className="mt-5 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setHistoryPage((page) => Math.max(1, page - 1));
                    setExpandedHistoryId(null);
                  }}
                  disabled={historyPage === 1}
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Prev
                </button>
                <span className="text-sm font-semibold text-[#52606d]">
                  {historyPage} / {historyTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryPage((page) => Math.min(historyTotalPages, page + 1));
                    setExpandedHistoryId(null);
                  }}
                  disabled={historyPage === historyTotalPages}
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-[#14213d]">Grace Daily - {selected.label}</h1>
        <div className="mt-4 mb-6 rounded-lg bg-[#f7f4ee] p-4 border border-[#dfd8ca]">
          <p className="font-semibold text-[#2a6f6f]">{t("ai.topic_label")}:</p>
          <p className="mt-2 whitespace-pre-wrap text-[#334155]">{prompt}</p>
        </div>
        <div>
          <p className="font-semibold text-[#2a6f6f]">{t("ai.answer_label")}:</p>
          <div className="mt-2 whitespace-pre-wrap text-[#334155] leading-8">
            <ReactMarkdown
              components={{
                a: ({ node, ...props }) => <span className="font-semibold">{props.children}</span>,
              }}
            >
              {answer || "Belum ada jawaban."}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </section>
  );
}
