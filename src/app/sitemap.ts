import { MetadataRoute } from "next";
import { getCollectionWithFallback } from "@/lib/server/db-fallback";

function parseDate(val: any): Date {
  if (!val) return new Date();
  if (typeof val.toDate === "function") return val.toDate();
  if (val._seconds) return new Date(val._seconds * 1000);
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.gracedaily.my.id";

  // Base routes of the application
  const routes = [
    "",
    "/blog",
    "/alkitab",
    "/rencana-baca",
    "/tanya-pendeta",
    "/komunitas-doa",
    "/grup-renungan",
    "/jurnal",
    "/kontak",
    "/syarat-dan-ketentuan",
    "/ai",
  ].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));

  let blogEntries: any[] = [];
  let devotionEntries: any[] = [];
  let encyclopediaEntries: any[] = [];

  // 1. Fetch Blog Posts for Sitemap
  try {
    const blogs = await getCollectionWithFallback<any>("blog_posts", "blog_posts.json");
    const publishedBlogs = blogs.filter((d) => d.status === "published");
    publishedBlogs.forEach((data) => {
      const updatedAt = parseDate(data.updatedAt);
      const canonical = data.seo?.canonicalPath || `/blog/${data.id}`;
      blogEntries.push({
        url: `${siteUrl}${canonical.startsWith("/") ? "" : "/"}${canonical}`,
        lastModified: updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      });
    });
  } catch (error) {
    console.error("Gagal memuat artikel blog untuk sitemap:", error);
  }

  // 2. Fetch Devotions for Sitemap
  try {
    const devotions = await getCollectionWithFallback<any>("daily_devotions", "renungan.json");
    const publishedDevotions = devotions.filter((d) => d.status === "published");
    publishedDevotions.forEach((data) => {
      const generatedAt = parseDate(data.generatedAt);
      const canonical = data.seo?.canonicalPath || `/renungan/${data.id}`;
      devotionEntries.push({
        url: `${siteUrl}${canonical.startsWith("/") ? "" : "/"}${canonical}`,
        lastModified: generatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      });
    });
  } catch (error) {
    console.error("Gagal memuat renungan untuk sitemap:", error);
  }

  // 3. Fetch Encyclopedia for Sitemap
  try {
    const categories = [
      "tokoh", "tempat", "kamus", "perumpamaan", "mukjizat", "kitab", "kronologi",
      "silsilah", "teologi", "teologi-2", "topikal_alkitab", "peristiwa", "peristiwa-2",
    ];
    const encyclopediaDocs: any[] = [];
    for (const cat of categories) {
      try {
        const docs = await getCollectionWithFallback<any>("ensiklopedia_cache", `${cat}.json`);
        encyclopediaDocs.push(...docs);
      } catch (err) {
        console.error(`Sitemap: Gagal memuat ensiklopedia kategori ${cat}:`, err);
      }
    }

    const publishedEncy = encyclopediaDocs.filter((d) => d.status === "published");
    publishedEncy.forEach((data) => {
      const updatedAt = parseDate(data.updatedAt);
      const canonical = data.seo?.canonicalPath || `/ensiklopedia/${data.kategori || "tokoh"}/${data.slug || data.id}`;
      encyclopediaEntries.push({
        url: `${siteUrl}${canonical.startsWith("/") ? "" : "/"}${canonical}`,
        lastModified: updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
    });
  } catch (error) {
    console.error("Gagal memuat ensiklopedia untuk sitemap:", error);
  }

  return [...routes, ...blogEntries, ...devotionEntries, ...encyclopediaEntries];
}
