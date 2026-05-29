import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hubungi Kami",
  description: "Hubungi tim pelayanan Grace Daily untuk pertanyaan, saran, atau bantuan lainnya.",
  openGraph: {
    title: "Hubungi Kami | Grace Daily",
    description: "Hubungi tim pelayanan Grace Daily untuk pertanyaan, saran, atau bantuan lainnya.",
  },
};

export default function KontakLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
