import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SharePageClient from "@/app/components/SharePageClient";
import { getSharePageById } from "@/lib/server/share-page";

export const revalidate = 300;

type ShareDetailProps = {
  params: Promise<{ id: string }>;
};

const getPageData = cache(async (id: string) => {
  return getSharePageById(id);
});

function absoluteUrl(value?: string) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://grace-daily.app";
  if (!value) return `${siteUrl}/logo.png`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

export async function generateMetadata({ params }: ShareDetailProps): Promise<Metadata> {
  const { id } = await params;
  const page = await getPageData(id);

  if (!page) {
    return {
      title: "Halaman Tidak Ditemukan",
    };
  }

  const seo = (page as any).seo;
  const title = seo?.title || page.title;
  const description = seo?.description || page.subtitle || page.prompt || page.content.slice(0, 140);
  const imageUrl = absoluteUrl(seo?.image || page.bannerUrl);
  const keywords = seo?.keywords || [title, page.mode || "AI Alkitab", "Grace Daily"];

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: imageUrl, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ShareDetailPage({ params }: ShareDetailProps) {
  const { id } = await params;
  const page = await getPageData(id);

  if (!page) {
    return notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-12 text-[#1f2933] sm:px-8">
      <SharePageClient page={page} />
    </main>
  );
}
