"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { stopAudio, toggleAudio } from "@/lib/audio";
import { downloadPdf, shareToWhatsApp, toRelativeUrl } from "@/lib/share";
import type { SharePage } from "@/lib/server/share-page";

type SharePageClientProps = {
  page: SharePage;
};

function normalizeMarkdown(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n");
}

export default function SharePageClient({ page }: SharePageClientProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const formattedContent = useMemo(() => normalizeMarkdown(page.content), [page.content]);

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const handleListenClick = () => {
    const textToRead = `${page.title}. ${page.subtitle || ""}. ${page.prompt ? `Topik: ${page.prompt}.` : ""} ${page.content}`;
    toggleAudio(textToRead, isPlaying, setIsPlaying, "id-ID");
  };

  function handlePrintPdf() {
    const content = [
      page.subtitle ? `**${page.subtitle}**` : "",
      page.prompt ? `**Topik / Pertanyaan:**\n${page.prompt}` : "",
      formattedContent,
    ].filter(Boolean).join("\n\n");

    downloadPdf(page.title, content, {
      bannerUrl: page.bannerUrl,
      subtitle: page.subtitle || page.prompt,
    });
  }

  async function handleNativeShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: page.title,
          text: page.subtitle || page.prompt || page.content.slice(0, 120),
          url,
        });
        return;
      } catch {
        // Clipboard fallback.
      }
    }

    await navigator.clipboard.writeText(url);
    alert("Tautan halaman berhasil disalin.");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#2a6f6f] hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Kembali ke Grace Daily
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleListenClick}
              className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                isPlaying ? "bg-red-500 text-white hover:bg-red-600" : "bg-[#2a6f6f] text-white hover:bg-[#205555]"
              }`}
            >
              {isPlaying ? "Hentikan Suara" : "Dengarkan"}
            </button>
            <button
              onClick={() => shareToWhatsApp(page.title, `${page.subtitle ? `${page.subtitle}\n\n` : ""}${formattedContent}\n\n${window.location.href}`)}
              className="rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-[#102c3a] shadow-sm hover:bg-[#20ba59]"
            >
              WhatsApp
            </button>
            <button
              onClick={handlePrintPdf}
              className="rounded-full border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm hover:bg-[#f7f4ee]"
            >
              PDF
            </button>
            <button
              onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank", "noopener,noreferrer")}
              className="rounded-full bg-[#1877f2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#145dbf]"
            >
              Facebook
            </button>
            <button
              onClick={handleNativeShare}
              className="rounded-full border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm hover:bg-[#f7f4ee]"
            >
              Bagikan
            </button>
          </div>
        </div>

        <span className="rounded-md bg-[#e9f5db] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#284b3a]">
          {page.type}
        </span>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-[#14213d] sm:text-4xl lg:text-5xl">
          {page.title}
        </h1>
        {page.subtitle && (
          <p className="mt-4 text-lg leading-8 text-[#52606d]">{page.subtitle}</p>
        )}
      </header>

      {page.bannerUrl && (
        <a
          href={toRelativeUrl(page.bannerUrl)}
          target="_blank"
          rel="noreferrer"
          className="mb-8 block overflow-hidden rounded-xl border border-[#dfd8ca] bg-white shadow-sm"
        >
          <img src={toRelativeUrl(page.bannerUrl)} alt={page.title} className="aspect-[1200/630] w-full object-cover" />
        </a>
      )}

      {page.prompt && (
        <div className="mb-8 rounded-xl border-l-4 border-[#2a6f6f] bg-[#fffdf8] p-6 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#2a6f6f]">
            Topik / Pertanyaan
          </p>
          <p className="whitespace-pre-wrap text-[#334155]">{page.prompt}</p>
        </div>
      )}

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
            blockquote: ({ ...props }) => <blockquote {...props} className="my-6 border-l-4 border-[#2a6f6f] bg-[#fffdf8] px-5 py-3 italic" />,
          }}
        >
          {formattedContent}
        </ReactMarkdown>
      </article>
    </div>
  );
}
