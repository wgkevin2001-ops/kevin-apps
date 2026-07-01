// 2026 行事曆 × 健康管理 — Service Worker
// 提供離線快取，讓 App 開啟更快、無網路時也能查看資料
const CACHE_NAME = "calendar2026-cache-v1";
const CACHE_FILES = [
  "./2026行事曆.html",
  "./manifest-行事曆.json",
  "./icon-行事曆-192.png",
  "./icon-行事曆-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Network-first：優先抓最新版本，若離線則退回快取
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
