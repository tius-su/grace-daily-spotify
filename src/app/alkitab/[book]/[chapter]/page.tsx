import { redirect } from "next/navigation";
import { slugToBookName } from "@/lib/bible-deeplink";

interface Props {
  params: Promise<{ book: string; chapter: string }>;
}

/**
 * Deep link route: /alkitab/[book]/[chapter]
 * Redirects to /alkitab?book=...&chapter=...
 */
export default async function AlkitabBookChapterPage({ params }: Props) {
  const { book, chapter } = await params;

  // Validate book slug
  const bookName = slugToBookName(book);
  const chapterNum = parseInt(chapter, 10);

  if (!bookName || isNaN(chapterNum) || chapterNum < 1) {
    // Fall back to the main alkitab page gracefully
    redirect("/alkitab");
  }

  redirect(`/alkitab?book=${encodeURIComponent(book)}&chapter=${chapterNum}`);
}
