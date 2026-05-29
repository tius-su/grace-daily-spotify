import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Komunitas Doa",
  description: "Ruang teduh digital untuk saling mendoakan dan membagikan pokok doa di dalam kasih Kristus.",
  openGraph: {
    title: "Komunitas Doa | Grace Daily",
    description: "Ruang teduh digital untuk saling mendoakan dan membagikan pokok doa di dalam kasih Kristus.",
  },
};

export default function KomunitasDoaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
