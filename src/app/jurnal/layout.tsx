import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jurnal Spiritual",
  description: "Catat doa, syukur, pergumulan, dan pertumbuhan iman Anda secara pribadi dan aman.",
  openGraph: {
    title: "Jurnal Spiritual | Grace Daily",
    description: "Catat doa, syukur, pergumulan, dan pertumbuhan iman Anda secara pribadi dan aman.",
  },
};

export default function JurnalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
