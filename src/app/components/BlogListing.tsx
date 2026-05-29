"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type Post = {
  id: string;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  category?: string;
  createdAt?: any;
};

type BlogListingProps = {
  initialPosts: Post[];
  allCategories: string[];
};

export default function BlogListing({ initialPosts, allCategories }: BlogListingProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryFilter = searchParams.get("category");

  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);

  // Set category in URL helper
  const setSelectedCategory = (cat: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cat) {
      params.set("category", cat);
    } else {
      params.delete("category");
    }
    router.push(`/blog?${params.toString()}`);
  };

  // Web Speech API Voice Search Helper
  function startVoiceSearch() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Anda tidak mendukung fitur Voice to Text secara langsung (terutama in-app browser media sosial). Silakan buka website ini di Safari (iOS) atau Chrome (Android) untuk menggunakan fitur pencarian suara.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      
      let errorMsg = `Gagal merekam suara (Error: ${event.error}).`;
      if (event.error === "not-allowed") {
        errorMsg = "Izin akses mikrofon ditolak. Silakan aktifkan izin mikrofon untuk browser ini di pengaturan perangkat/aplikasi Anda.";
      } else if (event.error === "no-speech") {
        errorMsg = "Tidak ada suara yang terdeteksi. Silakan coba lagi.";
      } else if (event.error === "audio-capture") {
        errorMsg = "Perangkat mikrofon tidak ditemukan.";
      } else if (event.error === "network") {
        errorMsg = "Koneksi jaringan terputus.";
      } else if (event.error === "service-not-allowed") {
        errorMsg = "Layanan dikte tidak diizinkan. Silakan aktifkan fitur Dikte (Dictation) di pengaturan keyboard perangkat Anda.";
      }
      alert(errorMsg);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setSearchQuery(speechToText);
    };

    recognition.start();
  }

  // Filter posts based on Category and Search Query
  const filteredPosts = initialPosts.filter((post) => {
    const matchesCategory = !categoryFilter || post.category === categoryFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.excerpt && post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (post.category && post.category.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search Input with Voice to Text */}
      <div className="flex max-w-lg gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari artikel rohani..."
            className="w-full rounded-md border border-[#dfd8ca] bg-white py-3 pl-4 pr-10 text-sm text-[#1f2933] outline-none focus:border-[#2a6f6f]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-[#1f2933]"
              title="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 11-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={startVoiceSearch}
          className={`rounded-md px-4 py-3 border border-[#dfd8ca] font-semibold text-sm flex items-center gap-1.5 transition ${
            isListening
              ? "bg-red-100 text-red-700 border-red-300 animate-pulse"
              : "bg-white text-[#14213d] hover:bg-gray-50"
          }`}
          title="Cari dengan Suara (Voice Search)"
        >
          <span>🎙️</span>
          <span className="hidden sm:inline">{isListening ? "Mendengarkan..." : "Cari Suara"}</span>
        </button>
      </div>

      {/* Category Navigation Bar (Horizontal scroll on mobile) */}
      <div 
        className="mb-8 flex overflow-x-auto gap-2 border-b border-[#dfd8ca] pb-4 -mx-5 px-5 sm:mx-0 sm:px-0 scrollbar-thin"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        <button
          onClick={() => setSelectedCategory(null)}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition ${
            !categoryFilter
              ? "bg-[#2a6f6f] text-white"
              : "border border-[#dfd8ca] bg-white text-[#334155] hover:bg-gray-50"
          }`}
        >
          Semua Topik
        </button>
        {allCategories.map((cat) => (
          <button
            onClick={() => setSelectedCategory(cat)}
            key={cat}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition ${
              categoryFilter === cat
                ? "bg-[#2a6f6f] text-white"
                : "border border-[#dfd8ca] bg-white text-[#334155] hover:bg-gray-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Articles View (Neat Title List when filtered, Grid Cards when not) */}
      {filteredPosts.length === 0 ? (
        <p className="text-lg text-[#52606d] italic">Belum ada artikel yang cocok dengan pencarian Anda.</p>
      ) : categoryFilter ? (
        /* Neat List of Article Titles when Category is Selected */
        <div className="rounded-2xl border border-[#dfd8ca] bg-white p-6 shadow-sm max-w-4xl">
          <h2 className="text-2xl font-semibold text-[#14213d] mb-6 flex items-center gap-2">
            <span className="h-6 w-1 rounded-full bg-[#2a6f6f]" />
            Daftar Artikel Kategori: <span className="text-[#2a6f6f]">{categoryFilter}</span>
          </h2>
          <div className="divide-y divide-[#dfd8ca]/60">
            {filteredPosts.map((post) => {
              const date = post.createdAt 
                ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(post.createdAt))
                : "Baru saja";
              return (
                <div key={post.id} className="py-4 first:pt-0 last:pb-0 group">
                  <Link href={`/blog/${post.id}`} className="block">
                    <span className="text-xs text-[#52606d] font-semibold">{date}</span>
                    <h3 className="mt-1 text-lg font-semibold text-[#14213d] group-hover:text-[#2a6f6f] transition">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="mt-1 text-sm text-[#52606d] line-clamp-2 leading-relaxed">{post.excerpt}</p>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Grid Card Previews on Blog Home Index */
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => (
            <Link
              href={`/blog/${post.id}`}
              key={post.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-[#dfd8ca] bg-white shadow-sm transition hover:shadow-md"
            >
              {post.imageUrl ? (
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="h-48 w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-48 w-full flex-col items-center justify-center bg-[#102c3a] gap-2">
                  <img src="/logo.jpg" alt="Logo" className="h-12 w-12 rounded-full object-cover border border-[#ffd166]/30" />
                  <span className="text-sm font-bold uppercase tracking-widest text-[#ffd166]">Grace Daily</span>
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#2a6f6f]">{post.category}</p>
                <h2 className="mt-3 text-xl font-semibold leading-tight text-[#14213d] group-hover:text-[#2a6f6f]">{post.title}</h2>
                {post.excerpt && (
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#52606d]">{post.excerpt}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
