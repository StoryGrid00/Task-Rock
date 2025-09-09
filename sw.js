/* Task Rock Service Worker */
const SW_VERSION = "tr-2025-09-09-02";
const STATIC_CACHE = `tr-static-${SW_VERSION}`;
const RUNTIME_CACHE = `tr-runtime-${SW_VERSION}`;

// Add/keep your app shell here
const PRECACHE_URLS = [
  "./",
  "index.html",
  "assets/images/Jerry-Default.png",
  "assets/images/jerry-default.png",
  "assets/images/jerry.png",
  "assets/logo-light.png",
  "assets/logo-dark.png",
  "manifest.webmanifest"
].filter(Boolean);

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        if (![STATIC_CACHE, RUNTIME_CACHE].includes(key)) return caches.delete(key);
      })
    );
    await self.clients.claim();
  })());
});

// Network-first for HTML; SWR for others
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isHTML = req.headers.get("accept")?.includes("text/html");

  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        return cached || caches.match("index.html");
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkResp) => {
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, networkResp.clone()));
        return networkResp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Allow page to trigger immediate activation
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

