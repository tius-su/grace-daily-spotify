import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { verifyAdmin } from "@/lib/server/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!R2_BUCKET_NAME) {
    return NextResponse.json({ error: "Bucket R2 belum dikonfigurasi." }, { status: 500 });
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
    });

    const response = await s3Client.send(command);
    const files = (response.Contents || []).map((file) => ({
      key: file.Key || "",
      size: file.Size || 0,
      lastModified: file.LastModified ? file.LastModified.toISOString() : "",
      url: process.env.NEXT_PUBLIC_R2_PUBLIC_URL 
        ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${file.Key}` 
        : `/api/admin/media/download?key=${encodeURIComponent(file.Key || "")}`,
    }));

    // Sort by last modified descending so newest is first
    files.sort((a, b) => {
      const timeA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const timeB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json({ files });
  } catch (error: any) {
    console.error("Failed to list R2 files:", error);
    return NextResponse.json({ error: error.message || "Gagal melist file media." }, { status: 500 });
  }
}
