export type QueryLog = {
  timestamp: string;
  category: string;
  source: "R2" | "Firebase SDK" | "Firebase REST" | "Vercel" | "Static Fallback";
  pathOrUrl: string;
  durationMs: number;
  cacheStatus: "HIT" | "MISS";
};

// In-memory array of the latest 50 queries
const queryLogs: QueryLog[] = [];
const MAX_LOGS = 50;

export function logQuery(
  category: string,
  source: "R2" | "Firebase SDK" | "Firebase REST" | "Vercel" | "Static Fallback",
  pathOrUrl: string,
  durationMs: number,
  cacheStatus: "HIT" | "MISS" = "MISS"
) {
  const log: QueryLog = {
    timestamp: new Date().toISOString(),
    category,
    source,
    pathOrUrl,
    durationMs,
    cacheStatus,
  };

  queryLogs.unshift(log);

  // Keep list bounded to max size
  if (queryLogs.length > MAX_LOGS) {
    queryLogs.pop();
  }
}

export function getQueryLogs(): QueryLog[] {
  return queryLogs;
}
