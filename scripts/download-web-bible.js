/**
 * download-web-bible.js
 * CommonJS wrapper for scripts/download-web-bible.mjs
 */

import("./download-web-bible.mjs").catch((err) => {
  console.error("Failed to load module:", err);
  process.exit(1);
});
