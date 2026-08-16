self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim(),
  );
});

/*
 * Deliberately no asset cache:
 * Color Hunt is updated frequently and stale game bundles are worse than
 * an offline fallback. The service worker exists for installability/app mode.
 */
