/* Installable shell only. Private API responses and authenticated pages are never cached. */
const CACHE = "fitai-public-v1";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add("/offline.html")));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("fitai-public-") && k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener("message", event => {
  if (event.data === "ACTIVATE_AFTER_WORKOUT") self.skipWaiting();
});
self.addEventListener("fetch", event => {
  if (event.request.mode === "navigate" && new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
  }
});
