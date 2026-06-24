/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  experimental: {
    serverComponentsExternalPackages: ["@google-analytics/data"],
  },
  async headers() {
    // Build script-src list
    const baseScriptSrc = "'self' 'unsafe-inline'";
    const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
    const allowedScriptDomains = [
      "https://www.clarity.ms",
      "https://*.clarity.ms",
      "https://pagead2.googlesyndication.com",
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
    ];
    const scriptSrc = `${baseScriptSrc}${devEval} ${allowedScriptDomains.join(" ")}`;

    // Connect-src for external APIs (GA, Firebase, R2, Midtrans, Clarity, etc.)
    const connectSrc = [
      "'self'",
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
      "https://googleads.g.doubleclick.net",
      "https://adservice.google.com",
      "https://*.adservice.google.com",
      "https://app.midtrans.com",
      "https://*.midtrans.com",
      "https://www.clarity.ms",
      "https://*.clarity.ms",
      "https://c.bing.com",
      "https://img.youtube.com",
      "https://*.youtube.com",
      "http://localhost:3000",
      "http://localhost:3001",
      "ws://localhost:3000",
      "ws://localhost:3001",
    ].join(" ");

    // Frame-src for ads, GTM, YouTube, Midtrans, and Google iframes
    const frameSrc = [
      "https://pagead2.googlesyndication.com",
      "https://www.googletagmanager.com",
      "https://googleads.g.doubleclick.net",
      "https://*.doubleclick.net",
      "https://www.youtube.com",
      "https://*.youtube.com",
      "https://app.midtrans.com",
      "https://*.midtrans.com",
      "https://*.adtrafficquality.google",
      "https://*.google.com",
      "https://*.firebaseapp.com",
    ].join(" ");

    const csp = [
      "default-src 'self'",
      "img-src http: https: data: blob:",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      `connect-src ${connectSrc}`,
      `frame-src ${frameSrc}`,
      "font-src https: data:",
      "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
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
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
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
        ],
      },
    ];
  },
};

module.exports = nextConfig;
