/* Naturstrolche – Service Worker (muss nicht geändert werden, auch nicht bei neuen Werkzeugen).
   HTML-Seiten: online immer die neueste Fassung (max. 4 Sek. warten), offline die gespeicherte.
   Die Startseite speichert alle Werkzeuge aus ihrer Liste selbst vor. */
const CACHE = 'naturstrolche';
const FILES = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(FILES.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const offlinePage = () => new Response(
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<body style="font-family:system-ui,sans-serif;padding:2rem;color:#26301F;background:#F4F3EE">' +
  '<h2>Noch nicht offline verfügbar</h2><p>Bitte diese Seite einmal mit Internet öffnen. Danach funktioniert sie auch ohne Netz.</p>',
  {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('.enc');
  // "…/" und "…/index.html" teilen sich einen Eintrag
  const key = url.pathname.endsWith('/') ? new URL('index.html', url).href : url.origin + url.pathname;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = await c.match(key, {ignoreSearch: true});
    const net = fetch(req, isHtml ? {cache: 'no-cache'} : undefined).then(res => {
      if (res && res.ok) c.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (!cached) return (await net) || (isHtml ? offlinePage() : new Response('', {status: 504}));
    if (!isHtml) { e.waitUntil(net); return cached; }
    const timeout = new Promise(r => setTimeout(() => r(null), 4000));
    const fresh = await Promise.race([net, timeout]);
    if (!fresh || !fresh.ok) e.waitUntil(net);
    return (fresh && fresh.ok) ? fresh : cached;
  })());
});
