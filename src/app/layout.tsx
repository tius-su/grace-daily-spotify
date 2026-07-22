import type { Metadata, Viewport } from "next";
import * as Sentry from "@sentry/nextjs";
import { CONFIG } from "@/lib/server/config";
import Script from "next/script";
import { PwaRegister } from "@/app/components/PwaRegister";
import { Header } from "@/app/components/Header";
import { PushNotificationManager } from "@/app/components/PushNotificationManager";
import { GraceDailyChatbot } from "@/app/components/GraceDailyChatbot";
import { MonetagScript } from "@/app/components/MonetagScript";
import { getDocWithFallback } from "@/lib/server/db-fallback";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.gracedaily.my.id";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Grace Daily",
    template: "%s | Grace Daily",
  },
  description:
    "Renungan harian Kristen, tanya pendeta, jurnal spiritual, komunitas doa, dan membership premium.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    statusBarStyle: "default",
    title: "Grace Daily",
  },
  openGraph: {
    title: "Grace Daily",
    description: "Renungan harian Kristen, tanya pendeta, jurnal spiritual, komunitas doa, dan membership premium.",
    url: siteUrl,
    siteName: "Grace Daily",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Grace Daily Logo",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Grace Daily",
    description: "Renungan harian Kristen, tanya pendeta, jurnal spiritual, komunitas doa, dan membership premium.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#14213d",
};

function parseHtmlToReact(htmlString: string) {
  if (!htmlString) return null;

  const tagRegex = /<(script|link|meta|style|noscript)\b([^>]*)>([\s\S]*?)<\/\1>|<(script|link|meta|style|noscript)\b([^>]*)\/?>/gi;
  const elements: React.ReactNode[] = [];
  let match;
  let key = 0;

  while ((match = tagRegex.exec(htmlString)) !== null) {
    const tagName = (match[1] || match[4]).toLowerCase();
    const attrsStr = match[2] || match[5] || "";
    const content = match[3] || "";

    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/gi;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
      const attrName = attrMatch[1];
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? attrName;
      
      const lowerName = attrName.toLowerCase();
      if (lowerName === "class") {
        attrs.className = attrVal;
      } else if (lowerName === "charset") {
        attrs.charSet = attrVal;
      } else if (lowerName === "http-equiv") {
        attrs.httpEquiv = attrVal;
      } else if (lowerName === "crossorigin") {
        attrs.crossOrigin = attrVal;
      } else if (lowerName === "async") {
        attrs.async = true as any;
      } else if (lowerName === "defer") {
        attrs.defer = true as any;
      } else {
        attrs[attrName] = attrVal;
      }
    }

    if (tagName === "script") {
      if (content.trim()) {
        elements.push(
          <script
            key={key++}
            {...attrs}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      } else {
        elements.push(<script key={key++} {...attrs} />);
      }
    } else if (tagName === "style") {
      if (content.trim()) {
        elements.push(
          <style
            key={key++}
            {...attrs}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      } else {
        elements.push(<style key={key++} {...attrs} />);
      }
    } else if (tagName === "noscript") {
      if (content.trim()) {
        elements.push(
          <noscript
            key={key++}
            {...attrs}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      } else {
        elements.push(<noscript key={key++} {...attrs} />);
      }
    } else if (tagName === "link") {
      elements.push(<link key={key++} {...attrs} />);
    } else if (tagName === "meta") {
      elements.push(<meta key={key++} {...attrs} />);
    }
  }

  return elements;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize Sentry only when DSN is provided
  if (CONFIG.SENTRY_DSN) {
    Sentry.init({
      dsn: CONFIG.SENTRY_DSN,
      tracesSampleRate: 0.2,
      environment: process.env.NODE_ENV,
    });
  }

  let googleCodes: any = null;

  try {
    googleCodes = await getDocWithFallback<any>("settings", "google_codes", "settings.json");
  } catch (e) {
    console.error("Failed to load Google codes with fallback:", e);
  }

  return (
    <html lang="id" className="h-full antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Standard PWA App Capable Tag */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Google AdSense Account Verification */}
        <meta name="google-adsense-account" content="ca-pub-9511274459054303" />

        {/* RSS Feed Discovery */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Grace Daily — Renungan &amp; Artikel Terbaru"
          href={`${siteUrl}/api/rss.xml`}
        />

        {/* Google Search Console Meta Verification */}
        {googleCodes?.googleSearchConsoleToken && (
          <meta name="google-site-verification" content={googleCodes.googleSearchConsoleToken} />
        )}

        {/* Custom global header scripts */}
        {googleCodes?.globalHeaderScripts && parseHtmlToReact(googleCodes.globalHeaderScripts)}
      </head>
      <body className="flex min-h-full flex-col">
        {/* Scripts loaded outside of <head> to prevent hydration mismatches */}
        <Script
          src={
            process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION !== "false"
              ? "https://app.midtrans.com/snap/snap.js"
              : "https://app.sandbox.midtrans.com/snap/snap.js"
          }
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          strategy="lazyOnload"
        />

        {/* Google Analytics (gtag.js) */}
        {googleCodes?.googleAnalyticsId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleCodes.googleAnalyticsId}`}
              strategy="lazyOnload"
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${googleCodes.googleAnalyticsId}');
                `,
              }}
            />
          </>
        )}

        {/* Google Tag Manager (GTM) */}
        {googleCodes?.googleTagManagerId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${googleCodes.googleTagManagerId}');
              `,
            }}
          />
        )}

        {/* Google Tag Manager noscript */}
        {googleCodes?.googleTagManagerId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${googleCodes.googleTagManagerId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}

        {/* Google AdSense */}
        <Script
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "ca-pub-9511274459054303"}`}
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />

        <MonetagScript />

        {/* Custom global body scripts */}
        {googleCodes?.globalBodyScripts && (
          <div dangerouslySetInnerHTML={{ __html: googleCodes.globalBodyScripts }} />
        )}

        <LanguageProvider>
          <Header />
          {children}
          <PwaRegister />
          <PushNotificationManager />
          <GraceDailyChatbot />
        </LanguageProvider>
      </body>
    </html>
  );
}
