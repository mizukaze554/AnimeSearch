const CACHE_NAME = 'animeserc-cache-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js',
  'https://cdn.tailwindcss.com'
];

// Install event: cache app shell
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch event: serve from cache, fall back to network
self.addEventListener('fetch', (evt) => {
  if(evt.request.method !== 'GET') return;

  evt.respondWith(
    caches.match(evt.request).then(cachedResp => {
      if (cachedResp) {
        return cachedResp;
      }
      return fetch(evt.request)
        .then(fetchResp => {
          // Optionally cache new requests here
          return fetchResp;
        })
        .catch(() => {
          // Fallback if offline and no cache (optional)
          if (evt.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
