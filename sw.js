const CACHE_NAME = 'velovertical-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './assets/icon.svg',
  './manifest.webmanifest',
  './js/config.js',
  './js/geometry.js',
  './js/difficulty.js',
  './js/externalLinks.js',
  './js/geocoder.js',
  './js/routing.js',
  './js/overpass.js',
  './js/optimizer.js',
  './js/weather.js',
  './js/logistics.js',
  './js/exporters.js',
  './js/mapView.js',
  './js/elevationChart.js',
  './js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const reqUrl = new URL(event.request.url);
  // Only cache same-origin app shell files; never cache cross-origin APIs or map tiles.
  if (reqUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
