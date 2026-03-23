// sw.js - Service Worker para Gestión de Negocios Pro v3.9.17
// Versión TOTAL: Incluye funciones experimentales, sincronización, actualizaciones por contenido y corrección de extensiones.

const CACHE_NAME = 'business-app-v3.9.17';
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

// Importar scripts de Firebase para FCM (Modo Compatibilidad)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 1. INICIALIZACIÓN DE FIREBASE (Credenciales de producción)
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

// 2. MANEJO DE NOTIFICACIONES FCM EN SEGUNDO PLANO
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensaje FCM recibido en segundo plano:', payload);
  
  const notificationTitle = payload.data?.title || payload.notification?.title || 'Gestión de Negocios';
  const notificationBody = payload.data?.body || payload.notification?.body || 'Nueva actualización disponible';

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
      { action: 'open', title: '📊 Abrir App' },
      { action: 'dismiss', title: '❌ Cerrar' }
    ],
    tag: payload.data?.tag || 'business-notification',
    renotify: true,
    requireInteraction: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 3. INSTALACIÓN (Estrategia Resiliente con Promise.allSettled)
self.addEventListener('install', event => {
  console.log('[SW] Instalando versión:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos estáticos...');
        // Usamos allSettled para que si un recurso externo falla (ej. CORS de Tailwind), 
        // el Service Worker se instale de todos modos sin errores fatales.
        return Promise.allSettled(
          urlsToCache.map(url => {
            return fetch(url).then(response => {
              if (response.ok) return cache.put(url, response);
              throw new Error(`Fallo en carga: ${url}`);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// 4. ACTIVACIÓN (Limpieza de versiones antiguas)
self.addEventListener('activate', event => {
  console.log('[SW] Activando y limpiando caches antiguos...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eliminando cache obsoleto:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 5. EVENTO FETCH (Estrategia Avanzada + FIX de Extensiones de Chrome)
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // --- CORRECCIÓN CRÍTICA PARA PROTOCOLOS NO SOPORTADOS ---
  // Ignorar cualquier petición que no sea http o https (ej. chrome-extension://)
  if (!url.startsWith('http')) return;

  // Excluir peticiones dinámicas de Firebase/Analytics del sistema de caché
  if (url.includes('firebaseio.com') || 
      url.includes('googleapis.com') || 
      url.includes('firestore.googleapis.com')) {
    return;
  }

  // ESTRATEGIA PARA HTML: Network First (Priorizar servidor para detectar cambios)
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
        .catch(() => {
          return caches.match(event.request).then(cached => cached || caches.match('/'));
        })
    );
    return;
  }

  // ESTRATEGIA PARA ASSETS (CSS, JS, IMÁGENES): Cache First
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(response => {
        // Solo cachear si la respuesta es válida (Estado 200 y tipo básico)
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        // Doble validación de protocolo antes de ejecutar .put en el caché
        if (event.request.url.startsWith('http')) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(err => {
        console.log('[SW] Error en fetch:', url, err);
        // Fallbacks básicos en caso de error total de red
        if (url.includes('.css')) return new Response('/* Error CSS */', { headers: {'Content-Type': 'text/css'} });
      });
    })
  );
});

// 6. MANEJO DE CLIC EN NOTIFICACIONES
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
        if (clients.openWindow) return clients.openWindow(notification.data?.url || '/');
      })
  );
});

// 7. SINCRONIZACIÓN EN SEGUNDO PLANO (Experimental)
self.addEventListener('sync', event => {
  console.log('[SW] Sincronización de fondo detectada:', event.tag);
  if (event.tag === 'sync-sales' || event.tag === 'sync-expenses') {
    event.waitUntil(
      new Promise((resolve) => {
        // Simulación de procesamiento de colas IndexedDB
        console.log('[SW] Procesando datos pendientes de internet...');
        setTimeout(() => {
          console.log('[SW] Sincronización exitosa');
          resolve();
        }, 2000);
      })
    );
  }
});

// 8. MENSAJERÍA AVANZADA (APP <-> SW)
self.addEventListener('message', event => {
  if (!event.data) return;

  // Saltas la espera de actualización
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Obtener información detallada del caché para la UI de configuración
  if (event.data.type === 'GET_CACHE_INFO' && event.ports[0]) {
    caches.open(CACHE_NAME).then(cache => cache.keys()).then(keys => {
      event.ports[0].postMessage({
        status: 'success',
        cacheName: CACHE_NAME,
        cachedItems: keys.length,
        version: 'v3.9.17'
      });
    });
  }

  // Cachear un nuevo recurso solicitado dinámicamente desde la App
  if (event.data.type === 'CACHE_NEW_RESOURCE') {
    caches.open(CACHE_NAME).then(cache => cache.add(event.data.url));
  }
});

// 9. MONITOREO DE ESTADO DE RED
self.addEventListener('offline', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({ type: 'NETWORK_STATUS', status: 'offline' }));
  });
});

self.addEventListener('online', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({ type: 'NETWORK_STATUS', status: 'online' }));
  });
});

// 10. VERIFICADOR DE ACTUALIZACIONES POR COMPARACIÓN DE TEXTO
// Esta función descarga el index.html cada X tiempo y compara el contenido 
// para detectar cambios en Render sin depender solo del ciclo de vida del SW.
function checkForUpdates() {
  console.log('[SW] Verificando contenido del servidor para actualizaciones...');
  fetch('/index.html?v=' + Date.now(), { cache: 'no-store' })
    .then(response => {
      if (response.status === 200) {
        caches.open(CACHE_NAME).then(cache => {
          cache.match('/index.html').then(cachedResponse => {
            if (cachedResponse) {
              Promise.all([response.clone().text(), cachedResponse.text()]).then(texts => {
                if (texts[0] !== texts[1]) {
                  console.log('[SW] ¡Contenido modificado en servidor! Avisando a la App...');
                  notifyClientsAboutUpdate();
                }
              });
            }
          });
        });
      }
    }).catch(err => console.log('[SW] Error en verificación de actualización:', err));
}

function notifyClientsAboutUpdate() {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'APP_UPDATE_AVAILABLE',
        message: 'Nueva versión detectada. Por favor, recarga la aplicación.',
        timestamp: Date.now()
      });
    });
  });
}

// Ejecutar revisión cada 10 minutos
setInterval(checkForUpdates, 10 * 60 * 1000);

// 11. MANEJO DE PUSH GENÉRICO (PARA MENSAJES NO-FCM)
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Notificación del sistema',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(data.title || 'Aviso Pro', options));
  } catch (e) {
    console.error('[SW] Error procesando push genérico:', e);
  }
});

// 12. CAPTURA Y LOG DE ERRORES GLOBALES
self.addEventListener('error', event => {
  console.error('[Service Worker Error]', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[Service Worker Rejection]', event.reason);
});
