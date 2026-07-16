import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { getDocWithFallback } from "@/lib/server/db-fallback";
import {
  cleanEncyclopediaArticle,
  encyclopediaSlug,
  excerptFromArticle,
  isLegacyEncyclopediaIllustrationUrl,
  isValidEncyclopediaIllustrationUrl,
} from "@/lib/encyclopedia";
import { ensureEncyclopediaBannerR2, ensureEncyclopediaIllustrationR2 } from "@/lib/server/encyclopedia-images";
import type { Metadata } from "next";
import EncyclopediaClient from "./client";

// Simple server-rendered detail page to avoid 404 + JSON leakage.
// It renders content from Firestore cache: ensiklopedia_cache.

type EncyclopediaCacheDoc = {
  id: string;
  kategori: string;
  keyword: string;
  slug: string;
  title: string;
  title_en?: string;
  title_zh?: string;
  isi_artikel: string;
  isi_artikel_en?: string;
  isi_artikel_zh?: string;
  bannerUrl?: string;
  illustrationUrl?: string;
  seo?: any;
  status?: string;
};

function safeToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getEnsiklopediaR2FileName(kategori: string): string {
  const cat = kategori.toLowerCase().replace(/_/g, "_");
  // Map semua 13 kategori ke file R2 yang benar
  const mapping: Record<string, string> = {
    "tokoh": "tokoh.json",
    "tempat": "tempat.json",
    "kamus": "kamus.json",
    "istilah": "kamus.json",
    "mukjizat": "mukjizat.json",
    "perumpamaan": "perumpamaan.json",
    "kitab": "kitab.json",
    "kronologi": "kronologi.json",
    "silsilah": "silsilah.json",
    "teologi": "teologi.json",
    "teologi-2": "teologi-2.json",
    "topikal_alkitab": "topikal_alkitab.json",
    "peristiwa": "peristiwa.json",
    "peristiwa-2": "peristiwa-2.json",
  };
  return mapping[cat] ?? `${cat}.json`;
}


async function getCacheDoc(
  kategori: string,
  slug: string,
  options: { ensureImages?: boolean } = {},
): Promise<EncyclopediaCacheDoc | null> {
  const db = getAdminDb();
  const docId = `${kategori}-${slug}`;
  const r2File = getEnsiklopediaR2FileName(kategori);

  try {
    const data: any = await getDocWithFallback<any>("ensiklopedia_cache", docId, r2File);
    if (!data) return null;

    const keyword = safeToText(data.keyword ?? slug);
    const title = safeToText(data.title ?? data.keyword ?? slug);
    const cleanArticle = cleanEncyclopediaArticle(data.isi_artikel);
    let bannerUrl = typeof data.bannerUrl === "string" ? data.bannerUrl : undefined;
    let illustrationUrl = typeof data.illustrationUrl === "string" ? data.illustrationUrl : undefined;
    const shouldRegenerateIllustration =
      !illustrationUrl ||
      isLegacyEncyclopediaIllustrationUrl(illustrationUrl) ||
      !isValidEncyclopediaIllustrationUrl(illustrationUrl);

    if (options.ensureImages && (!bannerUrl || shouldRegenerateIllustration)) {
      const imageSlug = `${kategori}-${encyclopediaSlug(keyword || title || slug)}`;
      const updates: Record<string, string | Date> = { updatedAt: new Date() };

      if (!bannerUrl) {
        bannerUrl = await ensureEncyclopediaBannerR2({
          slug: imageSlug,
          kategori,
          topik: keyword || title || slug,
        });
        if (bannerUrl) updates.bannerUrl = bannerUrl;
      }

      if (shouldRegenerateIllustration) {
        illustrationUrl = await ensureEncyclopediaIllustrationR2({
          slug: `${imageSlug}-illustration`,
          kategori,
          topik: keyword || title || slug,
          force: isLegacyEncyclopediaIllustrationUrl(illustrationUrl),
        });
        if (illustrationUrl) updates.illustrationUrl = illustrationUrl;
      }

      if (db && (updates.bannerUrl || updates.illustrationUrl)) {
        try {
          await db.collection("ensiklopedia_cache").doc(docId).set(updates, { merge: true });
          try {
            const { uploadToR2Path } = await import("@/lib/server/backup-r2-service");
            const key = `encyclopedia/${kategori}/${slug}.json`;
            await uploadToR2Path(key, JSON.stringify({
              ...data,
              ...updates,
              isi_artikel: cleanArticle,
              bannerUrl: bannerUrl || data.bannerUrl || "",
              illustrationUrl: illustrationUrl || data.illustrationUrl || "",
            }));
            console.log(`[Ensiklopedia] Successfully synced single updated doc with images to R2: ${key}`);
          } catch (syncErr) {
            console.error("[Ensiklopedia] Failed to sync updated doc with images to R2:", syncErr);
          }
        } catch (dbErr) {
          console.warn("[Ensiklopedia] Failed to save generated image URLs to DB (likely quota limit):", dbErr);
        }
      }
    }

    return {
      id: docId,
      kategori: data.kategori ?? kategori,
      keyword,
      slug: data.slug ?? slug,
      title,
      title_en: data.title_en || undefined,
      title_zh: data.title_zh || undefined,
      isi_artikel: cleanArticle,
      isi_artikel_en: data.isi_artikel_en || undefined,
      isi_artikel_zh: data.isi_artikel_zh || undefined,
      bannerUrl,
      illustrationUrl,
      seo: data.seo || null,
      status: data.status || "review",
    };
  } catch (err) {
    console.error("[Ensiklopedia] getCacheDoc failed (Quota Exceeded?):", err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { kategori: string; slug: string };
}): Promise<Metadata> {
  const doc = await getCacheDoc(params.kategori, params.slug);
  if (!doc || doc.status !== "published") {
    return {
      title: "Artikel Tidak Ditemukan",
    };
  }
  const seo = (doc as any)?.seo;
  const title = seo?.title || (doc?.title ? `Ensiklopedia: ${doc.title}` : `Ensiklopedia Alkitab`);
  const description = seo?.description || (doc?.isi_artikel
    ? excerptFromArticle(doc.isi_artikel, 150)
    : "Artikel ensiklopedia Alkitab yang akurat ");
  const keywords = seo?.keywords || (doc?.keyword ? [doc.keyword, doc.kategori, "Ensiklopedia Alkitab"] : ["Ensiklopedia Alkitab"]);

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      images: doc?.bannerUrl || doc?.illustrationUrl ? [{ url: seo?.image || doc.bannerUrl || doc.illustrationUrl }] : [],
    },
  };
}

export default async function EncyclopediaDetailPage({
  params,
}: {
  params: { kategori: string; slug: string };
}) {
  const { kategori, slug } = params;
  
  const { isBot } = await import("@/lib/server/storage-config");
  const skipImages = isBot();
  const doc = await getCacheDoc(kategori, slug, { ensureImages: !skipImages });

  if (!doc || doc.status !== "published") {
    return notFound();
  }

  return (
    <EncyclopediaClient
      title={doc.title}
      title_en={doc.title_en}
      title_zh={doc.title_zh}
      kategori={doc.kategori}
      keyword={doc.keyword}
      slug={doc.slug}
      bannerUrl={doc.bannerUrl}
      illustrationUrl={doc.illustrationUrl}
      isi_artikel={doc.isi_artikel}
      isi_artikel_en={doc.isi_artikel_en}
      isi_artikel_zh={doc.isi_artikel_zh}
    />
  );
}
