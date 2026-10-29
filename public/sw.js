/* Service worker « Kaddie » : notifications push, et la liste de courses consultable sans réseau. */

const CACHE = "kaddie-v2"; // page hors connexion, police, logo
const STATIQUES = "kaddie-statiques-v1"; // fichiers de l'appli (scripts, styles, illustrations)
const PAGES = "kaddie-pages-v1"; // la dernière liste de courses
const OFFLINE_URL = "/offline.html";
const LISTE = "/courses";
const MAX_STATIQUES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/fonts/BoldenVan.ttf", "/brand/logo/kaddie-logo-blanc.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const gardes = [CACHE, STATIQUES, PAGES];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !gardes.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const estStatique = (path) =>
  path.startsWith("/_next/static/") || path.startsWith("/brand/") || path.startsWith("/fonts/") || path.startsWith("/icons/");

/** Garde la page de la liste (réponse complète, pour la rouvrir sans réseau). */
async function garderListe(res) {
  if (!res.ok || res.redirected || !new URL(res.url).pathname.startsWith(LISTE)) return;
  const cache = await caches.open(PAGES);
  await cache.put(LISTE, res);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Déconnecté de la famille : la liste gardée n'a plus rien à faire sur ce téléphone.
    if (url.pathname.startsWith("/bienvenue")) caches.delete(PAGES);
    // Toujours le réseau d'abord (données en direct). Sans réseau : la dernière liste
    // pour l'écran des courses, sinon une page d'excuse (qui propose cette liste).
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (url.pathname === LISTE && !url.search) event.waitUntil(garderListe(res.clone()));
          return res;
        })
        .catch(async () => {
          const liste = url.pathname === LISTE ? await caches.match(LISTE, { cacheName: PAGES, ignoreVary: true }) : null;
          return liste || caches.match(OFFLINE_URL);
        }),
    );
    return;
  }

  // Fichiers de l'appli : ceux de _next/static ne changent jamais (nom unique par version) ;
  // les autres sont servis tout de suite depuis le téléphone, puis remis à jour en arrière-plan.
  if (estStatique(url.pathname)) {
    event.respondWith(
      caches.open(STATIQUES).then(async (cache) => {
        const garde = (await cache.match(req)) || (await caches.match(req, { cacheName: CACHE }));
        const reseau = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        });
        if (garde) {
          if (!url.pathname.startsWith("/_next/static/")) event.waitUntil(reseau.catch(() => {}));
          return garde;
        }
        return reseau;
      }),
    );
  }
});

// La liste est affichée : on en garde une copie à jour, et on limite la place prise.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "garder-liste") return;
  event.waitUntil(
    fetch(LISTE, { credentials: "same-origin", headers: { accept: "text/html" } })
      .then(garderListe)
      .catch(() => {})
      .then(async () => {
        const cache = await caches.open(STATIQUES);
        const cles = await cache.keys();
        await Promise.all(cles.slice(0, Math.max(0, cles.length - MAX_STATIQUES)).map((k) => cache.delete(k)));
      }),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Kaddie";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // « via=notification » : Kaddie le compte (un total par jour, sans identifiant) puis le retire de l'adresse.
  const cible = new URL(event.notification.data?.url || "/", self.location.origin);
  cible.searchParams.set("via", "notification");
  const url = cible.href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
