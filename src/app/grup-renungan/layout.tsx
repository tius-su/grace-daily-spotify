import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grup Renungan",
  description: "Diskusikan ayat Alkitab, bagikan refleksi iman harian, dan bertumbuh bersama saudara seiman di grup renungan Grace Daily.",
  openGraph: {
    title: "Grup Renungan | Grace Daily",
    description: "Diskusikan ayat Alkitab, bagikan refleksi iman harian, dan bertumbuh bersama saudara seiman di grup renungan Grace Daily.",
  },
};

export default function DevotionGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
