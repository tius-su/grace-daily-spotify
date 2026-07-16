import { getAdminDb, reportDbFailure } from "@/lib/server/firebase-admin";
import { fetchCollectionFromRest, fetchPublishedBlogsFromRest, fetchDocFromRest } from "@/lib/server/firestore-rest";
import { Suspense } from "react";
import BlogListing from "@/app/components/BlogListing";
import { blogCategories as staticBlogCategories } from "@/lib/data";
import { Metadata } from "next";

export const revalidate = 300; // Cache page for 5 minutes

export const metadata: Metadata = {
  title: "Blog & Artikel",
  description: "Dapatkan inspirasi, hikmat, renungan, dan artikel teologi mendalam dari tim Grace Daily.",
  openGraph: {
    title: "Blog & Artikel | Grace Daily",
    description: "Dapatkan inspirasi, hikmat, renungan, dan artikel teologi mendalam dari tim Grace Daily.",
  },
};

export default async function BlogIndexPage() {
  let posts: any[] = [];
  let allCategories: string[] = [];

  try {
    const { getCollectionWithFallback, getDocWithFallback } = await import("@/lib/server/db-fallback");
    const { queryD1 } = await import("@/lib/server/d1");

    // 1. Fetch categories
    const catsDoc = await getDocWithFallback<any>("settings", "blog_categories", "settings.json");
    if (catsDoc && Array.isArray(catsDoc.list) && catsDoc.list.length > 0) {
      allCategories = catsDoc.list;
    }

    // 2. Fetch blog posts (Try D1 first, fallback to R2)
    let backupPosts: any[] = [];
    const d1Posts = await queryD1<any>(
      "SELECT id, title, title_en, title_zh, category, tags, image_url as imageUrl, excerpt, excerpt_en, excerpt_zh, created_at as createdAt FROM articles ORDER BY created_at DESC LIMIT 500"
    );

    if (d1Posts && Array.isArray(d1Posts) && d1Posts.length > 0) {
      backupPosts = d1Posts.map(p => ({
        ...p,
        status: "published" // D1 only stores published metadata
      }));
      console.log(`[Blog Page] Loaded ${d1Posts.length} posts from D1.`);
    } else {
      console.log("[Blog Page] D1 query returned null or empty, falling back to R2...");
      backupPosts = await getCollectionWithFallback<any>("blog_posts", "blog_posts.json");
    }

    const loadedPosts: any[] = [];

    backupPosts.forEach((data) => {
      if (data.status === "published" || !data.status) {
        loadedPosts.push({
          id: data.id,
          title: data.title ?? "",
          title_en: data.title_en ?? "",
          title_zh: data.title_zh ?? "",
          excerpt: data.excerpt ?? "",
          excerpt_en: data.excerpt_en ?? "",
          excerpt_zh: data.excerpt_zh ?? "",
          imageUrl: data.imageUrl ?? "",
          category: data.category ?? "",
          createdAt: (() => {
            const value = data.createdAt;
            if (!value) return null;
            if (typeof value.toDate === "function") return value.toDate().getTime();
            if (typeof value.toMillis === "function") return value.toMillis();
            if (value.seconds) return value.seconds * 1000;
            if (value._seconds) return value._seconds * 1000;
            if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
              const date = new Date(value);
              return Number.isNaN(date.getTime()) ? null : date.getTime();
            }
            return null;
          })(),
        });
      }
    });

    posts = loadedPosts;
    posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (error) {
    console.error("Gagal memuat artikel blog:", error);
  }

  if (allCategories.length === 0) {
    allCategories = staticBlogCategories;
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-12 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={
          <div className="space-y-6 animate-pulse">
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
            <div className="h-10 w-96 bg-gray-200 rounded"></div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 mt-12">
              <div className="h-64 bg-white border border-[#dfd8ca] rounded-xl"></div>
              <div className="h-64 bg-white border border-[#dfd8ca] rounded-xl"></div>
              <div className="h-64 bg-white border border-[#dfd8ca] rounded-xl"></div>
            </div>
          </div>
        }>
          <BlogListing initialPosts={posts} allCategories={allCategories} />
        </Suspense>
      </div>
    </main>
  );
}
