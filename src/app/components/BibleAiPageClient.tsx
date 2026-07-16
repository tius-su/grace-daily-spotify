"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { stopAudio, toggleAudio } from "@/lib/audio";
import { downloadPdf, shareToWhatsApp, toRelativeUrl } from "@/lib/share";
import type { BibleAiPage } from "@/lib/server/bible-ai-page";

type BibleAiPageClientProps = {
  page: BibleAiPage;
};

export default function BibleAiPageClient({ page }: BibleAiPageClientProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const shareTitle = page.title;
  const shareText = useMemo(() => {
    return [
      `*${page.title}*`,
      "",
      `*Ayat:* ${page.reference} (${page.translation})`,
      `"${page.verseText}"`,
      "",
      page.content,
    ].join("\n");
  }, [page.content, page.reference, page.title, page.translation, page.verseText]);

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const handleListenClick = () => {
    const textToRead = `${page.title}. Ayat Alkitab: ${page.reference}. ${page.verseText}. ${page.content}`;
    toggleAudio(textToRead, isPlaying, setIsPlaying, page.translation === "BSB" ? "en-US" : "id-ID");
  };

  async function handleNativeShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `${page.reference} - ${page.verseText}`,
          url,
        });
        return;
      } catch {
        // Continue to clipboard fallback.
      }
    }

    await navigator.clipboard.writeText(`${shareTitle}\n${url}`);
    alert("Tautan berhasil disalin.");
  }

  function handleFacebookShare() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener,noreferrer");
  }

  function handlePrintPdf() {
    downloadPdf(
      page.title,
      `**Ayat:** ${page.reference} (${page.translation})\n\n"${page.verseText}"\n\n${page.content}`,
      {
        bannerUrl: page.bannerUrl,
        subtitle: `${page.reference} (${page.translation})`,
      },
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/alkitab"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#2a6f6f] hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Kembali ke Alkitab
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleListenClick}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                isPlaying ? "bg-red-500 text-white hover:bg-red-600" : "bg-[#2a6f6f] text-white hover:bg-[#205555]"
              }`}
            >
              {isPlaying ? "Hentikan Suara" : "Dengarkan"}
            </button>

            <button
              onClick={() => shareToWhatsApp(shareTitle, `${shareText}\n\n${window.location.href}`)}
              className="inline-flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-[#102c3a] shadow-sm hover:bg-[#20ba59]"
            >
              WhatsApp
            </button>

            <button
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-2 rounded-full border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm hover:bg-[#f7f4ee]"
            >
              PDF
            </button>

            <button
              onClick={handleFacebookShare}
              className="inline-flex items-center gap-2 rounded-full bg-[#1877f2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#145dbf]"
            >
              Facebook
            </button>

            <button
              onClick={handleNativeShare}
              className="inline-flex items-center gap-2 rounded-full border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm hover:bg-[#f7f4ee]"
            >
              Bagikan
            </button>
          </div>
        </div>

        <span className="rounded-md bg-[#e9f5db] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#284b3a]">
          {page.type === "explanation" ? "Penjelasan Alkitab" : "Tafsiran Ayat"}
        </span>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-[#14213d] sm:text-4xl lg:text-5xl">
          {page.title}
        </h1>
      </header>

      {page.bannerUrl && (
        <a
          href={toRelativeUrl(page.bannerUrl)}
          target="_blank"
          rel="noreferrer"
          className="mb-8 block overflow-hidden rounded-xl border border-[#dfd8ca] bg-white shadow-sm"
        >
          <img
            src={toRelativeUrl(page.bannerUrl)}
            alt={page.title}
            className="aspect-[1200/630] w-full object-cover"
          />
        </a>
      )}

      <div className="mb-8 rounded-xl border-l-4 border-[#2a6f6f] bg-[#fffdf8] p-6 leading-relaxed shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#2a6f6f]">
          Ayat: {page.reference} ({page.translation})
        </p>
        <blockquote className="text-lg font-medium italic text-[#334155]">
          &ldquo;{page.verseText}&rdquo;
        </blockquote>
      </div>

      <article className="prose prose-lg max-w-none text-[#334155]">
        <ReactMarkdown
          components={{
            h1: ({ ...props }) => <h2 {...props} className="mt-8 text-2xl font-bold text-[#14213d]" />,
            h2: ({ ...props }) => <h2 {...props} className="mt-8 text-2xl font-bold text-[#14213d]" />,
            h3: ({ ...props }) => <h3 {...props} className="mt-6 text-xl font-bold text-[#2a6f6f]" />,
            p: ({ ...props }) => <p {...props} className="mb-5 leading-8" />,
            li: ({ ...props }) => <li {...props} className="mb-2 leading-8" />,
            ul: ({ ...props }) => <ul {...props} className="mb-6 list-disc pl-6" />,
            ol: ({ ...props }) => <ol {...props} className="mb-6 list-decimal pl-6" />,
          }}
        >
          {page.content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
