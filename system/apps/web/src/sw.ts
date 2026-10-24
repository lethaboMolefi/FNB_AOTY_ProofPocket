/// <reference lib="webworker" />
// Service worker (Workbox, injectManifest).
// Precaches the app shell. API reads for the signed-in founder's own data are network-first with a cached
// fallback. Documents, proofs of payment, payment pages and other people's data are never cached.
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { CACHEABLE_API } from "./lib/cache-rules";

declare const self: ServiceWorkerGlobalScope;

const FOUNDER_API_CACHE = "pp-api-founder";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every page loads the app shell, including offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }));

registerRoute(
  ({ url, request }) => request.method === "GET" && url.origin === self.location.origin && CACHEABLE_API.test(url.pathname),
  new NetworkFirst({
    cacheName: FOUNDER_API_CACHE,
    networkTimeoutSeconds: 4,
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 86_400 })],
  }),
);

registerRoute(({ url }) => url.origin === "https://fonts.googleapis.com", new StaleWhileRevalidate({ cacheName: "google-fonts-css" }));
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 86_400 })],
  }),
);

// Background Sync: ask open ProofPocket windows to send the offline outbox (they hold the sign-in token).
self.addEventListener("sync", (event) => {
  const e = event as Event & { tag: string; waitUntil(p: Promise<unknown>): void };
  if (e.tag === "pp-outbox") e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => cs.forEach((c) => c.postMessage({ type: "FLUSH_OUTBOX" }))));
});

self.addEventListener("message", (event) => {
  const type = (event.data as { type?: string } | undefined)?.type;
  // The page shows "A new version is ready. Refresh"; Refresh sends this.
  if (type === "SKIP_WAITING") void self.skipWaiting();
  // Sign-out or a different account on the same phone.
  if (type === "CLEAR_FOUNDER_API_CACHE") event.waitUntil(caches.delete(FOUNDER_API_CACHE));
});
