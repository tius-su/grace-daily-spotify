import { NextResponse } from "next/server";
import { queryD1 } from "@/lib/server/d1";
import { searchBibleVerses } from "@/lib/bible";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const trimmed = q.trim();

  if (!trimmed) {
    return NextResponse.json({
      ok: true,
      results: { articles: [], encyclopedia: [], devotions: [], verses: [] },
    });
  }

  const searchPattern = `%${trimmed}%`;

  try {
    // 1. Search Articles (D1)
    const articlesPromise = queryD1<any>(
      `SELECT id, title, category, excerpt, created_at as createdAt 
       FROM articles 
       WHERE title LIKE ? OR excerpt LIKE ? OR category LIKE ? 
       ORDER BY created_at DESC LIMIT 6`,
      [searchPattern, searchPattern, searchPattern]
    ).catch((err) => {
      console.error("[Search API] Articles query failed:", err);
      return null;
    });

    // 2. Search Encyclopedia (D1)
    const encyclopediaPromise = queryD1<any>(
      `SELECT id, slug, keyword, title, kategori, updated_at as updatedAt 
       FROM encyclopedia 
       WHERE keyword LIKE ? OR title LIKE ? OR kategori LIKE ? 
       LIMIT 6`,
      [searchPattern, searchPattern, searchPattern]
    ).catch((err) => {
      console.error("[Search API] Encyclopedia query failed:", err);
      return null;
    });

    // 3. Search Devotions (D1 from devotion_translations)
    const devotionsPromise = queryD1<any>(
      `SELECT devotion_id as id, title, excerpt 
       FROM devotion_translations 
       WHERE language_code = 'id' AND (title LIKE ? OR excerpt LIKE ?) 
       LIMIT 6`,
      [searchPattern, searchPattern]
    ).catch((err) => {
      console.error("[Search API] Devotions query failed:", err);
      return null;
    });

    // 4. Search Bible Verses (Client-Server hybrid search from lib/bible)
    const biblePromise = searchBibleVerses(trimmed, "ind_ayt")
      .then((verses) => verses.slice(0, 6))
      .catch((err) => {
        console.error("[Search API] Bible search failed:", err);
        return [];
      });

    // Resolve all searches in parallel
    const [articlesRes, encyclopediaRes, devotionsRes, bibleRes] = await Promise.all([
      articlesPromise,
      encyclopediaPromise,
      devotionsPromise,
      biblePromise,
    ]);

    // Format results
    const articles = (articlesRes || []).map((art: any) => ({
      id: art.id,
      title: art.title,
      category: art.category,
      excerpt: art.excerpt,
      createdAt: art.createdAt,
      url: `/blog/${art.id}`,
    }));

    const encyclopedia = (encyclopediaRes || []).map((ensi: any) => ({
      id: ensi.id,
      slug: ensi.slug,
      title: ensi.title || ensi.keyword,
      keyword: ensi.keyword,
      kategori: ensi.kategori,
      url: `/ensiklopedia/${ensi.kategori}/${ensi.slug}`,
    }));

    const devotions = (devotionsRes || []).map((dev: any) => ({
      id: dev.id,
      title: dev.title,
      excerpt: dev.excerpt,
      url: `/renungan/${dev.id}`,
    }));

    const verses = (bibleRes || []).map((v: any) => ({
      id: v.id,
      reference: v.reference,
      text: v.text,
      translation: v.translation,
      url: `/alkitab?search=${encodeURIComponent(v.reference)}`,
    }));

    return NextResponse.json({
      ok: true,
      results: {
        articles,
        encyclopedia,
        devotions,
        verses,
      },
    });
  } catch (err: any) {
    console.error("[Search API] Error occurred during search execution:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses pencarian." },
      { status: 500 }
    );
  }
}
