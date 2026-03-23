// sw.js - Service Worker para Gestión de Negocios Pro v3.9.15 (Full Experimental + Chrome & CORS Fix)
const CACHE_NAME = 'business-app-v3.9.15';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js'
];

// Importar scripts de Firebase para FCM
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Configuración de Firebase - USA LA MISMA QUE EN TU HTML
firebase.initializeApp({
  apiKey: "AIzaSyBIGUo2-YFCHKF6Nc8I-lB_NmGZiQ5pHJI",
  authDomain: "cryptotracker-8a6fd.firebaseapp.com",
  projectId: "cryptotracker-8a6fd",
  storageBucket: "cryptotracker-8a6fd.firebaseStorage.app",
  messagingSenderId: "720112375781",
  appId: "1:720112375781:web:7995dcbd6fe7470aea810c",
  measurementId: "G-2VW050K6PC"
});

const messaging = firebase.messaging();

// MANEJO DE NOTIFICACIONES EN SEGUNDO PLANO
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Mensaje FCM recibido:', payload);
  const notificationTitle = payload.data?.title || payload.notification?.title || 'Gestión de Negocios';
  const notificationOptions = {
    body: payload.data?.body || payload.notification?.body || 'Nueva notificación del sistema',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    data: { url: payload.data?.url || '/' },
    tag: 'business-notification',
    renotify: true,
    requireInteraction: true
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// INSTALACIÓN RESILIENTE (Ignora fallos de CORS en archivos individuales)
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando v3.9.15...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url => {
          return fetch(url).then(res => {
            if (res.ok) return cache.put(url, res);
          }).catch(err => console.log('[SW] No se pudo cachear al instalar:', url));
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN Y LIMPIEZA
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activando y limpiando caches viejos...');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })
    )).then(() => self.clients.claim())
  );
});

// ESTRATEGIA FETCH CON FIX DE PROTOCOLO CRÍTICO
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // --- SOLUCIÓN AL ERROR DE CHROME-EXTENSION ---
  if (!url.startsWith('http')) return;

  // Excluir peticiones dinámicas de Firebase
  if (url.includes('firebaseio.com') || url.includes('googleapis.com')) return;

  // Lógica Network First para HTML
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  // Lógica Cache First para el resto
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const copy = response.clone();
        // Doble validación antes del put para evitar el error de scheme
        if (event.request.url.startsWith('http')) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {});
    })
  );
});

// CLIC EN NOTIFICACIONES
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) { if (client.url.includes('/') && 'focus' in client) return client.focus(); }
      if (clients.openWindow) return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});

// BACKGROUND SYNC (EXPERIMENTAL)
self.addEventListener('sync', event => {
  console.log('[SW] Sincronización pendiente:', event.tag);
});

// MENSAJERÍA AVANZADA
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_CACHE_INFO' && event.ports[0]) {
    caches.open(CACHE_NAME).then(c => c.keys()).then(k => {
      event.ports[0].postMessage({ status: 'success', cachedItems: k.length });
    });
  }
});

// ESTADO DE RED
self.addEventListener('online', () => notifyNetworkStatus('online'));
self.addEventListener('offline', () => notifyNetworkStatus('offline'));

function notifyNetworkStatus(status) {
  self.clients.matchAll().then(clients => {
    clients.forEach(c => c.postMessage({ type: 'NETWORK_STATUS', status }));
  });
}

// AUTO-UPDATE CHECK (COMPARACIÓN DE TEXTO)
function checkForUpdates() {
  fetch('/index.html?v=' + Date.now(), { cache: 'no-store' }).then(res => {
    if (res.status === 200) {
      caches.open(CACHE_NAME).then(cache => {
        cache.match('/index.html').then(oldRes => {
          if (oldRes) {
            Promise.all([res.clone().text(), oldRes.text()]).then(texts => {
              if (texts[0] !== texts[1]) {
                self.clients.matchAll().then(c => c.forEach(client => client.postMessage({ type: 'APP_UPDATE_AVAILABLE' })));
              }
            });
          }
        });
      });
    }
  }).catch(() => {});
}
setInterval(checkForUpdates, 10 * 60 * 1000); // Cada 10 min
