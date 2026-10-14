// 一建实务 PWA Service Worker —— 应用外壳缓存 + 运行时缓存 + 断网可用
const CACHE = 'yj-beika-v2';
const SHELL = [
  './',
  './index.html',
  './gl/index.html',
  './yj/index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(SHELL);
    }).catch(function () { /* 离线时忽略，运行时再补 */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
      return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先，失败回退缓存（按真实 URL 缓存，保证更新及时 + 离线可用）
  if (req.mode === 'navigate') {
    e.respondWith((async function () {
      const cacheKey = url.pathname;
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(cacheKey, res.clone());
        return res;
      } catch (err) {
        const cache = await caches.open(CACHE);
        return (await cache.match(cacheKey)) ||
               (await cache.match('./index.html')) ||
               (await cache.match('./'));
      }
    })());
    return;
  }

  // 静态资源（含音频/专题图）：缓存优先 + 后台静默刷新
  e.respondWith((async function () {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) {
      fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
      }).catch(function () {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      throw err;
    }
  })());
});
