// Bump this version number every time you want to force clients to drop their old cache.
const CACHE_VERSION = "stshifts-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting(); // activate the new SW immediately, don't wait for old tabs to close
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim(); // take control of open tabs right away
});

// Network-first: always try to fetch the latest version from the server first.
// Only fall back to the cache if the network request fails (e.g. offline).
// This prevents the app from ever getting stuck showing an old cached build.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
