"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { shareToWhatsApp, downloadPdf } from "@/lib/share";
import { toggleAudio } from "@/lib/audio";
import { useLanguage } from "@/lib/i18n";

export default function SermonAssistant() {
  const { language, t } = useLanguage();
  const [theme, setTheme] = useState("");
  const [verse, setVerse] = useState("");
  const [audience, setAudience] = useState("");
  const [duration, setDuration] = useState("30");
  const [result, setResult] = useState("");
  const [resultPageUrl, setResultPageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListeningTheme, setIsListeningTheme] = useState(false);
  const [isListeningVerse, setIsListeningVerse] = useState(false);
  const [isListeningAudience, setIsListeningAudience] = useState(false);

  const startSpeechRecognition = (
    setValue: (val: string | ((prev: string) => string)) => void,
    setIsListening: (val: boolean) => void
  ) => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Browser Anda tidak mendukung Dikte Suara.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setValue((prev) => (prev ? `${prev} ${speechToText}` : speechToText));
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const generateSermon = async () => {
    if (!theme || !verse) {
      alert("Mohon isi tema dan ayat utama.");
      return;
    }

    setLoading(true);
    setResultPageUrl("");
    try {
      const prompt = `Buat outline khotbah Kristen yang mendalam dan praktis dengan detail berikut:
      
Tema: ${theme}
Ayat Utama: ${verse}
Target Audiens: ${audience || "Umum"}
Durasi: ${duration} menit

Format output harus mencakup:
1. Judul Khotbah yang menarik
2. Tujuan Pengajaran (apa yang ingin dicapai)
3. Ayat Utama
4. Minimal 8 ayat pendukung dengan referensi
5. Latar Belakang Teks (konteks historis singkat)
6. Ide Besar (main idea)
7. Penjelasan Teologis yang bertanggung jawab
8. Outline Khotbah 3-5 poin dengan sub-poin
9. Naskah Pengantar (opening)
10. Transisi antar poin
11. Minimal 3 ilustrasi kehidupan sehari-hari yang relevan
12. Contoh kasus nyata dalam keluarga/pekerjaan/gereja
13. Pertanyaan Diskusi Komsel yang menggali hati (minimal 5 pertanyaan)
14. Aplikasi Praktis untuk pribadi/keluarga/komunitas
15. Ajakan Respons (call to action)
16. Doa Penutup
17. Catatan Pastoral yang tidak menghakimi

Jawab dalam bahasa Indonesia dengan struktur yang rapi dan mudah dipahami. Pastikan konten alkitabiah, hangat, dan pastoral.`;

      const currentUser = auth?.currentUser;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUser) {
        const token = await currentUser.getIdToken();
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: "sermon_guide",
          prompt,
          language,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.answer) {
        throw new Error("server sibuk");
      }
      setResult(data.answer || "Gagal generate khotbah.");
      if (currentUser) {
        let sharePageUrl = "";
        const pageResponse = await fetch("/api/share-page", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await currentUser.getIdToken()}`,
          },
          body: JSON.stringify({
            type: "Asisten Khotbah/Komsel",
            title: `Outline Khotbah: ${theme}`,
            subtitle: `Ayat utama: ${verse} • Durasi ${duration} menit`,
            prompt: `Tema: ${theme}\nAyat Utama: ${verse}\nTarget Audiens: ${audience || "Umum"}\nDurasi: ${duration} menit`,
            content: data.answer,
          }),
        });
        const pageData = await pageResponse.json().catch(() => ({}));
        if (pageResponse.ok && pageData.url) {
          sharePageUrl = pageData.url;
          setResultPageUrl(pageData.url);
        }
 
        if (db) {
          try {
            await addDoc(collection(db, "ai_requests"), {
              userId: currentUser.uid,
              mode: "Asisten Khotbah/Komsel",
              prompt,
              answer: data.answer,
              sharePageUrl,
              createdAt: serverTimestamp(),
            });
          } catch (dbErr) {
            console.error("Gagal menyimpan riwayat ke Firestore:", dbErr);
          }
        }
      }
    } catch (error: any) {
      console.error("Gagal generate khotbah:", error);
      alert("server sibuk");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    alert("Khotbah berhasil disalin!");
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#14213d] mb-2">
            {language === "zh" ? "AI 讲道与小组查经助手" : language === "en" ? "AI Sermon & Cell Group Assistant" : "Asisten Khotbah AI"}
          </h1>
          <p className="text-[#52606d]">
            {language === "zh" ? "由人工智能驱动的基督教讲道大纲与小组团契讨论材料生成器。" : language === "en" ? "AI-powered Christian sermon outline and cell group discussion material builder." : "Pembuat outline khotbah Kristen dan bahan diskusi kelompok sel berbasis kecerdasan buatan."}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-[#dfd8ca] p-6 mb-8">
          <h2 className="text-xl font-semibold text-[#14213d] mb-4">
            {language === "zh" ? "讲道细节" : language === "en" ? "Sermon Details" : "Detail Khotbah"}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#334155] mb-1">
                {language === "zh" ? "讲道主题 *" : language === "en" ? "Sermon Theme *" : "Tema Khotbah *"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="flex-1 rounded-md border border-[#dfd8ca] px-4 py-2 focus:border-[#2a6f6f] outline-none bg-white text-gray-900"
                  placeholder={language === "zh" ? "例如：上帝永不改变的爱" : language === "en" ? "e.g. God's Unchanging Love" : "Contoh: Kasih Allah yang Tak Berubah"}
                  required
                />
                <button
                  type="button"
                  onClick={() => startSpeechRecognition(setTheme, setIsListeningTheme)}
                  className={`rounded-md px-3 py-2 border border-[#dfd8ca] font-semibold text-sm transition ${
                    isListeningTheme ? "bg-red-100 text-red-700 animate-pulse border-red-300" : "bg-white text-[#14213d] hover:bg-gray-50"
                  }`}
                  title="Dikte Suara"
                >
                  🎙️
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155] mb-1">
                {language === "zh" ? "核心经文 *" : language === "en" ? "Main Scripture *" : "Ayat Utama *"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verse}
                  onChange={(e) => setVerse(e.target.value)}
                  className="flex-1 rounded-md border border-[#dfd8ca] px-4 py-2 focus:border-[#2a6f6f] outline-none bg-white text-gray-900"
                  placeholder={language === "zh" ? "例如：约翰福音 3:16" : language === "en" ? "e.g. John 3:16" : "Contoh: Yohanes 3:16"}
                  required
                />
                <button
                  type="button"
                  onClick={() => startSpeechRecognition(setVerse, setIsListeningVerse)}
                  className={`rounded-md px-3 py-2 border border-[#dfd8ca] font-semibold text-sm transition ${
                    isListeningVerse ? "bg-red-100 text-red-700 animate-pulse border-red-300" : "bg-white text-[#14213d] hover:bg-gray-50"
                  }`}
                  title="Dikte Suara"
                >
                  🎙️
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155] mb-1">
                {language === "zh" ? "目标听众" : language === "en" ? "Target Audience" : "Target Audiens"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="flex-1 rounded-md border border-[#dfd8ca] px-4 py-2 focus:border-[#2a6f6f] outline-none bg-white text-gray-900"
                  placeholder={language === "zh" ? "例如：青年、家庭、大众" : language === "en" ? "e.g. Youth, Young Families, General" : "Contoh: Jemaat muda, Keluarga muda, Umum"}
                />
                <button
                  type="button"
                  onClick={() => startSpeechRecognition(setAudience, setIsListeningAudience)}
                  className={`rounded-md px-3 py-2 border border-[#dfd8ca] font-semibold text-sm transition ${
                    isListeningAudience ? "bg-red-100 text-red-700 animate-pulse border-red-300" : "bg-white text-[#14213d] hover:bg-gray-50"
                  }`}
                  title="Dikte Suara"
                >
                  🎙️
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155] mb-1">
                {language === "zh" ? "讲道时长" : language === "en" ? "Sermon Duration" : "Durasi Khotbah"}
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-md border border-[#dfd8ca] px-4 py-2 focus:border-[#2a6f6f] outline-none bg-white text-gray-900"
              >
                <option value="15">15 {language === "zh" ? "分钟" : language === "en" ? "minutes" : "menit"}</option>
                <option value="30">30 {language === "zh" ? "分钟" : language === "en" ? "minutes" : "menit"}</option>
                <option value="45">45 {language === "zh" ? "分钟" : language === "en" ? "minutes" : "menit"}</option>
                <option value="60">60 {language === "zh" ? "分钟" : language === "en" ? "minutes" : "menit"}</option>
              </select>
            </div>

            <button
              onClick={generateSermon}
              disabled={loading}
              className="w-full rounded-md bg-[#2a6f6f] px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? (language === "zh" ? "正在生成..." : language === "en" ? "Generating..." : "Sedang Membuat...") : (language === "zh" ? "生成讲道与小组材料" : language === "en" ? "Generate Sermon & Study Materials" : "Buat Outline Khotbah")}
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-white rounded-lg border border-[#dfd8ca] p-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 pb-4 border-b border-[#dfd8ca]">
              <h2 className="text-xl font-semibold text-[#14213d]">
                Outline Khotbah
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => shareToWhatsApp(`Outline Khotbah: ${theme}`, result)}
                  className="rounded-md bg-[#2a6f6f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a4a4a]"
                >
                  Share WA
                </button>
                <button
                  onClick={() => downloadPdf(`Outline Khotbah: ${theme}`, result)}
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-xs font-semibold text-[#14213d] hover:bg-gray-50"
                >
                  Cetak PDF
                </button>
                <button
                  onClick={() => toggleAudio(result, isPlaying, setIsPlaying, "id-ID")}
                  className="rounded-md bg-[#e9f5db] px-3 py-1.5 text-xs font-semibold text-[#284b3a] transition hover:bg-[#cde4b4]"
                >
                  {isPlaying ? "⏹ Stop Audio" : "🎧 Dengarkan"}
                </button>
                <button
                  onClick={copyToClipboard}
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-xs font-semibold text-[#14213d] hover:bg-[#f7f4ee]"
                >
                  Salin
                </button>
                {resultPageUrl && (
                  <a
                    href={resultPageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-[#ffd166] px-3 py-1.5 text-xs font-bold text-[#102c3a] transition hover:bg-[#f4a261]"
                  >
                    Buka Halaman
                  </a>
                )}
              </div>
            </div>
            <div className="prose max-w-none text-[#14213d] whitespace-pre-wrap leading-8">
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
