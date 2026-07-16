"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SearchResultItem {
  id: string;
  title: string;
  excerpt?: string;
  category?: string;
  kategori?: string;
  url: string;
  reference?: string;
  text?: string;
  translation?: string;
}

interface SearchResults {
  articles: SearchResultItem[];
  encyclopedia: SearchResultItem[];
  devotions: SearchResultItem[];
  verses: SearchResultItem[];
}

interface SearchModalProps {
  onClose: () => void;
}

export function SearchModal({ onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SearchResults>({
    articles: [],
    encyclopedia: [],
    devotions: [],
    verses: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Focus input on mount & Lock body scroll
  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Debounced search fetch
  useEffect(() => {
    if (!query.trim()) {
      setResults({ articles: [], encyclopedia: [], devotions: [], verses: [] });
      setLoading(false);
      setError("");
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          throw new Error("Gagal mengambil hasil pencarian");
        }
        const data = await res.json();
        if (data.ok && data.results) {
          setResults(data.results);
        } else {
          throw new Error(data.error || "Gagal mengambil data");
        }
      } catch (err: any) {
        console.error("[SearchModal] Fetch error:", err);
        setError(err.message || "Terjadi kesalahan saat mencari.");
      } finally {
        setLoading(false);
      }
    }, 400); // 400ms debounce delay

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleResultClick = (url: string) => {
    onClose();
    router.push(url);
  };

  const hasResults =
    results.articles.length > 0 ||
    results.encyclopedia.length > 0 ||
    results.devotions.length > 0 ||
    results.verses.length > 0;

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
    >
      <div
        ref={modalRef}
        className="w-full max-w-3xl bg-[#14213d] border border-white/10 rounded-2xl shadow-2xl mt-12 sm:mt-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-[#1d2d44]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6 text-[#ffd166]"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari artikel, ayat alkitab, ensiklopedia..."
            className="flex-1 bg-transparent text-white placeholder-white/40 text-lg outline-none border-none py-1 focus:ring-0"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition"
              aria-label="Hapus pencarian"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-md transition"
          >
            ESC
          </button>
        </div>

        {/* Modal Content / Results */}
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-10 h-10 border-4 border-[#ffd166]/20 border-t-[#ffd166] rounded-full animate-spin"></div>
              <p className="text-white/60 text-sm">Mencari dengan pintar...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-center text-sm">
              {error}
            </div>
          )}

          {!loading && !error && !query.trim() && (
            <div className="text-center py-10 space-y-2">
              <p className="text-white/80 font-medium">Pencarian Pintar Grace Daily</p>
              <p className="text-white/50 text-xs max-w-md mx-auto">
                Ketikkan kata kunci untuk menemukan artikel blog rohani, renungan harian, tokoh/tempat di ensiklopedia Alkitab, atau kutipan ayat Alkitab tertentu.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-4">
                {["Kasih", "Musa", "Yohanes 3:16", "Doa", "Keluarga"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[#ffd166] hover:text-[#ffe49e] border border-white/5 rounded-full transition"
                  >
                    "{tag}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && query.trim() && !hasResults && (
            <div className="text-center py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-12 h-12 mx-auto text-white/20 mb-3"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-white/60 text-sm">
                Tidak ada hasil ditemukan untuk &ldquo;<strong>{query}</strong>&rdquo;
              </p>
            </div>
          )}

          {!loading && !error && hasResults && (
            <div className="space-y-6">
              {/* Category: BIBLE VERSES */}
              {results.verses.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[#ffd166] text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                    <span>📖</span> Ayat Alkitab
                  </h3>
                  <div className="grid gap-2">
                    {results.verses.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => handleResultClick(v.url)}
                        className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#ffd166]/30 rounded-xl cursor-pointer transition-all duration-200 group text-left"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-white font-semibold text-sm group-hover:text-[#ffd166] transition">
                            {v.reference}
                          </span>
                          <span className="text-white/30 text-[10px] uppercase font-bold tracking-wider">
                            {v.translation}
                          </span>
                        </div>
                        <p className="text-white/70 text-xs line-clamp-2 italic leading-relaxed">
                          &ldquo;{v.text}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: DEVOTIONS */}
              {results.devotions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[#ffd166] text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                    <span>🌅</span> Renungan Harian
                  </h3>
                  <div className="grid gap-2">
                    {results.devotions.map((dev) => (
                      <div
                        key={dev.id}
                        onClick={() => handleResultClick(dev.url)}
                        className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#ffd166]/30 rounded-xl cursor-pointer transition-all duration-200 group text-left"
                      >
                        <h4 className="text-white font-semibold text-sm group-hover:text-[#ffd166] transition mb-1 line-clamp-1">
                          {dev.title}
                        </h4>
                        {dev.excerpt && (
                          <p className="text-white/50 text-xs line-clamp-2 leading-relaxed">
                            {dev.excerpt}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: BLOG ARTICLES */}
              {results.articles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[#ffd166] text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                    <span>✍️</span> Artikel & Blog
                  </h3>
                  <div className="grid gap-2">
                    {results.articles.map((art) => (
                      <div
                        key={art.id}
                        onClick={() => handleResultClick(art.url)}
                        className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#ffd166]/30 rounded-xl cursor-pointer transition-all duration-200 group text-left"
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h4 className="text-white font-semibold text-sm group-hover:text-[#ffd166] transition line-clamp-1">
                            {art.title}
                          </h4>
                          {art.category && (
                            <span className="text-[10px] bg-[#ffd166]/10 text-[#ffd166] px-2 py-0.5 rounded font-medium shrink-0">
                              {art.category}
                            </span>
                          )}
                        </div>
                        {art.excerpt && (
                          <p className="text-white/50 text-xs line-clamp-2 leading-relaxed">
                            {art.excerpt}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: ENCYCLOPEDIA */}
              {results.encyclopedia.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[#ffd166] text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                    <span>📚</span> Ensiklopedia Alkitab
                  </h3>
                  <div className="grid gap-2">
                    {results.encyclopedia.map((ensi) => (
                      <div
                        key={ensi.id}
                        onClick={() => handleResultClick(ensi.url)}
                        className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#ffd166]/30 rounded-xl cursor-pointer transition-all duration-200 group text-left"
                      >
                        <div className="flex justify-between items-center gap-2">
                          <h4 className="text-white font-semibold text-sm group-hover:text-[#ffd166] transition">
                            {ensi.title}
                          </h4>
                          <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded uppercase tracking-wider font-semibold">
                            {ensi.kategori}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
