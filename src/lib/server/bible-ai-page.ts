import { getDocWithFallback } from "@/lib/server/db-fallback";

export type BibleAiPage = {
  id: string;
  type: "explanation" | "commentary";
  title: string;
  reference: string;
  verseText: string;
  translation: string;
  content: string;
  bannerUrl?: string;
  provider?: string;
  status?: string;
  createdAt?: Date | null;
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

export async function getBibleAiPageById(id: string): Promise<BibleAiPage | null> {
  const data = await getDocWithFallback<any>("bible_ai_pages", id, "bible_ai_pages.json");

  if (!data) {
    return null;
  }

  if (data.status && data.status !== "published") {
    return null;
  }

  return {
    id: data.id ?? id,
    type: data.type === "commentary" ? "commentary" : "explanation",
    title: data.title ?? "Pendalaman Alkitab",
    reference: data.reference ?? "",
    verseText: data.verseText ?? "",
    translation: data.translation ?? "AYT",
    content: data.content ?? "",
    bannerUrl: data.bannerUrl,
    provider: data.provider,
    status: data.status,
    createdAt: toDate(data.createdAt),
  };
}
