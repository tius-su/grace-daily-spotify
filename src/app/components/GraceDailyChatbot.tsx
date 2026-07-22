"use client";

import React, { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import ReactMarkdown from "react-markdown";

export type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isCached?: boolean;
};

const SUGGESTIONS = [
  "Renungan hari ini 🕊️",
  "Rencana Baca Alkitab 📖",
  "Ensiklopedia & Tokoh Alkitab 🏛️",
  "Komunitas & Tembok Doa 🙏",
  "Tulis Jurnal Spiritual 📝",
  "Konsultasi Tanya Pendeta ⛪",
  "Artikel & Berita Terbaru 📰",
  "Asisten Khotbah 📜",
];

const STORAGE_KEY = "grace_chatbot_history_v1";

export function GraceDailyChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<{ remaining: number; maxLimit: number; isGuest: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load saved history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn("Gagal membaca chat history dari localStorage:", e);
    }

    // Default initial message
    setMessages([
      {
        id: "welcome-1",
        role: "assistant",
        content: "Syalom! Saya Grace Daily Assistant. Ada yang bisa saya bantu atau doakan untuk kamu hari ini?",
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // Track Firebase Auth state
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Save history on change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
      } catch (e) {
        console.warn("Gagal menyimpan chat history ke localStorage:", e);
      }
    }
  }, [messages]);

  // Scroll to bottom when messages update or panel opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    const userMsgId = `usr_${Date.now()}`;
    const newMsg: LocalMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    if (!textToSend) setInput("");
    setIsLoading(true);

    try {
      let token: string | null = null;
      if (user) {
        try {
          token = await user.getIdToken();
        } catch (tErr) {
          console.warn("Gagal mengambil token user:", tErr);
        }
      }

      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      setQuotaInfo({
        remaining: data.remaining,
        maxLimit: data.maxLimit,
        isGuest: data.isGuest,
      });

      const botMsg: LocalMessage = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        content: data.answer || "Maaf, belum ada tanggapan yang tersedia.",
        timestamp: Date.now(),
        isCached: !!data.isCached,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Apakah kamu yakin ingin menghapus semua pesan di riwayat chat ini?")) {
      const resetMsg: LocalMessage[] = [
        {
          id: `welcome_${Date.now()}`,
          role: "assistant",
          content: "Syalom! Riwayat obrolan telah dibersihkan. Ada yang bisa saya bantu lagi?",
          timestamp: Date.now(),
        },
      ];
      setMessages(resetMsg);
      localStorage.removeItem(STORAGE_KEY);
      setErrorMessage(null);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Buka Chatbot Grace Daily"
          className="fixed bottom-5 right-5 z-[999] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#14213d] via-[#1f3160] to-[#f4a261] p-[2px] shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group"
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#14213d] text-white">
            <span className="relative flex h-3 w-3 absolute -top-1 -right-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f4a261] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f4a261]"></span>
            </span>
            <svg
              className="h-7 w-7 text-[#f4a261] transition-transform duration-300 group-hover:rotate-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
        </button>
      )}

      {/* Interactive Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-[999] flex h-[540px] max-h-[85vh] w-[370px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl text-slate-100 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/60 bg-gradient-to-r from-[#14213d] to-[#1e293b] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#f4a261] text-[#14213d] font-bold shadow-md">
                ✨
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#14213d]"></span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Grace Daily AI</h3>
                  <span className="rounded bg-[#f4a261]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#f4a261]">
                    Bot
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {quotaInfo
                    ? `${quotaInfo.remaining}/${quotaInfo.maxLimit} pesan tersisa jam ini`
                    : user
                      ? "Batas 20 pesan/jam"
                      : "Batas 5 pesan/jam (Guest)"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={handleClearHistory}
                title="Bersihkan percakapan"
                className="rounded-lg p-1.5 hover:bg-slate-700/50 hover:text-rose-400 transition"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Tutup Chat"
                className="rounded-lg p-1.5 hover:bg-slate-700/50 hover:text-white transition"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f4a261] text-[#14213d] text-xs font-bold shadow-sm mt-0.5">
                    🕊️
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-amber-600 to-[#f4a261] text-slate-950 font-medium rounded-br-none shadow-md"
                      : "bg-slate-800/80 border border-slate-700/60 text-slate-200 rounded-bl-none shadow-sm"
                  }`}
                >
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-amber-300">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-1">{children}</ol>,
                      a: ({ href, children }) => {
                        const isInternal = href && (href.startsWith("/") || href.includes("gracedaily"));
                        return (
                          <a
                            href={href}
                            target={isInternal ? "_self" : "_blank"}
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-amber-300 underline hover:text-amber-200 transition bg-amber-400/10 px-1.5 py-0.5 rounded my-0.5"
                          >
                            {children} 🔗
                          </a>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {msg.role === "assistant" && msg.isCached && (
                    <div className="mt-1.5 flex items-center justify-end">
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-300/80 border border-amber-500/20" title="Jawaban diambil dari R2 Cache (Hemat Kuota AI)">
                        ⚡ R2 Cache
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Quick Suggestions Chips */}
            {messages.length <= 2 && !isLoading && (
              <div className="pt-2">
                <p className="text-[11px] font-medium text-slate-400 mb-2">Saran pertanyaan cepat:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(sug)}
                      className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] text-amber-200/90 transition hover:border-[#f4a261] hover:bg-slate-700"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4a261] text-[#14213d] text-xs font-bold animate-pulse">
                  🕊️
                </div>
                <div className="rounded-2xl rounded-bl-none bg-slate-800/80 border border-slate-700/60 px-4 py-3 text-slate-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}

            {/* Error Message Box */}
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-2.5 text-xs text-rose-300">
                ⚠️ {errorMessage}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Area */}
          <div className="border-t border-slate-800 bg-[#0f172a] p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tulis pesan..."
                disabled={isLoading}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-400 focus:border-[#f4a261] focus:outline-none focus:ring-1 focus:ring-[#f4a261] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f4a261] text-[#14213d] font-bold transition hover:bg-amber-400 disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
