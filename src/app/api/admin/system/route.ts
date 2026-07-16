import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/auth";
import { getActiveStorageConfig, updateStorageConfig } from "@/lib/server/storage-config";
import { getFirestoreUsage } from "@/lib/server/firestore-monitor";
import { getQueryLogs } from "@/lib/server/network-debug";
import { generateValidationReport, runR2Backup, getR2FileCounts, syncEncyclopediaOnly } from "@/lib/server/backup-r2-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [config, usage, r2Counts, validationReport] = await Promise.all([
      getActiveStorageConfig(),
      getFirestoreUsage(),
      getR2FileCounts(),
      generateValidationReport(),
    ]);

    const logs = getQueryLogs();

    return NextResponse.json({
      config,
      usage,
      r2Counts,
      logs,
      validationReport,
    });
  } catch (err: any) {
    console.error("[System Admin API] Failed to gather statistics:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load system status" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "update_config") {
      const { config } = body;
      if (!config) {
        return NextResponse.json({ error: "Configuration object is missing" }, { status: 400 });
      }
      const updated = await updateStorageConfig(config);
      return NextResponse.json({ success: true, config: updated });
    }

    if (action === "trigger_backup") {
      const result = await runR2Backup();
      return NextResponse.json({ success: result.status === "success", result });
    }

    if (action === "sync_encyclopedia") {
      const result = await syncEncyclopediaOnly();
      return NextResponse.json({ success: result.status === "success", result });
    }

    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("[System Admin API] Action execution failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to perform administrative action" },
      { status: 500 }
    );
  }
}
