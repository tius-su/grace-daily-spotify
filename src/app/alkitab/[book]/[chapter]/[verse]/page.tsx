import { redirect } from "next/navigation";
import { slugToBookName } from "@/lib/bible-deeplink";

interface Props {
  params: Promise<{ book: string; chapter: string; verse: string }>;
}

/**
 * Deep link route: /alkitab/[book]/[chapter]/[verse]
 * Redirects to /alkitab?book=...&chapter=...&verse=...
 * so BibleExplorer can read params and auto-scroll to the target verse.
 */
export default async function AlkitabDeepLinkPage({ params }: Props) {
  const { book, chapter, verse } = await params;

  // Validate book slug
  const bookName = slugToBookName(book);
  const chapterNum = parseInt(chapter, 10);
  const verseNum = parseInt(verse, 10);

  if (!bookName || isNaN(chapterNum) || chapterNum < 1) {
    // Fall back to the main alkitab page gracefully
    redirect("/alkitab");
  }

  const verseParam = !isNaN(verseNum) && verseNum > 0
    ? `&verse=${verseNum}`
    : "";

  redirect(`/alkitab?book=${encodeURIComponent(book)}&chapter=${chapterNum}${verseParam}`);
}
