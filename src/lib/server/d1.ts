// Utility to query Cloudflare D1 SQL database using REST API.
// Run directly from server-side environment (Vercel Serverless / Cron).

export interface D1QueryResult<T> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface D1Response<T> {
  result: D1QueryResult<T>[];
  success: boolean;
  errors: any[];
}

/**
 * Executes a SQL query against Cloudflare D1 using Client REST API.
 * Returns the array of result rows, or null if the query failed or D1 is unconfigured.
 */
export async function queryD1<T>(sql: string, params: any[] = []): Promise<T[] | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "dd3d0162fefacc8b01a83ca376d06947";
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || "02913987-6b3d-45c9-890a-4f0a43f43b6a";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AI_TOKEN;

  if (!apiToken) {
    console.warn("[D1 Client] CLOUDFLARE_API_TOKEN is not configured. Skipping query and falling back.");
    return null;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql,
        params,
      }),
      // Caching is not desired for write/dynamic SQL queries.
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[D1 Client] Query failed with status ${res.status}: ${errorText}`);
      return null;
    }

    const payload = (await res.json()) as D1Response<T>;

    if (payload.success && payload.result && payload.result.length > 0) {
      const firstResult = payload.result[0];
      if (firstResult.success) {
        return firstResult.results;
      } else {
        console.error("[D1 Client] Inner query failed:", firstResult);
      }
    } else {
      console.error("[D1 Client] API response reported error:", payload.errors);
    }
  } catch (err) {
    console.error("[D1 Client] Network error running D1 query:", err);
  }

  return null;
}

/**
 * Execute multiple statements or single batch run in D1.
 */
export async function executeD1(sql: string, params: any[] = []): Promise<boolean> {
  const result = await queryD1<any>(sql, params);
  return result !== null;
}
