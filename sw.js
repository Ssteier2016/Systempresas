// sw.js - Service Worker para Gestión de Negocios Pro v3.9.13 con FCM
const CACHE_NAME = 'business-app-v3.9.13';
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

// Importar scripts de Firebase para FCM (Versión compat necesaria para Service Worker)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Configuración de Firebase en el Service Worker
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

// Configuración de FCM para notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Mensaje FCM recibido en segundo plano:', payload);
  
  const notificationTitle = payload.data?.title || 
                           payload.notification?.title || 
                           'Gestión de Negocios';
  
  const notificationBody = payload.data?.body || 
                          payload.notification?.body || 
                          'Tienes una nueva notificación';

  const notificationOptions = {
    body: notificationBody,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: payload.data?.url || '/',
      click_action: payload.data?.click_action || payload.fcmOptions?.link || '/',
      type: payload.data?.type || 'general',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: '📊 Abrir App' },
      { action: 'dismiss', title: '❌ Cerrar' }
    ],
    tag: payload.data?.tag || 'business-notification',
    renotify: true,
    requireInteraction: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cacheando archivos estáticos');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación y limpieza de caches antiguos
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Borrando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Fetch (Manejo de peticiones)
self.addEventListener('fetch', event => {
  // CORRECCIÓN CRÍTICA: Ignorar peticiones que no sean http o https (como chrome-extension://)
  if (!(event.request.url.startsWith('http'))) return;

  // Excluir peticiones de Firebase y APIs dinámicas del caché
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  // Estrategia Network First para archivos HTML
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

  // Estrategia Cache First para otros recursos (CSS, JS, imágenes)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then(response => {
          // No cachear si la respuesta no es válida o es opaca
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(err => console.log('[Service Worker] Error en fetch:', err));
      })
  );
});

// Manejo de clics en las notificaciones
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

// Escuchar mensajes desde la aplicación (interfaz)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Sincronización en segundo plano (Background Sync)
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sincronización:', event.tag);
  if (event.tag === 'sync-sales' || event.tag === 'sync-expenses') {
    event.waitUntil(Promise.resolve()); // Aquí iría la lógica de sincronización de IndexedDB
  }
});

// Verificación de actualizaciones periódicas
function checkForUpdates() {
  fetch('/index.html', { cache: 'no-store' })
    .then(response => {
      if (response.status === 200) {
        // Lógica de comparación simple podría ir aquí
      }
    }).catch(err => console.log('Error verificando update', err));
}
setInterval(checkForUpdates, 1000 * 60 * 60); // Revisar cada hora

// Captura de errores globales en el worker
self.addEventListener('unhandledrejection', event => {
  console.error('[Service Worker] Rechazo no manejado:', event.reason);
});
