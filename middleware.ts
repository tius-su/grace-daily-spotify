import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in‑memory token bucket: 60 requests per minute per IP
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000; // 1 minute

// Map of IP -> { count, reset }
const ipMap = new Map<string, { count: number; reset: number }>();

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip cron jobs – they must not be rate‑limited
  if (pathname.startsWith('/api/cron')) {
    return NextResponse.next();
  }

  // Apply rate‑limit only on public API routes
  if (pathname.startsWith('/api')) {
    const ip =
      request.ip ??
      request.headers.get('x-forwarded-for')?.split(',')[0] ??
      'unknown';
    const now = Date.now();
    const record = ipMap.get(ip) ?? { count: 0, reset: now + WINDOW_MS };

    // Reset window if elapsed
    if (now > record.reset) {
      record.count = 0;
      record.reset = now + WINDOW_MS;
    }

    record.count++;
    ipMap.set(ip, record);

    if (record.count > RATE_LIMIT) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
