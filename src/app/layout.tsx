import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { PwaRegister } from "@/app/components/PwaRegister";
import { Header } from "@/app/components/Header";
import { getAdminDb } from "@/lib/server/firebase-admin";
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
    capable: true,
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
        url: "/logo.jpg",
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
    images: ["/logo.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#14213d",
};

function parseHtmlToReact(htmlString: string) {
  if (!htmlString) return null;

  const tagRegex = /<(script|link|meta)\b([^>]*)>([\s\S]*?)<\/\1>|<(link|meta)\b([^>]*)\/?>/gi;
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
      
      if (attrName.toLowerCase() === "class") {
        attrs.className = attrVal;
      } else if (attrName.toLowerCase() === "charset") {
        attrs.charSet = attrVal;
      } else if (attrName.toLowerCase() === "http-equiv") {
        attrs.httpEquiv = attrVal;
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
  const adminDb = getAdminDb();
  let googleCodes: any = null;

  if (adminDb) {
    try {
      const snap = await adminDb.collection("settings").doc("google_codes").get();
      if (snap.exists) {
        googleCodes = snap.data();
      }
    } catch (e) {
      console.error("Failed to load Google codes:", e);
    }
  }

  return (
    <html lang="id" className="h-full antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script
          src={
            process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
              ? "https://app.midtrans.com/snap/snap.js"
              : "https://app.sandbox.midtrans.com/snap/snap.js"
          }
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          strategy="lazyOnload"
        />

        {/* Google Search Console Meta Verification */}
        {googleCodes?.googleSearchConsoleToken && (
          <meta name="google-site-verification" content={googleCodes.googleSearchConsoleToken} />
        )}

        {/* Google Analytics (gtag.js) */}
        {googleCodes?.googleAnalyticsId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleCodes.googleAnalyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleCodes.googleAnalyticsId}');
              `}
            </Script>
          </>
        )}

        {/* Google Tag Manager (GTM) */}
        {googleCodes?.googleTagManagerId && (
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${googleCodes.googleTagManagerId}');
            `}
          </Script>
        )}

        {/* Custom global header scripts */}
        {googleCodes?.globalHeaderScripts && parseHtmlToReact(googleCodes.globalHeaderScripts)}
      </head>
      <body className="flex min-h-full flex-col">
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

        {/* Custom global body scripts */}
        {googleCodes?.globalBodyScripts && (
          <div dangerouslySetInnerHTML={{ __html: googleCodes.globalBodyScripts }} />
        )}

        <Header />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

