import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";
import path from "path";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function descriptionFrom(...values) {
  return cleanText(values.find((value) => cleanText(value)) || "Konten Grace Daily untuk pembacaan dan perenungan Alkitab.").slice(0, 160);
}

function keywordsFrom(...values) {
  return Array.from(new Set(values.flatMap((value) => Array.isArray(value) ? value : [value]).map(cleanText).filter(Boolean))).slice(0, 12);
}

function seoFields({ title, description, keywords, slug, canonicalPath, image, schemaType, publishedAt, updatedAt }) {
  return {
    title: cleanText(title).slice(0, 70) || "Grace Daily",
    description: descriptionFrom(description),
    keywords: keywordsFrom(...(keywords || []), title, "Grace Daily"),
    slug,
    canonicalPath,
    ...(image ? { image } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(schemaType ? { schemaType } : {}),
  };
}

function mergeSeo(existing, next) {
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined && value !== "")),
  };
}

async function migrateCollection(db, collectionName, build) {
  const snapshot = await db.collection(collectionName).get();
  let updated = 0;

  for (const item of snapshot.docs) {
    const data = item.data();
    const seo = build(item.id, data);
    if (!seo) continue;

    await item.ref.set({ seo: mergeSeo(data.seo, seo), updatedAt: data.updatedAt || new Date() }, { merge: true });
    updated += 1;
  }

  return { collection: collectionName, scanned: snapshot.size, updated };
}

async function main() {
  const keyPath = path.join(process.cwd(), "scripts", "serviceAccountKey.json");
  if (!existsSync(keyPath)) {
    console.error("scripts/serviceAccountKey.json not found.");
    process.exit(1);
  }

  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
  const db = getFirestore();

  const results = [];
  results.push(await migrateCollection(db, "daily_devotions", (id, data) => {
    const slug = data.slug || data.dateId || id;
    const title = data.title || `Renungan Harian ${slug}`;
    return seoFields({
      title,
      description: data.excerpt || data.body || data.reflection || data.verseText,
      keywords: [title, data.verseRef, "renungan harian", "daily devotion"],
      slug,
      canonicalPath: `/renungan/${slug}`,
      image: data.bannerUrl || data.imageUrl || data.illustrationUrl,
      schemaType: "Article",
      publishedAt: data.generatedAt || data.createdAt,
      updatedAt: data.updatedAt,
    });
  }));

  results.push(await migrateCollection(db, "blog_posts", (id, data) => {
    const slug = data.slug || id;
    const title = data.title || slug;
    return seoFields({
      title,
      description: data.excerpt || data.body,
      keywords: [title, data.category, "blog rohani", "Grace Daily"],
      slug,
      canonicalPath: `/blog/${slug}`,
      image: data.imageUrl,
      schemaType: "BlogPosting",
      publishedAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }));

  results.push(await migrateCollection(db, "bible_ai_pages", (id, data) => {
    const title = data.title || data.topic || id;
    const slug = data.slug || slugify(title);
    return seoFields({
      title,
      description: data.description || data.answer || data.summary,
      keywords: [title, data.mode, "AI Alkitab", "studi Alkitab"],
      slug,
      canonicalPath: `/hasil/${id}`,
      image: data.bannerUrl,
      schemaType: "CreativeWork",
      publishedAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }));

  results.push(await migrateCollection(db, "ai_requests", (id, data) => {
    const title = data.topic || data.title || data.mode || `AI Request ${id}`;
    const slug = data.slug || slugify(`${data.mode || "ai"}-${id}`);
    return seoFields({
      title,
      description: data.summary || data.answer || data.prompt,
      keywords: [title, data.mode, "AI rohani"],
      slug,
      canonicalPath: data.sharePageUrl || `/hasil/${id}`,
      schemaType: "CreativeWork",
      publishedAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }));

  results.push(await migrateCollection(db, "daily_readings", (id, data) => {
    const title = data.title || data.keyword || `${data.book || "Bacaan"} ${data.chapterStart || ""}`.trim() || id;
    const slug = data.slug || slugify(title);
    return seoFields({
      title,
      description: data.description || `${title} - rencana bacaan Alkitab Grace Daily.`,
      keywords: [data.keyword, title, data.book, "daily readings", "bacaan Alkitab"],
      slug,
      canonicalPath: `/reading-plan?reading=${encodeURIComponent(id)}`,
      schemaType: "CreativeWork",
      publishedAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }));

  results.push(await migrateCollection(db, "ensiklopedia_cache", (id, data) => {
    const kategori = data.kategori || id.split("-")[0] || "tokoh";
    const slug = data.slug || slugify(data.keyword || data.title || id);
    const title = data.title || data.keyword || slug;
    return seoFields({
      title: `${title} - Ensiklopedia Alkitab Grace Daily`,
      description: data.description || data.isi_artikel,
      keywords: [title, kategori, "Ensiklopedia Alkitab", "studi Alkitab"],
      slug,
      canonicalPath: `/ensiklopedia/${kategori}/${slug}`,
      image: data.bannerUrl || data.illustrationUrl,
      schemaType: "Article",
      publishedAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }));

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
