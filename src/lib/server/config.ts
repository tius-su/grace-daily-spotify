/**
 * Central configuration validator for environment variables.
 * Imported wherever config is needed.
 */
export const CONFIG = (() => {
  const required = {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
    GROUP_ID: process.env.TELEGRAM_GROUP_ID,
    CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "",
  } as Record<string, string | undefined>;

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    const err = new Error(`[Warning] Missing environment variables: ${missing.join(', ')}`);
    console.warn(err.message);
    // Don't throw during build phase to prevent Vercel preview build failures
    if (process.env.NEXT_PHASE !== 'phase-production-build' && process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      throw err;
    }
  }

  return {
    BOT_TOKEN: (required.BOT_TOKEN || "") as string,
    CHANNEL_ID: (required.CHANNEL_ID || "") as string,
    GROUP_ID: (required.GROUP_ID || "") as string,
    CHAT_ID: (required.CHAT_ID || "") as string,
    APP_URL: (required.NEXT_PUBLIC_APP_URL || "") as string,
    R2_PUBLIC_URL: (required.R2_PUBLIC_URL || "") as string,
    SENTRY_DSN: process.env.SENTRY_DSN || '',
  };
})();
