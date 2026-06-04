import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const allowOrigin = process.env.NEXT_PUBLIC_APP_URL || "*";

  if (!R2_BUCKET_NAME) {
    return NextResponse.json({ error: "Bucket R2 belum dikonfigurasi." }, { status: 500, headers: { 'Access-Control-Allow-Origin': allowOrigin } });
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

    const result = await s3Client.send(command as any);

    // `result.Body` is a stream (Readable) — return it directly
    const body = result.Body as unknown as ReadableStream || result.Body as any;

    const contentType = (result as any).ContentType || "application/octet-stream";

    return new NextResponse(body, {
      headers: {
        "Content-Type": String(contentType),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, HEAD",
      },
    });
  } catch (error: any) {
    console.error("Failed to proxy R2 object:", error);
    return NextResponse.json({ error: error?.message || "Gagal mengambil file." }, { status: 500, headers: { 'Access-Control-Allow-Origin': allowOrigin } });
  }
}
