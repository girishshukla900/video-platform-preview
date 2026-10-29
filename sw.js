/* Service worker: offline shell, never stale API data.
 *
 * Deliberately narrow. It caches the app shell (HTML, bundle, CSS, icons) so the app opens
 * without a network, and it never caches anything under /rest/ or /storage/ — cached API
 * responses would show a user data that is silently out of date, which is worse than an
 * honest offline message.
 */

const CACHE = "app-shell-v1";
const SHELL = ["./", "./index.html", "./bundle.js", "./styles.css", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never serve cached API or storage responses.
  if (url.pathname.includes("/rest/") || url.pathname.includes("/storage/") || url.pathname.includes("/auth/")) {
    return;
  }
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    }),
  );
});
