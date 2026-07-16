import sharp from "sharp";

/**
 * Optimizes an image buffer to WebP format at 75% quality.
 * If optimization fails, it returns the original buffer and metadata.
 */
export async function optimizeToWebp(buffer: Buffer): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  try {
    const optimized = await sharp(buffer)
      .webp({ quality: 75 })
      .toBuffer();
    return {
      buffer: optimized,
      contentType: "image/webp",
      extension: "webp",
    };
  } catch (error) {
    console.error("[ImageOptimizer] Failed to optimize image to WebP:", error);
    return {
      buffer,
      contentType: "image/png", // fallback
      extension: "png",
    };
  }
}
