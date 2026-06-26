/**
 * CADVISA Careiro — Service Worker
 * Estratégia:
 *   • App shell (HTML, ícones)   → Cache-First
 *   • Google Fonts               → Stale-While-Revalidate
 *   • Firebase / Firestore / API → Network-First (sem cache)
 *   • Demais recursos externos   → Network-First c/ fallback de cache
 */

const CACHE_NAME   = 'cadvisa-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

/* ──────────────────────────────────────────────
   INSTALL — pré-cacheia o app shell
────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(
        SHELL_ASSETS.map(url => new Request(url, { cache: 'reload' }))
      );
    }).then(() => self.skipWaiting())
  );
});

/* ──────────────────────────────────────────────
   ACTIVATE — remove caches antigas
────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ──────────────────────────────────────────────
   FETCH — roteamento de requisições
────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Firebase, Firestore, Auth, gstatic.com scripts → Network-only
  //    (dados em tempo real não devem ser interceptados)
  if (
    url.hostname.includes('firebaseio.com')  ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    (url.hostname === 'www.gstatic.com' && url.pathname.includes('firebasejs'))
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Google Fonts CSS e arquivos de fonte → Stale-While-Revalidate
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3. App shell (mesmo origem, GET) → Cache-First
  if (request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4. Qualquer outra coisa → Network-First c/ fallback de cache
  event.respondWith(networkFirst(request));
});

/* ──────────────────────────────────────────────
   Estratégias
────────────────────────────────────────────── */

/** Cache-First: usa cache se existir; caso contrário busca na rede e guarda. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // offline e sem cache: retorna página principal como fallback
    return caches.match('./index.html');
  }
}

/** Network-First: tenta rede; em falha usa cache. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    return cached || caches.match('./index.html');
  }
}

/** Stale-While-Revalidate: retorna cache imediatamente e atualiza em background. */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}
