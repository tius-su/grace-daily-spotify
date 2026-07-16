import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ==========================================
// Rate Limiting: 60 requests per minute per IP
// ==========================================
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;
const ipMap = new Map<string, { count: number; reset: number }>();

// ==========================================
// IP-to-Language mapping
// ==========================================
const EAST_ASIA_COUNTRIES = new Set(['CN', 'HK', 'TW', 'MO', 'SG']);

function detectLanguageFromIP(request: NextRequest): string | null {
  const country =
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry') ||
    '';
  if (!country) return null;
  const upper = country.toUpperCase();
  if (upper === 'ID') return 'id';
  if (EAST_ASIA_COUNTRIES.has(upper)) return 'zh';
  return 'en';
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  const fileName = pathname.slice(1);
  const hostname = request.headers.get('host') || '';

  // ==========================================
  // FITUR 1: Google Site Verification Otomatis
  // ==========================================
  if (
    !fileName.includes('/') &&
    fileName.startsWith('google') &&
    fileName.endsWith('.html')
  ) {
    return new NextResponse(`google-site-verification: ${fileName}`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // ==========================================
  // FITUR 2: Rate Limiting API (dipulihkan dari root middleware)
  // ==========================================
  const isDev =
    process.env.NODE_ENV === 'development' ||
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1');

  if (
    !isDev &&
    pathname.startsWith('/api') &&
    !pathname.startsWith('/api/cron')
  ) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';
    const now = Date.now();
    const record = ipMap.get(ip) ?? { count: 0, reset: now + WINDOW_MS };
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

  // ==========================================
  // FITUR 3: Routing Subdomain Telegram Mini App
  // ==========================================
  if (hostname.includes('app.gracedaily.my.id')) {
    if (pathname === '/manifest.json' || pathname === '/manifest.webmanifest') {
      url.pathname = '/miniapp-manifest.json';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/') {
      url.pathname = '/telegram-miniapp';
      return NextResponse.rewrite(url);
    }
    const allowedPaths = ['/rencana-baca', '/blog', '/ensiklopedia', '/daily-devotion'];
    const isAllowed = allowedPaths.some(p => pathname.startsWith(p));
    if (isAllowed) {
      url.pathname = `/telegram-miniapp${pathname}`;
      return NextResponse.rewrite(url);
    }
    if (
      !pathname.startsWith('/telegram-miniapp') &&
      !pathname.startsWith('/_next') &&
      !pathname.startsWith('/api')
    ) {
      url.pathname = '/telegram-miniapp';
      return NextResponse.rewrite(url);
    }
  }

  // ==========================================
  // FITUR 4: IP-Based Language Cookie Auto-Detection
  // ==========================================
  const existingLangCookie = request.cookies.get('gda-language')?.value;
  const validLangs = ['id', 'en', 'zh'];

  // Only set cookie if not already set or invalid
  if (!existingLangCookie || !validLangs.includes(existingLangCookie)) {
    const detectedLang = detectLanguageFromIP(request);
    if (detectedLang) {
      const response = NextResponse.next();
      response.cookies.set('gda-language', detectedLang, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax',
        httpOnly: false, // Must be readable by client JS
      });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/google:verification*.html',
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};