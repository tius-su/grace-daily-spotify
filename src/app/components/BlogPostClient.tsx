"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toggleAudio, stopAudio } from "@/lib/audio";

type BlogPostClientProps = {
  post: {
    id: string;
    title: string;
    category: string;
    status: string;
    authorName?: string;
    createdAt?: any;
    imageUrl?: string;
    excerpt?: string;
    body: string;
  };
  publishDate: string;
};

export default function BlogPostClient({ post, publishDate }: BlogPostClientProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const handleListenClick = () => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = post.body;
    const textToRead = `${post.title}. Kategori: ${post.category}. ${post.excerpt || ""}. ${tempDiv.textContent || tempDiv.innerText || ""}`;
    toggleAudio(textToRead, isPlaying, setIsPlaying);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#2a6f6f] hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Kembali ke Blog
          </Link>

          <button
            onClick={handleListenClick}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition cursor-pointer ${
              isPlaying
                ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                : "bg-[#2a6f6f] text-white hover:bg-[#205555]"
            }`}
          >
            {isPlaying ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
                Hentikan Suara
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
                Dengarkan Artikel
              </>
            )}
          </button>
        </div>

        <span className="rounded-md bg-[#e9f5db] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#284b3a]">
          {post.category}
        </span>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-[#14213d] sm:text-4xl lg:text-5xl">
          {post.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-4 border-b border-[#dfd8ca] pb-6 text-sm text-[#52606d]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#14213d]">{post.authorName || "Tim Grace Daily"}</span>
          </div>
          <span>•</span>
          <time>{publishDate}</time>
        </div>
      </header>

      {post.imageUrl && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-[#dfd8ca] shadow-sm">
          <img
            src={post.imageUrl}
            alt={post.title}
            className="h-auto max-h-[480px] w-full object-cover"
          />
        </div>
      )}

      {post.excerpt && (
        <div className="mb-8 rounded-xl border-l-4 border-[#2a6f6f] bg-[#fffdf8] p-5 italic text-[#52606d] shadow-sm leading-relaxed">
          {post.excerpt}
        </div>
      )}

      <article className="prose prose-lg max-w-none text-[#334155] leading-8">
        <div 
          dangerouslySetInnerHTML={{ __html: post.body }}
          className="rich-text-content"
        />
      </article>
    </div>
  );
}
