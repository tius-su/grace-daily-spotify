import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { verifyAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!R2_BUCKET_NAME) {
    return NextResponse.json({ error: "Bucket R2 belum dikonfigurasi." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Buat nama file yang unik dan hilangkan spasi
    const uniqueName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: uniqueName,
        Body: buffer,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    // Gunakan URL akses publik
    const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL 
      ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${uniqueName}`
      : `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/admin/media/download?key=${encodeURIComponent(uniqueName)}`;
      
    return NextResponse.json({ url: publicUrl, key: uniqueName });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}