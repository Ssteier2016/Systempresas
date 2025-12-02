// Nombre de la caché para esta versión de la PWA. CAMBIAR EL NÚMERO DE VERSIÓN CADA VEZ QUE HAYA UN CAMBIO.
const CACHE_NAME = 'systempresas-cache-v3';

// Lista de archivos esenciales que deben ser precargados e ir a la caché
// He actualizado las URLs de Firebase a la versión 10.8.0
const urlsToCache = [
	'/',
	'/index.html', // Tu archivo principal
	'/manifest.json',
    '/sw.js', // Incluir el service worker para que se pueda actualizar
	// Rutas de íconos (asumiendo que existen en la raíz)
	'/logo192.png',	
	'/icon512.png',
	// Enlaces a las librerías externas que se usan:
	'https://cdn.tailwindcss.com',
	'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
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

// Activación del Service Worker: Borra cachés antiguas
self.addEventListener('activate', event => {
	console.log('[Service Worker] Activado. Tomando control de los clientes.');
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
	// Solo interceptar peticiones GET y URLs que no sean de Firestore (para que los datos de Firestore vayan siempre a la red)
	const requestUrl = new URL(event.request.url);

	if (event.request.method !== 'GET' || requestUrl.protocol.startsWith('firestore')) {
		return;
	}
	
	event.respondWith(
		caches.match(event.request)
			.then(response => {
				// 1. Si el recurso está en la caché, devolverlo.
				if (response) {
					// console.log(`[Service Worker] Sirviendo desde la caché: ${event.request.url}`);
					return response;
				}
				
				// 2. Si no está en caché, ir a la red.
				// console.log(`[Service Worker] Obteniendo de la red: ${event.request.url}`);
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
						console.error(`[Service Worker] Error al obtener y no está en caché: ${event.request.url}`);
						// Podrías devolver una página de fallback si es necesario
						// return caches.match('/offline.html'); 
					});
			})
	);
});

// Listener para forzar la activación (utilizado por index.html para recargar)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
