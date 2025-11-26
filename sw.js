// Nombre de la caché para esta versión de la PWA
const CACHE_NAME = 'systempresas-cache-v1';

// Lista de archivos esenciales que deben ser precargados e ir a la caché
// Asegúrate de que esta lista contenga TODOS los archivos que necesita la app para funcionar offline.
const urlsToCache = [
  '/',
  '/dashboard.html', // Tu archivo principal
  '/manifest.json',
  // Debes incluir las rutas de tus logos e íconos:
  '/logo192.png', 
  '/icon512.png',
  // Los enlaces a las librerías externas que se usan:
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js",
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando y precargando la caché...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Forzar la activación inmediata
      .catch(err => {
        console.error('[Service Worker] Falló la precarga de la caché:', err);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activado.');
  // Limpiar cachés viejas
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Estrategia de caché: Cache-First, luego Network
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el recurso está en la caché, devolverlo inmediatamente
        if (response) {
          console.log(`[Service Worker] Sirviendo desde la caché: ${event.request.url}`);
          return response;
        }
        
        // Si no está en caché, ir a la red
        console.log(`[Service Worker] Obteniendo de la red: ${event.request.url}`);
        return fetch(event.request)
          .then(networkResponse => {
            // Clonar la respuesta para poder almacenarla en caché y devolverla
            const responseToCache = networkResponse.clone();
            
            // Solo cachear respuestas válidas (no 404, no errores, solo HTTP/HTTPS)
            if (networkResponse.status === 200 && networkResponse.type === 'basic') {
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            
            return networkResponse;
          })
          .catch(() => {
             // Esto se ejecuta si falla la red y no estaba en caché.
             // Aquí se podría mostrar una página de offline.
             console.error(`[Service Worker] Error al obtener y no está en caché: ${event.request.url}`);
             // Opcionalmente, devolver una respuesta de fallback
             // return caches.match('/offline.html'); 
          });
      })
  );
});
