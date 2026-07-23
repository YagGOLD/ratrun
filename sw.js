/* ============================================================
   RatRun — Service Worker (cache-first, 100% offline)
   Só é registrado em HTTPS (ver app.js). Ao mudar qualquer arquivo,
   incremente a versão do cache para forçar atualização.
   ============================================================ */

var CACHE = "ratrun-v1";

var FILES = [
  ".",
  "index.html",
  "manifest.json",
  "css/theme.css",
  "css/creator.css",
  "css/app.css",
  "js/palettes.js",
  "js/catalog.js",
  "js/parts/new-avatar.js",
  "js/assets.js",
  "js/renderer.js",
  "js/expressions.js",
  "js/animator.js",
  "js/storage.js",
  "js/toast.js",
  "js/util.js",
  "js/finance.js",
  "js/goals.js",
  "js/backup.js",
  "js/donation.js",
  "js/ui-creator.js",
  "js/nav.js",
  "js/ui-home.js",
  "js/ui-fixed.js",
  "js/ui-daily.js",
  "js/ui-reports.js",
  "js/ui-goals.js",
  "js/app.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/favicon.png",
  "icons/pix-qr.png",

  "New_Avatar/SKIN/SKIN_01.png",
  "New_Avatar/HAIR/HAIR_01.png",
  "New_Avatar/EYES/EYES_01.png",
  "New_Avatar/EYEBROWS/EYEBROWN_01.png",
  "New_Avatar/NOSE/NOSE_01.png",
  "New_Avatar/MOUTH/MOUTH_01.png",
  "New_Avatar/CLOTH/CLOTH_01.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(e.request);
    })
  );
});
