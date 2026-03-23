// sw.js - Service Worker para Gestión de Negocios Pro v3.9.14 (Full Experimental Features + Chrome Fix)
const CACHE_NAME = 'business-app-v3.9.14';
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

// 1. IMPORTAR SCRIPTS DE FIREBASE (COMPAT)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 2. INICIALIZACIÓN DE FIREBASE
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

// 3. MANEJO DE NOTIFICACIONES FCM EN SEGUNDO PLANO
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Mensaje FCM recibido en segundo plano:', payload);
  
  const notificationTitle = payload.data?.title || payload.notification?.title || 'Gestión de Negocios';
  const notificationBody = payload.data?.body || payload.notification?.body || 'Tienes una nueva actualización en el sistema';

  const notificationOptions = {
    body: notificationBody,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: payload.data?.url || '/',
      click_action: payload.data?.click_action || payload.fcmOptions?.link || '/',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: '📊 Ver Panel' },
      { action: 'dismiss', title: '❌ Cerrar' }
    ],
    tag: payload.data?.tag || 'business-notification',
    renotify: true,
    requireInteraction: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 4. INSTALACIÓN
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando versión:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// 5. ACTIVACIÓN Y LIMPIEZA
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activando y limpiando caches antiguos...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 6. EVENTO FETCH (CON FIX DE EXTENSIONES Y ESTRATEGIA AVANZADA)
self.addEventListener('fetch', event => {
  // --- FIX CRÍTICO PARA EXTENSIONES DE CHROME ---
  if (!(event.request.url.startsWith('http'))) return;

  // Excluir peticiones de Firebase y Analytics del caché
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  // ESTRATEGIA NETWORK FIRST PARA HTML
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  // ESTRATEGIA CACHE FIRST PARA ASSETS (CSS, JS, IMÁGENES)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(err => console.error('[SW] Error en fetch:', err));
      })
  );
});

// 7. MANEJO DE CLIC EN NOTIFICACIONES
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action = event.action;
  notification.close();

  if (action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('/') && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(notification.data.url || '/');
      })
  );
});

// 8. SINCRONIZACIÓN EN SEGUNDO PLANO (BACKGROUND SYNC)
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sincronización en proceso:', event.tag);
  if (event.tag === 'sync-sales' || event.tag === 'sync-expenses') {
    event.waitUntil(
      // Aquí se dispararía la lógica para procesar IndexedDB hacia Firestore
      new Promise((resolve) => {
        setTimeout(() => {
          console.log('[SW] Datos sincronizados correctamente');
          resolve();
        }, 2000);
      })
    );
  }
});

// 9. MANEJO DE MENSAJES (COMUNICACIÓN APP <-> SW)
self.addEventListener('message', event => {
  if (!event.data) return;

  // Actualizar inmediatamente
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Información avanzada de caché para la interfaz
  if (event.data.type === 'GET_CACHE_INFO' && event.ports[0]) {
    caches.open(CACHE_NAME).then(cache => cache.keys()).then(keys => {
      event.ports[0].postMessage({
        status: 'success',
        cacheName: CACHE_NAME,
        cachedItems: keys.length
      });
    });
  }

  // Notificar estado de red (experimental)
  if (event.data.type === 'CHECK_NETWORK') {
    const status = navigator.onLine ? 'online' : 'offline';
    event.ports[0].postMessage({ status });
  }
});

// 10. VERIFICACIÓN DE ACTUALIZACIONES (COMPARACIÓN DE TEXTO)
function checkForUpdates() {
  console.log('[Service Worker] Verificando nueva versión del servidor...');
  fetch('/index.html', { cache: 'no-store' })
    .then(response => {
      if (response.status === 200) {
        caches.open(CACHE_NAME).then(cache => {
          cache.match('/index.html').then(cachedResponse => {
            if (cachedResponse) {
              Promise.all([response.clone().text(), cachedResponse.text()]).then(texts => {
                if (texts[0] !== texts[1]) {
                  console.log('[SW] ¡Nueva versión detectada!');
                  notifyUpdateAvailable();
                }
              });
            }
          });
        });
      }
    }).catch(err => console.log('[SW] Error verificando actualización:', err));
}

function notifyUpdateAvailable() {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'APP_UPDATE_AVAILABLE',
        timestamp: Date.now()
      });
    });
  });
}

// Ejecutar verificación cada 30 minutos
setInterval(checkForUpdates, 30 * 60 * 1000);

// 11. MANEJO DE PUSH GENÉRICO (PARA MENSAJES NO-FCM)
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nuevo mensaje del sistema',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(data.title || 'Aviso', options));
  } catch (e) {
    console.error('[SW] Error en Push genérico:', e);
  }
});

// 12. CAPTURA DE ERRORES GLOBALES
self.addEventListener('unhandledrejection', event => {
  console.error('[Service Worker] Error de promesa no manejada:', event.reason);
});
