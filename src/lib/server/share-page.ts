import { getDocWithFallback } from "@/lib/server/db-fallback";

export type SharePage = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  prompt?: string;
  content: string;
  sourceId?: string;
  bannerUrl?: string;
  status?: string;
  createdAt?: Date | null;
  mode?: string;
  seo?: any;
};

function toDate(value: any): Date | null {
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
}

export function slugifyShareTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52) || "hasil";
}

export async function getSharePageById(id: string): Promise<SharePage | null> {
  const data = await getDocWithFallback<any>("share_pages", id, "share_pages.json");

  if (!data) {
    return null;
  }

  if (data.status && data.status !== "published") {
    return null;
  }

  return {
    id: data.id ?? id,
    type: data.type ?? "Grace Daily",
    title: data.title ?? "Hasil Grace Daily",
    subtitle: data.subtitle,
    prompt: data.prompt,
    content: data.content ?? "",
    sourceId: data.sourceId,
    bannerUrl: data.bannerUrl,
    status: data.status,
    createdAt: toDate(data.createdAt),
    mode: data.mode,
    seo: data.seo || null,
  };
}
