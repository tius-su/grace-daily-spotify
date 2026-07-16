import { runR2Backup } from "@/lib/server/backup-r2-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — needed for large collections and subcollections backup

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const customCronHeader = request.headers.get("x-cron-secret") || "";

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || url.searchParams.get("cron_secret");

  if (!secret) {
    console.log("[cron/backup-r2] No CRON_SECRET set — allowing request.");
    return true;
  }

  const authorized =
    authHeader === `Bearer ${secret}` ||
    querySecret === secret ||
    customCronHeader === secret;

  return authorized;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runR2Backup();
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menjalankan backup harian.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
