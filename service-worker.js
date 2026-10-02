const SHELL_CACHE = 'furqan-shell-v2';
const RUNTIME_CACHE = 'furqan-runtime-v1';
const APP_SHELL = [
    '/',
    '/index.html',
    '/quran.html',
    '/manifest.json',
    '/5332635273529073463.jpg',
    '/apple-touch-icon.png',
    '/icon-192.png',
    '/icon-512.png'
];
const OPTIONAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/adhan@4.4.2/lib/bundles/adhan.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const shellCache = await caches.open(SHELL_CACHE);
        await shellCache.addAll(APP_SHELL);

        await Promise.allSettled(OPTIONAL_ASSETS.map(async url => {
            const request = new Request(url, { mode: 'no-cors' });
            const response = await fetch(request);
            if (response.ok || response.type === 'opaque') {
                const runtimeCache = await caches.open(RUNTIME_CACHE);
                await runtimeCache.put(request, response);
            }
        }));

        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter(name => name.startsWith('furqan-') && ![SHELL_CACHE, RUNTIME_CACHE].includes(name))
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    if (request.mode === 'navigate') {
        event.respondWith(fetch(request)
            .then(response => {
                caches.open(SHELL_CACHE).then(cache => cache.put(request, response.clone()).catch(() => {}));
                return response;
            })
            .catch(async () => await caches.match(request) || await caches.match('/index.html')));
        return;
    }

    event.respondWith(caches.match(request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then(response => {
            if (response.ok || response.type === 'opaque') {
                caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response.clone()).catch(() => {}));
            }
            return response;
        }).catch(() => caches.match(request));
    }));
});