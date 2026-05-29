import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tanya Pendeta",
  description: "Tanyakan pergumulan, diskusi firman, dan konseling rohani berbasis pastoral alkitabiah secara instan.",
  openGraph: {
    title: "Tanya Pendeta | Grace Daily",
    description: "Tanyakan pergumulan, diskusi firman, dan konseling rohani berbasis pastoral alkitabiah secara instan.",
  },
};

export default function TanyaPendetaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
