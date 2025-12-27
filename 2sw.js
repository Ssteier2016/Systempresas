// Nombre de la caché para esta versión de la PWA. CAMBIAR EL NÚMERO DE VERSIÓN CADA VEZ QUE HAYA UN CAMBIO.
const CACHE_NAME = 'systempresas-cache-v3';

// Lista de archivos esenciales que deben ser precargados e ir a la caché
const urlsToCache = [
	'/',
	'/index.html',
	'/manifest.json',
	'/sw.js',
	// Rutas de íconos (asumiendo que existen en la raíz)
	'/logo192.png',	
	'/icon512.png',
	'/favicon.png',
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
			.then(() => self.skipWaiting())
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
	// Solo interceptar peticiones GET
	if (event.request.method !== 'GET') {
		return;
	}
	
	// Excluir peticiones de Firebase/Firestore de la caché
	const requestUrl = event.request.url;
	if (requestUrl.includes('firebase') || requestUrl.includes('firestore') || 
		requestUrl.includes('googleapis')) {
		// Para Firebase/Firestore, usar solo red (no cachear)
		return fetch(event.request);
	}
	
	event.respondWith(
		caches.match(event.request)
			.then(response => {
				// 1. Si el recurso está en la caché, devolverlo.
				if (response) {
					return response;
				}
				
				// 2. Si no está en caché, ir a la red.
				return fetch(event.request)
					.then(networkResponse => {
						// Solo cachear respuestas válidas
						if (networkResponse.status === 200 && networkResponse.type === 'basic') {
							const responseToCache = networkResponse.clone();
							caches.open(CACHE_NAME)
								.then(cache => {
									cache.put(event.request, responseToCache);
								});
						}
						
						return networkResponse;
					})
					.catch(() => {
						console.error(`[Service Worker] Error al obtener: ${event.request.url}`);
						// Si es una página HTML, podrías devolver offline.html
						if (event.request.headers.get('accept').includes('text/html')) {
							return caches.match('/index.html');
						}
					});
			})
	);
});

// MANEJO DE NOTIFICACIONES PUSH - NUEVO
self.addEventListener('push', event => {
	console.log('[Service Worker] Notificación push recibida.');
	
	let data = {};
	if (event.data) {
		data = event.data.json();
	}
	
	const options = {
		body: data.body || 'Nueva notificación del sistema',
		icon: '/icon-192.png',
		badge: '/icon-72.png',
		tag: data.tag || 'business-notification',
		requireInteraction: true,
		actions: [
			{
				action: 'view',
				title: 'Ver'
			},
			{
				action: 'close',
				title: 'Cerrar'
			}
		]
	};
	
	event.waitUntil(
		self.registration.showNotification(
			data.title || 'Sistema de Negocio',
			options
		)
	);
});

// MANEJO DE CLIC EN NOTIFICACIÓN - NUEVO
self.addEventListener('notificationclick', event => {
	console.log('[Service Worker] Notificación clickeada.');
	
	event.notification.close();
	
	if (event.action === 'close') {
		return;
	}
	
	// Si el usuario hace clic en la notificación (no en una acción específica)
	event.waitUntil(
		clients.matchAll({
			type: 'window',
			includeUncontrolled: true
		}).then(clientList => {
			// Si ya hay una ventana abierta, enfocarla
			for (const client of clientList) {
				if (client.url === '/' && 'focus' in client) {
					return client.focus();
				}
			}
			// Si no hay ventana abierta, abrir una nueva
			if (clients.openWindow) {
				return clients.openWindow('/');
			}
		})
	);
});

// Listener para forzar la activación
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
