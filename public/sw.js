const CACHE_VERSION = 'v4';
const APP_CACHE = `grace-daily-app-${CACHE_VERSION}`;
const DATA_CACHE = `grace-daily-data-${CACHE_VERSION}`;
const IMAGE_CACHE = `grace-daily-images-${CACHE_VERSION}`;
const R2_HOSTS = new Set(['pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev']);
const MAX_IMAGE_CACHE_ENTRIES = 40;
const urlsToCache = [
  '/manifest.webmanifest'
];

function isImageRequest(request, url) {
  const destinationIsImage = request.destination === 'image';
  const pathIsImage = url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|avif)$/i);
  return destinationIsImage || Boolean(pathIsImage);
}

function isR2ImageRequest(request, url) {
  return R2_HOSTS.has(url.hostname) && isImageRequest(request, url);
}

function isDataRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.endsWith('.json');
}

function shouldBypassCache(request, url) {
  if (request.method !== 'GET') return true;
  return url.pathname.startsWith('/_next/');
}

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cacheKey = normalizedImageCacheKey(request);
  const cached = await cache.match(cacheKey);
  const networkPromise = fetch(request)
    .then((response) => {
      if (isCacheableImageResponse(response)) {
        cache.put(cacheKey, response.clone());
        trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_ENTRIES);
      }
      return response;
    })
    .catch((error) => {
      if (cached) return cached;
      throw error;
    });

  return cached || networkPromise;
}

function normalizedImageCacheKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete('_t');
  return new Request(url.toString(), {
    method: 'GET',
    headers: request.headers,
    mode: request.mode,
    credentials: request.credentials,
    cache: 'default',
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity,
  });
}

function isCacheableImageResponse(response) {
  return Boolean(response && (response.ok || response.type === 'opaque'));
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  await cache.delete(keys[0]);
  return trimCache(cacheName, maxEntries);
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  const validCaches = new Set([APP_CACHE, DATA_CACHE, IMAGE_CACHE]);
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!validCaches.has(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (shouldBypassCache(event.request, url)) {
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isR2ImageRequest(event.request, url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(APP_CACHE)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        if (!isImageRequest(event.request, url)) {
          return caches.match(event.request).then((response) => {
            if (response) return response;
            return new Response(
              '<html><head><meta charset="utf-8"><title>Koneksi Bermasalah | Grace Daily</title></head><body style="font-family:sans-serif;padding:30px;text-align:center;background:#f7f4ee;color:#1f2933;"><h1 style="color:#d9534f;">Koneksi Bermasalah</h1><p>Gagal memuat halaman. Silakan periksa koneksi internet Anda atau coba lagi nanti.</p><a href="/" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#14213d;color:#fff;text-decoration:none;border-radius:5px;">Kembali ke Beranda</a></body></html>',
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              }
            );
          });
        }

        return caches.match(event.request).then((response) => response || caches.match('/fallback.webp'));
      })
  );
});

// Monetag Integration (Ads & Push Notifications)
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11318687
};
self.lary = "";
try {
  importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw');
} catch (e) {
  console.error('Failed to import Monetag service worker:', e);
}
