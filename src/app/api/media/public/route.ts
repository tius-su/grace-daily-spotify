import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, R2_BUCKET_NAME } from "@/lib/server/r2";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestOrigin = request.headers.get("origin");
  const allowOrigin = requestOrigin || "*";

  if (!R2_BUCKET_NAME) {
    return NextResponse.json({ error: "Bucket R2 belum dikonfigurasi." }, { status: 500, headers: { 'Access-Control-Allow-Origin': allowOrigin } });
  }

  try {
    const { searchParams } = new URL(request.url);
    const keyParam = searchParams.get("key");

    if (!keyParam) {
      return NextResponse.json({ error: "Key file wajib disertakan." }, { status: 400, headers: { 'Access-Control-Allow-Origin': allowOrigin } });
    }

    // decode key and remove any cache-busting query string
    const decoded = decodeURIComponent(keyParam);
    let s3Key = decoded.split("?")[0];

    // ─── KODE PENYELAMAT: BELOKKAN .PNG KE .WEBP UTK ENCYCLOPEDIA ───
    if (s3Key.startsWith("encyclopedia-banners/") && s3Key.endsWith(".png")) {
      s3Key = s3Key.replace(".png", ".webp");
    }
    // ─────────────────────────────────────────────────────────────

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: s3Key,
    });

    let result: any;
    try {
      result = await s3Client.send(command as any);
    } catch (err: any) {
      // translate not-found errors to 404 for clients
      const msg = err?.message || String(err);
      console.error(`R2 get object failed for key=${s3Key}:`, msg);
      const notFound = err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound" || /specified key does not exist|nosuchkey/i.test(msg);
      if (notFound) {
        return new NextResponse("Not found", { status: 404, headers: { 'Access-Control-Allow-Origin': allowOrigin } });
      }
      throw err;
    }

    // `result.Body` is a stream (Readable) — return it directly
    const body = result.Body as ReadableStream | any;

    // Koreksi Content-Type jika mendeteksi file dibelokkan ke webp
    let contentType = result.ContentType || "application/octet-stream";
    if (s3Key.endsWith(".webp")) {
      contentType = "image/webp";
    }

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