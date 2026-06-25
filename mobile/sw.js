/**
 * Service Worker — VISA Careiro
 * Estratégia: Network-first para Firebase, Cache-first para assets estáticos
 */

const CACHE_NAME      = 'visa-careiro-v1';
const STATIC_CACHE    = 'visa-static-v1';
const RUNTIME_CACHE   = 'visa-runtime-v1';

// Assets que devem ser cacheados na instalação
const PRECACHE_ASSETS = [
  './index.html',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png'
];

// Hosts do Firebase — sempre network-first (dados em tempo real)
const FIREBASE_HOSTS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.gstatic.com'
];

// Fonts — cache agressivo (imutáveis)
const FONT_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ─── INSTALL ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Precache parcial:', err))
  );
});

// ─── ACTIVATE ─────────────────────────────────────────
self.addEventListener('activate', event => {
  const VALID_CACHES = [CACHE_NAME, STATIC_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => !VALID_CACHES.includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-GET e chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.protocol === 'blob:') return;

  // Firebase → Network First (dados em tempo real, sem cache)
  if (FIREBASE_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE, 5000));
    return;
  }

  // Fontes → Cache First com fallback de rede
  if (FONT_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // Arquivo principal HTML → Network First com fallback de cache
  if (url.pathname.endsWith('index.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(request, STATIC_CACHE, 3000));
    return;
  }

  // Assets locais (js, css, img) → Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Demais → Network com cache de fallback
  event.respondWith(networkFirst(request, RUNTIME_CACHE, 8000));
});

// ─── ESTRATÉGIAS ──────────────────────────────────────

/**
 * Network First: tenta rede, cai no cache se falhar ou timeout
 */
async function networkFirst(request, cacheName, timeout = 5000) {
  const cache = await caches.open(cacheName);
  try {
    const networkPromise = fetch(request.clone());
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeout)
    );
    const response = await Promise.race([networkPromise, timeoutPromise]);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fallback offline para o HTML principal
    if (request.destination === 'document') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline — sem conexão disponível.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/**
 * Cache First: serve do cache; busca na rede se não encontrado
 */
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request.clone());
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset não disponível offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// ─── BACKGROUND SYNC (para quando voltar online) ──────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-dados') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'SYNC_READY' })
        );
      })
    );
  }
});

// ─── PUSH NOTIFICATIONS (base para futuro) ────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const options = {
    body:    data.body    || 'Nova notificação VISA Careiro',
    icon:    './icon-192.png',
    badge:   './icon-192.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || './' },
    actions: [
      { action: 'open',    title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'VISA Careiro',
      options
    )
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        const existing = windowClients.find(c => c.url === url && 'focus' in c);
        if (existing) return existing.focus();
        return clients.openWindow(url);
      })
  );
});
