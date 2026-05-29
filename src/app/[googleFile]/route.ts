import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ googleFile: string }> }
) {
  const { googleFile } = await params;

  // Intercept requests for Google Search Console HTML verification files.
  // e.g. /googledcc8ca322c8231fa.html -> should serve "google-site-verification: googledcc8ca322c8231fa.html"
  if (googleFile.startsWith("google") && googleFile.endsWith(".html")) {
    return new NextResponse(`google-site-verification: ${googleFile}`, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  // Pass through / 404 for other files
  return new NextResponse("Not Found", { status: 404 });
}
