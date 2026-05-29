import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { notFound } from "next/navigation";
import Link from "next/link";

// Mencegah Next.js melakukan cache permanen jika artikel sering diubah
export const revalidate = 60;

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  if (!db) return notFound();

  // Mengambil dokumen dari koleksi "blog_posts" berdasarkan ID (slug)
  const docRef = doc(db, "blog_posts", params.slug);
  const docSnap = await getDoc(docRef);

  // Jika artikel tidak ditemukan ATAU statusnya masih draft, tampilkan 404
  if (!docSnap.exists() || docSnap.data().status !== "published") {
    notFound();
  }

  const post = docSnap.data();

  // Format tanggal dari Firestore Timestamp (jika ada)
  const publishDate = post.createdAt?.toDate
    ? post.createdAt.toDate().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Baru saja";

  return (
    <main className="min-h-screen bg-[#f7f4ee] py-12 text-[#1f2933]">
      <article className="mx-auto max-w-3xl px-5 sm:px-8">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center text-sm font-semibold text-[#2a6f6f] hover:underline"
        >
          &larr; Kembali ke Blog
        </Link>

        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
            {post.category}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#14213d] sm:text-4xl md:text-5xl">
            {post.title}
          </h1>
          <div className="mt-4 flex items-center gap-2 text-sm text-[#52606d]">
            <span>Oleh {post.authorName || "Admin Grace Daily"}</span>
            <span>&bull;</span>
            <time>{publishDate}</time>
          </div>
        </header>

        {post.imageUrl && (
          <div className="mb-10 overflow-hidden rounded-xl border border-[#dfd8ca] bg-white shadow-sm">
            <img src={post.imageUrl} alt={post.title} className="w-full object-cover" />
          </div>
        )}

        {post.excerpt && (
          <p className="mb-8 text-lg italic leading-relaxed text-[#52606d]">
            {post.excerpt}
          </p>
        )}

        {/* Merender konten HTML dari TinyBlockEditor */}
        <div
          className="prose prose-lg max-w-none text-[#334155] prose-headings:text-[#14213d] prose-a:text-[#2a6f6f] prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: post.body }}
        />
      </article>
    </main>
  );
}