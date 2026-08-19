const CACHE_NAME = 'abm-pwa-v3';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/sw.js')) return;
  event.respondWith(
    fetch(new Request(event.request.url, { cache: 'no-cache' }))
      .then(response => response)
      .catch(() => caches.match('index.html'))
  );
});
