/* Bead Studio service worker. Generated at build time: the precache list and version are filled in. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const PREFIX = 'bead-studio-';
const CACHE = PREFIX + VERSION;
const META = 'bead-studio-meta';

async function cleanResponse(res) {
  // A redirected response can't be used to answer a navigation in some browsers; copy it.
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (url) => {
          if (await cache.match(url, MATCH)) return;
          const res = await fetch(new Request(url, { cache: 'reload' }));
          if (!res.ok) throw new Error(`precache failed: ${url} ${res.status}`);
          await cache.put(url, await cleanResponse(res));
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Keep this version and the one before it, so a page that is still open on the old
      // version can load its remaining files. Delete anything older.
      const meta = await caches.open(META);
      const listRes = await meta.match('/versions');
      let versions = listRes ? await listRes.json() : [];
      versions = versions.filter((v) => v !== CACHE).concat(CACHE).slice(-2);
      await meta.put('/versions', new Response(JSON.stringify(versions)));
      for (const k of await caches.keys()) {
        if (k.startsWith(PREFIX) && !versions.includes(k)) await caches.delete(k);
      }
      await self.clients.claim();
    })(),
  );
});

// Scripts and styles are requested in CORS mode (with an Origin header). Servers may answer
// with `Vary: Origin`, which would stop a cached copy from matching, so Vary is ignored.
const MATCH = { ignoreSearch: true, ignoreVary: true };

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request, MATCH)) || (await caches.match(request, MATCH));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname === '/version.json') return;
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match('/', MATCH)) || (await caches.match('/', MATCH)) || fetch(req);
      })(),
    );
    return;
  }
  event.respondWith(
    (async () => {
      const hit = await fromCache(req);
      if (hit) return hit;
      return fetch(req);
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'status') return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      let cached = 0;
      for (const url of PRECACHE) if (await cache.match(url, MATCH)) cached++;
      const msg = { type: 'status', cached, total: PRECACHE.length, version: VERSION };
      if (event.source) event.source.postMessage(msg);
    })(),
  );
});
