import { Suspense } from "react";
import { getCollectionWithFallback } from "@/lib/server/db-fallback";
import { excerptFromArticle } from "@/lib/encyclopedia";
import { EnsiklopediaContainer } from "@/app/components/EnsiklopediaContainer";

export const revalidate = 300; // Cache page for 5 minutes

export default async function EnsiklopediaPage() {
  let initialArticles: any[] = [];

  try {
    // All categories including peristiwa-2 and teologi-2
    const categories = [
      "tokoh", "tempat", "kamus", "perumpamaan", "mukjizat", "kitab", "kronologi",
      "silsilah", "teologi", "teologi-2", "topikal_alkitab", "peristiwa", "peristiwa-2",
    ];
    const { queryD1 } = await import("@/lib/server/d1");
    const d1Ensi = await queryD1<any>(
      "SELECT id, slug, keyword, title, title_en, title_zh, kategori, banner_url as bannerUrl, updated_at as updatedAt FROM encyclopedia ORDER BY updated_at DESC LIMIT 2000"
    );

    let allDocs: any[] = [];
    if (d1Ensi && Array.isArray(d1Ensi) && d1Ensi.length > 0) {
      allDocs = d1Ensi;
      console.log(`[Ensiklopedia Page] Loaded ${d1Ensi.length} entries from D1.`);
    } else {
      console.log("[Ensiklopedia Page] D1 query returned null or empty, falling back to R2...");
      for (const cat of categories) {
        const data = await getCollectionWithFallback<any>("ensiklopedia_cache", `${cat}.json`);
        allDocs.push(...data);
      }
    }


    initialArticles = allDocs
      .filter((d) => d.status === "published" || !d.status)
      .map((d) => {
        let updatedStr = new Date().toISOString();
        if (d.updatedAt) {
          if (d.updatedAt._seconds) {
            updatedStr = new Date(d.updatedAt._seconds * 1000).toISOString();
          } else if (d.updatedAt.seconds) {
            updatedStr = new Date(d.updatedAt.seconds * 1000).toISOString();
          } else if (typeof d.updatedAt === "string" || typeof d.updatedAt === "number") {
            updatedStr = new Date(d.updatedAt).toISOString();
          }
        }
        return {
          id: d.id,
          title: d.title || d.keyword || "",
          title_en: d.title_en ?? "",
          title_zh: d.title_zh ?? "",
          slug: d.slug || "",
          kategori: d.kategori || "",
          summary: d.isi_artikel ? excerptFromArticle(d.isi_artikel, 120) : "",
          bannerUrl: d.bannerUrl || "",
          illustrationUrl: d.illustrationUrl || "",
          updatedAt: updatedStr,
        };
      });
  } catch (err) {
    console.error("Gagal memuat ensiklopedia cache:", err);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-8 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<div className="py-10 text-[#52606d]">Memuat...</div>}>
          <EnsiklopediaContainer initialArticles={initialArticles} />
        </Suspense>
      </div>
    </main>
  );
}

