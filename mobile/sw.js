// sw.js - Service Worker simples para CADVISA Careiro

const CACHE_NAME = 'cadvisa-cache-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  // Bibliotecas externas usadas (opcional, mas melhora offline)
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap',
  'https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth-compat.js'
];

// Instalação: faz o cache dos recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação: remove caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener('fetch', event => {
  const request = event.request;

  // Estratégia: stale-while-revalidate para recursos estáticos
  // e network-first para navegação (HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Atualiza o cache com a nova versão
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) {
            // Retorna do cache e atualiza em segundo plano
            fetch(request).then(response => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then(cache => cache.put(request, response));
              }
            }).catch(() => {});
            return cached;
          }
          return fetch(request);
        })
    );
  }
});