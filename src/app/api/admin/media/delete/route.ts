import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { verifyAdmin } from "@/lib/server/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!R2_BUCKET_NAME) {
    return NextResponse.json({ error: "Bucket R2 belum dikonfigurasi." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const key = body.key || body.fileKey;

    if (!key) {
      return NextResponse.json({ error: "Key file wajib diisi." }, { status: 400 });
    }

    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true, message: `File ${key} berhasil dihapus.` });
  } catch (error: any) {
    console.error("Failed to delete R2 file:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus file media." }, { status: 500 });
  }
}
