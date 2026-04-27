// TireScan Service Worker
// Strategy: network-first for HTML/API, cache-first for static assets only.
// This prevents ERR_FAILED when the dev server restarts.

const CACHE_NAME = 'tirescan-v3';

// Only cache static assets — never cache HTML pages or API endpoints
const STATIC_ASSETS = [
  '/static/core/css/base.css',
  '/static/core/css/auth.css',
  '/static/analysis/css/dashboard.css',
  '/static/analysis/js/camera.js',
  '/static/analysis/js/dashboard.js',
  '/manifest.json',
];

// ── Install: pre-cache static assets ─────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => null))
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

  // HTML pages: network-first, NO cache fallback
  // If network fails, let it fail — don't serve stale HTML
  event.respondWith(
    fetch(request).catch(() => {
      // Only return cached version of the exact same URL if available
      return caches.match(request);
    })
  );
});
