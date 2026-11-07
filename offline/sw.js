/* Versi offline: simpan page dan video dalam iPad */
var CORE = 'pel-off-core-v1';
var MEDIA = 'pel-off-media-v1';
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CORE).then(function (c) { return c.addAll(['./', './index.html', '../icon.png']); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

/* jawab permintaan video sebahagian demi sebahagian, potong Blob tanpa salin seluruh video ke memori */
function rangeResponse(req, full) {
  var range = req.headers.get('range');
  return full.blob().then(function (blob) {
    var size = blob.size, start = 0, end = size - 1;
    var m = range && /bytes=(\d*)-(\d*)/.exec(range);
    if (!m) return new Response(blob, { status: 200, headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size), 'Accept-Ranges': 'bytes' } });
    if (m[1] === '' && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); }
    else { start = m[1] ? parseInt(m[1], 10) : 0; end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1; }
    return new Response(blob.slice(start, end + 1, 'video/mp4'), {
      status: 206, statusText: 'Partial Content',
      headers: { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' }
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\.mp4$/.test(url.pathname)) {
    e.respondWith(caches.open(MEDIA).then(function (c) {
      return c.match(url.pathname).then(function (hit) { return hit ? rangeResponse(req, hit) : fetch(req); });
    }));
    return;
  }
  e.respondWith(caches.open(CORE).then(function (c) {
    return fetch(req, { cache: 'no-store' }).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; })
      .catch(function () { return c.match(req, { ignoreSearch: true }).then(function (h) { return h || c.match('./index.html'); }); });
  }));
});
