/*
 * Minimal service worker for the installable staff/admin app (scope: /admin/).
 * It exists so browsers treat the portal as an installable app. It deliberately
 * caches NOTHING and never touches API calls: every request goes straight to the
 * network, so staff always see live data and no sign-in data is stored by the worker.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // No respondWith: the browser handles the request normally.
});
