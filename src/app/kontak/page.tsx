"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function KontakPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name || !email || !message) return;
    
    setStatus("loading");
    
    try {
      const response = await fetch("https://formsubmit.co/ajax/dailygrace168@gmail.com", {
        method: "POST",
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: subject || `Pesan Baru dari ${name}`,
          name,
          email,
          message
        })
      });

      if (response.ok) {
        setStatus("success");
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Kontak Kami
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Kami selalu sedia mendengar Anda.
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white transition hover:bg-[#1a2d52]"
          >
            Kembali ke Beranda
          </Link>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[0.8fr_1.2fr] items-start">
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-8">
            <h2 className="text-2xl font-semibold text-[#14213d]">Grace Daily</h2>
            <p className="mt-4 leading-7 text-[#52606d]">
              Jika Anda memiliki pertanyaan tentang aplikasi, ingin berbagi kesaksian, atau membutuhkan bantuan terkait paket berlangganan, jangan ragu untuk menghubungi kami.
            </p>
            <div className="mt-8 grid gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e9f5db] text-[#284b3a]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#14213d]">Email Resmi</p>
                  <p className="text-sm text-[#52606d]">dailygrace168@gmail.com</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 rounded-lg border border-[#dfd8ca] bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#14213d] mb-2">Kirim Pesan Secara Langsung</h2>
            
            {status === "success" && (
              <div className="rounded-md bg-[#e9f5db] p-4 text-[#284b3a] font-semibold">
                Pesan Anda berhasil dikirim! Kami akan merespons melalui email secepatnya.
              </div>
            )}
            
            {status === "error" && (
              <div className="rounded-md bg-red-100 p-4 text-red-800 font-semibold">
                Maaf, terjadi kesalahan saat mengirim pesan. Silakan coba beberapa saat lagi.
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-[#14213d]">Nama Lengkap</label>
                <input 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f]"
                  placeholder="Nama Anda"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-[#14213d]">Alamat Email</label>
                <input 
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f]"
                  placeholder="email@anda.com"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-[#14213d]">Subjek / Judul Pesan (Opsional)</label>
              <input 
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f]"
                placeholder="Topik pesan"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-[#14213d]">Isi Pesan</label>
              <textarea 
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="min-h-40 rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f]"
                placeholder="Tuliskan pertanyaan, saran, atau bantuan yang Anda butuhkan..."
              />
            </div>
            
            <button 
              type="submit"
              disabled={status === "loading"}
              className="mt-2 w-full rounded-md bg-[#2a6f6f] px-5 py-4 text-center font-semibold text-white transition hover:bg-[#1a4a4a] disabled:opacity-50"
            >
              {status === "loading" ? "Mengirim Pesan..." : "Kirim Pesan"}
            </button>
            
            <p className="text-center text-xs text-[#52606d] mt-2">
              Dengan mengirimkan pesan, Anda setuju untuk dihubungi kembali melalui email yang tertera.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
