// Launcher helper. Only small, verified boot files are stored here; the worker
// caches runtime assets when the game actually requests them.
function createRuntimeCache(base, network, hash) {
  'use strict';
  var supported = window.isSecureContext && 'serviceWorker' in navigator && 'caches' in window;
  var cacheName = 'kw-boot:' + base.pathname + ':v1';
  var script = new URL('hosting-cache-sw.js', base).href;
  function bounded(promise, ms) {
    return new Promise(function(resolve) {
      var timer = setTimeout(function() { resolve(null); }, ms);
      promise.then(function(value) { clearTimeout(timer); resolve(value); }, function() { clearTimeout(timer); resolve(null); });
    });
  }
  var registration = supported ? bounded(Promise.resolve().then(function() { return navigator.serviceWorker.register(script, {
    scope: base.pathname, updateViaCache: 'none'
  }); }), 3500) : Promise.resolve(null);
  async function checked(path, expected, loader) {
    var url = new URL(path, base), cache;
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || /[?#]/.test(path)) throw new Error('缓存文件路径不合法');
    if ('caches' in window) {
      var local = await bounded((async function() {
        cache = await caches.open(cacheName);
        var response = await cache.match(url.href);
        if (!response) return null;
        var bytes = await response.arrayBuffer();
        if (bytes.byteLength === expected.bytes && await hash(bytes) === expected.sha256) return bytes;
        await cache.delete(url.href);
        return null;
      })(), 750);
      if (local) return local;
    }
    var bytes = await (loader || network)(url);
    if (bytes.byteLength !== expected.bytes || await hash(bytes) !== expected.sha256) throw new Error('版本文件校验失败，请稍后重试');
    // Storage is best effort. Quota/private-mode failures never prevent play.
    bounded((async function() {
      var store = cache || await caches.open(cacheName);
      await store.put(url.href, new Response(bytes));
      var keys = await store.keys();
      for (var prefix of ['game.', 'hosting-files.']) {
        var old = keys.filter(function(key) { return new URL(key.url).pathname.split('/').pop().startsWith(prefix) && key.url !== url.href; });
        for (var key of old.slice(0, Math.max(0, old.length - 1))) await store.delete(key);
      }
    })(), 1000);
    return bytes;
  }
  async function inventoryNetwork(url) {
    var ctl = new AbortController(), timer = setTimeout(function() { ctl.abort(); }, 5000);
    try {
      var response = await fetch(url, {cache: 'force-cache', credentials: 'same-origin', signal: ctl.signal});
      if (!response.ok) throw new Error('缓存清单 HTTP ' + response.status);
      return await response.arrayBuffer();
    } finally { clearTimeout(timer); }
  }
  function controller() {
    return new Promise(function(resolve) {
      function ready() {
        var worker = navigator.serviceWorker.controller;
        if (worker && worker.scriptURL === script) {
          navigator.serviceWorker.removeEventListener('controllerchange', ready);
          clearTimeout(timer); resolve(worker);
        }
      }
      var timer = setTimeout(function() { navigator.serviceWorker.removeEventListener('controllerchange', ready); resolve(null); }, 1500);
      navigator.serviceWorker.addEventListener('controllerchange', ready); ready();
    });
  }
  async function connect(release) {
    if (!supported) return {enabled: false, reason: 'unsupported'};
    return await bounded((async function() {
      var active = navigator.serviceWorker.controller;
      var results = await Promise.all([active && active.scriptURL === script ? Promise.resolve(true) : registration, checked(release.inventory, {
        sha256: release.inventory_sha256, bytes: release.inventory_bytes
      }, inventoryNetwork)]);
      if (!results[0]) return {enabled: false, reason: 'registration-unavailable'};
      var worker = await controller();
      if (!worker) return {enabled: false, reason: 'controller-unavailable'};
      return await new Promise(function(resolve) {
        var channel = new MessageChannel();
        var timer = setTimeout(function() { channel.port1.close(); resolve(null); }, 1500);
        channel.port1.onmessage = function(event) {
          clearTimeout(timer); channel.port1.close(); resolve(event.data);
        };
        worker.postMessage({type: 'KW_CACHE_INIT', protocol: 1, release: release, inventory: results[1]}, [channel.port2]);
      });
    })(), 3500) || {enabled: false, reason: 'cache-timeout'};
  }
  return {checked: checked, connect: connect};
}
