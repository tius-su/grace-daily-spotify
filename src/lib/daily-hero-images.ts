export const DAILY_HERO_IMAGES = [
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-Daily-best.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-Daily5.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-daily-bile.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-daily.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-daily.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace.daily.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Gd1.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace1.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/gd.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/gdaily.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/gdd.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/grace3.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/grace4.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/grace5.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/graced.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/gracedai.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/gracedayil.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace.daily.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/GraceDaily-1.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace_daily.png",
] as const;

export const DEFAULT_DAILY_HERO_IMAGE = DAILY_HERO_IMAGES[0];
export const LOCAL_DAILY_HERO_FALLBACK = "/fallback.webp";

export function isLocalDailyHeroFallback(url?: string | null) {
  if (!url) return false;

  try {
    const parsedUrl = new URL(url, "https://grace-daily.local");
    return parsedUrl.pathname === LOCAL_DAILY_HERO_FALLBACK;
  } catch {
    return url === LOCAL_DAILY_HERO_FALLBACK;
  }
}

export function resolveDailyHeroImage(...urls: Array<string | null | undefined>) {
  return urls.find((url) => url && !isLocalDailyHeroFallback(url)) || DEFAULT_DAILY_HERO_IMAGE;
}

export function selectDailyHeroImage(seed: string) {
  const hash = seed.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return DAILY_HERO_IMAGES[hash % DAILY_HERO_IMAGES.length] ?? DEFAULT_DAILY_HERO_IMAGE;
}
