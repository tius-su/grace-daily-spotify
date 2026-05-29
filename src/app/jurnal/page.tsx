"use client";

import Link from "next/link";
import { FormEvent, useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, Timestamp, deleteDoc, setDoc, doc } from "firebase/firestore";
import { shareToWhatsApp, printPdf } from "@/lib/share";

type JournalEntry = {
  id: string;
  title: string;
  mood: string;
  content: string;
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

              <div className="grid gap-3 h-fit">
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
                        onClick={() => printPdf(`Jurnal: ${entry.title}`, entry.content)}
                        className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a]"
                      >
                        Cetak PDF
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

