/* Project-scoped, on-demand runtime cache. No precache, no isolation headers,
 * no navigation/manifest interception, and no page reload on first install. */
'use strict';
const BASE = new URL('__BASE_PATH__', self.location.origin);
const CONTENT = 'kw-runtime:' + BASE.pathname + ':v1';
const META = 'kw-runtime-meta:' + BASE.pathname + ':v1';
const LIMIT = 256 * 1024 * 1024;
const catalogs = new Map(), pending = new Map();
let statePromise, queue = Promise.resolve(), usedBytes = 0, storedFiles = 0;
let measured = false, storageCooldown = 0;
const observedSince = new Date().toISOString(), observations = new Map();
const totals = {cacheHits: 0, cacheHitBytes: 0, cacheMisses: 0, httpFetches: 0, verifiedFetchBytes: 0, untrackedFetches: 0, integrityRetries: 0};
function observe(clientId, name, amount = 1) {
  if (!observations.has(clientId)) observations.set(clientId, Object.fromEntries(Object.keys(totals).map(function(key) { return [key, 0]; })));
  observations.get(clientId)[name] += amount;
  totals[name] += amount;
}

function address(path) { return new URL('hosting-cache/' + path, BASE).href; }
// Preserve the original URL as well as bytes: cached CSS/module responses may
// use Response.url to resolve relative dependencies.
function contentKey(record, path) { return address('content/' + record.sha256 + '/' + path); }
function optional(promise, ms) {
  return new Promise(function(resolve) {
    const timer = setTimeout(function() { resolve(null); }, ms);
    promise.then(function(value) { clearTimeout(timer); resolve(value); }, function() { clearTimeout(timer); resolve(null); });
  });
}
function serial(job) {
  const result = queue.then(job);
  queue = result.catch(function() {});
  return result;
}
async function sha(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map(function(n) { return n.toString(16).padStart(2, '0'); }).join('');
}
function safePath(path) {
  if (typeof path !== 'string' || !path || /[\\:%?#]/.test(path) || path.startsWith('/') ||
      path.split('/').some(function(p) { return !p || p === '.' || p === '..'; })) return false;
  const url = new URL(path, BASE);
  return url.origin === BASE.origin && url.pathname.startsWith(BASE.pathname);
}
async function validate(release, bytes) {
  if (!release || release.schema !== 1 || release.base_path !== BASE.pathname ||
      !/^[a-f0-9]{16}$/.test(release.id) || !/^[a-f0-9]{64}$/.test(release.inventory_sha256) ||
      release.inventory !== 'hosting-files.' + release.id + '.json' ||
      release.id !== release.inventory_sha256.slice(0, 16) ||
      !/^game\.[a-f0-9]{16}\.html$/.test(release.entry) ||
      !(bytes instanceof ArrayBuffer) || bytes.byteLength !== release.inventory_bytes ||
      bytes.byteLength > 2 * 1024 * 1024 || await sha(bytes) !== release.inventory_sha256) {
    throw new Error('Invalid cache inventory');
  }
  const inventory = JSON.parse(new TextDecoder().decode(bytes)), files = inventory.files;
  if (inventory.schema !== 1 || !files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Invalid cache file list');
  let total = 0;
  const names = Object.keys(files);
  if (names.length > 20000) throw new Error('Cache file count exceeds budget');
  for (const path of names) {
    const record = files[path];
    if (!safePath(path) || !record || !/^[a-f0-9]{64}$/.test(record.sha256) ||
        !Number.isSafeInteger(record.bytes) || record.bytes < 0 || record.bytes >= 100 * 1024 * 1024) throw new Error('Unsafe cache record');
    total += record.bytes;
  }
  if (total !== inventory.total_bytes || total > 950 * 1024 * 1024 ||
      !files[release.entry] || files[release.entry].sha256 !== release.entry_sha256 ||
      files[release.entry].bytes !== release.entry_bytes) throw new Error('Cache inventory does not match release');
  return {release: release, files: files};
}
async function state() {
  if (!statePromise) statePromise = (async function() {
    const cache = await caches.open(META), response = await cache.match(address('state'));
    const value = response ? await response.json() : null;
    return value && value.protocol === 1 && Array.isArray(value.catalogs) && value.clients
      ? value : {protocol: 1, catalogs: [], clients: {}};
  })().catch(function(error) { statePromise = null; throw error; });
  return statePromise;
}
async function saveState(value) {
  const cache = await caches.open(META);
  await cache.put(address('state'), new Response(JSON.stringify(value)));
}
async function catalog(id) {
  if (!catalogs.has(id)) catalogs.set(id, (async function() {
    const cache = await caches.open(META), response = await cache.match(address('catalog/' + id));
    if (!response) throw new Error('Cache catalog missing');
    const value = await response.json();
    const result = await validate(value.release, new TextEncoder().encode(value.inventory).buffer);
    if (result.release.id !== id) throw new Error('Cache catalog identity mismatch');
    return result;
  })().catch(function(error) { catalogs.delete(id); throw error; }));
  return catalogs.get(id);
}
async function maintain(value) {
  // Keep two recent releases and every release pinned to an open game tab.
  const pages = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  const live = new Set(pages.filter(function(client) { return client.url.startsWith(BASE.href); }).map(function(client) { return client.id; }));
  for (const id of Object.keys(value.clients)) if (!live.has(id)) delete value.clients[id];
  for (const id of observations.keys()) if (!live.has(id)) observations.delete(id);
  const keep = new Set(value.catalogs.slice(0, 2).map(function(item) { return item.id; }));
  Object.values(value.clients).forEach(function(id) { keep.add(id); });
  const allowed = new Map(), retained = [];
  for (const item of value.catalogs) {
    if (!keep.has(item.id)) continue;
    try {
      const current = await catalog(item.id);
      Object.entries(current.files).forEach(function(item) { allowed.set(contentKey(item[1], item[0]), item[1].bytes); });
      retained.push(item);
    } catch (_) { /* Corrupt metadata cannot authorize a cache hit. */ }
  }
  const data = await caches.open(CONTENT), metadata = await caches.open(META);
  let bytes = 0, count = 0;
  for (const key of await data.keys()) {
    if (!allowed.has(key.url)) await data.delete(key);
    else { bytes += allowed.get(key.url); count++; }
  }
  const retainedIds = new Set(retained.map(function(item) { return item.id; }));
  for (const item of value.catalogs) if (!retainedIds.has(item.id)) {
    await metadata.delete(address('catalog/' + item.id)); catalogs.delete(item.id);
  }
  value.catalogs = retained;
  await saveState(value);
  usedBytes = bytes; storedFiles = count; measured = true;
}
async function initialize(client, message) {
  const current = await validate(message.release, message.inventory);
  return serial(async function() {
    const value = await state(), cache = await caches.open(META), id = current.release.id;
    await cache.put(address('catalog/' + id), new Response(JSON.stringify({
      release: current.release, inventory: new TextDecoder().decode(message.inventory)
    })));
    catalogs.set(id, Promise.resolve(current));
    value.clients[client.id] = id;
    value.catalogs = [{id: id}].concat(value.catalogs.filter(function(item) { return item.id !== id; }));
    await maintain(value);
    return {enabled: true, protocol: 1, release: id, cachedFiles: storedFiles, cachedBytes: usedBytes, limitBytes: LIMIT};
  });
}
async function store(record, path, response) {
  return serial(async function() {
    if (Date.now() < storageCooldown) return;
    const cache = await caches.open(CONTENT), key = contentKey(record, path);
    if (!measured) await maintain(await state());
    if (await cache.match(key, {ignoreVary: true})) return;
    // Never evict active-version data to make a write succeed. If old and new
    // releases temporarily exceed the cap, new misses use ordinary HTTP.
    if (usedBytes + record.bytes > LIMIT) return;
    try {
      await cache.put(key, response);
      usedBytes += record.bytes; storedFiles++;
    } catch (_) { storageCooldown = Date.now() + 60000; }
  });
}
async function download(request, record, path, clientId) {
  for (let attempt = 0; attempt < 2; attempt++) {
    observe(clientId, 'httpFetches');
    if (attempt) observe(clientId, 'integrityRetries');
    const response = await fetch(attempt ? new Request(request, {cache: 'reload'}) : request);
    if (response.status !== 200 || response.type !== 'basic' || response.headers.has('Content-Range')) return {response: response};
    const bytes = await response.clone().arrayBuffer();
    if (bytes.byteLength === record.bytes && await sha(bytes) === record.sha256) {
      observe(clientId, 'verifiedFetchBytes', bytes.byteLength);
      return {response: response, write: store(record, path, response.clone()).catch(function() {})};
    }
  }
  throw new TypeError('游戏资源版本校验失败，请重新打开游戏');
}
async function resource(event, path) {
  const record = await optional((async function() {
    const value = await state(), id = value.clients[event.clientId];
    if (id) {
      const files = (await catalog(id)).files;
      if (Object.prototype.hasOwnProperty.call(files, path)) return files[path];
    }
    return null;
  })(), 500);
  if (!record) {
    observe(event.clientId, 'untrackedFetches'); observe(event.clientId, 'httpFetches');
    return {response: await fetch(event.request)};
  }
  const key = contentKey(record, path);
  const cached = await optional((async function() {
    const cache = await caches.open(CONTENT);
    return await cache.match(key, {ignoreVary: true});
  })(), 250);
  if (cached) {
    observe(event.clientId, 'cacheHits'); observe(event.clientId, 'cacheHitBytes', record.bytes);
    return {response: cached};
  }
  observe(event.clientId, 'cacheMisses');
  // Reuse unchanged paths/bytes between releases; changed bytes get a distinct
  // key, including when two open tabs use different versions of a fixed path.
  if (!pending.has(key)) {
    pending.set(key, download(event.request, record, path, event.clientId).finally(function() { pending.delete(key); }));
  }
  const result = await pending.get(key);
  return {response: result.response.clone(), write: result.write};
}
self.addEventListener('install', function(event) { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', function(event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', function(event) {
  const client = event.source, message = event.data, port = event.ports[0];
  if (!client || !client.id || !client.url.startsWith(BASE.href) || !port || !message || message.protocol !== 1) return;
  if (message.type === 'KW_CACHE_INIT') {
    event.waitUntil(initialize(client, message).then(function(result) { port.postMessage(result); }, function() {
      port.postMessage({enabled: false, reason: 'storage-or-inventory-unavailable'});
    }));
  } else if (message.type === 'KW_CACHE_STATUS') {
    event.waitUntil(serial(async function() {
      const value = await state();
      if (!measured) await maintain(value);
      port.postMessage({protocol: 1, scope: BASE.href, cachedFiles: storedFiles, cachedBytes: usedBytes,
        limitBytes: LIMIT, releases: value.catalogs.map(function(item) { return item.id; }), precache: false,
        observations: {since: observedSince, lifetime: '当前Worker本次运行；浏览器休眠或重启后计数从零开始',
          totals: totals, clients: Array.from(observations).map(function(item) {
            return {client: item[0], release: value.clients[item[0]] || null, counts: item[1]};
          })}});
    }).catch(function() { port.postMessage({enabled: false, reason: 'storage-unavailable'}); }));
  }
});
self.addEventListener('fetch', function(event) {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || !event.clientId || request.mode === 'navigate' || request.cache === 'no-store' ||
      request.headers.has('Range') || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname) ||
      url.searchParams.has('diag') || url.searchParams.has('check')) return;
  let path;
  try { path = decodeURIComponent(url.pathname.slice(BASE.pathname.length)); } catch (_) { return; }
  if (!safePath(path) || path === 'index.html' || path.startsWith('hosting-') || path.startsWith('hosting-cache/')) return;
  const result = resource(event, path);
  event.respondWith(result.then(function(value) { return value.response; }));
  event.waitUntil(result.then(function(value) { return value.write; }).catch(function() {}));
});
