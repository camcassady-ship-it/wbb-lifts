/* Offline cache for the lifts reference. No analytics. */
const CACHE = "wbb-lifts-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/site.css",
  "./js/app.js",
  "./js/qrcode.js",
  "./data/program.json",
  "./assets/favicon.svg",
  "./robots.txt",
  "./assets/images/phase1-cover.webp",
  "./assets/images/phase1-deload-cover.webp",
  "./assets/images/phase2-cover.webp",
  "./assets/images/phase2-deload-cover.webp",
  "./assets/images/phase3-cover.webp",
  "./assets/images/phase1-day1-precore.webp",
  "./assets/images/phase1-day1-ablock.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).pathname.endsWith(".mp4")) {
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fetched;
    })
  );
});
