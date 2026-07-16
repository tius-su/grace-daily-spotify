import { getDocWithFallback } from "@/lib/server/db-fallback";
import { notFound } from "next/navigation";
import BlogPostClient from "@/app/components/BlogPostClient";
import { cache } from "react";
import { Metadata } from "next";

export const revalidate = 60; // Revalidate every minute

type BlogDetailProps = {
  params: Promise<{ id: string }>;
};

const getBlogPost = cache(async (id: string) => {
  try {
    const post = await getDocWithFallback<any>("blog_posts", id, "blog_posts.json");
    return post;
  } catch (error) {
    console.error("Gagal memuat detail artikel dengan fallback:", error);
    return null;
  }
});

export async function generateMetadata({ params }: BlogDetailProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getBlogPost(id);

  if (!post || post.status !== "published") {
    return {
      title: "Artikel Tidak Ditemukan",
    };
  }

  const seo = post.seo;
  const title = seo?.title || (post.title ?? "Artikel");
  const description = seo?.description || post.excerpt || "Baca artikel selengkapnya di Grace Daily.";
  const imageUrl = seo?.image || post.imageUrl || "/logo.png";
  const keywords = seo?.keywords || [title, post.category, "blog rohani", "Grace Daily"];

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

  const toDate = (value: any) => {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.toMillis === "function") return new Date(value.toMillis());
    if (value.seconds) return new Date(value.seconds * 1000);
    if (value._seconds) return new Date(value._seconds * 1000);
    if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  };

  const dateObj = toDate(post.createdAt) || new Date();

  const publishDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(dateObj);

  const serializablePost = {
    id: post.id,
    title: post.title ?? "",
    title_en: post.title_en ?? "",
    title_zh: post.title_zh ?? "",
    category: post.category ?? "",
    status: post.status ?? "",
    authorName: post.authorName ?? "Tim Grace Daily",
    imageUrl: post.imageUrl ?? "",
    excerpt: post.excerpt ?? "",
    excerpt_en: post.excerpt_en ?? "",
    excerpt_zh: post.excerpt_zh ?? "",
    body: post.body ?? "",
    body_en: post.body_en ?? "",
    body_zh: post.body_zh ?? "",
  };

  return <BlogPostClient post={serializablePost} publishDate={publishDate} />;
}

