import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil Pengguna",
  description: "Kelola akun, riwayat aktivitas rohani, dan langganan Grace Daily Anda.",
  openGraph: {
    title: "Profil Pengguna | Grace Daily",
    description: "Kelola akun, riwayat aktivitas rohani, dan langganan Grace Daily Anda.",
  },
};

export default function ProfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
