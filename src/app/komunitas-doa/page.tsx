"use client";

import Link from "next/link";
import { FormEvent, useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, Timestamp, deleteDoc, setDoc, doc } from "firebase/firestore";
import { shareToWhatsApp, printPdf } from "@/lib/share";

type PrayerRequest = {
  id: string;
  name: string;
  category: string;
  content: string;
  createdAt?: Timestamp | null;
  prayed?: boolean;
  authorId?: string;
};

export default function PrayerCommunityPage() {
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [name, setName] = useState("Anonim");
  const [category, setCategory] = useState("Doa pribadi");
  const [content, setContent] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequests() {
      if (!db) return;
      try {
        const q = query(collection(db, "prayer_rooms", "global", "requests"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const loaded = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          prayed: false
        })) as PrayerRequest[];
        setRequests(loaded);
      } catch (error) {
        console.error("Gagal memuat doa:", error);
      }
    }
    
    loadRequests();

    if (!auth) {
      setIsLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      if (currentUser) {
         setName(currentUser.displayName || currentUser.email?.split("@")[0] || "Anonim");
      }
    });
  }, []);

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !db || !content.trim() || isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingRequestId) {
        await setDoc(doc(db, "prayer_rooms", "global", "requests", editingRequestId), {
          name,
          category,
          content,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        setRequests(requests.map(r => r.id === editingRequestId ? { ...r, name, category, content } : r));
        setEditingRequestId(null);
        setContent("");
      } else {
        const docRef = await addDoc(collection(db, "prayer_rooms", "global", "requests"), {
          name,
          category,
          content,
          authorId: user.uid,
          createdAt: serverTimestamp(),
        });
        await addDoc(collection(db, "users", user.uid, "activities"), {
          type: "prayer_request",
          title: `Pokok doa: ${category}`,
          description: content.slice(0, 160),
          createdAt: serverTimestamp(),
        });
        
        setRequests([{ id: docRef.id, name, category, content, createdAt: null, prayed: false, authorId: user.uid }, ...requests]);
        setContent("");
      }
    } catch (error) {
      console.error("Gagal mengirim doa:", error);
      alert("Gagal mengirim pokok doa. Pastikan teks maksimal 1000 karakter.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePray(id: string) {
    setRequests(requests.map(r => r.id === id ? { ...r, prayed: true } : r));
  }

  function handleEdit(request: PrayerRequest) {
    setEditingRequestId(request.id);
    setName(request.name);
    setCategory(request.category);
    setContent(request.content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingRequestId(null);
    setName(user?.displayName || user?.email?.split("@")[0] || "Anonim");
    setCategory("Doa pribadi");
    setContent("");
  }

  async function handleDelete(id: string) {
    if (!db || !window.confirm("Apakah Anda yakin ingin menghapus pokok doa ini?")) return;
    try {
      await deleteDoc(doc(db, "prayer_rooms", "global", "requests", id));
      setRequests(requests.filter(r => r.id !== id));
      if (editingRequestId === id) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error("Gagal menghapus pokok doa:", error);
      alert("Gagal menghapus pokok doa.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Komunitas Doa
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Ruang saling mendoakan dengan privasi dan moderasi.
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white"
          >
            Kembali
          </Link>
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="h-fit sticky top-6">
            {!user ? (
              <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 text-center">
                <h2 className="text-xl font-semibold text-[#14213d]">Kirim Pokok Doa</h2>
                <p className="mt-3 text-[#52606d]">Login untuk membagikan pergumulan Anda agar didoakan oleh komunitas.</p>
                <Link href="/login" className="mt-5 inline-block rounded-md bg-[#14213d] px-5 py-3 font-semibold text-white">Login Sekarang</Link>
              </div>
            ) : (
              <form
                onSubmit={handleFormSubmit}
                className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm"
              >
                <h2 className="text-xl font-semibold text-[#14213d]">
                  {editingRequestId ? "Ubah Pokok Doa" : "Kirim pokok doa"}
                </h2>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
                  placeholder="Nama atau Anonim"
                  maxLength={50}
                  required
                />
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
                >
                  <option>Doa pribadi</option>
                  <option>Keluarga</option>
                  <option>Pekerjaan</option>
                  <option>Kesehatan</option>
                  <option>Pelayanan</option>
                </select>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="min-h-40 rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
                  placeholder="Tulis pokok doa tanpa data pribadi yang sensitif."
                  maxLength={1000}
                  required
                />
                <div className="flex gap-3">
                  <button disabled={isSubmitting} className="flex-1 rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white disabled:opacity-50 transition">
                    {isSubmitting ? "Mengirim..." : editingRequestId ? "Simpan Perubahan" : "Kirim pokok doa"}
                  </button>
                  {editingRequestId && (
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

          <div className="grid gap-3 h-fit">
            {isLoading && requests.length === 0 && (
              <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 text-center text-[#52606d]">
                Memuat daftar doa...
              </div>
            )}
            {!isLoading && requests.length === 0 && (
              <div className="rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-5 text-center text-[#52606d]">
                Belum ada pokok doa di komunitas.
              </div>
            )}
            {requests.map((request) => (
              <article
                key={request.id}
                className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <h2 className="text-xl font-semibold text-[#14213d]">
                    {request.name}
                  </h2>
                  <span className="rounded-md bg-[#e9f5db] px-3 py-1 text-sm font-semibold text-[#284b3a] shrink-0 w-fit">
                    {request.category}
                  </span>
                </div>
                <p className="mt-3 leading-7 text-[#52606d] whitespace-pre-wrap break-words">
                  {request.content}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handlePray(request.id)}
                    disabled={request.prayed}
                    className={`rounded-md border px-4 py-2 font-semibold transition ${
                      request.prayed 
                        ? "border-transparent bg-[#e9f5db] text-[#284b3a]" 
                        : "border-[#dfd8ca] text-[#14213d] hover:bg-[#f7f4ee]"
                    }`}
                  >
                    {request.prayed ? "Telah didoakan 🙏" : "Saya doakan"}
                  </button>
                  <button
                    onClick={() => shareToWhatsApp(`Pokok Doa: ${request.name} (${request.category})`, request.content)}
                    className="rounded-md border border-[#dfd8ca] px-4 py-2 font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition"
                  >
                    Share WA
                  </button>
                  <button
                    onClick={() => printPdf(`Pokok Doa: ${request.name} (${request.category})`, request.content)}
                    className="rounded-md border border-[#dfd8ca] px-4 py-2 font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition"
                  >
                    PDF
                  </button>

                  {user && request.authorId === user.uid && (
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => handleEdit(request)}
                        className="rounded-md border border-[#dfd8ca] px-3 py-1 text-xs font-semibold text-[#14213d] hover:bg-gray-50 transition"
                      >
                        Ubah
                      </button>
                      <button
                        onClick={() => handleDelete(request.id)}
                        className="rounded-md bg-red-50 text-red-600 px-3 py-1 text-xs font-semibold hover:bg-red-100 transition"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
