import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BibleAiPageClient from "@/app/components/BibleAiPageClient";
import { getBibleAiPageById } from "@/lib/server/bible-ai-page";

export const revalidate = 300;

type BibleAiDetailProps = {
  params: Promise<{ id: string }>;
};

const getPageData = cache(async (id: string) => {
  return getBibleAiPageById(id);
});

function absoluteUrl(value?: string) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://grace-daily.app";
  if (!value) return `${siteUrl}/logo.png`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

export async function generateMetadata({ params }: BibleAiDetailProps): Promise<Metadata> {
  const { id } = await params;
  const page = await getPageData(id);

  if (!page) {
    return {
      title: "Pendalaman Alkitab Tidak Ditemukan",
    };
  }

  const description = `${page.reference} - ${page.verseText.slice(0, 130)}${page.verseText.length > 130 ? "..." : ""}`;
  const imageUrl = absoluteUrl(page.bannerUrl);

  return {
    title: page.title,
    description,
    openGraph: {
      title: page.title,
      description,
      type: "article",
      images: [
        {
          url: imageUrl,
          alt: page.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function BibleAiDetailPage({ params }: BibleAiDetailProps) {
  const { id } = await params;
  const page = await getPageData(id);

  if (!page) {
    return notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-12 text-[#1f2933] sm:px-8">
      <BibleAiPageClient page={page} />
    </main>
  );
}
