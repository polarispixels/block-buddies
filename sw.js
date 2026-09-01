// Network-first with cache fallback: updates arrive on refresh, and the game
// still plays with no connection once it has loaded at least once.
const CACHE = 'ffbg-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'js/util.js', 'js/audio.js', 'js/particles.js', 'js/entities.js', 'js/puzzleblocks.js', 'js/ride.js', 'js/beams.js', 'js/flowerart.js', 'js/flowerscene.js', 'js/flowerland.js', 'js/levels.js', 'js/game.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
