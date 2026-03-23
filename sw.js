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

// Importar scripts de Firebase para FCM
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Configuración de Firebase en el SW
// Nota: El SW no tiene acceso a import.meta.env, por lo que aquí las claves deben ser fijas 
// o inyectadas durante el proceso de build.
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

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.data?.title || payload.notification?.title || 'Gestión de Negocios';
  const notificationBody = payload.data?.body || payload.notification?.body || 'Tienes una nueva notificación';

  const notificationOptions = {
    body: notificationBody,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: payload.data?.url || '/',
      click_action: payload.data?.click_action || payload.fcmOptions?.link || '/'
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

// INSTALACIÓN
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN
self.addEventListener('activate', event => {
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

// FETCH (CORREGIDO PARA EVITAR ERROR 'chrome-extension')
self.addEventListener('fetch', event => {
  // 1. CORRECCIÓN: Ignorar peticiones que no sean http o https (Extensiones, etc)
  if (!event.request.url.startsWith('http')) return;

  // 2. Excluir requests de Firebase/APIs dinámicas del caché
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  // Estrategia Network First para HTML
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

  // Estrategia Cache First para recursos estáticos
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return response;
      }).catch(err => console.error('[SW] Fetch failed:', err));
    })
  );
});

// MANEJO DE CLIC EN NOTIFICACIÓN
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  notification.close();

  if (event.action !== 'dismiss') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          for (const client of clientList) {
            if (client.url.includes('/') && 'focus' in client) return client.focus();
          }
          if (clients.openWindow) return clients.openWindow(notification.data.url || '/');
        })
    );
  }
});

// MENSAJES DESDE LA APP
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
