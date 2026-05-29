"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { AiMode } from "@/lib/ai";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { shareToWhatsApp, printPdf } from "@/lib/share";
import { toggleAudio } from "@/lib/audio";

const tools: Array<{
  mode: AiMode;
  label: string;
  prompt: string;
  placeholder: string;
}> = [
  {
    mode: "devotional",
    label: "Renungan online",
    prompt:
      "Buat renungan harian dari Yohanes 3:16. Sertakan judul, ayat, refleksi, aplikasi, dan doa.",
    placeholder: "Tulis ayat atau tema renungan, contoh: Mazmur 23 tentang penyertaan Tuhan.",
  },
  {
    mode: "devotional_pdf",
    label: "PDF Devotional",
    prompt:
      "Susun bahan PDF devotional 7 hari bertema pengharapan dalam Kristus. Sertakan halaman pembuka, ayat utama tiap hari, renungan, pertanyaan refleksi, ruang catatan, doa, dan panduan diskusi keluarga/komsel.",
    placeholder: "Tulis tema, durasi, audiens, dan kebutuhan bahan PDF devotional.",
  },
  {
    mode: "pastor",
    label: "Tanya pendeta",
    prompt:
      "Saya sedang sulit berdoa dan merasa jauh dari Tuhan. Tolong jawab secara pastoral dan alkitabiah.",
    placeholder: "Tulis pertanyaan rohani atau pergumulan yang ingin didiskusikan.",
  },
  {
    mode: "bible-study",
    label: "Studi Alkitab",
    prompt:
      "Bantu saya memahami Roma 8:28 dengan konteks, tema utama, dan pertanyaan diskusi.",
    placeholder: "Masukkan referensi ayat atau topik studi Alkitab.",
  },
  {
    mode: "prayer",
    label: "Doa",
    prompt:
      "Buatkan doa singkat untuk orang yang sedang cemas tetapi ingin percaya kepada Tuhan.",
    placeholder: "Tulis kebutuhan doa, contoh: keluarga, pekerjaan, kesehatan, pengampunan.",
  },
  {
    mode: "song_recommendation",
    label: "Lagu Rohani",
    prompt:
      "Rekomendasikan lagu penyembahan tentang iman dan pengharapan yang cocok untuk saat teduh.",
    placeholder: "Sebutkan suasana hati atau topik lagu yang ingin dicari.",
  },
  {
    mode: "sermon_guide",
    label: "Panduan Khotbah/Komsel",
    prompt:
      "Buat panduan khotbah/komsel lengkap tentang mengampuni orang yang melukai kita. Sertakan ayat utama, minimal 8 ayat pendukung, latar belakang teks, ide besar, outline 4 poin, penjabaran mendalam, contoh kasus nyata di keluarga/pekerjaan/gereja, 3 ilustrasi kehidupan sehari-hari, pertanyaan diskusi, aplikasi praktis, ajakan respons, dan doa penutup.",
    placeholder: "Tulis tema, perikop, audiens, atau kebutuhan pelayanan yang akan dibahas.",
  },
  {
    mode: "counseling",
    label: "Pendampingan rohani",
    prompt:
      "Saya merasa lelah secara batin. Berikan langkah refleksi rohani yang aman dan membangun.",
    placeholder: "Ceritakan situasi secara singkat. Hindari data pribadi yang sensitif.",
  },
];

const HISTORY_ITEMS_PER_PAGE = 6;

export function AiConsole() {
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

  const visibleTools = userAllowedModes
    ? tools.filter(t => userAllowedModes.includes(t.mode))
    : tools.filter(t => t.mode === "devotional");

  const [mode, setMode] = useState<AiMode>("devotional");
  const selected = useMemo(
    () => tools.find((tool) => tool.mode === mode) ?? tools[0],
    [mode],
  );
  const [prompt, setPrompt] = useState(selected.prompt);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("Memeriksa status paket...");

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
      if (!currentUser) {
        setUserAllowedModes(["devotional"]); 
        setCanExportPdf(false);
        setMode("devotional");
        setStatus("Mode gratis. Login untuk fitur lebih.");
        return;
      }
      
      try {
        if (!db) return;
        
        // Fetch history
        const q = query(collection(db, "ai_requests"), where("userId", "==", currentUser.uid));
        const snap = await getDocs(q);
        const historyData = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        historyData.sort((a: any, b: any) => {
          const ta = a.createdAt?.toMillis() || 0;
          const tb = b.createdAt?.toMillis() || 0;
          return tb - ta;
        });
        setHistory(historyData);
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setStreak(userData.streakCount || 0);
          
          if (userData.role === "admin") {
            const allModes = tools.map((t) => t.mode);
            setUserAllowedModes(allModes);
            setCanExportPdf(true);
            setStatus("Admin: Akses penuh terbuka.");
            return;
          }

          const selectedPlanName = userData.selectedPlan;
          if (selectedPlanName) {
            const planSnap = await getDocs(query(collection(db, "plans")));
            const planDoc = planSnap.docs.find(d => d.data().name === selectedPlanName);
            if (planDoc) {
              const allowed = planDoc.data().allowedModes || ["devotional"];
              setUserAllowedModes(allowed);
              setCanExportPdf(allowed.includes("export_pdf"));
              
              if (allowed.length > 0 && !allowed.includes("devotional")) {
                const nextMode = allowed[0] as AiMode;
                const nextTool = tools.find((t) => t.mode === nextMode) ?? tools[0];
                setMode(nextMode);
                setPrompt(nextTool.prompt);
              }
              setStatus("Siap membuat respons.");
              return;
            }
          }
        }
        setUserAllowedModes(["devotional"]);
        setCanExportPdf(false);
        setStatus("Paket tidak ditemukan. Mode gratis aktif.");
      } catch (err) {
        console.error("Gagal memuat batas paket:", err);
        setStatus("Gagal memuat status paket.");
      }
    });
  }, []);

  useEffect(() => {
    const requestedMode = searchParams.get("mode") as AiMode | null;
    if (requestedMode && tools.some((tool) => tool.mode === requestedMode)) {
      changeMode(requestedMode);
    }
  }, [searchParams]);

  function changeMode(nextMode: AiMode) {
    const nextTool = tools.find((tool) => tool.mode === nextMode) ?? tools[0];
    setMode(nextMode);
    setPrompt(nextTool.prompt);
    setAnswer("");
    setHistorySearch("");
    setHistoryPage(1);
    setExpandedHistoryId(null);
    setStatus(`Mode ${nextTool.label} siap.`);
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
      ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date)
      : "Tanggal belum tersedia";
  }

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Memproses...");
    setAnswer("");

    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, prompt }),
    });
    const data = (await response.json()) as {
      answer?: string;
      provider?: string;
      error?: string;
    };

    if (!response.ok) {
      setStatus(data.error ?? "Sistem gagal merespons.");
      return;
    }

    setAnswer(data.answer ?? "");
    setStatus(
      data.provider === "demo"
        ? "Mode demo aktif. Isi DEEPSEEK_API_KEY untuk jawaban live."
        : "Jawaban selesai.",
    );

    if (user && db && data.answer) {
      if (mode === "devotional") {
        try {
          const userRef = doc(db, "users", user.uid);
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
          userId: user.uid,
          mode: selected.label,
          prompt,
          answer: data.answer,
          createdAt: serverTimestamp()
        });
        setHistory([{
          id: newRef.id,
          mode: selected.label,
          prompt,
          answer: data.answer,
          createdAt: Timestamp.now()
        }, ...history]);
        await addDoc(collection(db, "users", user.uid, "activities"), {
          type: mode,
          title: selected.label,
          description: prompt.slice(0, 160),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Gagal menyimpan riwayat", err);
      }
    }
  }

  function handleShareCurrent() {
    shareToWhatsApp(`Grace Daily | ${selected.label}`, `*Topik:*\n_${prompt}_\n\n*Jawaban:*\n${answer}`);
  }

  function handlePrintCurrent() {
    printPdf(`Grace Daily | ${selected.label}`, `<p><strong>Topik:</strong> ${prompt}</p><br/>${answer}`);
  }

  return (
    <section>
      <div className="print:hidden">
        <div className="grid gap-6 md:grid-cols-[250px_1fr]">
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-semibold text-[#14213d]">Pilih Mode</h2>
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
                  <p className="text-sm font-semibold text-[#d97706] mb-1">Setia Bersaat Teduh</p>
                  <p className="text-3xl font-bold text-[#b45309]">🔥 {streak}</p>
                  <p className="text-xs text-[#92400e] mt-1">Hari Beruntun</p>
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
                  Sampaikan pergumulan atau topik Anda, dan temukan panduan rohani yang menyegarkan jiwa.
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
                  className="rounded-md bg-[#14213d] px-5 py-3 font-semibold text-white"
                >
                  Jalankan
                </button>
                {canExportPdf && (
                  <button
                    type="button"
                    onClick={handlePrintCurrent}
                    className="rounded-md border border-[#dfd8ca] px-5 py-3 font-semibold text-[#14213d]"
                  >
                    Cetak PDF
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
                    className="rounded-md bg-[#e9f5db] px-5 py-3 font-semibold text-[#284b3a] transition hover:bg-[#cde4b4]"
                  >
                    {playingId === "current" ? "⏹ Stop Audio" : "🎧 Dengarkan"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShareCurrent}
                  className="rounded-md bg-[#2a6f6f] px-5 py-3 font-semibold text-white"
                >
                  Share WhatsApp
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
                  {answer || "Hasil akan muncul di sini."}
                </ReactMarkdown>
              </div>
            </article>
          </div>
        </div>

        {user && (
          <div className="mt-8 rounded-lg border border-[#dfd8ca] bg-white p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-xl font-semibold text-[#14213d]">Jejak {selected.label} Anda</h2>
              <input
                type="search"
                value={historySearch}
                onChange={(event) => {
                  setHistorySearch(event.target.value);
                  setHistoryPage(1);
                  setExpandedHistoryId(null);
                }}
                className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm"
                placeholder="Cari riwayat..."
              />
            </div>
            <div className="mt-4 grid gap-3">
              {modeHistory.length === 0 ? (
                <p className="text-sm text-[#52606d]">Belum ada riwayat yang tercatat untuk {selected.label}. Panduan rohani yang Anda cari akan tersimpan rapi di sini.</p>
              ) : (
                paginatedHistory.map((h) => (
                  <article key={h.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedHistoryId((current) => current === h.id ? null : h.id)}
                      className="flex w-full flex-col justify-between gap-2 text-left sm:flex-row sm:items-center"
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
                              alert("Gagal menyimpan perubahan.");
                            } finally {
                              setIsSavingEdit(false);
                            }
                          }} className="grid gap-4">
                            <div className="grid gap-2">
                              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Topik / Prompt</label>
                              <textarea
                                value={editPromptValue}
                                onChange={(e) => setEditPromptValue(e.target.value)}
                                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none text-[#1f2933] bg-white"
                                rows={3}
                                required
                              />
                            </div>
                            <div className="grid gap-2 border-t border-[#dfd8ca] pt-3">
                              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Jawaban</label>
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
                                className="rounded-md bg-[#14213d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2d52] disabled:opacity-50"
                              >
                                {isSavingEdit ? "Menyimpan..." : "Simpan"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingHistoryId(null)}
                                className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#14213d] transition hover:bg-gray-50"
                              >
                                Batal
                              </button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-md bg-white p-4">
                          <div className="rounded-md bg-[#f7f4ee] p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Topik / Prompt</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#334155]">{h.prompt}</p>
                          </div>
                          <div className="mt-4 border-t border-[#dfd8ca] pt-4">
                            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Jawaban</p>
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
                              className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a]"
                            >
                              Share WA
                            </button>
                            <button 
                              onClick={() => printPdf(`Grace Daily | ${h.mode}`, `<p><strong>Topik:</strong> ${h.prompt}</p><br/>${h.answer}`)}
                              className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a]"
                            >
                              Cetak PDF
                            </button>
                            <button 
                              onClick={() => {
                                toggleAudio(h.answer, playingId === h.id, (isPlaying) => {
                                  setPlayingId(isPlaying ? h.id : null);
                                });
                              }}
                              className="text-sm font-semibold text-[#d97706] hover:text-[#b45309]"
                            >
                              {playingId === h.id ? "⏹ Stop Audio" : "🎧 Dengarkan"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingHistoryId(h.id);
                                setEditPromptValue(h.prompt || "");
                                setEditAnswerValue(h.answer || "");
                              }}
                              className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                            >
                              Edit
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
                              className="text-sm font-semibold text-red-600 hover:text-red-800"
                            >
                              Hapus
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
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
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
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
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
          <p className="font-semibold text-[#2a6f6f]">Topik / Input:</p>
          <p className="mt-2 whitespace-pre-wrap text-[#334155]">{prompt}</p>
        </div>
        <div>
          <p className="font-semibold text-[#2a6f6f]">Jawaban / Output:</p>
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
