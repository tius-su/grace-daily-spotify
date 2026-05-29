import { getAdminDb } from "@/lib/server/firebase-admin";
import { fetchDocFromRest } from "@/lib/server/firestore-rest";
import { notFound } from "next/navigation";
import BlogPostClient from "@/app/components/BlogPostClient";
import { cache } from "react";
import { Metadata } from "next";

export const revalidate = 60; // Revalidate every minute

type BlogDetailProps = {
  params: Promise<{ id: string }>;
};

const getBlogPost = cache(async (id: string) => {
  const adminDb = getAdminDb();
  let post: any = null;
  if (adminDb) {
    try {
      const docSnap = await adminDb.collection("blog_posts").doc(id).get();
      if (docSnap.exists) {
        post = { id: docSnap.id, ...docSnap.data() };
      }
    } catch (error) {
      console.error("Gagal memuat detail artikel:", error);
    }
  } else {
    try {
      const restDoc = await fetchDocFromRest("blog_posts", id);
      if (restDoc) {
        post = restDoc;
      }
    } catch (error) {
      console.error("Gagal memuat detail artikel via REST:", error);
    }
  }
  return post;
});

export async function generateMetadata({ params }: BlogDetailProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getBlogPost(id);

  if (!post || post.status !== "published") {
    return {
      title: "Artikel Tidak Ditemukan",
    };
  }

  const title = post.title ?? "Artikel";
  const description = post.excerpt ?? "Baca artikel selengkapnya di Grace Daily.";
  const imageUrl = post.imageUrl || "/logo.jpg";

  return {
    title,
    description,
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

export default async function BlogPostDetailPage({ params }: BlogDetailProps) {
  const { id } = await params;
  const post = await getBlogPost(id);

  if (!post) {
    return notFound();
  }

  // Ensure only published posts are publicly viewable
  if (post.status !== "published") {
    return notFound();
  }

  const publishDate = post.createdAt?.toDate 
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(post.createdAt.toDate())
    : "Baru saja";

  const serializablePost = {
    id: post.id,
    title: post.title ?? "",
    category: post.category ?? "",
    status: post.status ?? "",
    authorName: post.authorName ?? "Tim Grace Daily",
    imageUrl: post.imageUrl ?? "",
    excerpt: post.excerpt ?? "",
    body: post.body ?? "",
  };

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-12 text-[#1f2933] sm:px-8">
      <BlogPostClient post={serializablePost} publishDate={publishDate} />
    </main>
  );
}

