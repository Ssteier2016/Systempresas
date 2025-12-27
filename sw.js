// sw.js - Service Worker para Gestión de Negocios Pro v3.9.12 con FCM
const CACHE_NAME = 'business-app-v3.9.12';
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
  // FCM scripts
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

// Configuración de FCM para notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Mensaje FCM recibido en segundo plano:', payload);
  console.log('[Service Worker] Payload completo:', JSON.stringify(payload));
  
  // Extraer título y cuerpo del payload
  const notificationTitle = payload.data?.title || 
                           payload.notification?.title || 
                           'Gestión de Negocios';
  
  const notificationBody = payload.data?.body || 
                          payload.notification?.body || 
                          'Tienes una nueva notificación';

  // Opciones de la notificación
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
      {
        action: 'open',
        title: '📊 Abrir App'
      },
      {
        action: 'dismiss',
        title: '❌ Cerrar'
      }
    ],
    tag: payload.data?.tag || 'business-notification',
    renotify: true,
    requireInteraction: true,
    silent: false
  };

  console.log('[Service Worker] Mostrando notificación:', notificationTitle);
  
  // Mostrar la notificación
  return self.registration.showNotification(notificationTitle, notificationOptions)
    .then(() => {
      console.log('[Service Worker] Notificación mostrada correctamente');
    })
    .catch(error => {
      console.error('[Service Worker] Error mostrando notificación:', error);
    });
});

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cacheando archivos');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Instalación completada');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Error durante instalación:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Borrando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activación completada');
      return self.clients.claim();
    })
  );
});

// Estrategia de Cache: Network First con fallback a Cache
self.addEventListener('fetch', event => {
  // Excluir requests de Firebase y otras APIs dinámicas
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  // Para archivos HTML, usar Network First
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Solo cachear respuestas exitosas
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Si no hay cache, mostrar la página offline
              return caches.match('/');
            });
        })
    );
    return;
  }

  // Para otros recursos (CSS, JS, imágenes), usar Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // No cachear respuestas que no sean exitosas
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clonar la respuesta para guardarla en cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.log('[Service Worker] Fetch failed:', event.request.url, error);
            // Para recursos críticos, podrías retornar una versión alternativa
            if (event.request.url.includes('.css')) {
              return new Response('/* Fallback CSS */', {
                headers: { 'Content-Type': 'text/css' }
              });
            }
            if (event.request.url.includes('.js')) {
              return new Response('// Fallback JS', {
                headers: { 'Content-Type': 'application/javascript' }
              });
            }
          });
      })
  );
});

// Manejo de clics en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Clic en notificación:', event.notification.tag);
  
  const notification = event.notification;
  const action = event.action;
  const notificationData = notification.data || {};
  
  notification.close();
  
  if (action === 'dismiss') {
    console.log('[Service Worker] Notificación descartada');
    return;
  }
  
  // Por defecto, abrir la app
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then(clientList => {
      // Buscar una ventana ya abierta
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          console.log('[Service Worker] Enfocando ventana existente');
          return client.focus();
        }
      }
      
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        console.log('[Service Worker] Abriendo nueva ventana:', notificationData.url || '/');
        return clients.openWindow(notificationData.url || '/');
      }
    })
    .catch(error => {
      console.error('[Service Worker] Error manejando clic de notificación:', error);
    })
  );
});

// Manejo de cierre de notificaciones
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Notificación cerrada:', event.notification.tag);
});

// Sincronización en segundo plano
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sincronización en segundo plano:', event.tag);
  
  if (event.tag === 'sync-sales') {
    event.waitUntil(
      syncPendingSales()
    );
  }
  
  if (event.tag === 'sync-expenses') {
    event.waitUntil(
      syncPendingExpenses()
    );
  }
});

// Función para sincronizar ventas pendientes
function syncPendingSales() {
  return new Promise((resolve, reject) => {
    console.log('[Service Worker] Sincronizando ventas pendientes...');
    
    // Aquí implementarías la lógica para sincronizar ventas
    // guardadas localmente cuando no había conexión
    
    // Por ahora, solo log
    setTimeout(() => {
      console.log('[Service Worker] Ventas sincronizadas');
      resolve();
    }, 1000);
  });
}

// Función para sincronizar gastos pendientes
function syncPendingExpenses() {
  return new Promise((resolve, reject) => {
    console.log('[Service Worker] Sincronizando gastos pendientes...');
    
    setTimeout(() => {
      console.log('[Service Worker] Gastos sincronizados');
      resolve();
    }, 1000);
  });
}

// Manejo de mensajes desde la app
self.addEventListener('message', event => {
  console.log('[Service Worker] Mensaje recibido:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Saltando espera...');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_NEW_RESOURCE') {
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.add(event.data.url);
      })
      .then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({status: 'cached', url: event.data.url});
        }
      })
      .catch(error => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({status: 'error', error: error.message});
        }
      });
  }
  
  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.keys();
      })
      .then(keys => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            status: 'success',
            cacheName: CACHE_NAME,
            cachedItems: keys.length
          });
        }
      });
  }
});

// Función para manejar conexión offline
self.addEventListener('offline', () => {
  console.log('[Service Worker] App está offline');
  
  // Notificar a todas las ventanas abiertas
  self.clients.matchAll()
    .then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NETWORK_STATUS',
          status: 'offline',
          timestamp: Date.now()
        });
      });
    });
});

self.addEventListener('online', () => {
  console.log('[Service Worker] App está online nuevamente');
  
  // Notificar a todas las ventanas abiertas
  self.clients.matchAll()
    .then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NETWORK_STATUS',
          status: 'online',
          timestamp: Date.now()
        });
      });
    })
    .then(() => {
      // Intentar sincronizar datos pendientes
      return self.registration.sync.register('sync-sales');
    })
    .then(() => {
      return self.registration.sync.register('sync-expenses');
    })
    .catch(error => {
      console.error('[Service Worker] Error registrando sync:', error);
    });
});

// Función para verificar actualizaciones
function checkForUpdates() {
  console.log('[Service Worker] Verificando actualizaciones...');
  
  fetch('/?v=' + Date.now(), { cache: 'no-store' })
    .then(response => {
      if (response.status === 200) {
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.match('/')
              .then(cachedResponse => {
                if (cachedResponse) {
                  cachedResponse.text().then(cachedText => {
                    response.clone().text().then(newText => {
                      if (cachedText !== newText) {
                        console.log('[Service Worker] Nueva versión disponible');
                        notifyClientsAboutUpdate();
                      }
                    });
                  });
                }
              });
          });
      }
    })
    .catch(error => {
      console.error('[Service Worker] Error verificando actualizaciones:', error);
    });
}

// Notificar a los clientes sobre actualización
function notifyClientsAboutUpdate() {
  self.clients.matchAll()
    .then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'APP_UPDATE_AVAILABLE',
          message: 'Hay una nueva versión disponible. Recarga para actualizar.',
          timestamp: Date.now()
        });
      });
    });
}

// Verificar actualizaciones periódicamente
setInterval(checkForUpdates, 5 * 60 * 1000); // Cada 5 minutos

// Evento de error
self.addEventListener('error', event => {
  console.error('[Service Worker] Error:', event.error);
});

// Evento de rechazo de promesa no manejado
self.addEventListener('unhandledrejection', event => {
  console.error('[Service Worker] Promesa rechazada no manejada:', event.reason);
});

// Función helper para cachear recursos dinámicamente
function cacheResource(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    const responseClone = response.clone();
    caches.open(CACHE_NAME)
      .then(cache => {
        cache.put(request, responseClone);
      })
      .catch(error => {
        console.error('[Service Worker] Error cacheando recurso:', error);
      });
  }
}

// Función para manejar notificaciones push personalizadas (no FCM)
self.addEventListener('push', event => {
  if (!event.data) {
    console.log('[Service Worker] Notificación push sin datos');
    return;
  }
  
  try {
    const data = event.data.json();
    console.log('[Service Worker] Notificación push personalizada:', data);
    
    const options = {
      body: data.body || 'Nueva notificación',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
        type: data.type || 'custom'
      },
      actions: [
        { action: 'open', title: 'Abrir' },
        { action: 'dismiss', title: 'Cerrar' }
      ],
      tag: data.tag || 'custom-notification'
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Gestión de Negocios',
        options
      )
    );
  } catch (error) {
    console.error('[Service Worker] Error procesando notificación push:', error);
    
    // Fallback: mostrar notificación simple
    event.waitUntil(
      self.registration.showNotification('Gestión de Negocios', {
        body: 'Tienes una nueva notificación',
        icon: '/icon-192.png'
      })
    );
  }
});
