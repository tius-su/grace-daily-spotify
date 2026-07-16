import { NextResponse } from "next/server";
import { getDocWithFallback, getCollectionWithFallback } from "@/lib/server/db-fallback";
import { cleanEncyclopediaArticle } from "@/lib/encyclopedia";

export const dynamic = "force-dynamic";

function toSlugFromKeyword(keyword: string) {
  return keyword
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kategori = (searchParams.get("kategori") || searchParams.get("cat") || "tokoh").toLowerCase();
  const keyword = searchParams.get("keyword") || searchParams.get("q") || "";
  const trimmed = keyword.trim();

  if (!trimmed) {
    return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
  }

  const expectedSlug = toSlugFromKeyword(trimmed);
  const docId = `${kategori}-${expectedSlug}`;
  const r2File = `${kategori}.json`;

  try {
    // Attempt doc retrieval (the db-fallback.ts handles routing to R2 or Firebase and logging network stats)
    let articleData = await getDocWithFallback<any>("ensiklopedia_cache", docId, r2File);

    // Fallback search by exact keyword in case slug doesn't match
    if (!articleData) {
      const allDocs = await getCollectionWithFallback<any>("ensiklopedia_cache", r2File);
      const match = allDocs.find(
        (d: any) =>
          d.kategori === kategori &&
          d.status === "published" &&
          (d.keyword?.toLowerCase() === trimmed.toLowerCase() || d.title?.toLowerCase() === trimmed.toLowerCase())
      );
      if (match) {
        articleData = match;
      }
    }

    if (!articleData || articleData.status !== "published") {
      return NextResponse.json({ error: "Artikel belum tersedia." }, { status: 404 });
    }

    // Return the cleaned article data
    return NextResponse.json({
      ok: true,
      article: {
        id: articleData.id || docId,
        kategori: articleData.kategori || kategori,
        keyword: articleData.keyword || trimmed,
        slug: articleData.slug || expectedSlug,
        title: articleData.title || articleData.keyword || trimmed,
        isi_artikel: cleanEncyclopediaArticle(articleData.isi_artikel),
        bannerUrl: articleData.bannerUrl || "",
        illustrationUrl: articleData.illustrationUrl || "",
      },
    });
  } catch (err: any) {
    console.error("[Ensiklopedia Search API] Error searching:", err);
    return NextResponse.json({ error: "Terjadi kesalahan saat mencari artikel." }, { status: 500 });
  }
}
