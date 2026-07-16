"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export function MonetagScript() {
  const pathname = usePathname();

  // Allow ads only on articles (blog), daily devotions (renungan), and encyclopedia pages
  const allowedPrefixes = ["/blog", "/renungan", "/ensiklopedia"];
  const shouldShow = allowedPrefixes.some((prefix) => pathname?.startsWith(prefix));

  if (!shouldShow) return null;

  return (
    <Script
      src="https://nap5k.com/tag.min.js"
      data-zone="11320267"
      async
      data-cfasync="false"
      strategy="afterInteractive"
    />
  );
}
