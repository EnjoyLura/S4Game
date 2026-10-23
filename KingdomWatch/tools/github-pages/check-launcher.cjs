/* Offline checks of the hosting bootstrap only. Never starts Cocos or a browser. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const folder = path.resolve(process.argv[2]);
const html = fs.readFileSync(path.join(folder, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const diagnostic = fs.readFileSync(path.join(folder, 'hosting-diagnostics.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
for (const script of [code, diagnostic]) {
  const result = spawnSync(process.execPath, ['--check', '-'], { input: script, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
async function scenario(version, invalid = false) {
  const body = Buffer.from('<html><head><base href="/kingdom-watch-play/"></head><body>' + version + '</body></html>');
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  const manifest = { schema: 1, id: version, base_path: '/kingdom-watch-play/', entry: 'game.' + sha.slice(0, 16) + '.html', entry_sha256: invalid ? '0'.repeat(64) : sha, requires_cross_origin_isolation: false };
  const requests = [], nodes = { kwLoad: {}, kwRetry: {}, kwProblem: { hidden: true } }; let written, opens = 0, closes = 0;
  const ctx = vm.createContext({ URL, TextDecoder, AbortController, Uint8Array, Date, setTimeout, clearTimeout,
    crypto: crypto.webcrypto, location: { origin: 'https://enjoylura.github.io' },
    window: { isSecureContext: true }, crossOriginIsolated: false,
    document: { getElementById: id => nodes[id], open: () => opens++, write: text => written = text, close: () => closes++ },
    fetch: async (url, opts) => {
      assert.equal(opts.cache, 'no-store'); assert(url.pathname.startsWith('/kingdom-watch-play/'));
      requests.push(String(url)); const b = url.pathname.endsWith('hosting-release.json') ? Buffer.from(JSON.stringify(manifest)) : body;
      return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
    }
  });
  vm.runInContext(code, ctx);
  for (let i = 0; i < 100 && !written && nodes.kwRetry.hidden !== false; i++) await new Promise(r => setTimeout(r, 5));
  assert.equal(requests.length, 2);
  if (invalid) { assert.equal(opens, 0); assert.equal(written, undefined); assert.equal(nodes.kwRetry.hidden, false); }
  else { assert.equal(written, body.toString()); assert.equal(opens, 1); assert.equal(closes, 1); }
  return { version, invalidDigest: invalid, entryInjected: !!written, networkFirst: true };
}
(async () => {
  const samples = [await scenario('first-visit'), await scenario('repeat-visit'), await scenario('updated-release'), await scenario('corrupted-entry', true)];
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'hosting-release.json')));
  const wasm = manifest.wasm.map(name => {
    const bytes = fs.readFileSync(path.join(folder, name)); const module = new WebAssembly.Module(bytes);
    assert(WebAssembly.validate(bytes)); return { path: name, compiled: true, importedMemory: WebAssembly.Module.imports(module).filter(x => x.kind === 'memory').length };
  });
  console.log(JSON.stringify({ checks: samples, wasm, gameStarted: false, browserStarted: false }, null, 2));
})().catch(err => { console.error(err); process.exitCode = 1; });
