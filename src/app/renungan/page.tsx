import Link from "next/link";
import { Suspense } from "react";
import { RenunganArchive } from "@/app/components/RenunganArchive";

export const revalidate = 300; // Cache page for 5 minutes

export const metadata = {
  title: "Arsip Renungan Harian - Grace Daily",
  description: "Daftar renungan harian Kristen dari hari-hari sebelumnya. Temukan inspirasi firman Tuhan kapan saja.",
};

export default async function RenunganPage() {
  let devotions: any[] = [];

  try {
    const { getCollectionWithFallback } = await import("@/lib/server/db-fallback");
    const dbDevotions = await getCollectionWithFallback<any>("daily_devotions", "renungan.json");
    
    // Fetch D1 translations
    let transMap: Record<string, Record<string, string>> = {};
    try {
      const { queryD1 } = await import("@/lib/server/d1");
      const translations = await queryD1<any>("SELECT devotion_id, language_code, title FROM devotion_translations");
      if (translations) {
        translations.forEach((t) => {
          if (!transMap[t.devotion_id]) {
            transMap[t.devotion_id] = {};
          }
          transMap[t.devotion_id][t.language_code] = t.title;
        });
      }
    } catch (d1Err) {
      console.warn("Failed to fetch devotion translations from D1:", d1Err);
    }

    dbDevotions.forEach((data) => {
      if (data.status === "published" || !data.status) {
        const id = data.id || data.dateId;
        devotions.push({
          id,
          title: data.title ?? "Renungan Hari Ini",
          title_en: transMap[id]?.en || "",
          title_zh: transMap[id]?.zh || "",
          verseRef: data.verseRef ?? "",
          verseText: data.verseText ?? "",
          dateId: data.dateId ?? data.id,
          imageUrl: data.imageUrl ?? "",
          illustrationUrl: data.illustrationUrl ?? "",
          bannerUrl: data.bannerUrl ?? "",
        });
      }
    });
    // Sort devotions by dateId descending
    devotions.sort((a, b) => String(b.dateId).localeCompare(String(a.dateId)));
  } catch (error) {
    console.error("Failed to fetch devotions archive:", error);
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f4ee] px-5 py-8 text-[#52606d] sm:px-8">Memuat...</div>}>
      <RenunganArchive devotions={devotions} />
    </Suspense>
  );
}
