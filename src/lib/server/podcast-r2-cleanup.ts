import { s3Client, R2_BUCKET_NAME } from "./r2";
import { ListObjectsV2Command, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";

export const RETENTION_DAYS = 300;

export interface CleanupResult {
  success: boolean;
  retentionDays: number;
  cutoffDate: string;
  totalObjectsScanned: number;
  deletedCount: number;
  deletedKeys: string[];
  errors: string[];
}

/**
 * Parses date from key if key contains YYYY-MM-DD or date format.
 * Fallback to LastModified date.
 */
function getObjectDate(key: string, lastModified?: Date): Date {
  const match = key.match(/(\d{4}-\d{2}-\d{2})/);
  if (match && match[1]) {
    const parsed = new Date(match[1]);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return lastModified || new Date();
}

/**
 * Scans Cloudflare R2 bucket for podcast MP3 audio files under `podcasts/` prefix
 * and deletes any files older than 300 days (rolling 300-day window).
 */
export async function runPodcastR2Cleanup(
  prefix: string = "podcasts/",
  customRetentionDays: number = RETENTION_DAYS
): Promise<CleanupResult> {
  const cutoffTime = Date.now() - customRetentionDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffTime);

  const result: CleanupResult = {
    success: true,
    retentionDays: customRetentionDays,
    cutoffDate: cutoffDate.toISOString(),
    totalObjectsScanned: 0,
    deletedCount: 0,
    deletedKeys: [],
    errors: [],
  };

  if (!s3Client || !R2_BUCKET_NAME) {
    result.success = false;
    result.errors.push("Cloudflare R2 credentials or bucket name not configured.");
    return result;
  }

  try {
    let continuationToken: string | undefined = undefined;
    const keysToDelete: string[] = [];

    do {
      const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(listCommand);
      const items = response.Contents || [];
      result.totalObjectsScanned += items.length;

      for (const item of items) {
        if (!item.Key) continue;

        // Skip RSS feed xml files if we only clean audio files, or check extension
        const isMp3 = item.Key.toLowerCase().endsWith(".mp3") || item.Key.toLowerCase().endsWith(".m4a") || item.Key.toLowerCase().endsWith(".wav");
        
        if (isMp3) {
          const itemDate = getObjectDate(item.Key, item.LastModified);
          if (itemDate.getTime() < cutoffTime) {
            keysToDelete.push(item.Key);
          }
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    if (keysToDelete.length > 0) {
      console.log(`[R2 Podcast Cleanup] Found ${keysToDelete.length} audio files older than ${customRetentionDays} days. Deleting...`);

      // Delete in batches of 1000 (S3 limit)
      for (let i = 0; i < keysToDelete.length; i += 1000) {
        const batch = keysToDelete.slice(i, i + 1000);
        try {
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: R2_BUCKET_NAME,
            Delete: {
              Objects: batch.map((key) => ({ Key: key })),
              Quiet: true,
            },
          });
          await s3Client.send(deleteCommand);
          result.deletedCount += batch.length;
          result.deletedKeys.push(...batch);
        } catch (batchErr: any) {
          console.error("[R2 Podcast Cleanup] Error deleting batch:", batchErr);
          result.errors.push(`Failed batch delete: ${batchErr?.message || batchErr}`);
        }
      }
    } else {
      console.log(`[R2 Podcast Cleanup] No podcast audio files older than ${customRetentionDays} days found.`);
    }
  } catch (err: any) {
    console.error("[R2 Podcast Cleanup] Error scanning R2 bucket:", err);
    result.success = false;
    result.errors.push(err?.message || "Failed to scan R2 bucket");
  }

  return result;
}
