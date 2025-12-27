// sw.js - Service Worker para Gestión de Negocios Pro v3.9.12
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
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
];

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
  // Excluir requests de Firebase y otras APIs
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return;
  }

  // Para archivos HTML, usar Network First
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clonar la respuesta para guardarla en cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            });
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
            console.log('[Service Worker] Fetch failed; returning offline page', error);
            // Para recursos críticos, podrías retornar una versión alternativa
          });
      })
  );
});

// Manejo de Notificaciones Push
self.addEventListener('push', event => {
  console.log('[Service Worker] Notificación push recibida');
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'Nueva notificación del sistema',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir App'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Gestión de Negocios',
      options
    )
  );
});

// Manejo de clics en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Clic en notificación:', event.notification.tag);
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(clientList => {
        // Si ya hay una ventana abierta, enfócala
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abre una nueva
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/');
        }
      })
  );
});

// Sincronización en segundo plano
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sincronización en segundo plano:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(
      syncData()
        .then(() => {
          console.log('[Service Worker] Sincronización completada');
        })
        .catch(error => {
          console.error('[Service Worker] Error en sincronización:', error);
        })
    );
  }
});

// Función de sincronización (puedes personalizarla)
function syncData() {
  return new Promise((resolve, reject) => {
    // Aquí puedes implementar la lógica para sincronizar datos pendientes
    // Por ejemplo, si guardas datos localmente cuando hay problemas de conexión
    
    console.log('[Service Worker] Sincronizando datos pendientes...');
    // Simular sincronización
    setTimeout(() => {
      resolve();
    }, 1000);
  });
}

// Manejo de mensajes desde la app
self.addEventListener('message', event => {
  console.log('[Service Worker] Mensaje recibido:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_DATA') {
    // Para cachear datos dinámicamente desde la app
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.add(event.data.url);
      })
      .then(() => {
        event.ports[0].postMessage({status: 'cached'});
      })
      .catch(error => {
        event.ports[0].postMessage({status: 'error', error: error.message});
      });
  }
});

// Función para manejar conexión offline
self.addEventListener('offline', () => {
  console.log('[Service Worker] App está offline');
});

self.addEventListener('online', () => {
  console.log('[Service Worker] App está online nuevamente');
  
  // Notificar a la app que la conexión se restableció
  self.clients.matchAll()
    .then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NETWORK_STATUS',
          status: 'online'
        });
      });
    });
});

// Función helper para manejar actualizaciones de la app
function handleAppUpdate() {
  self.clients.matchAll()
    .then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'APP_UPDATED',
          message: 'Nueva versión disponible. Por favor recarga la página.'
        });
      });
    });
}
