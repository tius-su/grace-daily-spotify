/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  compress: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["@google-analytics/data"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 1 day cache for optimized images
    remotePatterns: [
      { protocol: "https", hostname: "pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev" },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "pagead2.googlesyndication.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "*.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    // Build script-src list
    const baseScriptSrc = "'self' 'unsafe-inline'";
    const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
    const allowedScriptDomains = [
      "https://www.clarity.ms",
      "https://*.clarity.ms",
      "https://pagead2.googlesyndication.com",
      "https://*.googlesyndication.com", // Tambah ini untuk script ads pendukung
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
      "https://www.googletagservices.com",
      "https://cdn.jsdelivr.net",
      "https://app.midtrans.com",
      "https://*.midtrans.com",
      "https://*.adtrafficquality.google",
      "https://apis.google.com",
      "https://telegram.org",
      "https://*.telegram.org",
      "https://www.gstatic.com",        // TAMBAHAN: Diperlukan oleh Firebase script-src
      "https://*.gstatic.com",          // TAMBAHAN: Diperlukan oleh Firebase script-src
      "https://www.paypal.com",         // TAMBAHAN: PayPal SDK
      "https://*.paypal.com",
      "https://quge5.com",              // TAMBAHAN: Monetag Ad Script
      "https://*.quge5.com",
      "https://3nbf4.com",              // TAMBAHAN: Monetag Service Worker / Ads
      "https://*.3nbf4.com",
      "https://6opo.com",               // TAMBAHAN: Monetag tracking / endpoints
      "https://*.6opo.com",
      "https://auqot.com",              // TAMBAHAN: Monetag CDN / rotation scripts
      "https://*.auqot.com",
      "https://ekhay.com",
      "https://*.ekhay.com",
      "https://b3mny.com",
      "https://*.b3mny.com",
      "https://rtmark.net",
      "https://*.rtmark.net",
    ];
    const scriptSrc = `${baseScriptSrc}${devEval} ${allowedScriptDomains.join(" ")}`;

    // Connect-src for external APIs (GA, Firebase, R2, Midtrans, Clarity, etc.)
    const connectSrc = [
      "'self'",
      "https://*.gracedaily.my.id",
      "https://gracedaily.my.id",
      "https://www.google-analytics.com",
      "https://securetoken.googleapis.com",
      "https://*.googleapis.com",
      "https://*.google.com",
      "https://*.gstatic.com",
      "https://*.r2.dev",
      "https://*.adtrafficquality.google",
      "https://*.doubleclick.net",
      // AdSense ping & reporting endpoints
      "https://pagead2.googlesyndication.com",
      "https://*.googlesyndication.com",
      "googleads.g.doubleclick.net",
      "https://adservice.google.com",
      "https://*.adservice.google.com",
      "https://app.midtrans.com",
      "https://*.midtrans.com",
      "https://www.clarity.ms",
      "https://*.clarity.ms",
      "https://c.bing.com",
      "https://img.youtube.com",
      "https://*.youtube.com",
      "https://www.googletagmanager.com", // TAMBAHAN: Mengatasi GTM connect-src error
      "https://telegram.org",             // TAMBAHAN: Mengatasi telegram.org connect-src error
      "https://*.telegram.org",           // TAMBAHAN: Mengatasi telegram.org connect-src error
      "https://www.paypal.com",           // TAMBAHAN: PayPal API
      "https://*.paypal.com",
      "https://*.paypalobjects.com",
      "https://quge5.com",              // TAMBAHAN: Monetag Connect APIs
      "https://*.quge5.com",
      "https://3nbf4.com",
      "https://*.3nbf4.com",
      "https://6opo.com",
      "https://*.6opo.com",
      "https://auqot.com",
      "https://*.auqot.com",
      "https://ekhay.com",
      "https://*.ekhay.com",
      "https://b3mny.com",
      "https://*.b3mny.com",
      "https://rtmark.net",
      "https://*.rtmark.net",
      "http://localhost:3000",
      "http://localhost:3001",
      "ws://localhost:3000",
      "ws://localhost:3001",
    ].join(" ");

    // Frame-src for ads, GTM, YouTube, Midtrans, and Google iframes
    const frameSrc = [
      "https://pagead2.googlesyndication.com",
      "https://www.googletagmanager.com",
      "googleads.g.doubleclick.net",
      "https://*.doubleclick.net",
      "https://www.youtube.com",
      "https://*.youtube.com",
      "https://app.midtrans.com",
      "https://*.midtrans.com",
      "https://*.adtrafficquality.google",
      "https://*.google.com",
      "https://*.firebaseapp.com",
      "https://*.paypal.com",
      "https://quge5.com",              // TAMBAHAN: Monetag Iframes
      "https://*.quge5.com",
      "https://3nbf4.com",
      "https://*.3nbf4.com",
      "https://6opo.com",
      "https://*.6opo.com",
      "https://auqot.com",
      "https://*.auqot.com",
      "https://ekhay.com",
      "https://*.ekhay.com",
      "https://b3mny.com",
      "https://*.b3mny.com",
      "https://rtmark.net",
      "https://*.rtmark.net",
    ].join(" ");

    const workerSrc = [
      "'self'",
      "blob:",
      "https://3nbf4.com",
      "https://*.3nbf4.com",
      "https://quge5.com",
      "https://*.quge5.com",
      "https://auqot.com",
      "https://*.auqot.com",
      "https://ekhay.com",
      "https://*.ekhay.com",
      "https://b3mny.com",
      "https://*.b3mny.com",
      "https://rtmark.net",
      "https://*.rtmark.net",
    ].join(" ");

    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob: https://*.gracedaily.my.id https://gracedaily.my.id https://*.r2.dev https://*.googleapis.com https://lh3.googleusercontent.com https://img.youtube.com https://pagead2.googlesyndication.com https://*.paypalobjects.com http: https:",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      `connect-src ${connectSrc}`,
      `frame-src ${frameSrc}`,
      `worker-src ${workerSrc}`,
      "font-src https: data:",
      "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://*.gracedaily.my.id https://gracedaily.my.id",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Permissions-Policy",
            value: "bluetooth=*, camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Long-lived cache for Next.js immutable static assets (JS/CSS bundles with content hash)
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache static images and fonts from /public
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/bible/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/:file(.*\\.(?:ico|png|jpg|jpeg|svg|webp|avif|woff2|woff|ttf|otf))",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

module.exports = nextConfig;