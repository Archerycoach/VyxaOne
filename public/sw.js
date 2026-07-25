/*
 * Service worker do Vyxa One (PWA).
 *
 * Objetivos: tornar a app instalável e resistente a falhas de rede, SEM servir
 * versões desatualizadas depois de um deploy.
 *  - Navegações (páginas HTML): network-first → offline.html se não houver rede.
 *  - Estáticos do Next (/_next/static, com hash no nome) e imagens: cache-first
 *    (são imutáveis, por isso é seguro).
 *  - Pedidos /api/ e de autenticação: NUNCA são intercetados (sempre rede).
 *
 * Ao mudar a app shell, incrementar CACHE_VERSION para limpar o cache antigo.
 */
const CACHE_VERSION = "vyxa-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // APIs e autenticação: sempre rede, nunca cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth")) return;

  // Navegações (páginas): rede primeiro, com fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Estáticos imutáveis do Next + imagens/fontes: cache primeiro.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});

// ── Notificações push ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Vyxa One", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Vyxa One";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Se a app já está aberta, foca-a e navega para o alvo.
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
