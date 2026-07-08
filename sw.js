// Bump this CACHE name whenever index.html/pricing.js/manifest.json change
// meaningfully — the version string itself changing is what makes browsers
// notice this file is different and install a fresh service worker, which
// then deletes the old cache (see activate()) and starts fetching fresh
// content. Forgetting to bump this is exactly why an already-installed
// phone can keep showing an old version of the app indefinitely even after
// you re-upload new files to GitHub.
const CACHE = 'sale-camp-v3';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/pricing.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network-first for Supabase/API calls — always want the latest data.
  if (e.request.url.includes('supabase.co') || e.request.url.includes('anthropic.com') || e.request.url.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Network-first for the app shell itself (the page navigation, and
  // index.html directly) — this is the fix for phones getting stuck on an
  // old version: previously this was cache-first, so once index.html was
  // cached on a phone, that phone kept serving the old copy forever, even
  // after a new version was uploaded to GitHub. Falls back to the cached
  // copy only when there's genuinely no internet (offline use).
  if (e.request.mode === 'navigate' || e.request.url.endsWith('/index.html') || e.request.url.endsWith('/') || e.request.url.endsWith('/pricing.js')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first for other static assets (fonts, the supabase-js library,
  // pricing.js) — these change rarely and cache-first keeps the app fast
  // and working offline.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
