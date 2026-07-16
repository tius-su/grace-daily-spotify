"use client";

import Link from "next/link";
import { FormEvent, useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, Timestamp, deleteDoc, setDoc, doc } from "firebase/firestore";
import { shareToWhatsApp, downloadPdf } from "@/lib/share";
import { toggleAudio } from "@/lib/audio";

type JournalEntry = {
  id: string;
  title: string;
  mood: string;
  content: string;
  sharePageUrl?: string;
  createdAt?: Timestamp | null;
};

const moodOptions = ["Tenang", "Bersyukur", "Cemas", "Lelah", "Berharap"];

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState("Tenang");
  const [content, setContent] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState("Semua");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [playingEntryId, setPlayingEntryId] = useState<string | null>(null);

  const [insightLoading, setInsightLoading] = useState(false);
  const [insightContent, setInsightContent] = useState("");
  const [insightError, setInsightError] = useState("");

  const moodStats = useMemo(() => {
    const last7 = entries.slice(0, 7);
    const counts: Record<string, number> = { Tenang: 0, Bersyukur: 0, Cemas: 0, Lelah: 0, Berharap: 0 };
    last7.forEach(e => {
      if (counts[e.mood] !== undefined) {
        counts[e.mood]++;
      }
    });
    const total = last7.length || 1;
    return Object.keys(counts).map(m => ({
      name: m,
      count: counts[m],
      percentage: Math.round((counts[m] / total) * 100),
    }));
  }, [entries]);

  async function handleGetAiInsights() {
    if (entries.length === 0) {
      alert("Silakan tulis minimal satu entri jurnal untuk dianalisis.");
      return;
    }
    setInsightLoading(true);
    setInsightContent("");
    setInsightError("");

    try {
      const token = await user?.getIdToken().catch(() => null);
      if (!token) {
        setInsightError("Silakan login terlebih dahulu.");
        setInsightLoading(false);
        return;
      }

      const journalContext = entries.slice(0, 7).map((e, idx) => 
        `Entri ${idx + 1} (Mood: ${e.mood}):\nJudul: ${e.title}\nIsi: ${e.content}`
      ).join("\n\n---\n\n");

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: "journal-insights",
          prompt: journalContext,
        }),
      });

      const data = await response.json();
      if (response.ok && data.answer) {
        setInsightContent(data.answer);
      } else {
        setInsightError("server sibuk");
      }
    } catch (e) {
      setInsightError("server sibuk");
    } finally {
      setInsightLoading(false);
    }
  }

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && db) {
        try {
          const q = query(collection(db, "users", currentUser.uid, "journals"), orderBy("createdAt", "desc"));
          const snapshot = await getDocs(q);
          const loadedEntries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as JournalEntry[];
          setEntries(loadedEntries);
        } catch (error) {
          console.error("Gagal memuat jurnal:", error);
        }
      }
      setIsLoading(false);
    });
  }, []);

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !db || !title.trim() || !content.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEntryId) {
        await setDoc(doc(db, "users", user.uid, "journals", editingEntryId), {
          title,
          mood,
          content,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        setEntries(entries.map(e => e.id === editingEntryId ? { ...e, title, mood, content } : e));
        setEditingEntryId(null);
        setTitle("");
        setContent("");
        setMood("Tenang");
      } else {
        const docRef = await addDoc(collection(db, "users", user.uid, "journals"), {
          title,
          mood,
          content,
          createdAt: serverTimestamp(),
        });
        await addDoc(collection(db, "users", user.uid, "activities"), {
          type: "journal",
          title,
          description: content.slice(0, 160),
          createdAt: serverTimestamp(),
        });
        
        setEntries([{ id: docRef.id, title, mood, content, createdAt: null }, ...entries]);
        setTitle("");
        setContent("");
        setMood("Tenang");
      }
    } catch (error) {
      console.error("Gagal menyimpan jurnal:", error);
      alert("Gagal menyimpan jurnal. Pastikan judul maksimal 100 karakter dan isi 3000 karakter.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(entry: JournalEntry) {
    setEditingEntryId(entry.id);
    setTitle(entry.title);
    setMood(entry.mood);
    setContent(entry.content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingEntryId(null);
    setTitle("");
    setContent("");
    setMood("Tenang");
  }

  async function handleDelete(id: string) {
    if (!user || !db || !window.confirm("Apakah Anda yakin ingin menghapus jurnal ini?")) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "journals", id));
      setEntries(entries.filter(e => e.id !== id));
      if (editingEntryId === id) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error("Gagal menghapus jurnal:", error);
      alert("Gagal menghapus jurnal.");
    }
  }

  async function ensureJournalPage(entry: JournalEntry) {
    if (entry.sharePageUrl) {
      window.open(entry.sharePageUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (!user || !db) {
      alert("Silakan login untuk membuat halaman jurnal.");
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
          type: "Jurnal Spiritual",
          title: `Jurnal: ${entry.title}`,
          subtitle: `Mood: ${entry.mood}`,
          content: entry.content,
          sourceId: entry.id,
        }),
      });
      const pageData = await pageResponse.json();
      if (!pageResponse.ok || !pageData.url) {
        throw new Error(pageData.error || "Gagal membuat halaman jurnal.");
      }

      await setDoc(doc(db, "users", user.uid, "journals", entry.id), { sharePageUrl: pageData.url }, { merge: true });
      setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, sharePageUrl: pageData.url } : item));
      window.open(pageData.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      alert(err.message || "Gagal membuat halaman jurnal.");
    }
  }

  const displayedEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMood = moodFilter === "Semua" || entry.mood === moodFilter;
    return matchesSearch && matchesMood;
  });

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Jurnal Spiritual
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Catat doa, syukur, pergumulan, dan pertumbuhan iman.
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white"
          >
            Kembali
          </Link>
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.9fr_1.1fr]">
          {isLoading ? (
            <div className="col-span-full rounded-lg border border-[#dfd8ca] bg-white p-5 text-center">
              Memuat data...
            </div>
          ) : !user ? (
            <div className="col-span-full rounded-lg border border-[#dfd8ca] bg-white p-8 text-center">
              <h2 className="text-xl font-semibold text-[#14213d]">Anda belum login</h2>
              <p className="mt-3 text-[#52606d]">Silakan login terlebih dahulu untuk mulai menulis dan menyimpan jurnal spiritual Anda secara privat.</p>
              <Link href="/login" className="mt-5 inline-block rounded-md bg-[#14213d] px-5 py-3 font-semibold text-white">Login Sekarang</Link>
            </div>
          ) : (
            <>
              <form
                onSubmit={handleFormSubmit}
                className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit sticky top-6 shadow-sm"
              >
                <h2 className="text-xl font-semibold text-[#14213d]">
                  {editingEntryId ? "Ubah Jurnal" : "Tulis jurnal"}
                </h2>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
                  placeholder="Judul jurnal"
                  maxLength={100}
                  required
                />
                <select
                  value={mood}
                  onChange={(event) => setMood(event.target.value)}
                  className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
                >
                  {moodOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="min-h-40 rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
                  placeholder="Apa yang kamu rasakan di hadapan Tuhan hari ini?"
                  maxLength={3000}
                  required
                />
                <div className="flex gap-3">
                  <button disabled={isSubmitting} className="flex-1 rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white disabled:opacity-50 transition">
                    {isSubmitting ? "Menyimpan..." : editingEntryId ? "Simpan Perubahan" : "Simpan jurnal"}
                  </button>
                  {editingEntryId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="rounded-md border border-[#dfd8ca] px-4 py-3 font-semibold text-[#14213d] transition hover:bg-gray-50"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>

              <div className="grid gap-4 h-fit">
                {/* Jurnal Insights & Mood Analytics Panel */}
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm space-y-5">
                  <div className="border-b border-[#dfd8ca] pb-3">
                    <h3 className="text-lg font-semibold text-[#14213d] flex items-center gap-2">
                      📊 Insights & Mood Analytics
                    </h3>
                    <p className="text-xs text-[#52606d] mt-1">Analisis suasana hati dan perkembangan spiritual berdasarkan 7 entri jurnal terakhir.</p>
                  </div>

                  {/* Mood Stats bars */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#2a6f6f]">Sebaran Suasana Hati (Mood)</h4>
                    {entries.length === 0 ? (
                      <p className="text-xs text-[#52606d] italic">Belum ada jurnal untuk dianalisis.</p>
                    ) : (
                      <div className="grid gap-2">
                        {moodStats.map((stat) => (
                          <div key={stat.name} className="flex items-center justify-between text-sm gap-4">
                            <span className="w-20 font-medium text-xs text-[#1f2933]">{stat.name}</span>
                            <div className="flex-1 bg-[#dfd8ca]/40 rounded-full h-2 relative">
                              <div className="bg-[#2a6f6f] h-2 rounded-full transition-all duration-300" style={{ width: `${stat.percentage}%` }}></div>
                            </div>
                            <span className="w-10 text-right text-xs font-semibold text-[#52606d]">{stat.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI Refleksi Button & Container */}
                  <div className="pt-2 border-t border-[#dfd8ca]/60">
                    <button
                      type="button"
                      onClick={handleGetAiInsights}
                      disabled={insightLoading || entries.length === 0}
                      className="w-full rounded-md bg-[#d97706] hover:bg-[#b45309] text-white py-2 px-4 text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {insightLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span>Menganalisis Jurnal Anda...</span>
                        </>
                      ) : (
                        <>
                          <span>🌟 Dapatkan Analisis Rohani AI</span>
                        </>
                      )}
                    </button>

                    {/* AI Output Result */}
                    {insightContent && (
                      <div className="mt-4 p-4 rounded-lg bg-[#f7f4ee] border border-[#dfd8ca] animate-in fade-in duration-300">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#d97706]">Hasil Refleksi Rohani AI</span>
                          <button
                            onClick={() => setInsightContent("")}
                            className="text-xs text-[#52606d] hover:text-[#1f2933] cursor-pointer bg-transparent border-none outline-none"
                          >
                            Tutup
                          </button>
                        </div>
                        <div className="prose prose-sm max-w-none text-[#52606d] leading-relaxed text-xs">
                          <ReactMarkdown
                            components={{
                              h1: ({ ...props }) => <strong {...props} className="block mt-2 text-sm text-[#14213d]" />,
                              h2: ({ ...props }) => <strong {...props} className="block mt-2 text-xs text-[#14213d]" />,
                              h3: ({ ...props }) => <strong {...props} className="block mt-2 text-xs text-[#14213d]" />,
                            }}
                          >
                            {insightContent}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {insightError && (
                      <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold text-center">
                        {insightError}
                      </div>
                    )}
                  </div>
                </div>

                {/* Search & Filter Section */}
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-4 shadow-sm flex flex-col sm:flex-row gap-3">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari riwayat jurnal..."
                    className="flex-1 rounded-md border border-[#dfd8ca] px-3 py-2 text-sm bg-white text-[#1f2933]"
                  />
                  <select
                    value={moodFilter}
                    onChange={(e) => setMoodFilter(e.target.value)}
                    className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm bg-white text-[#1f2933]"
                  >
                    <option value="Semua">Semua Mood</option>
                    {moodOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>

                {displayedEntries.length === 0 && (
                  <div className="rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-5 text-center text-sm text-[#52606d]">
                    {entries.length === 0 
                      ? "Belum ada jurnal yang tersimpan." 
                      : "Tidak ada riwayat jurnal yang cocok dengan kriteria pencarian."}
                  </div>
                )}
                {displayedEntries.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <h2 className="text-xl font-semibold text-[#14213d]">
                        {entry.title}
                      </h2>
                      <span className="rounded-md bg-[#e9f5db] px-3 py-1 text-sm font-semibold text-[#284b3a] shrink-0 w-fit">
                        {entry.mood}
                      </span>
                    </div>
                    <p className="mt-3 leading-7 text-[#52606d] whitespace-pre-wrap break-words">{entry.content}</p>
                    <div className="mt-4 flex gap-4 border-t border-[#dfd8ca] pt-4">
                      <button
                        onClick={() => shareToWhatsApp(`Jurnal: ${entry.title}`, entry.content)}
                        className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a]"
                      >
                        Share WA
                      </button>
                      <button
                        onClick={() => ensureJournalPage(entry)}
                        className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a]"
                      >
                        Buka Halaman
                      </button>
                      <button
                        onClick={() => downloadPdf(`Jurnal: ${entry.title}`, entry.content)}
                        className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a]"
                      >
                        Cetak PDF
                      </button>
                      <button
                        onClick={() => {
                          toggleAudio(entry.content, playingEntryId === entry.id, (isPlaying) => {
                            setPlayingEntryId(isPlaying ? entry.id : null);
                          });
                        }}
                        className="text-sm font-semibold text-[#d97706] hover:text-[#b45309]"
                      >
                        {playingEntryId === entry.id ? "Stop Audio" : "Dengarkan"}
                      </button>
                      
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="rounded-md border border-[#dfd8ca] px-3 py-1 text-xs font-semibold text-[#14213d] hover:bg-gray-50 transition"
                        >
                          Ubah
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="rounded-md bg-red-50 text-red-600 px-3 py-1 text-xs font-semibold hover:bg-red-100 transition"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
