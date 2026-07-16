import { encyclopediaSlug } from "./encyclopedia";

export type SeoSchemaType = "Article" | "BlogPosting" | "CreativeWork" | "FAQPage";

export type SeoFields = {
  title: string;
  description: string;
  keywords: string[];
  slug: string;
  canonicalPath: string;
  image?: string;
  publishedAt?: unknown;
  updatedAt?: unknown;
  schemaType?: SeoSchemaType;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeKeywords(values: Array<unknown>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => cleanText(value))
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

export function buildSeoFields(params: {
  title: string;
  description?: unknown;
  keywords?: Array<unknown>;
  slug?: string;
  canonicalPath: string;
  image?: string;
  publishedAt?: unknown;
  updatedAt?: unknown;
  schemaType?: SeoSchemaType;
}): SeoFields {
  const title = cleanText(params.title).slice(0, 70) || "Grace Daily";
  const description =
    cleanText(params.description).slice(0, 160) ||
    "Konten rohani Grace Daily untuk membantu pembacaan dan perenungan Alkitab.";
  const slug = params.slug ? encyclopediaSlug(params.slug) : encyclopediaSlug(title);

  return {
    title,
    description,
    keywords: dedupeKeywords([...((params.keywords ?? []) as unknown[]), title, "Grace Daily"]),
    slug,
    canonicalPath: params.canonicalPath,
    ...(params.image ? { image: params.image } : {}),
    ...(params.publishedAt ? { publishedAt: params.publishedAt } : {}),
    ...(params.updatedAt ? { updatedAt: params.updatedAt } : {}),
    ...(params.schemaType ? { schemaType: params.schemaType } : {}),
  };
}
