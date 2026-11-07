/* Service worker: simpan semua fail pelancaran dalam iPad supaya boleh jalan tanpa internet */
var CORE = 'pel-core-v5';
var MEDIA = 'pel-media-v2';
var RT = 'pel-rt-v1';
var CORE_FILES = ['./', './index.html', './icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CORE).then(function (c) { return c.addAll(CORE_FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return (k.indexOf('pel-core-') === 0 && k !== CORE) || (k.indexOf('pel-media-') === 0 && k !== MEDIA); }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* jawab permintaan video dengan Range (iPad Safari minta video sebahagian demi sebahagian) */
function rangeResponse(req, full) {
  var range = req.headers.get('range');
  if (!range) return full;
  /* potong Blob tanpa salin keseluruhan video ke memori */
  return full.blob().then(function (blob) {
    var m = /bytes=(\d*)-(\d*)/.exec(range);
    var size = blob.size;
    var start, end;
    if (m && m[1] === '' && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
    else { start = m && m[1] ? parseInt(m[1], 10) : 0; end = m && m[2] ? parseInt(m[2], 10) : size - 1; }
    if (end >= size) end = size - 1;
    var part = blob.slice(start, end + 1, 'video/mp4');
    return new Response(part, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes'
      }
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* video: dari simpanan dahulu */
  if (url.origin === location.origin && /\.mp4$/.test(url.pathname)) {
    e.respondWith(caches.open(MEDIA).then(function (c) {
      return c.match(url.pathname, { ignoreSearch: true }).then(function (hit) {
        if (hit) return rangeResponse(req, hit);
        return fetch(req);
      });
    }));
    return;
  }

  /* page & ikon: ambil versi terbaru bila ada internet, guna simpanan bila offline */
  if (url.origin === location.origin) {
    e.respondWith(caches.open(CORE).then(function (c) {
      return fetch(req, { cache: 'no-store' }).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(function () {
        return c.match(req, { ignoreSearch: true }).then(function (hit) { return hit || c.match('./index.html'); });
      });
    }));
    return;
  }

  /* fon Google: simpan bila pertama kali dimuatkan */
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(RT).then(function (c) {
      return c.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) { c.put(req, res.clone()); return res; });
      });
    }));
  }
});
