import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key file wajib disertakan." }, { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    // Generate a presigned URL that is valid for 60 seconds
    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("Failed to generate presigned download URL:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat URL download." }, { status: 500 });
  }
}
