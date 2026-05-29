"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, query, getDocs, addDoc, serverTimestamp, Timestamp, getDoc, doc, deleteDoc, setDoc, where } from "firebase/firestore";
import { shareToWhatsApp, printPdf } from "@/lib/share";
import { toggleAudio } from "@/lib/audio";

type PastoralQuestion = {
  id: string;
  authorId: string;
  authorName: string;
  category: string;
  question: string;
  answer: string;
  createdAt?: Timestamp;
  isVerifiedByPastor?: boolean;
  pastorNotes?: string;
};

const categories = ["Curhat & Pergumulan", "Tanya Alkitab", "Keluarga & Pernikahan", "Pekerjaan & Karir", "Lainnya"];

export default function TanyaPendetaPage() {
  const [questions, setQuestions] = useState<PastoralQuestion[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("Jemaat");
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const [category, setCategory] = useState(categories[0]);
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      fetchQuestions(currentUser);
      if (currentUser) {
        setUserName(currentUser.displayName || "Jemaat");
        try {
          if (db) {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists() && userDoc.data().name) {
              setUserName(userDoc.data().name);
            }
          }
        } catch (e) {}
      }
    });
  }, []);

  async function fetchQuestions(currentUser: User | null) {
    if (!currentUser) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    try {
      if (!db) return;
      setLoading(true);
      // Query ONLY questions created by this user
      const q = query(collection(db, "pastoral_questions"), where("authorId", "==", currentUser.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PastoralQuestion));
      
      // Sort in memory by createdAt descending to bypass composite index requirements
      data.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      
      setQuestions(data);
    } catch (err) {
      console.error("Gagal memuat riwayat tanya pendeta", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !db || !question.trim() || isSubmitting) return;

    if (question.length > 2000) {
      setError("Pertanyaan terlalu panjang (maksimal 2000 karakter).");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "pastor", prompt: `Konteks: ${category}. Pertanyaan/Curhat: ${question}` }),
      });
      const data = await response.json();

      if (!response.ok || !data.answer) {
        throw new Error(data.error || "Gagal mendapatkan jawaban AI.");
      }

      if (editingQuestionId) {
        await setDoc(doc(db, "pastoral_questions", editingQuestionId), {
          category,
          question,
          answer: data.answer,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        setQuestions(questions.map((item) => 
          item.id === editingQuestionId 
            ? { ...item, category, question, answer: data.answer } 
            : item
        ));
        setEditingQuestionId(null);
        setQuestion("");
      } else {
        const docRef = await addDoc(collection(db, "pastoral_questions"), {
          authorId: user.uid,
          authorName: userName,
          category,
          question,
          answer: data.answer,
          createdAt: serverTimestamp()
        });
        await addDoc(collection(db, "ai_requests"), {
          userId: user.uid,
          mode: "Tanya pendeta",
          prompt: `Kategori: ${category}. Pertanyaan: ${question}`,
          answer: data.answer,
          createdAt: serverTimestamp()
        });
        await addDoc(collection(db, "users", user.uid, "activities"), {
          type: "pastor",
          title: `Tanya Pendeta: ${category}`,
          description: question.slice(0, 160),
          createdAt: serverTimestamp(),
        });

        setQuestions([{
          id: docRef.id,
          authorId: user.uid,
          authorName: userName,
          category,
          question,
          answer: data.answer,
          createdAt: Timestamp.now()
        }, ...questions]);

        setQuestion("");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sistem saat meminta AI. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(q: PastoralQuestion) {
    setEditingQuestionId(q.id);
    setCategory(q.category);
    setQuestion(q.question);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingQuestionId(null);
    setQuestion("");
    setCategory(categories[0]);
    setError("");
  }

  async function handleDelete(id: string) {
    if (!db || !window.confirm("Apakah Anda yakin ingin menghapus pertanyaan ini?")) return;
    try {
      await deleteDoc(doc(db, "pastoral_questions", id));
      setQuestions((prev) => prev.filter((item) => item.id !== id));
      if (editingQuestionId === id) {
        handleCancelEdit();
      }
    } catch (e) {
      alert("Gagal menghapus pertanyaan.");
    }
  }

  const displayedQuestions = questions;

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Forum Publik Terbuka
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Tanya Pendeta
            </h1>
            <p className="mt-2 max-w-2xl text-[#52606d]">
              Ruang aman untuk membagikan pergumulan, menanyakan firman, atau bahan diskusi komsel. Pertanyaan Anda akan dijawab secara instan oleh kecerdasan buatan berbasis pastoral alkitabiah.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white transition hover:bg-[#1a2d52]"
          >
            Kembali ke Beranda
          </Link>
        </header>

        <section className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.5fr] items-start">
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-6 sticky top-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#14213d]">
              {editingQuestionId ? "Ubah Pertanyaan" : "Kirim Pertanyaan"}
            </h2>
            {!user ? (
              <div className="mt-4 rounded-md bg-[#f7f4ee] p-5 text-center">
                <p className="text-[#52606d] mb-4">Anda harus masuk (login) untuk dapat bertanya di forum publik ini.</p>
                <Link href="/login" className="rounded-md bg-[#2a6f6f] px-5 py-2 font-semibold text-white">Login Sekarang</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
                {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
                
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-[#14213d]">Kategori Topik</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f] bg-white text-[#1f2933]"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-[#14213d]">Pertanyaan atau Curhatan Anda</label>
                  <textarea 
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="min-h-32 rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f] bg-white text-[#1f2933]"
                    placeholder="Contoh: Saya sedang kesulitan mencari kerja dan merasa Tuhan jauh..."
                    required
                  />
                  <p className="text-xs text-[#52606d] text-right">{question.length}/2000 karakter</p>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="submit"
                    disabled={isSubmitting || !question.trim()}
                    className="flex-1 rounded-md bg-[#14213d] px-5 py-3 font-semibold text-white transition hover:bg-[#1a2d52] disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Mencari Jawaban Pastoral...
                      </>
                    ) : editingQuestionId ? "Simpan Perubahan" : "Tanyakan Sekarang"}
                  </button>
                  {editingQuestionId && (
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
            )}
          </div>

          <div className="grid gap-4">
            <div className="border-b border-[#dfd8ca] pb-3 mb-2 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#14213d]">Riwayat Konsultasi Anda</h2>
              {user && (
                <span className="rounded-full bg-[#e9f5db] px-3 py-1 text-xs font-semibold text-[#2a6f6f]">
                  {displayedQuestions.length} Pertanyaan
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-center text-[#52606d] py-6">Memuat riwayat bimbingan...</p>
            ) : !user ? (
              <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 text-center shadow-sm">
                <p className="text-[#52606d]">Silakan masuk (login) terlebih dahulu untuk melihat riwayat bimbingan Anda.</p>
              </div>
            ) : displayedQuestions.length === 0 ? (
              <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 text-center shadow-sm">
                <p className="text-[#52606d]">Anda belum memiliki riwayat pertanyaan. Silakan kirim pertanyaan baru di panel sebelah kiri.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {displayedQuestions.map((q) => {
                  const isExpanded = !!expandedIds[q.id];
                  const dateStr = q.createdAt?.toDate 
                    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(q.createdAt.toDate())
                    : "Baru saja";
                  
                  return (
                    <article 
                      key={q.id} 
                      className="overflow-hidden rounded-lg border border-[#dfd8ca] bg-white shadow-sm transition hover:shadow-md"
                    >
                      {/* Accordion Header Row */}
                      <button
                        onClick={() => setExpandedIds(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50/50"
                      >
                        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 overflow-hidden">
                          <span className="text-xs text-[#52606d] font-semibold shrink-0">{dateStr}</span>
                          <span className="inline-block shrink-0 rounded bg-[#e9f5db] px-2 py-0.5 text-xs font-semibold text-[#2a6f6f] w-fit">
                            {q.category}
                          </span>
                          <p className="font-medium text-[#1f2933] text-sm truncate max-w-md sm:max-w-lg md:max-w-xl">
                            {q.question}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-xs font-semibold text-[#2e7d32]">
                            Terjawab
                          </span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`w-4 h-4 text-[#52606d] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </button>

                      {/* Accordion Body Content */}
                      {isExpanded && (
                        <div className="border-t border-[#dfd8ca]/60 bg-[#fbfaf8] px-5 py-5 flex flex-col gap-4">
                          {/* Full Question Panel */}
                          <div className="rounded-md bg-[#f7f4ee] p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#2a6f6f] mb-1">Pertanyaan Anda:</p>
                            <p className="text-sm leading-6 text-[#1f2933] whitespace-pre-wrap break-words">{q.question}</p>
                          </div>

                          {/* AI Answer Panel */}
                          <div className="rounded-md border border-[#e9f5db] bg-white p-4 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#2a6f6f] mb-2">Jawaban Pastoral (AI):</p>
                            <div className="prose prose-sm max-w-none leading-relaxed text-[#334155]">
                              <ReactMarkdown
                                components={{
                                  h1: ({ ...props }) => <strong {...props} className="block mt-2 text-base text-[#14213d]" />,
                                  h2: ({ ...props }) => <strong {...props} className="block mt-2 text-sm text-[#14213d]" />,
                                  h3: ({ ...props }) => <strong {...props} className="block mt-2 text-sm text-[#14213d]" />,
                                }}
                              >
                                {q.answer}
                              </ReactMarkdown>
                            </div>
                          </div>

                          {/* Pastor notes if verified */}
                          {q.isVerifiedByPastor && (
                            <div className="rounded-md border border-[#2a6f6f] bg-[#e9f5db] p-4 shadow-sm">
                              <p className="text-xs font-bold uppercase tracking-wider text-[#284b3a] mb-1">Catatan Verifikasi Pendeta:</p>
                              <p className="text-sm leading-6 text-[#284b3a] whitespace-pre-wrap">
                                {q.pastorNotes || "Pertanyaan ini telah didoakan & dibaca secara khusus oleh tim penggembalaan."}
                              </p>
                            </div>
                          )}

                          {/* Action Controls */}
                          <div className="flex flex-wrap gap-4 border-t border-[#dfd8ca]/60 pt-4 mt-1 items-center">
                            <button
                              onClick={() => shareToWhatsApp(`Tanya Pendeta: ${q.category}`, `*Tanya:*\n${q.question}\n\n*Jawab:*\n${q.answer}`)}
                              className="text-xs font-semibold text-[#2a6f6f] hover:underline"
                            >
                              Share WA
                            </button>
                            <button
                              onClick={() => printPdf(`Tanya Pendeta: ${q.category}`, `<p><strong>Tanya:</strong> ${q.question}</p><br/><strong>Jawab:</strong><br/>${q.answer}`)}
                              className="text-xs font-semibold text-[#2a6f6f] hover:underline"
                            >
                              Cetak PDF
                            </button>
                            <button
                              onClick={() => {
                                toggleAudio(q.answer, playingId === q.id, (isPlaying) => {
                                  setPlayingId(isPlaying ? q.id : null);
                                });
                              }}
                              className="text-xs font-semibold text-[#d97706] hover:underline"
                            >
                              {playingId === q.id ? "⏹ Stop Audio" : "🎧 Dengarkan"}
                            </button>

                            <div className="ml-auto flex gap-2">
                              <button
                                onClick={() => handleEdit(q)}
                                className="rounded border border-[#dfd8ca] bg-white px-2.5 py-1 text-xs font-semibold text-[#14213d] hover:bg-gray-50 transition"
                              >
                                Ubah
                              </button>
                              <button
                                onClick={() => handleDelete(q.id)}
                                className="rounded bg-red-50 text-red-600 px-2.5 py-1 text-xs font-semibold hover:bg-red-100 transition"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
