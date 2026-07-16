import { NextResponse } from "next/server";
import { downloadFromR2, runR2Backup } from "@/lib/server/backup-r2-service";
import { verifyAdmin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dataStr = await downloadFromR2("backup-info.json");
    if (!dataStr) {
      return NextResponse.json({ error: "No backup info found" }, { status: 404 });
    }
    return NextResponse.json(JSON.parse(dataStr));
  } catch (error: any) {
    // Check if the error is due to the backup-info.json file not existing yet
    const isNoSuchKey = 
      error?.name === "NoSuchKey" || 
      error?.Code === "NoSuchKey" || 
      error?.message?.includes("NoSuchKey") ||
      error?.$metadata?.httpStatusCode === 404;

    if (isNoSuchKey) {
      return NextResponse.json({
        lastBackupAt: "",
        status: "failed",
        files: [],
        error: "Belum ada data cadangan di R2. Silakan jalankan backup pertama Anda dengan mengklik tombol 'Picu Backup Sekarang' di bawah."
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load backup status from R2" },
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
    const result = await runR2Backup();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menjalankan backup" },
      { status: 500 }
    );
  }
}
