import { runPodcastR2Cleanup } from "@/lib/server/podcast-r2-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const customCronHeader = request.headers.get("x-cron-secret") || "";

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || url.searchParams.get("cron_secret");

  if (!secret) {
    return true;
  }

  return (
    authHeader === `Bearer ${secret}` ||
    querySecret === secret ||
    customCronHeader === secret
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPodcastR2Cleanup();
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membersihkan audio podcast tua di R2.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
