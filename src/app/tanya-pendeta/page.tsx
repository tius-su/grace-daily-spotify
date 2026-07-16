"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { auth, db, getOrCreateGuestId } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, query, getDocs, addDoc, serverTimestamp, Timestamp, getDoc, doc, deleteDoc, setDoc, where } from "firebase/firestore";
import { shareToWhatsApp, downloadPdf } from "@/lib/share";
import { toggleAudio } from "@/lib/audio";
import { useLanguage } from "@/lib/i18n";

type PastoralQuestion = {
  id: string;
  authorId: string;
  authorName: string;
  category: string;
  question: string;
  answer: string;
  sharePageUrl?: string;
  createdAt?: Timestamp;
  isVerifiedByPastor?: boolean;
  pastorNotes?: string;
};

const categories = ["Curhat & Pergumulan", "Tanya Alkitab", "Keluarga & Pernikahan", "Pekerjaan & Karir", "Lainnya"];

export default function TanyaPendetaPage() {
  const { language, t } = useLanguage();
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
      } else {
        setUserName("Jemaat (Tamu)");
      }
    });
  }, []);

  async function fetchQuestions(currentUser: User | null) {
    const activeUserId = currentUser ? currentUser.uid : getOrCreateGuestId();
    if (!activeUserId) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    try {
      if (!db) return;
      setLoading(true);
      // Query questions created by this user or guest
      const q = query(collection(db, "pastoral_questions"), where("authorId", "==", activeUserId));
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
    const activeUserId = user ? user.uid : getOrCreateGuestId();
    if (!activeUserId || !db || !question.trim() || isSubmitting) return;

    if (question.length > 2000) {
      setError(
        language === "zh" ? "提问内容过长（最多2000字）。" :
        language === "en" ? "Question is too long (max 2000 characters)." :
        "Pertanyaan terlalu panjang (maksimal 2000 karakter)."
      );
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const token = user ? await user.getIdToken().catch(() => null) : null;
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          mode: "pastor", 
          prompt: `Konteks: ${category}. Pertanyaan/Curhat: ${question}`, 
          language,
          guestId: token ? undefined : activeUserId
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.answer) {
        throw new Error(data.error || "server sibuk");
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
        let docId = `temp_${Date.now()}`;
        try {
          const docRef = await addDoc(collection(db, "pastoral_questions"), {
            authorId: activeUserId,
            authorName: userName,
            category,
            question,
            answer: data.answer,
            createdAt: serverTimestamp()
          });
          docId = docRef.id;
        } catch (dbErr) {
          console.error("Gagal menyimpan bimbingan ke pastoral_questions:", dbErr);
        }

        let sharePageUrl = "";
        try {
          const pageResponse = await fetch("/api/share-page", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              type: "Tanya Pendeta",
              title: `Tanya Pendeta: ${category}`,
              subtitle: "Jawaban pastoral Grace Daily",
              prompt: question,
              content: data.answer,
              sourceId: docId,
            }),
          });
          const pageData = await pageResponse.json().catch(() => ({}));
          if (pageResponse.ok && pageData.url) {
            sharePageUrl = pageData.url;
            if (!docId.startsWith("temp_")) {
              await setDoc(doc(db, "pastoral_questions", docId), { sharePageUrl }, { merge: true }).catch(() => null);
            }
          }
        } catch (pageError) {
          console.error("Gagal membuat halaman Tanya Pendeta", pageError);
        }

        try {
          await addDoc(collection(db, "ai_requests"), {
            userId: activeUserId,
            mode: "Tanya pendeta",
            prompt: `Kategori: ${category}. Pertanyaan: ${question}`,
            answer: data.answer,
            sharePageUrl,
            createdAt: serverTimestamp()
          });
        } catch (dbErr) {
          console.error("Gagal menyimpan ke ai_requests:", dbErr);
        }

        if (user) {
          try {
            await addDoc(collection(db, "users", user.uid, "activities"), {
              type: "pastor",
              title: `Tanya Pendeta: ${category}`,
              description: question.slice(0, 160),
              createdAt: serverTimestamp(),
            });
          } catch (dbErr) {
            console.error("Gagal menyimpan ke activities:", dbErr);
          }
        }

        setQuestions([{
          id: docId,
          authorId: activeUserId,
          authorName: userName,
          category,
          question,
          answer: data.answer,
          sharePageUrl,
          createdAt: Timestamp.now()
        }, ...questions]);

        setQuestion("");
      }
    } catch (err: any) {
      setError("server sibuk");
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
    const confirmMsg =
      language === "zh" ? "确定要删除这个问题吗？" :
      language === "en" ? "Are you sure you want to delete this question?" :
      "Apakah Anda yakin ingin menghapus pertanyaan ini?";
    if (!db || !window.confirm(confirmMsg)) return;
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

  async function ensureQuestionPage(q: PastoralQuestion) {
    if (q.sharePageUrl) {
      window.open(q.sharePageUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (!user || !db) {
      alert("Silakan login untuk membuat halaman hasil.");
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
          type: "Tanya Pendeta",
          title: `Tanya Pendeta: ${q.category}`,
          subtitle: "Jawaban pastoral Grace Daily",
          prompt: q.question,
          content: q.answer,
          sourceId: q.id,
        }),
      });
      const pageData = await pageResponse.json();
      if (!pageResponse.ok || !pageData.url) {
        throw new Error(pageData.error || "Gagal membuat halaman.");
      }
      await setDoc(doc(db, "pastoral_questions", q.id), { sharePageUrl: pageData.url }, { merge: true });
      setQuestions((prev) => prev.map((item) => item.id === q.id ? { ...item, sharePageUrl: pageData.url } : item));
      window.open(pageData.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      alert(err.message || "Gagal membuat halaman hasil.");
    }
  }

  const displayedQuestions = questions;

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              {language === "zh" ? "公开咨询论坛" : language === "en" ? "Open Public Forum" : "Forum Publik Terbuka"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              {t("pastor.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-[#52606d]">
              {t("pastor.subtitle")}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white transition hover:bg-[#1a2d52]"
          >
            {language === "zh" ? "返回首页" : language === "en" ? "Back to Home" : "Kembali ke Beranda"}
          </Link>
        </header>
 
        <section className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.5fr] items-start">
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-6 sticky top-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#14213d]">
              {editingQuestionId ? t("pastor.edit_question") : t("pastor.send_question")}
            </h2>
            <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-[#14213d]">{t("pastor.category_label")}</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f] bg-white text-[#1f2933]"
                >
                  {categories.map(c => {
                    let displayCat = c;
                    if (language === "en") {
                      if (c === "Curhat & Pergumulan") displayCat = "Personal Struggle";
                      if (c === "Tanya Alkitab") displayCat = "Bible Question";
                      if (c === "Keluarga & Pernikahan") displayCat = "Family & Marriage";
                      if (c === "Pekerjaan & Karir") displayCat = "Career & Job";
                      if (c === "Lainnya") displayCat = "Others";
                    } else if (language === "zh") {
                      if (c === "Curhat & Pergumulan") displayCat = "个人挣扎与心声";
                      if (c === "Tanya Alkitab") displayCat = "圣经疑问解答";
                      if (c === "Keluarga & Pernikahan") displayCat = "家庭与婚姻关系";
                      if (c === "Pekerjaan & Karir") displayCat = "工作与职业发展";
                      if (c === "Lainnya") displayCat = "其他主题";
                    }
                    return <option key={c} value={c}>{displayCat}</option>;
                  })}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-semibold text-[#14213d]">{t("pastor.question_label")}</label>
                <textarea 
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="min-h-32 rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f] bg-white text-[#1f2933]"
                  placeholder={t("pastor.placeholder")}
                  required
                />
                <p className="text-xs text-[#52606d] text-right">{question.length}/2000 {language === "zh" ? "字" : language === "en" ? "characters" : "karakter"}</p>
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
                      {language === "zh" ? "正在寻求牧师解答..." : language === "en" ? "Seeking Pastoral Answer..." : "Mencari Jawaban Pastoral..."}
                    </>
                  ) : editingQuestionId ? (language === "zh" ? "保存更改" : language === "en" ? "Save Changes" : "Simpan Perubahan") : (language === "zh" ? "立即提问" : language === "en" ? "Ask Now" : "Tanyakan Sekarang")}
                </button>
                {editingQuestionId && (
                  <button 
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-md border border-[#dfd8ca] px-4 py-3 font-semibold text-[#14213d] transition hover:bg-gray-50"
                  >
                    {language === "zh" ? "取消" : language === "en" ? "Cancel" : "Batal"}
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="grid gap-4">
            <div className="border-b border-[#dfd8ca] pb-3 mb-2 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#14213d]">{t("pastor.history")}</h2>
              <span className="rounded-full bg-[#e9f5db] px-3 py-1 text-xs font-semibold text-[#2a6f6f]">
                {displayedQuestions.length} {language === "zh" ? "个提问" : language === "en" ? "Questions" : "Pertanyaan"}
              </span>
            </div>

            {loading ? (
              <p className="text-center text-[#52606d] py-6">{language === "zh" ? "正在加载咨询历史..." : language === "en" ? "Loading consultation history..." : "Memuat riwayat bimbingan..."}</p>
            ) : displayedQuestions.length === 0 ? (
              <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 text-center shadow-sm">
                <p className="text-[#52606d]">{language === "zh" ? "您还没有提问历史。请在左侧面板发送新提问。" : language === "en" ? "You don't have any question history. Please submit a new question on the left panel." : "Anda belum memiliki riwayat pertanyaan. Silakan kirim pertanyaan baru di panel sebelah kiri."}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {displayedQuestions.map((q) => {
                  const isExpanded = !!expandedIds[q.id];
                  const dateStr = q.createdAt?.toDate 
                    ? new Intl.DateTimeFormat(
                        language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID",
                        { dateStyle: "medium" }
                      ).format(q.createdAt.toDate())
                    : (language === "zh" ? "刚刚" : language === "en" ? "Just now" : "Baru saja");
                  
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
                            {language === "zh" ? "已回答" : language === "en" ? "Answered" : "Terjawab"}
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
                             <p className="text-xs font-bold uppercase tracking-wider text-[#2a6f6f] mb-1">
                               {language === "zh" ? "您的提问:"
                               : language === "en" ? "Your Question:"
                               : "Pertanyaan Anda:"}
                             </p>
                            <p className="text-sm leading-6 text-[#1f2933] whitespace-pre-wrap break-words">{q.question}</p>
                          </div>

                          {/* AI Answer Panel */}
                          <div className="rounded-md border border-[#e9f5db] bg-white p-4 shadow-sm">
                             <p className="text-xs font-bold uppercase tracking-wider text-[#2a6f6f] mb-2">
                               {language === "zh" ? "牧师答复 (AI):"
                               : language === "en" ? "Pastoral Answer (AI):"
                               : "Jawaban Pastoral (AI):"}
                             </p>
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
                               <p className="text-xs font-bold uppercase tracking-wider text-[#284b3a] mb-1">
                                 {language === "zh" ? "牧师审阅备注:"
                                 : language === "en" ? "Pastor Verification Notes:"
                                 : "Catatan Verifikasi Pendeta:"}
                               </p>
                               <p className="text-sm leading-6 text-[#284b3a] whitespace-pre-wrap">
                                 {q.pastorNotes || (
                                   language === "zh" ? "这个问题已由牧成呢主团队特别祝福和阅读。"
                                   : language === "en" ? "This question has been prayed over & personally read by the pastoral team."
                                   : "Pertanyaan ini telah didoakan & dibaca secara khusus oleh tim penggembalaan."
                                 )}
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
                               onClick={() => ensureQuestionPage(q)}
                               className="text-xs font-semibold text-[#2a6f6f] hover:underline"
                             >
                               {language === "zh" ? "查看页面" : language === "en" ? "Open Page" : "Buka Halaman"}
                             </button>
                             <button
                               onClick={() => downloadPdf(`Tanya Pendeta: ${q.category}`, `<p><strong>Tanya:</strong> ${q.question}</p><br/><strong>Jawab:</strong><br/>${q.answer}`)}
                               className="text-xs font-semibold text-[#2a6f6f] hover:underline"
                             >
                               {language === "zh" ? "打印PDF" : language === "en" ? "Print PDF" : "Cetak PDF"}
                             </button>
                             <button
                               onClick={() => {
                                 toggleAudio(q.answer, playingId === q.id, (isPlaying) => {
                                   setPlayingId(isPlaying ? q.id : null);
                                 });
                               }}
                               className="text-xs font-semibold text-[#d97706] hover:underline"
                             >
                               {playingId === q.id
                                 ? (language === "zh" ? "⏹ 停止" : language === "en" ? "⏹ Stop Audio" : "⏹ Stop Audio")
                                 : (language === "zh" ? "🎧 收听" : language === "en" ? "🎧 Listen" : "🎧 Dengarkan")}
                             </button>

                            <div className="ml-auto flex gap-2">
                              <button
                                onClick={() => handleEdit(q)}
                                className="rounded border border-[#dfd8ca] bg-white px-2.5 py-1 text-xs font-semibold text-[#14213d] hover:bg-gray-50 transition"
                              >
                                {language === "zh" ? "编辑" : language === "en" ? "Edit" : "Ubah"}
                              </button>
                              <button
                                onClick={() => handleDelete(q.id)}
                                className="rounded bg-red-50 text-red-600 px-2.5 py-1 text-xs font-semibold hover:bg-red-100 transition"
                              >
                                {language === "zh" ? "删除" : language === "en" ? "Delete" : "Hapus"}
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
