const SHELL_CACHE = 'furqan-shell-v6';
const RUNTIME_CACHE = 'furqan-runtime-v5';
const APP_SHELL = [
    '/',
    '/index.html',
    '/stories-data.js',
    '/quran.html',
    '/manifest.json',
    '/5332635273529073463.jpg',
    '/apple-touch-icon.png',
    '/icon-192.png',
    '/icon-512.png'
];
const APP_SHELL_PATHS = new Set(APP_SHELL.map(path => new URL(path, self.location.origin).pathname));
const OPTIONAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/adhan@4.4.6/lib/bundles/adhan.umd.min.js'
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
    const requestUrl = new URL(request.url);
    const isAppShellRequest = requestUrl.origin === self.location.origin && APP_SHELL_PATHS.has(requestUrl.pathname);

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const shellCache = await caches.open(SHELL_CACHE);
                    await shellCache.put(request, response.clone());
                }
                return response;
            } catch {
                return await caches.match(request) || await caches.match('/index.html');
            }
        })());
        return;
    }

    if (isAppShellRequest) {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const shellCache = await caches.open(SHELL_CACHE);
                    await shellCache.put(request, response.clone());
                }
                return response;
            } catch {
                return await caches.match(request);
            }
        })());
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