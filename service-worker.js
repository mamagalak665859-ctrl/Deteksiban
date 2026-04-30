// TireScan Service Worker
// Strategy: cache-first for static assets, network-first for HTML with offline fallback.
// Supports offline usage for cached pages.

const CACHE_NAME = 'tirescan-v6';

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
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // Refresh cache in background
          fetch(request).then(res => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then(c => c.put(request, res));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request).then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Critical pages: cache-first with network update
  if (CRITICAL_PAGES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        });

        return cached || networkFetch;
      })
    );
    return;
  }

  // Other HTML pages: network-first with offline fallback
  event.respondWith(
    fetch(request).catch(() => {
      // Return offline page for navigation requests
      if (request.headers.get('accept').includes('text/html')) {
        return caches.match('/offline/');
      }
    })
  );
});
