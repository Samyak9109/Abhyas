// FR-031, ADR-019: Service Worker for offline app shell and asset caching.
// Strictly observes network egress boundaries: never intercepts or caches cloud AI provider requests.

const CACHE_NAME = "abhyas-shell-v1";

const PRECACHE_ASSETS = [
  "/",
  "/app/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon.ico",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/abhyas-mark.svg",
  "/abhyas-mark-dark.svg",
  "/theme-init.js",
  "/guide",
  "/help",
  "/open-source",
  "/privacy",
  "/404.html",
  "/fonts/PixelifySans-Bold.woff2",
  "/fonts/InstrumentSans-Regular.woff2",
  "/fonts/InstrumentSans-SemiBold.woff2",
  "/fonts/JetBrainsMono-Regular.woff2",
  "/fonts/JetBrainsMono-Medium.woff2",
  "/fonts/Caveat-Regular.woff2",
];

// Blocklist: external AI endpoints and local model servers that must never be cached by service worker
const UNCACHED_HOSTS = [
  "generativelanguage.googleapis.com",
  "api.openai.com",
  "localhost",
  "127.0.0.1",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Pre-cache core shell assets; ignore individual failures during install
        return Promise.allSettled(
          PRECACHE_ASSETS.map((url) =>
            fetch(url).then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
            })
          )
        );
      })
      .then(() => {
        // Wait for user prompt/message to skip waiting if updating existing clients
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only intercept GET requests
  if (request.method !== "GET") {
    return;
  }

  // 2. Never cache or intercept external AI provider requests or non-http protocols
  if (!url.protocol.startsWith("http")) {
    return;
  }
  if (UNCACHED_HOSTS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // 3. Navigation requests: Network-first with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // If offline, attempt matching exact route, then SPA fallback for /app/*
          const cached = await caches.match(request);
          if (cached) return cached;

          if (url.pathname.startsWith("/app")) {
            const spaShell = await caches.match("/app/index.html");
            if (spaShell) return spaShell;
          }

          const fallback = await caches.match("/404.html");
          if (fallback) return fallback;

          return new Response("Offline — Abhyas requires a network connection to load this page.", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        })
    );
    return;
  }

  // 4. Static assets (fonts, hashed bundles in /assets/, images, scripts): Cache-first
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webmanifest");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. Default: Network with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
