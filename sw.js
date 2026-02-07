'use strict';

/**
 * Taiwan Transport PWA - Service Worker
 * Provides offline capabilities and caching strategies
 */

const CACHE_NAME = 'taiwan-transport-v1';
const STATIC_CACHE = 'taiwan-transport-static-v1';
const API_CACHE = 'taiwan-transport-api-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/ubike.html',
    '/map.html',
    '/list.html',
    '/mrt.html',
    '/rail.html',
    '/bus.html',
    '/js/common.js',
    '/js/bus.js',
    '/js/util.js',
    '/ubike.js',
    '/sorttable.js',
    '/manifest.webapp'
];

// External assets (CDN resources)
const CDN_ASSETS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// API endpoints and their cache strategies
const API_PATTERNS = {
    // YouBike API - stale-while-revalidate (5 min cache)
    'apis.youbike.com.tw': {
        strategy: 'stale-while-revalidate',
        maxAge: 5 * 60 * 1000 // 5 minutes
    },
    // TDX API - network first with fallback
    'tdx.transportdata.tw': {
        strategy: 'network-first',
        maxAge: 30 * 1000 // 30 seconds
    },
    // OpenStreetMap tiles - cache first
    'tile.openstreetmap.org': {
        strategy: 'cache-first',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                // Cache local assets
                const localPromise = cache.addAll(STATIC_ASSETS).catch(err => {
                    console.warn('[SW] Some static assets failed to cache:', err);
                });

                // Cache CDN assets (separate to handle CORS)
                const cdnPromise = Promise.all(
                    CDN_ASSETS.map(url =>
                        fetch(url, { mode: 'cors' })
                            .then(response => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => console.warn('[SW] CDN asset failed:', url, err))
                    )
                );

                return Promise.all([localPromise, cdnPromise]);
            })
            .then(() => {
                console.log('[SW] Static assets cached');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter(name => name.startsWith('taiwan-transport-') &&
                            name !== STATIC_CACHE &&
                            name !== API_CACHE)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle requests with appropriate caching strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Determine caching strategy based on URL
    const apiConfig = Object.keys(API_PATTERNS).find(pattern =>
        url.hostname.includes(pattern)
    );

    if (apiConfig) {
        const config = API_PATTERNS[apiConfig];
        switch (config.strategy) {
            case 'cache-first':
                event.respondWith(cacheFirst(event.request, config.maxAge));
                break;
            case 'network-first':
                event.respondWith(networkFirst(event.request, config.maxAge));
                break;
            case 'stale-while-revalidate':
                event.respondWith(staleWhileRevalidate(event.request, config.maxAge));
                break;
            default:
                event.respondWith(networkFirst(event.request, config.maxAge));
        }
    } else if (url.origin === location.origin) {
        // Local static assets - cache first
        event.respondWith(cacheFirst(event.request));
    }
});

/**
 * Cache-first strategy
 * Best for: Static assets, map tiles, rarely changing content
 */
async function cacheFirst(request, maxAge = 24 * 60 * 60 * 1000) {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // Check if cache is still valid
        const cachedTime = cachedResponse.headers.get('sw-cached-time');
        if (!cachedTime || (Date.now() - parseInt(cachedTime)) < maxAge) {
            return cachedResponse;
        }
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            // Clone and cache with timestamp
            const responseToCache = networkResponse.clone();
            const headers = new Headers(responseToCache.headers);
            headers.append('sw-cached-time', Date.now().toString());

            const body = await responseToCache.blob();
            const cachedResponse = new Response(body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
            });

            cache.put(request, cachedResponse);
        }
        return networkResponse;
    } catch (error) {
        // Return cached response if network fails
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

/**
 * Network-first strategy
 * Best for: Real-time data, user-specific content
 */
async function networkFirst(request, maxAge = 60 * 1000) {
    const cache = await caches.open(API_CACHE);

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            // Cache the response with timestamp
            const responseToCache = networkResponse.clone();
            const headers = new Headers(responseToCache.headers);
            headers.append('sw-cached-time', Date.now().toString());

            const body = await responseToCache.blob();
            const cachedResponse = new Response(body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
            });

            cache.put(request, cachedResponse);
        }
        return networkResponse;
    } catch (error) {
        // Fall back to cache
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            console.log('[SW] Network failed, using cached response:', request.url);
            return cachedResponse;
        }
        throw error;
    }
}

/**
 * Stale-while-revalidate strategy
 * Best for: Semi-dynamic content (YouBike station data)
 */
async function staleWhileRevalidate(request, maxAge = 5 * 60 * 1000) {
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);

    // Fetch from network in background
    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                // Update cache with fresh response
                const responseToCache = networkResponse.clone();
                const headers = new Headers(responseToCache.headers);
                headers.append('sw-cached-time', Date.now().toString());

                responseToCache.blob().then(body => {
                    const cachedResp = new Response(body, {
                        status: responseToCache.status,
                        statusText: responseToCache.statusText,
                        headers: headers
                    });
                    cache.put(request, cachedResp);
                });
            }
            return networkResponse;
        })
        .catch(error => {
            console.warn('[SW] Network fetch failed:', error);
            return cachedResponse;
        });

    // Return cached response immediately if available
    if (cachedResponse) {
        const cachedTime = cachedResponse.headers.get('sw-cached-time');
        if (cachedTime && (Date.now() - parseInt(cachedTime)) < maxAge) {
            // Cache is fresh enough, return immediately
            return cachedResponse;
        }
        // Cache is stale but usable, return while revalidating
        fetchPromise; // Trigger background update
        return cachedResponse;
    }

    // No cache, wait for network
    return fetchPromise;
}

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
});

console.log('[SW] Service worker loaded');
