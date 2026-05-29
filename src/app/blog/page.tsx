import { getAdminDb, reportDbFailure } from "@/lib/server/firebase-admin";
import { fetchCollectionFromRest, fetchPublishedBlogsFromRest, fetchDocFromRest } from "@/lib/server/firestore-rest";
import Link from "next/link";
import { Suspense } from "react";
import BlogListing from "@/app/components/BlogListing";
import { blogCategories as staticBlogCategories } from "@/lib/data";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

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

  const adminDb = getAdminDb();
  let fetchedSuccessfully = false;

  // 1. Prioritize cached REST API fetch
  try {
    const restCats = await fetchDocFromRest("settings", "blog_categories");
    if (restCats && Array.isArray(restCats.list) && restCats.list.length > 0) {
      allCategories = restCats.list;
    }

    const restPosts = await fetchPublishedBlogsFromRest();
    const loadedPosts: any[] = [];
    
    restPosts.forEach((data) => {
      loadedPosts.push({
        id: data.id,
        title: data.title ?? "",
        excerpt: data.excerpt ?? "",
        imageUrl: data.imageUrl ?? "",
        category: data.category ?? "",
        createdAt: data.createdAt
          ? (typeof data.createdAt.toDate === "function"
            ? data.createdAt.toDate().getTime()
            : (typeof data.createdAt === "string" || typeof data.createdAt === "number"
              ? new Date(data.createdAt).getTime()
              : null))
          : null,
      });
    });

    posts = loadedPosts;
    posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    fetchedSuccessfully = true;
  } catch (error) {
    console.error("Gagal memuat artikel blog dari Firestore REST:", error);
  }

  // 2. Fallback to Admin SDK if REST query failed
  if (!fetchedSuccessfully && adminDb) {
    try {
      const blogCatsSnap = await adminDb.collection("settings").doc("blog_categories").get();
      if (blogCatsSnap.exists) {
        const catList = blogCatsSnap.data()?.list;
        if (Array.isArray(catList) && catList.length > 0) {
          allCategories = catList;
        }
      }

      const snapshot = await adminDb.collection("blog_posts").get();
      const loadedPosts: any[] = [];
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.status === "published") {
          loadedPosts.push({
            id: doc.id,
            title: data.title ?? "",
            excerpt: data.excerpt ?? "",
            imageUrl: data.imageUrl ?? "",
            category: data.category ?? "",
            createdAt: data.createdAt
              ? (typeof data.createdAt.toDate === "function"
                ? data.createdAt.toDate().getTime()
                : (typeof data.createdAt === "string" || typeof data.createdAt === "number"
                  ? new Date(data.createdAt).getTime()
                  : null))
              : null,
          });
        }
      });

      posts = loadedPosts;
      posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      fetchedSuccessfully = true;
    } catch (error) {
      console.error("Gagal memuat artikel blog dari Firestore (Admin SDK):", error);
      reportDbFailure();
    }
  }

  // Fallback if no categories or DB query failed
  if (allCategories.length === 0) {
    allCategories = staticBlogCategories;
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-12 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
              Blog Grace Daily
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-[#14213d] sm:text-5xl">
              Artikel, Renungan, dan Teologi.
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white transition hover:bg-[#1a2d52] self-start"
          >
            Kembali ke beranda
          </Link>
        </header>

        {/* Client Listing with interactive Category Scroll, Voice Search, and Search filtering */}
        <Suspense fallback={<p className="text-lg text-[#52606d] italic">Memuat daftar artikel...</p>}>
          <BlogListing initialPosts={posts} allCategories={allCategories} />
        </Suspense>
      </div>
    </main>
  );
}