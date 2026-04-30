// TireScan Service Worker
// Strategy: cache-first for static assets, network-first for HTML with offline fallback.
// Supports offline usage for cached pages.

const CACHE_NAME = 'tirescan-v7';

// Cache static assets and critical pages
const STATIC_ASSETS = [
  '/static/analysis/css/dashboard.css',
  '/static/analysis/js/camera.js',
  '/static/analysis/js/dashboard.js',
  '/manifest.json',
];

// Cache critical HTML pages for offline access
const CRITICAL_PAGES = [
  '/',
  '/login/',
  '/register/',
  '/dashboard/',
  '/history/',
  '/offline/',
  // Note: /detail/ requires ID parameter, cached on-demand
];

// ── Helper: fallback for old hashed JS asset requests ──────────────
function getFallbackStaticAsset(request) {
  const hashedJsMatch = request.url.match(/\/static\/analysis\/js\/(camera|dashboard)\.[a-f0-9]+\.js$/);
  if (!hashedJsMatch) return Promise.resolve(null);
  const fallbackUrl = `/static/analysis/js/${hashedJsMatch[1]}.js`;
  console.log('SW: Fallback triggered for', request.url, '-> trying', fallbackUrl);
  return caches.match(fallbackUrl).then(cached => {
    if (cached) {
      console.log('SW: Serving fallback from cache:', fallbackUrl);
      return cached;
    }
    console.log('SW: Fetching fallback from network:', fallbackUrl);
    return fetch(fallbackUrl).then(res => {
      if (res.ok) {
        console.log('SW: Caching fallback response:', fallbackUrl);
        caches.open(CACHE_NAME).then(c => c.put(fallbackUrl, res.clone()));
      }
      return res;
    }).catch(err => {
      console.error('SW: Failed to fetch fallback:', fallbackUrl, err);
      return null;
    });
  });
}

// ── Install: pre-cache static assets and critical pages ────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      const allAssets = [...STATIC_ASSETS, ...CRITICAL_PAGES];
      return Promise.allSettled(
        allAssets.map(url => cache.add(url).catch(() => null))
      );
    })
  );
});

// ── Activate: clear old caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: route by request type ─────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip non-same-origin, admin, and API requests entirely
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/admin/')) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/media/')) return;

  // Static assets: cache-first, update in background
  if (url.pathname.startsWith('/static/') || url.pathname === '/manifest.json') {
    console.log('SW: Handling static asset request:', request.url);
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          console.log('SW: Serving from cache:', request.url);
          // Refresh cache in background
          fetch(request).then(res => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then(c => c.put(request, res));
            }
          }).catch(() => {});
          return cached;
        }
        console.log('SW: Cache miss, fetching from network:', request.url);
        return fetch(request).then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
            console.log('SW: Cached response for:', request.url);
            return res;
          }
          console.log('SW: Network response not ok, trying fallback for:', request.url);
          return getFallbackStaticAsset(request).then(fallback => fallback || res);
        }).catch(() => {
          console.log('SW: Network failed, trying fallback for:', request.url);
          return getFallbackStaticAsset(request);
        });
      })
    );
    return;
  }

  // Critical pages: network-first with cache fallback
  if (CRITICAL_PAGES.includes(url.pathname)) {
    event.respondWith(
      fetch(request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => caches.match(request).then(cached => cached || caches.match('/offline/')))
    );
    return;
  }

  // Other HTML pages: network-first with offline fallback
  event.respondWith(
    fetch(request).catch(() => {
      if (request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/offline/');
      }
    })
  );
});
