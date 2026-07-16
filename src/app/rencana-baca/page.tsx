"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { toggleAudio } from "@/lib/audio";
import { BIBLE_BOOKS, fetchBibleChapterReading, type BibleChapterReading, USE_WEB_BIBLE } from "@/lib/bible";
import { useLanguage } from "@/lib/i18n";

const TOTAL_PLAN_DAYS = 365;
type BibleTranslationId = "ind_ayt" | "BSB" | "ind_web" | "web";

const AiDisclaimer = () => {
  const { language, t } = useLanguage();
  return (
    <div className="mb-6 rounded-lg border border-[#dfd8ca] bg-[#fffcf5] p-4 text-sm text-[#1f2933] leading-relaxed shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-[#d97706] text-lg mt-0.5">⚠️</span>
        <div>
          <p className="font-bold text-[#d97706] mb-1">
            {language === "zh" ? "AI 自动翻译声明" : language === "en" ? "AI Auto-Translation Disclaimer" : "Terjemahan Otomatis AI"}
          </p>
          <p className="text-xs text-[#52606d] whitespace-pre-line">
            {t("bible.disclaimer_text")}
          </p>
        </div>
      </div>
    </div>
  );
};

type CustomReadingPlan = {
  bookName: string;
  bookShort: string;
  duration: number;
  translationId: BibleTranslationId;
  currentDay: number;
  days: Array<{
    day: number;
    chapters: number[];
  }>;
};

function chaptersForDay(day: number) {
  const chapters = BIBLE_BOOKS.flatMap((book) =>
    Array.from({ length: book.chapters }, (_, index) => ({
      book: book.name,
      bookShort: book.id,
      chapter: index + 1,
    })),
  );
  const safeDay = Math.min(Math.max(day, 1), TOTAL_PLAN_DAYS);
  const start = Math.floor(((safeDay - 1) * chapters.length) / TOTAL_PLAN_DAYS);
  const end = Math.floor((safeDay * chapters.length) / TOTAL_PLAN_DAYS);
  return chapters.slice(start, Math.max(end, start + 1));
}

function planTextForDay(day: number, language = "id") {
  const chapters = chaptersForDay(day);
  const grouped = chapters.reduce<Record<string, number[]>>((acc, item) => {
    acc[item.book] = [...(acc[item.book] ?? []), item.chapter];
    return acc;
  }, {});
  const reading = Object.entries(grouped)
    .map(([book, chapterList]) => `${book} ${chapterList.join(", ")}`)
    .join("; ");

  if (language === "zh") {
    return [
      `### 第 ${day} 天阅读计划`,
      `**阅读:** ${reading}`,
      "",
      "静下心来阅读，标记触动您心灵的经文，然后为今天写下一个实际的顺服行动。",
      "",
      "**反思问题:** 这段经文教导了关于神、人、罪、恩典以及我需要采取的信心步伐的什么内容？",
    ].join("\n");
  } else if (language === "en") {
    return [
      `### Day ${day} Reading`,
      `**Read:** ${reading}`,
      "",
      "Read quietly, highlight the verse that touches your heart, then write down one practical obedience for today.",
      "",
      "**Reflection question:** What does this text teach about God, humanity, sin, grace, and the step of faith I need to take?",
    ].join("\n");
  }

  return [
    `### Bacaan Hari ${day}`,
    `**Baca:** ${reading}`,
    "",
    "Bacalah dengan tenang, tandai ayat yang menyentuh hati, lalu tulis satu ketaatan praktis untuk hari ini.",
    "",
    "**Pertanyaan refleksi:** Apa yang teks ini ajarkan tentang Allah, manusia, dosa, anugerah, dan langkah iman yang perlu saya ambil?",
  ].join("\n");
}

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

export default function BiblePlanPage() {
  const { language, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(true);

  const tLocal = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      premiumAccess: { id: "Akses Premium", en: "Premium Access", zh: "尊享特权" },
      guideTitle: { id: "Panduan Bacaan Alkitab", en: "Bible Reading Guide", zh: "圣经阅读指南" },
      paywallDesc: {
        id: "Fitur Rencana Baca Alkitab (Tantangan 365 Hari & Rencana Kustom) adalah fitur eksklusif untuk pengguna paket berbayar (Ensiklopedia Basic, Ensiklopedia Pro, Premium, atau Komunitas). Silakan pilih paket Anda untuk melanjutkan pertumbuhan iman.",
        en: "The Bible Reading Plan features (365-Day Challenge & Custom Plans) are exclusive to paid packages (Encyclopedia Basic, Encyclopedia Pro, Premium, or Community). Please choose your plan to continue growing in faith.",
        zh: "读经计划功能（365天挑战与自定义计划）是付费套餐（百科基础版、百科专业版、尊享版或社区版）的专属功能。请选择您的方案以继续在信仰中成长。"
      },
      upgradeProfile: { id: "Upgrade di Profil", en: "Upgrade in Profile", zh: "在个人中心升级" },
      loginRegister: { id: "Login / Daftar", en: "Login / Register", zh: "登录 / 注册" },
      backToHome: { id: "Kembali ke Beranda", en: "Back to Home", zh: "返回首页" },
      readingPlan: { id: "Rencana Baca", en: "Reading Plan", zh: "读经计划" },
      readingPlanDesc: {
        id: "Bertumbuh dalam kebenaran firman Tuhan setiap hari melalui tantangan rencana baca terarah.",
        en: "Grow in the truth of God's word every day through targeted reading plan challenges.",
        zh: "通过有针对性的读经计划挑战，每天在神的话语真理中成长。"
      },
      challenge365: { id: "Tantangan 365 Hari", en: "365-Day Challenge", zh: "365天读经挑战" },
      customPlan: { id: "Rencana Kustom", en: "Custom Plan", zh: "自定义计划" },
      createCustomTitle: { id: "Buat Rencana Baca Kustom Anda", en: "Create Your Custom Reading Plan", zh: "创建您的自定义读经计划" },
      createCustomDesc: {
        id: "Fokus membaca satu kitab pilihan Anda (misalnya Kitab Mazmur, Injil Yohanes) dengan durasi waktu yang dapat disesuaikan.",
        en: "Focus on reading one book of your choice (e.g. Psalms, Gospel of John) with customizable duration.",
        zh: "专注于阅读一卷您选择的书卷 (例如: 诗篇, 约翰福音)，并可自定阅读天数。"
      },
      chooseBook: { id: "Pilih Kitab", en: "Select Book", zh: "选择书卷" },
      chapters: { id: "Pasal", en: "Chapters", zh: "章" },
      durationDays: { id: "Durasi (Hari)", en: "Duration (Days)", zh: "天数 (天)" },
      translation: { id: "Terjemahan", en: "Translation", zh: "译本" },
      createCustomBtn: { id: "Buat Rencana Baca Kustom", en: "Create Custom Reading Plan", zh: "创建自定义读经计划" },
      customPlanOffline: { id: "Rencana Kustom Offline", en: "Offline Custom Plan", zh: "离线自定义计划" },
      deleteCustomPlan: { id: "Hapus Rencana Kustom", en: "Delete Custom Plan", zh: "删除自定义计划" },
      finished: { id: "Selesai! 🎉", en: "Finished! 🎉", zh: "完成！🎉" },
      day: { id: "Hari", en: "Day", zh: "第" },
      days: { id: "Hari", en: "Days", zh: "天" },
      prevDay: { id: "Hari sebelumnya", en: "Previous day", zh: "前一天" },
      nextDay: { id: "Buka hari berikutnya", en: "Next day", zh: "后一天" },
      readingMaterial: { id: "Materi Bacaan Hari", en: "Reading Material Day", zh: "第" },
      stopAudio: { id: "⏹ Stop Audio", en: "⏹ Stop Audio", zh: "⏹ 停止音频" },
      listenAudio: { id: "🎧 Dengarkan Suara", en: "🎧 Listen Audio", zh: "🎧 聆听音频" },
      listenAudioShort: { id: "🎧 Dengarkan", en: "🎧 Listen", zh: "🎧 聆听" },
      loadingBible: { id: "Memuat teks Alkitab...", en: "Loading Bible text...", zh: "正在加载经文..." },
      bibleNotFound: { id: "Teks tidak ditemukan secara offline.", en: "Bible text not found offline.", zh: "未找到离线经文。" },
      personalNotes: { id: "Catatan pribadi Hari", en: "Personal notes Day", zh: "第" },
      placeholderNotes: {
        id: "Tulis refleksi iman Anda di sini...",
        en: "Write your faith reflection here...",
        zh: "在此写下您的信仰反思..."
      },
      saving: { id: "Menyimpan...", en: "Saving...", zh: "保存中..." },
      saveNote: { id: "Simpan Catatan", en: "Save Note", zh: "保存 catatan" },
      saveNoteShort: { id: "Simpan catatan", en: "Save note", zh: "保存 catatan" },
      finishCustomPlan: { id: "Selesai Rencana Kustom", en: "Finish Custom Plan", zh: "完成自定义计划" },
      finishDayNext: { id: "Selesai Baca! Lanjut Hari", en: "Completed! Go to Day", zh: "阅读完成！进入第" },
      loadingProgress: { id: "Memuat progres Anda...", en: "Loading your progress...", zh: "正在加载您的进度..." },
      startYearChallenge: { id: "Mulai Tantangan Setahun!", en: "Start the One Year Challenge!", zh: "开启一年读经挑战！" },
      loginSaveProgress: {
        id: "Anda harus login untuk menyimpan progres bacaan harian Anda di cloud.",
        en: "You must log in to save your daily reading progress in the cloud.",
        zh: "您必须登录以在云端保存您的每日读经进度。"
      },
      loginRegisterNow: { id: "Login / Daftar Sekarang", en: "Login / Register Now", zh: "立即登录 / 注册" },
      yourProgress: { id: "Progres Anda", en: "Your Progress", zh: "您的进度" },
      openTodayGuide: { id: "Buka Panduan Hari Ini", en: "Open Today's Guide", zh: "开启今日读经" },
      arrangingPlan: { id: "Menyusun rencana baca Anda...", en: "Arranging your reading plan...", zh: "正在为您生成读经计划..." },
      todayMaterial: { id: "Materi Hari", en: "Material Day", zh: "第" },
      fullReadingRec: { id: "Bacaan lengkap rekomendasi", en: "Recommended Full Scripture", zh: "推荐阅读全部经文" },
      allVersesForDay: { id: "Semua ayat untuk Hari", en: "All verses for Day", zh: "第" },
      loadingFullVerses: { id: "Memuat ayat lengkap...", en: "Loading full verses...", zh: "正在加载全部经文..." },
      fullVersesNotAvailable: {
        id: "Ayat lengkap belum tersedia untuk bacaan ini. Daftar pasal rekomendasi tetap bisa diikuti di atas.",
        en: "Full verses are not available offline. You can still follow the recommended chapters above.",
        zh: "暂无全部离线经文。您仍可按照上方推荐的章节进行阅读。"
      },
      placeholderReflections: {
        id: "Tulis ayat yang berkesan, pertanyaan, atau langkah ketaatan hari ini.",
        en: "Write memorable verses, questions, or obedience steps for today.",
        zh: "在此写下令您印象深刻 of 经文、疑问或今天的顺服步骤。"
      },
      finishAllPlan: { id: "Selesai Seluruh Rencana", en: "Finish All Plans", zh: "完成全部计划" },
      notesListTitle: { id: "Daftar Catatan Anda", en: "Your Notes List", zh: "您的笔记列表" },
      noNotesSaved: { id: "Belum ada catatan tersimpan.", en: "No notes saved yet.", zh: "暂无已保存的笔记。" },
      challengeDay: { id: "Tantangan Hari", en: "Challenge Day", zh: "挑战第" },
      customPlanDay: { id: "Rencana Kustom Hari", en: "Custom Plan Day", zh: "自定义第" },
      recentlySaved: { id: "Baru disimpan", en: "Just saved", zh: "刚刚保存" },
      edit: { id: "Ubah", en: "Edit", zh: "修改" },
      delete: { id: "Hapus", en: "Delete", zh: "删除" }
    };
    return dict[key]?.[language] || dict[key]?.id || key;
  };
  
  // Standard plan states
  const [day, setDay] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [planData, setPlanData] = useState("");
  const [chapterReadings, setChapterReadings] = useState<BibleChapterReading[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [translationId, setTranslationId] = useState<BibleTranslationId>(USE_WEB_BIBLE ? "ind_web" : "ind_ayt");
  const [isPlaying, setIsPlaying] = useState(false);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<any[]>([]);
  const [savingNote, setSavingNote] = useState(false);

  // Mode selection: "standard" or "custom"
  const [planMode, setPlanMode] = useState<"standard" | "custom">("standard");

  // Custom plan states
  const [customPlan, setCustomPlan] = useState<CustomReadingPlan | null>(null);
  
  // Creator custom plan form states
  const [creatorBookShort, setCreatorBookShort] = useState("PSA"); // Default Mazmur
  const [creatorDuration, setCreatorDuration] = useState(7); // Default 7 hari
  const [creatorTranslation, setCreatorTranslation] = useState<BibleTranslationId>(USE_WEB_BIBLE ? "ind_web" : "ind_ayt");

  // Load plans on mount
  useEffect(() => {
    // Load local custom plan if any
    try {
      const storedCustom = localStorage.getItem("custom_bible_plan");
      if (storedCustom) {
        setCustomPlan(JSON.parse(storedCustom));
      }
      const storedMode = localStorage.getItem("bible_plan_mode");
      if (storedMode === "custom") {
        setPlanMode("custom");
      }
    } catch (e) {
      console.error(e);
    }

    if (!auth) return;
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setHasAccess(true);
      if (!currentUser) {
        if (typeof window !== "undefined") {
          const localDay = Number(localStorage.getItem("local_bible_plan_day") || "1");
          setDay(localDay);
          await loadPlanForDay(localDay);
          const localNote = localStorage.getItem(`note-day-${localDay}`) || "";
          setNote(localNote);
        }
        setLoading(false);
        return;
      }
      if (currentUser && db) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const nextDay = data.biblePlanDay || 1;
            setDay(nextDay);
            
            // Query local notes from firestore
            const notesSnap = await getDocs(query(collection(db, "users", currentUser.uid, "bible_plan_notes"), orderBy("updatedAt", "desc"), limit(100))).catch(() => null);
            setNotes(notesSnap?.docs.map((item) => ({ id: item.id, ...item.data() })) ?? []);
            
            // If standard plan mode, load today's reading
            if (planMode === "standard") {
              await loadPlanForDay(nextDay);
              const noteDoc = await getDoc(doc(db, "users", currentUser.uid, "bible_plan_notes", `day-${nextDay}`));
              setNote(noteDoc.exists() ? noteDoc.data().note ?? "" : "");
            }
          } else {
            await loadPlanForDay(1);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    });
  }, []);

  // Reload standard plan details if language changes
  useEffect(() => {
    if (planMode === "standard") {
      loadPlanForDay(day);
    }
  }, [language]);

  // Trigger loading chapters for Custom Plan when it changes or when custom plan day changes
  useEffect(() => {
    if (planMode === "custom" && customPlan) {
      loadCustomPlanChapters(customPlan);
    }
  }, [planMode, customPlan?.currentDay, customPlan?.translationId]);

  // Load custom plan text
  async function loadCustomPlanChapters(plan: CustomReadingPlan) {
    setLoadingChapters(true);
    const dayInfo = plan.days.find((d) => d.day === plan.currentDay);
    if (!dayInfo) {
      setChapterReadings([]);
      setLoadingChapters(false);
      return;
    }

    try {
      const readings = await Promise.all(
        dayInfo.chapters.map((chapNum) =>
          fetchBibleChapterReading(plan.bookShort, chapNum, plan.translationId)
        )
      );
      setChapterReadings(readings.filter(Boolean) as BibleChapterReading[]);
      
      // Load custom note for this day
      if (user && db) {
        const noteDoc = await getDoc(
          doc(db, "users", user.uid, "bible_plan_notes", `custom-${plan.bookShort}-${plan.currentDay}`)
        ).catch(() => null);
        setNote(noteDoc?.exists() ? noteDoc.data().note ?? "" : "");
      } else {
        const localNote = localStorage.getItem(`note-custom-${plan.bookShort}-${plan.currentDay}`);
        setNote(localNote ?? "");
      }
    } catch (e) {
      console.error("Gagal memuat ayat kustom", e);
    } finally {
      setLoadingChapters(false);
    }
  }

  // Create custom plan
  function handleCreateCustomPlan() {
    const selectedBook = BIBLE_BOOKS.find((b) => b.id === creatorBookShort);
    if (!selectedBook) return;

    const totalChapters = selectedBook.chapters;
    const duration = Math.min(Math.max(Number(creatorDuration) || 7, 1), totalChapters);
    
    // Divide chapters
    const chaptersPerDay = Math.floor(totalChapters / duration);
    const remainder = totalChapters % duration;
    
    const days: CustomReadingPlan["days"] = [];
    let currentChapter = 1;
    for (let dayNum = 1; dayNum <= duration; dayNum++) {
      const start = currentChapter;
      const count = chaptersPerDay + (dayNum <= remainder ? 1 : 0);
      const end = start + count - 1;
      days.push({
        day: dayNum,
        chapters: Array.from({ length: count }, (_, idx) => start + idx),
      });
      currentChapter = end + 1;
    }

    const newPlan: CustomReadingPlan = {
      bookName: selectedBook.name,
      bookShort: selectedBook.id,
      duration,
      translationId: creatorTranslation,
      currentDay: 1,
      days,
    };

    setCustomPlan(newPlan);
    setPlanMode("custom");
    localStorage.setItem("custom_bible_plan", JSON.stringify(newPlan));
    localStorage.setItem("bible_plan_mode", "custom");
    
    // Reset note
    setNote("");
  }

  // Reset custom plan
  function handleResetCustomPlan() {
    if (!window.confirm("Apakah Anda yakin ingin menghapus rencana baca kustom saat ini? Progres kustom akan hilang.")) return;
    setCustomPlan(null);
    setPlanMode("standard");
    localStorage.removeItem("custom_bible_plan");
    localStorage.setItem("bible_plan_mode", "standard");
    setNote("");
    loadPlanForDay(day);
  }

  // Toggle mode
  function handleToggleMode(mode: "standard" | "custom") {
    setPlanMode(mode);
    localStorage.setItem("bible_plan_mode", mode);
    setNote("");
    if (mode === "standard") {
      loadPlanForDay(day);
    } else if (customPlan) {
      loadCustomPlanChapters(customPlan);
    }
  }

  async function generatePlan() {
    if (generating) return;
    setGenerating(true);
    await loadPlanForDay(day);
    setGenerating(false);
  }

  async function loadPlanForDay(nextDay: number, nextTranslationId: BibleTranslationId = translationId) {
    setPlanData(planTextForDay(nextDay, language));
    setLoadingChapters(true);

    try {
      const readings = await Promise.all(
        chaptersForDay(nextDay).map((item) =>
          fetchBibleChapterReading(item.bookShort, item.chapter, nextTranslationId),
        ),
      );
      setChapterReadings(readings.filter(Boolean) as BibleChapterReading[]);
    } finally {
      setLoadingChapters(false);
    }
  }

  async function changeTranslation(nextTranslationId: BibleTranslationId) {
    setTranslationId(nextTranslationId);
    await loadPlanForDay(day, nextTranslationId);
  }

  async function loadNoteForDay(nextDay: number) {
    setDay(nextDay);
    await loadPlanForDay(nextDay);
    if (user && db) {
      const noteDoc = await getDoc(doc(db, "users", user.uid, "bible_plan_notes", `day-${nextDay}`)).catch(() => null);
      setNote(noteDoc?.exists() ? noteDoc.data().note ?? "" : "");
    } else {
      const localNote = localStorage.getItem(`note-day-${nextDay}`) || "";
      setNote(localNote);
    }
  }

  // Mark reading day complete
  async function markComplete() {
    if (planMode === "custom" && customPlan) {
      const nextDay = customPlan.currentDay + 1;
      
      // Save notes
      await saveCurrentNote();
      
      if (nextDay > customPlan.duration) {
        alert(`Selamat! Anda telah berhasil menyelesaikan rencana baca kustom Kitab ${customPlan.bookName} selama ${customPlan.duration} hari.`);
        // Mark as finished by setting day beyond duration
        const updated = { ...customPlan, currentDay: nextDay };
        setCustomPlan(updated);
        localStorage.setItem("custom_bible_plan", JSON.stringify(updated));
      } else {
        const updated = { ...customPlan, currentDay: nextDay };
        setCustomPlan(updated);
        localStorage.setItem("custom_bible_plan", JSON.stringify(updated));
        
        if (user && db) {
          await setDoc(doc(collection(db, "users", user.uid, "activities")), {
            type: "custom_bible_plan",
            title: `Selesai Hari ${customPlan.currentDay} - Kitab ${customPlan.bookName}`,
            description: `Menyelesaikan rencana kustom hari ${customPlan.currentDay} dari ${customPlan.duration}.`,
            createdAt: serverTimestamp(),
          });
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!user || !db) {
      const nextDay = Math.min(day + 1, TOTAL_PLAN_DAYS);
      await saveCurrentNote();
      if (typeof window !== "undefined") {
        localStorage.setItem("local_bible_plan_day", String(nextDay));
      }
      await loadNoteForDay(nextDay);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      const nextDay = Math.min(day + 1, TOTAL_PLAN_DAYS);
      await saveCurrentNote();
      await setDoc(doc(db, "users", user.uid), {
        biblePlanDay: nextDay,
        lastBiblePlanCompletedDay: day,
        lastBiblePlanCompletedAt: serverTimestamp(),
      }, { merge: true });
      await setDoc(doc(collection(db, "users", user.uid, "activities")), {
        type: "bible_plan",
        title: `Rencana Baca Hari ${day}`,
        description: "Menyelesaikan bacaan harian dan melanjutkan ke hari berikutnya.",
        createdAt: serverTimestamp(),
      });
      await loadNoteForDay(nextDay);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert("Gagal menyimpan progres.");
    }
  }

  // Save notes helper
  async function saveCurrentNote() {
    if (note.trim() === "") return;
    setSavingNote(true);
    try {
      if (planMode === "custom" && customPlan) {
        const noteId = `custom-${customPlan.bookShort}-${customPlan.currentDay}`;
        if (user && db) {
          await setDoc(doc(db, "users", user.uid, "bible_plan_notes", noteId), {
            day: customPlan.currentDay,
            note,
            planType: `custom-${customPlan.bookName}`,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } else {
          localStorage.setItem(`note-${noteId}`, note);
        }
        
        setNotes((current) => {
          const nextNote = { id: noteId, day: customPlan.currentDay, note, planType: `custom-${customPlan.bookName}`, updatedAt: { _seconds: Math.floor(Date.now() / 1000) } };
          return [nextNote, ...current.filter((item) => item.id !== noteId)];
        });
      } else {
        if (user && db) {
          await setDoc(doc(db, "users", user.uid, "bible_plan_notes", `day-${day}`), {
            day,
            note,
            planType: "standard",
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } else {
          localStorage.setItem(`note-day-${day}`, note);
        }
        setNotes((current) => {
          const nextNote = { id: `day-${day}`, day, note, planType: "standard", updatedAt: { _seconds: Math.floor(Date.now() / 1000) } };
          return [nextNote, ...current.filter((item) => item.id !== `day-${day}`)];
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNote(false);
    }
  }

  // Delete note
  async function deleteNote(noteId: string, dayNum: number) {
    if (!user || !db || !window.confirm(`Hapus catatan ini?`)) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "bible_plan_notes", noteId));
      setNotes((current) => current.filter((item) => item.id !== noteId));
      if (noteId.startsWith("day-") && day === dayNum) {
        setNote("");
      } else if (noteId.startsWith("custom-") && customPlan && customPlan.currentDay === dayNum) {
        setNote("");
      }
    } catch (e) {
      alert("Gagal menghapus catatan.");
    }
  }

  function formatDate(value: any) {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value?._seconds
          ? new Date(value._seconds * 1000)
          : null;
    return date
      ? new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date)
      : tLocal("recentlySaved");
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-4xl">
          <>
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              {tLocal("readingPlan")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              {tLocal("guideTitle")}
            </h1>
            <p className="mt-2 text-[#52606d]">
              {tLocal("readingPlanDesc")}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white transition hover:bg-[#1a2d52] self-start"
          >
            {tLocal("backToHome")}
          </Link>
        </header>

        {/* Tab Plan Mode Selector */}
        <div className="mt-8 flex gap-2 border-b border-[#dfd8ca] pb-4">
          <button
            onClick={() => handleToggleMode("standard")}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              planMode === "standard" ? "bg-[#14213d] text-white" : "border border-[#dfd8ca] bg-white text-[#1f2933]"
            }`}
          >
            {tLocal("challenge365")}
          </button>
          <button
            onClick={() => handleToggleMode("custom")}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              planMode === "custom" ? "bg-[#14213d] text-white" : "border border-[#dfd8ca] bg-white text-[#1f2933]"
            }`}
          >
            {tLocal("customPlan")} {customPlan && `(${customPlan.bookName})`}
          </button>
        </div>

        <section className="mt-6">
          {planMode === "custom" && !customPlan && (
            /* Custom Plan Creator Form */
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-[#14213d] mb-4">{tLocal("createCustomTitle")}</h2>
              <p className="text-[#52606d] mb-6">
                {tLocal("createCustomDesc")}
              </p>
              
              <div className="grid gap-6 sm:grid-cols-3 mb-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#14213d]" htmlFor="creator-book-select">{tLocal("chooseBook")}</label>
                  <select
                    id="creator-book-select"
                    value={creatorBookShort}
                    onChange={(e) => setCreatorBookShort(e.target.value)}
                    className="rounded border border-[#dfd8ca] bg-white px-3 py-2 text-sm text-[#1f2933]"
                  >
                    {BIBLE_BOOKS.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.name} ({book.chapters} {tLocal("chapters")})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#14213d]" htmlFor="creator-duration-input">{tLocal("durationDays")}</label>
                  <input
                    id="creator-duration-input"
                    type="number"
                    min={1}
                    max={150}
                    value={creatorDuration}
                    onChange={(e) => setCreatorDuration(Math.max(1, Number(e.target.value) || 1))}
                    className="rounded border border-[#dfd8ca] bg-white px-3 py-2 text-sm text-[#1f2933]"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#14213d]" htmlFor="creator-translation-select">{tLocal("translation")}</label>
                  <select
                    id="creator-translation-select"
                    value={creatorTranslation}
                    onChange={(e) => setCreatorTranslation(e.target.value as BibleTranslationId)}
                    className="rounded border border-[#dfd8ca] bg-white px-3 py-2 text-sm text-[#1f2933]"
                  >
                    {USE_WEB_BIBLE ? (
                      <>
                        <option value="ind_web">Indonesia WEB-AI</option>
                        <option value="web">English WEB</option>
                      </>
                    ) : (
                      <>
                        <option value="ind_ayt">Indonesia AYT</option>
                        <option value="BSB">English BSB</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateCustomPlan}
                className="w-full sm:w-auto rounded-md bg-[#2a6f6f] px-6 py-3 font-semibold text-white transition hover:bg-[#1a4a4a] text-center"
              >
                {tLocal("createCustomBtn")}
              </button>
            </div>
          )}

          {planMode === "custom" && customPlan && (
            /* Custom Plan Progress and Reading */
            <div className="grid gap-6 animate-in fade-in">
              <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 shadow-sm flex flex-col items-center text-center">
                <div className="flex justify-between w-full items-center mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#d97706]">{tLocal("customPlanOffline")}</span>
                  <button
                    onClick={handleResetCustomPlan}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 transition"
                  >
                    {tLocal("deleteCustomPlan")}
                  </button>
                </div>

                <h2 className="text-2xl font-bold text-[#14213d] mb-1">{language === "zh" ? "书卷" : language === "en" ? "Book" : "Kitab"} {customPlan.bookName}</h2>
                <h3 className="text-5xl font-bold text-[#2a6f6f] mt-2 mb-4">
                  {customPlan.currentDay > customPlan.duration ? (
                    tLocal("finished")
                  ) : (
                    <>
                      {language === "zh" ? `${tLocal("day")} ${customPlan.currentDay} ${tLocal("days")}` : `${tLocal("day")} ${customPlan.currentDay}`} <span className="text-2xl text-[#52606d]">/ {customPlan.duration}</span>
                    </>
                  )}
                </h3>

                <div className="w-full max-w-md bg-[#e9f5db] rounded-full h-4 mb-6 overflow-hidden">
                  <div
                    className="bg-[#2a6f6f] h-4 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, (customPlan.currentDay / customPlan.duration) * 100)}%` }}
                  ></div>
                </div>

                {customPlan.currentDay <= customPlan.duration && (
                  <div className="flex flex-wrap justify-center gap-3">
                    <label className="flex items-center gap-2 rounded-md border border-[#dfd8ca] bg-white px-3 py-2 text-sm font-semibold text-[#14213d]" htmlFor="custom-translation-select">
                      {tLocal("translation")}
                      <select
                        id="custom-translation-select"
                        value={customPlan.translationId}
                        onChange={(e) => {
                          const updated = { ...customPlan, translationId: e.target.value as BibleTranslationId };
                          setCustomPlan(updated);
                          localStorage.setItem("custom_bible_plan", JSON.stringify(updated));
                        }}
                        className="bg-transparent text-[#2a6f6f] outline-none"
                      >
                        {USE_WEB_BIBLE ? (
                          <>
                            <option value="ind_web">Indonesia WEB-AI</option>
                            <option value="web">English WEB</option>
                          </>
                        ) : (
                          <>
                            <option value="ind_ayt">Indonesia AYT</option>
                            <option value="BSB">English BSB</option>
                          </>
                        )}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...customPlan, currentDay: Math.max(1, customPlan.currentDay - 1) };
                        setCustomPlan(updated);
                        localStorage.setItem("custom_bible_plan", JSON.stringify(updated));
                      }}
                      disabled={customPlan.currentDay <= 1}
                      className="rounded-md border border-[#dfd8ca] px-4 py-2 font-semibold text-[#14213d] disabled:opacity-45"
                    >
                      {tLocal("prevDay")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...customPlan, currentDay: Math.min(customPlan.duration, customPlan.currentDay + 1) };
                        setCustomPlan(updated);
                        localStorage.setItem("custom_bible_plan", JSON.stringify(updated));
                      }}
                      disabled={customPlan.currentDay >= customPlan.duration}
                      className="rounded-md border border-[#dfd8ca] px-4 py-2 font-semibold text-[#14213d] disabled:opacity-45"
                    >
                      {tLocal("nextDay")}
                    </button>
                  </div>
                )}
              </div>

              {customPlan.currentDay <= customPlan.duration && (
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 shadow-sm">
                  <div className="flex justify-between items-center mb-6 border-b border-[#dfd8ca] pb-4">
                    <h3 className="text-xl font-bold text-[#2a6f6f]">
                      {language === "zh" ? `${tLocal("readingMaterial")} ${customPlan.currentDay} ${tLocal("days")}` : `${tLocal("readingMaterial")} ${customPlan.currentDay}`}
                    </h3>
                    <button
                      onClick={() => {
                        let combinedText = `Bacaan Kustom Hari ${customPlan.currentDay}. `;
                        chapterReadings.forEach((chapter) => {
                          combinedText += `${chapter.book} pasal ${chapter.chapter}.\n`;
                          chapter.verses.forEach((verse) => {
                            combinedText += `${verse.number}. ${verse.text}\n`;
                          });
                        });
                        toggleAudio(combinedText, isPlaying, setIsPlaying, customPlan.translationId === "BSB" ? "en-US" : "id-ID");
                      }}
                      className="rounded-md bg-[#e9f5db] px-4 py-2 font-semibold text-[#284b3a] transition hover:bg-[#cde4b4]"
                    >
                      {isPlaying ? tLocal("stopAudio") : tLocal("listenAudio")}
                    </button>
                  </div>

                  {loadingChapters ? (
                    <p className="text-[#52606d] italic text-center py-6">{tLocal("loadingBible")}</p>
                  ) : chapterReadings.length === 0 ? (
                    <p className="text-[#52606d] italic text-center py-6">{tLocal("bibleNotFound")}</p>
                  ) : (
                    <div className="grid gap-6">
                      {customPlan.translationId === "ind_web" && <AiDisclaimer />}
                      {chapterReadings.map((chapter) => (
                        <article key={`${chapter.bookShort}-${chapter.chapter}`} className="rounded-md border border-[#eadfcd] bg-[#fffdf8] p-5 shadow-sm">
                          <h4 className="text-xl font-bold text-[#14213d] mb-4">
                            {chapter.book} {chapter.chapter}
                          </h4>
                          <div className="grid gap-2 text-left text-sm leading-7 text-[#334155] sm:text-base">
                            {chapter.verses.map((verse) => (
                              <p key={verse.number}>
                                <sup className="mr-1.5 font-bold text-[#d97706]">{verse.number}</sup>
                                {verse.text}
                              </p>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  <div className="mt-8 grid gap-3 rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-5">
                    <label className="font-semibold text-[#14213d]" htmlFor="custom-plan-note">
                      {language === "zh" ? `${tLocal("personalNotes")} ${customPlan.currentDay} ${tLocal("days")}` : `${tLocal("personalNotes")} ${customPlan.currentDay}`}
                    </label>
                    <textarea
                      id="custom-plan-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className="min-h-32 rounded-md border border-[#dfd8ca] bg-white px-4 py-3 leading-7"
                      placeholder={tLocal("placeholderNotes")}
                      maxLength={3000}
                    />
                    <button
                      type="button"
                      onClick={saveCurrentNote}
                      disabled={savingNote}
                      className="w-fit rounded-md bg-[#2a6f6f] px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                    >
                      {savingNote ? tLocal("saving") : tLocal("saveNote")}
                    </button>
                  </div>

                  <div className="mt-10 border-t border-[#dfd8ca] pt-8 flex justify-center">
                    <button
                      onClick={markComplete}
                      className="rounded-md bg-[#d97706] px-8 py-4 font-bold text-white text-lg transition hover:bg-[#b45309] shadow-lg flex items-center gap-3"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {customPlan.currentDay >= customPlan.duration ? tLocal("finishCustomPlan") : `${tLocal("finishDayNext")} ${customPlan.currentDay + 1}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {planMode === "standard" && (
            /* Standard 365 Days Plan */
            <div className="grid gap-6 animate-in fade-in">
              {loading ? (
                <p className="text-center text-[#52606d]">{tLocal("loadingProgress")}</p>
              ) : (
                <div className="grid gap-6">
                  {!user && (
                    <div className="rounded-lg border border-amber-250 bg-amber-50 p-4 text-sm text-amber-850 text-center font-medium">
                      {language === "zh" ? "进度已保存在本地浏览器中。登录以在云端备份。" : language === "en" ? "Progress is saved locally in this browser. Log in to back up in the cloud." : "Progres disimpan secara lokal pada peramban ini. Masuk/login untuk mencadangkan progres Anda di cloud."}
                    </div>
                  )}
                  <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 shadow-sm flex flex-col items-center text-center">
                    <p className="text-sm font-bold uppercase tracking-widest text-[#d97706] mb-2">{tLocal("yourProgress")}</p>
                    <h2 className="text-6xl font-bold text-[#14213d] mb-4">
                      {language === "zh" ? `${tLocal("day")} ${day} ${tLocal("days")}` : `${tLocal("day")} ${day}`} <span className="text-2xl text-[#52606d]">/ 365</span>
                    </h2>
                    
                    <div className="w-full max-w-md bg-[#e9f5db] rounded-full h-4 mb-6 overflow-hidden">
                      <div className="bg-[#2a6f6f] h-4 rounded-full transition-all duration-1000 ease-out" style={{ width: `${(day / 365) * 100}%` }}></div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      <label className="flex items-center gap-2 rounded-md border border-[#dfd8ca] bg-white px-3 py-2 text-sm font-semibold text-[#14213d]" htmlFor="standard-translation-select">
                        {tLocal("translation")}
                        <select
                          id="standard-translation-select"
                          value={translationId}
                          onChange={(event) => changeTranslation(event.target.value as BibleTranslationId)}
                          className="bg-transparent text-[#2a6f6f] outline-none"
                        >
                          {USE_WEB_BIBLE ? (
                            <>
                              <option value="ind_web">Indonesia WEB-AI</option>
                              <option value="web">English WEB</option>
                            </>
                          ) : (
                            <>
                              <option value="ind_ayt">Indonesia AYT</option>
                              <option value="BSB">English BSB</option>
                            </>
                          )}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => loadNoteForDay(Math.max(1, day - 1))}
                        disabled={day <= 1}
                        className="rounded-md border border-[#dfd8ca] px-4 py-2 font-semibold text-[#14213d] disabled:opacity-45"
                      >
                        {tLocal("prevDay")}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadNoteForDay(Math.min(TOTAL_PLAN_DAYS, day + 1))}
                        disabled={day >= TOTAL_PLAN_DAYS}
                        className="rounded-md border border-[#dfd8ca] px-4 py-2 font-semibold text-[#14213d] disabled:opacity-45"
                      >
                        {tLocal("nextDay")}
                      </button>
                    </div>

                    {!planData && !generating && (
                      <button 
                        onClick={generatePlan}
                        className="mt-6 rounded-md bg-[#14213d] px-8 py-4 font-bold text-white text-lg transition hover:bg-[#1a2d52] shadow-lg"
                      >
                        {tLocal("openTodayGuide")}
                      </button>
                    )}

                    {generating && (
                      <div className="flex flex-col items-center gap-3 text-[#2a6f6f] mt-4">
                        <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="font-semibold text-lg">{tLocal("arrangingPlan")}</p>
                      </div>
                    )}
                  </div>

                  {planData && (
                    <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-6 border-b border-[#dfd8ca] pb-4">
                        <h3 className="text-2xl font-bold text-[#2a6f6f]">
                          {language === "zh" ? `${tLocal("todayMaterial")} ${day} ${tLocal("days")}` : `${tLocal("todayMaterial")} ${day}`}
                        </h3>
                        <button
                          onClick={() => {
                            let combinedText = planData;
                            if (chapterReadings.length > 0) {
                              combinedText += "\n\nBerikut adalah pembacaan Alkitab lengkap:\n\n";
                              chapterReadings.forEach((chapter) => {
                                combinedText += `${chapter.book} pasal ${chapter.chapter}.\n`;
                                chapter.verses.forEach((verse) => {
                                  combinedText += `Ayat ${verse.number}. ${verse.text}\n`;
                                });
                                combinedText += "\n";
                              });
                            }
                            toggleAudio(combinedText, isPlaying, setIsPlaying, translationId === "BSB" ? "en-US" : "id-ID");
                          }}
                          className="rounded-md bg-[#e9f5db] px-4 py-2 font-semibold text-[#284b3a] transition hover:bg-[#cde4b4]"
                        >
                          {isPlaying ? tLocal("stopAudio") : tLocal("listenAudioShort")}
                        </button>
                      </div>
                      
                      <div className="prose prose-lg max-w-none text-[#334155] leading-8">
                        <ReactMarkdown
                          components={{
                            h1: ({ ...props }) => <strong {...props} className="block mt-2 text-xl text-[#14213d]" />,
                            h2: ({ ...props }) => <strong {...props} className="block mt-2 text-lg text-[#14213d]" />,
                            h3: ({ ...props }) => <strong {...props} className="block mt-2 text-base text-[#14213d]" />,
                          }}
                        >
                          {planData}
                        </ReactMarkdown>
                      </div>

                      <div className="mt-8 rounded-lg border border-[#dfd8ca] bg-[#fffdf8] p-5">
                        <div className="flex flex-col justify-between gap-2 border-b border-[#dfd8ca] pb-4 sm:flex-row sm:items-end">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d97706]">
                              {tLocal("fullReadingRec")}
                            </p>
                            <h4 className="mt-1 text-xl font-bold text-[#14213d]">
                              {language === "zh" ? `${tLocal("allVersesForDay")} ${day} ${tLocal("days")}` : `${tLocal("allVersesForDay")} ${day}`}
                            </h4>
                          </div>
                          <p className="text-sm font-semibold text-[#52606d]">
                            Teks: {translationId === "ind_ayt"
                              ? "Indonesia AYT"
                              : translationId === "ind_web"
                              ? "Indonesia WEB-AI"
                              : translationId === "BSB"
                              ? "English BSB"
                              : "English WEB"}
                          </p>
                        </div>

                        {loadingChapters ? (
                          <p className="mt-5 text-sm font-semibold text-[#52606d]">
                            {tLocal("loadingFullVerses")}
                          </p>
                        ) : chapterReadings.length === 0 ? (
                          <p className="mt-5 text-sm text-[#52606d]">
                            {tLocal("fullVersesNotAvailable")}
                          </p>
                        ) : (
                          <div className="mt-5 grid gap-6">
                            {translationId === "ind_web" && <AiDisclaimer />}
                            {chapterReadings.map((chapter) => (
                              <article key={`${chapter.bookShort}-${chapter.chapter}`} className="rounded-md border border-[#eadfcd] bg-white p-4">
                                <h5 className="text-lg font-bold text-[#2a6f6f]">
                                  {chapter.book} {chapter.chapter}
                                </h5>
                                <div className="mt-3 grid gap-2 text-left text-sm leading-7 text-[#334155] sm:text-base">
                                  {chapter.verses.map((verse) => (
                                    <p key={verse.number}>
                                      <sup className="mr-1 font-bold text-[#d97706]">{verse.number}</sup>
                                      {verse.text}
                                    </p>
                                  ))}
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-8 grid gap-3 rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-5">
                        <label className="font-semibold text-[#14213d]" htmlFor="standard-plan-note">
                          {language === "zh" ? `${tLocal("personalNotes")} ${day} ${tLocal("days")}` : `${tLocal("personalNotes")} ${day}`}
                        </label>
                        <textarea
                          id="standard-plan-note"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          className="min-h-32 rounded-md border border-[#dfd8ca] bg-white px-4 py-3 leading-7"
                          placeholder={tLocal("placeholderReflections")}
                          maxLength={3000}
                        />
                        <button
                          type="button"
                          onClick={saveCurrentNote}
                          disabled={savingNote}
                          className="w-fit rounded-md bg-[#2a6f6f] px-5 py-3 font-semibold text-white disabled:opacity-50"
                        >
                          {savingNote ? tLocal("saving") : tLocal("saveNoteShort")}
                        </button>
                      </div>

                      <div className="mt-10 border-t border-[#dfd8ca] pt-8 flex justify-center">
                        <button 
                          onClick={markComplete}
                          className="rounded-md bg-[#d97706] px-8 py-4 font-bold text-white text-lg transition hover:bg-[#b45309] shadow-lg flex items-center gap-3"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          {day >= TOTAL_PLAN_DAYS ? tLocal("finishAllPlan") : `${tLocal("finishDayNext")} ${day + 1}`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User Notes list */}
          <div className="mt-8 rounded-lg border border-[#dfd8ca] bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-[#14213d]">{tLocal("notesListTitle")}</h3>
            <div className="mt-4 grid gap-3">
              {notes.length === 0 ? (
                <p className="text-sm text-[#52606d]">{tLocal("noNotesSaved")}</p>
              ) : (
                notes.map((item) => (
                  <article key={item.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.planType === "standard") {
                            handleToggleMode("standard");
                            loadNoteForDay(Number(item.day) || 1);
                          } else if (item.planType?.startsWith("custom-")) {
                            handleToggleMode("custom");
                          }
                          document.getElementById("bible-plan-note")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="font-semibold text-[#2a6f6f] hover:underline"
                      >
                        {item.planType === "standard" ? `${tLocal("challengeDay")} ${item.day}` : `${tLocal("customPlanDay")} ${item.day}`}
                      </button>
                      <time className="text-xs font-semibold uppercase tracking-[0.12em] text-[#52606d]">
                        {formatDate(item.updatedAt)}
                      </time>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#52606d]">{item.note}</p>
                    {user && (
                      <div className="mt-3 flex gap-2 border-t border-[#dfd8ca]/60 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.planType === "standard") {
                              handleToggleMode("standard");
                              loadNoteForDay(Number(item.day) || 1);
                            } else if (item.planType?.startsWith("custom-")) {
                              handleToggleMode("custom");
                            }
                            document.getElementById("bible-plan-note")?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="rounded bg-white border border-[#dfd8ca] px-3 py-1 text-xs font-semibold text-[#14213d] hover:bg-gray-50 transition"
                        >
                          {tLocal("edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteNote(item.id, Number(item.day))}
                          className="rounded bg-red-50 text-red-600 px-3 py-1 text-xs font-semibold hover:bg-red-100 transition"
                        >
                          {tLocal("delete")}
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
          </>
      </div>
    </main>
  );
}
