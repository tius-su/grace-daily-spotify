import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { PwaInstallPrompt } from "@/app/components/PwaInstallPrompt";

export const metadata: Metadata = {
  title: "Grace Daily Mini App",
  description:
    "Portal Rohani & Pendalaman Alkitab — Renungan harian, Ensiklopedia Alkitab, dan komunitas Kristen.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GraceDailyApp",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function TelegramMiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Telegram WebApp SDK — loaded before page renders */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      {/* Page content (no header/footer — fullscreen app experience) */}
      {children}

      {/* PWA Install Prompt — popup komunitas + install */}
      <PwaInstallPrompt />
    </>
  );
}
