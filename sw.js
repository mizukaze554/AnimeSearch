const CACHE_NAME = "animeserc-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/mine.jpg",
  "/manifest.json",
  "https://cdn.tailwindcss.com" // Tailwind CDN
];

// ✅ Install SW and cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ✅ Activate SW and clear old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ✅ Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Network-first for API calls
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for app shell/static assets
  event.respondWith(
    caches.match(event.request).then((cachedRes) => {
      return (
        cachedRes ||
        fetch(event.request).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return res;
        })
      );
    })
  );
});

// ✅ Optional: Offline fallback for navigation
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
  }
});
