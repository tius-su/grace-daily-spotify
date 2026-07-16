import { getDevotionById } from "@/lib/server/daily-devotion";
import { notFound } from "next/navigation";
import DevotionPageClient from "@/app/components/DevotionPageClient";
import { cache } from "react";
import { Metadata } from "next";
import { resolveDailyHeroImage } from "@/lib/daily-hero-images";

export const revalidate = 300; // Revalidate every 5 minutes

type DevotionDetailProps = {
  params: Promise<{ id: string }>;
};

const getDevotionData = cache(async (id: string) => {
  return await getDevotionById(id);
});

export async function generateMetadata({ params }: DevotionDetailProps): Promise<Metadata> {
  const { id } = await params;
  const devotion = await getDevotionData(id);

  if (!devotion) {
    return {
      title: "Renungan Tidak Ditemukan",
    };
  }

  const seo = (devotion as any).seo;
  const title = seo?.title || (devotion.title ?? "Renungan Harian");
  const description = seo?.description || `${devotion.verseRef} - ${devotion.verseText.substring(0, 120)}...`;
  const imageUrl = seo?.image || devotion.bannerUrl || resolveDailyHeroImage(devotion.imageUrl, devotion.illustrationUrl);
  const keywords = seo?.keywords || [title, devotion.verseRef, "Renungan Harian", "Grace Daily"];

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: "article",
      images: [
        {
          url: imageUrl,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function DevotionDetailPage({ params }: DevotionDetailProps) {
  const { id } = await params;
  const devotion = await getDevotionData(id);

  if (!devotion) {
    return notFound();
  }

  const serializableDevotion = {
    id: devotion.id,
    title: devotion.title,
    verseRef: devotion.verseRef,
    verseText: devotion.verseText,
    body: devotion.body,
    prayer: devotion.prayer,
    imageUrl: devotion.imageUrl,
    illustrationUrl: devotion.illustrationUrl,
    bannerUrl: devotion.bannerUrl,
  };

  return <DevotionPageClient devotion={serializableDevotion} />;
}
