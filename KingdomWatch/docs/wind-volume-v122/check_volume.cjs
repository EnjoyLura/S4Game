'use strict';
// Run: node docs/wind-volume-v122/check_volume.cjs
// Only cosmetic TypeScript is evaluated, with inert CC/Ux/resource doubles.
// No engine, game scene, GPU, browser, real timers, image decoding or Git process.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require(process.env.WIND_CHECK_TYPESCRIPT ||
  'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const project = path.resolve(__dirname, '../..');
const volumePath = 'assets/scripts/battle/WindVolumeVFX.ts';
const parentPath = 'assets/scripts/battle/WindNinjaVFX.ts';
const heroesPath = 'assets/scripts/battle/WindNinjaHeroes.ts';
const source = fs.readFileSync(path.join(project, volumePath), 'utf8');
const effect = fs.readFileSync(path.join(project, 'assets/resources/fx/wind-volume-v122.effect'), 'utf8');
const baseline = '876c8b9cf75a7e5773ae00933bb5abeef8ef26f4';
const report = { status: 'FAIL', baseline, scope: 'isolated cosmetic modules with inert doubles and static source protection',
  engineExecuted: false, gameSceneExecuted: false, gitProcessExecuted: false, realTimersUsed: false,
  imagesRequired: false, shaderCompiled: false, tests: [] };
const ast = (text, name = 'check.ts') => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
function visit(node, predicate) {
  const found = [];
  function walk(n) { if (predicate(n)) found.push(n); ts.forEachChild(n, walk); }
  walk(node); return found;
}
function tokens(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const result = [];
  for (let kind; (kind = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken;) result.push([kind, scanner.getTokenText()]);
  return JSON.stringify(result);
}
async function check(name, fn) {
  try { const detail = await fn(); report.tests.push({ name, status: 'PASS', ...(detail ? { detail } : {}) }); }
  catch (error) { report.tests.push({ name, status: 'FAIL', error: error.stack || String(error) }); }
}
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

function harness() {
  const stats = { nodes: [], materials: [], textures: [], frames: [], effectLoads: [], uxCalls: [], imageLoads: [], timers: new Map() };
  class Asset {
    constructor() { this.isValid = true; this.refs = 0; this.destroyCalls = 0; }
    addRef() { this.refs++; return this; }
    destroy() { this.destroyCalls++; this.isValid = false; }
  }
  class Texture2D extends Asset {
    static PixelFormat = { RGBA8888: 'rgba8' };
    static Filter = { LINEAR: 'linear', NONE: 'none' };
    static WrapMode = { CLAMP_TO_EDGE: 'clamp' };
    constructor() { super(); stats.textures.push(this); }
    reset(options) { Object.assign(this, options); }
    uploadData(data) { this.pixels = Array.from(data); }
    setFilters(min, mag) { this.filters = [min, mag]; }
    setMipFilter(filter) { this.mip = filter; }
    setWrapMode(s, t) { this.wrap = [s, t]; }
  }
  class SpriteFrame extends Asset {
    constructor() { super(); stats.frames.push(this); }
    reset(options) { Object.assign(this, options); }
  }
  class Material extends Asset {
    constructor() { super(); this.calls = []; stats.materials.push(this); }
    initialize(options) { assert(this.isValid); this.options = options; }
    setProperty(name, value) {
      assert(this.isValid);
      this.calls.push({ name, value: value instanceof Vec4 ? [value.x, value.y, value.z, value.w] : value });
    }
  }
  class Vec4 { constructor() { this.set(0, 0, 0, 0); } set(x, y, z, w) { Object.assign(this, { x, y, z, w }); } }
  class Vec2 {}
  class Rect { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
  class Size { constructor(width, height) { Object.assign(this, { width, height }); } }
  class UITransform { setContentSize(width, height) { Object.assign(this, { width, height }); } }
  class Sprite { static SizeMode = { CUSTOM: 'custom' }; constructor() { this.isValid = true; } }
  class Node {
    static EventType = { NODE_DESTROYED: 'destroyed' };
    constructor(name) {
      Object.assign(this, { name, children: [], components: [], isValid: true, queued: false, active: true,
        position: { x: 0, y: 0, z: 0 }, events: new Map() }); stats.nodes.push(this);
    }
    setParent(parent) { this.parent = parent; parent.children.push(this); }
    setPosition(x, y, z) { this.position = { x, y, z }; }
    addComponent(Type) { const c = new Type(); c.node = this; this.components.push(c); return c; }
    once(name, callback) { this.events.set(name, callback); }
    getChildByName(name) { return this.children.find(n => n.name === name); }
    getSiblingIndex() { return this.parent.children.indexOf(this); }
    setSiblingIndex(index) {
      const children = this.parent.children; children.splice(children.indexOf(this), 1); children.splice(index, 0, this);
    }
    destroy() {
      if (!this.isValid) return;
      this.queued = true;
      for (const child of [...this.children]) child.destroy();
      const callback = this.events.get(Node.EventType.NODE_DESTROYED);
      this.events.delete(Node.EventType.NODE_DESTROYED); if (callback) callback();
      this.isValid = false; this.components.forEach(c => { c.isValid = false; });
    }
  }
  class Color { static fromHEX(c, hex) { c.hex = hex; } }
  class Graphics {
    constructor() { return new Proxy(this, { get: (object, key) => key in object ? object[key] : () => {} }); }
  }
  const cc = { EffectAsset: Asset, gfx: { BlendFactor: { ONE: 1, ONE_MINUS_SRC_ALPHA: 2 } },
    isValid: (item, strict) => !!item && item.isValid !== false && (!strict || !item.queued),
    Material, Node, Rect, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec2, Vec4, Color, Graphics,
    Layers: { Enum: { UI_2D: 1 } },
    resources: { load(id, Type, callback) { assert.equal(Type, Asset); stats.effectLoads.push({ id, callback }); } } };
  const uxCache = new Map(), uxPending = new Map();
  function uxFrame(id, callback, priority) {
    stats.uxCalls.push({ id, priority });
    if (uxCache.has(id)) { void Promise.resolve().then(() => callback(uxCache.get(id))); return; }
    if (!uxPending.has(id)) { uxPending.set(id, []); stats.imageLoads.push(id); }
    uxPending.get(id).push(callback);
  }
  const N = (name, parent) => { const node = new Node(name); node.setParent(parent); return node; };
  let timerID = 0;
  const sandbox = {
    Date: class ForbiddenDate { constructor() { throw new Error('wall-clock access'); } static now() { throw new Error('wall-clock access'); } },
    performance: { now() { throw new Error('wall-clock access'); } },
    setTimeout(fn, ms) { const id = ++timerID; stats.timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { stats.timers.delete(id); },
  };
  const context = vm.createContext(sandbox);
  const effects = [];
  class HeroFxShader {
    constructor() { this.ready = false; this.draws = []; effects.push(this); }
    begin() {} end() {} draw(...args) { this.draws.push(args); return this.ready; }
  }
  function load(text, filename, dependencies) {
    const compiled = ts.transpileModule(text, { fileName: filename, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
    assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
    const module = { exports: {} };
    const wrapper = new vm.Script('(function(require,module,exports){' + compiled.outputText + '\n})', { filename }).runInContext(context);
    wrapper(id => { assert(Object.hasOwn(dependencies, id), 'Unexpected runtime dependency: ' + id); return dependencies[id]; }, module, module.exports);
    return module.exports;
  }
  const api = load(source, volumePath, { cc, '../ui/UIKit': { N }, '../ui/Ux': { uxFrame } });
  const effectAsset = new Asset();
  function atlas() {
    const texture = new Texture2D(); texture.reset({ width: 1024, height: 1024 });
    const frame = new SpriteFrame(); frame.reset({ texture }); return frame;
  }
  const art = [atlas(), atlas()];
  return { ...api, stats, cc, effects, art, effectAsset, uxFrame,
    parent: () => new Node('parent'),
    finishEffect(error = null) { const item = stats.effectLoads.find(x => !x.done); assert(item); item.done = true; item.callback(error, error ? null : effectAsset); },
    finishAtlas(index, frame = art[index]) {
      const id = api.WIND_VOLUME_IMAGES[index], callbacks = uxPending.get(id); assert(callbacks);
      uxPending.delete(id); if (frame) uxCache.set(id, frame); callbacks.forEach(cb => cb(frame));
    },
    async ready() { this.finishEffect(); this.finishAtlas(0); this.finishAtlas(1); await flush(); },
    runRetries() { const timers = [...stats.timers]; stats.timers.clear(); timers.forEach(([, t]) => t.fn()); },
    parentAPI() { return load(fs.readFileSync(path.join(project, parentPath), 'utf8'), parentPath,
      { cc, './HeroFxShader': { HeroFxShader }, './WindVolumeVFX': api }); },
  };
}
const area = (kind = 'eye', age = 0.8) => ({ kind, age, x: 13, y: -7, radius: 40, duration: 4 });
const bindings = q => q.material.calls.filter(c => c.name === 'volumeMap');
const last = (q, name) => q.material.calls.filter(c => c.name === name).at(-1).value;

// Read loose immutable Git objects directly: no git executable, repository writes,
// hooks, checkout or index access. Fail explicitly if this baseline is unavailable.
function gitObject(id) {
  const file = path.join(project, '../.git/objects', id.slice(0, 2), id.slice(2));
  assert(fs.existsSync(file), 'Required loose baseline object unavailable: ' + id);
  const object = zlib.inflateSync(fs.readFileSync(file)), zero = object.indexOf(0);
  assert.equal(crypto.createHash('sha1').update(object).digest('hex'), id);
  return { type: object.subarray(0, zero).toString().split(' ')[0], data: object.subarray(zero + 1) };
}
function gitTree(id) {
  const object = gitObject(id); assert.equal(object.type, 'tree'); const entries = [];
  for (let offset = 0; offset < object.data.length;) {
    const space = object.data.indexOf(32, offset), zero = object.data.indexOf(0, space);
    entries.push({ mode: object.data.subarray(offset, space).toString(), name: object.data.subarray(space + 1, zero).toString(),
      id: object.data.subarray(zero + 1, zero + 21).toString('hex') }); offset = zero + 21;
  }
  return entries;
}
function treeAt(parts) {
  let id = /^tree ([a-f0-9]{40})/m.exec(gitObject(baseline).data.toString())[1];
  for (const part of parts) { const entry = gitTree(id).find(e => e.name === part); assert(entry, part); id = entry.id; }
  return id;
}
function inventory(id, prefix, output = new Map()) {
  for (const entry of gitTree(id)) {
    const name = prefix + '/' + entry.name;
    if (entry.mode === '40000') inventory(entry.id, name, output); else output.set(name, entry.id);
  }
  return output;
}
function diskInventory(folder, output = []) {
  for (const entry of fs.readdirSync(path.join(project, folder), { withFileTypes: true })) {
    const name = folder + '/' + entry.name;
    if (entry.isDirectory()) diskInventory(name, output); else output.push(name);
  }
  return output;
}

(async () => {
  await check('whole-asset first-paint barrier, UX prewarm identity and cross-instance deduplication', async () => {
    const h = harness(); const warmed = [];
    h.WIND_VOLUME_IMAGES.forEach(id => h.uxFrame(id, frame => warmed.push(frame), 'next'));
    const a = new h.WindVolumeVFX(h.parent()), b = new h.WindVolumeVFX(h.parent());
    assert.equal(h.stats.effectLoads.length, 1); assert.equal(h.stats.imageLoads.length, 2);
    assert.equal(a.ready, false); assert.equal(a.draw(area(), 1), false);
    h.finishEffect(); await flush(); assert.equal(a.ready, false);
    h.finishAtlas(0); await flush(); assert.equal(a.ready, false); assert.equal(b.ready, false);
    assert.equal(h.stats.materials.length, 0); assert(a.quads.every(q => !q.node.active));
    h.finishAtlas(1); await flush(); assert(a.ready && b.ready);
    assert.equal(h.stats.materials.length, 16); assert.equal(h.effectAsset.refs, 1);
    h.art.forEach((frame, i) => {
      assert.equal(frame, warmed[i]); assert.equal(frame.refs, 1); assert.equal(frame.packable, false);
      assert.deepEqual(frame.texture.filters, ['linear', 'linear']); assert.equal(frame.texture.mip, 'none');
      assert.deepEqual(frame.texture.wrap, ['clamp', 'clamp']);
    });
    a.quads.forEach(q => assert.equal(bindings(q)[0].value, h.art[0].texture));
    return { instances: 2, materials: 16, effectDownloads: 1, actualImageDownloads: 2, retainedReferencesPerPath: 1 };
  });
  await check('failed effect and atlas requests are evicted and deduplicated on retry', async () => {
    const h = harness(), a = new h.WindVolumeVFX(h.parent()), b = new h.WindVolumeVFX(h.parent());
    h.finishEffect(new Error('inert failure')); h.finishAtlas(0, null); h.finishAtlas(1); await flush();
    assert(!a.ready && !b.ready); assert.equal(h.stats.timers.size, 2);
    assert([...h.stats.timers.values()].every(t => t.ms === 1000));
    h.runRetries(); assert.equal(h.stats.effectLoads.length, 2); assert.equal(h.stats.imageLoads.length, 3);
    h.finishEffect(); h.finishAtlas(0); await flush(); assert(a.ready && b.ready);
    assert.equal(h.stats.timers.size, 0); assert.equal(h.effectAsset.refs, 1);
    assert(h.art.every(frame => frame.refs === 1));
  });
  await check('destroy-before-late-load and queued-parent destruction cannot create stale materials', async () => {
    const h = harness(), oldParent = h.parent(), old = new h.WindVolumeVFX(oldParent);
    const carrierFrame = old.frame, carrierTexture = old.texture; oldParent.destroy();
    const live = new h.WindVolumeVFX(h.parent()); await h.ready();
    assert.equal(old.ready, false); assert.equal(old.draw(area(), 1), false); assert(live.ready);
    assert.equal(h.stats.materials.length, 8); assert.equal(carrierFrame.destroyCalls, 1); assert.equal(carrierTexture.destroyCalls, 1);
    assert.equal(h.stats.effectLoads.length, 1); assert.equal(h.stats.imageLoads.length, 2);
    const queued = harness(), parent = queued.parent(), pool = new queued.WindVolumeVFX(parent);
    parent.queued = true; await queued.ready(); assert.equal(pool.ready, false); assert.equal(queued.stats.materials.length, 0);
    parent.destroy();
  });
  await check('fixed eight-slot pool reuses nodes/materials and begin/end hides stale slots', async () => {
    const h = harness(), pool = new h.WindVolumeVFX(h.parent(), 99); await h.ready();
    assert.equal(pool.quads.length, 8); const nodes = pool.quads.map(q => q.node), materials = [...h.stats.materials];
    assert.deepEqual(pool.texture.pixels, new Array(16).fill(255)); assert.equal(pool.texture.width, 2);
    pool.begin(); for (let i = 0; i < 8; i++) assert.equal(pool.draw(area(), 1), true);
    assert.equal(pool.draw(area(), 1), false); pool.end(); assert(nodes.every(n => n.active));
    pool.begin(); assert(pool.draw(area(), 1)); pool.end();
    assert(nodes[0].active); assert(nodes.slice(1).every(n => !n.active));
    assert(pool.quads.every((q, i) => q.node === nodes[i] && q.material === materials[i]));
    pool.begin(); assert.equal(pool.draw(area('spiral'), 1), false); assert.equal(pool.draw(area(), 0), true);
    pool.end(); assert(nodes.every(n => !n.active)); assert.equal(h.stats.materials.length, 8);
  });
  await check('sampler changes only with mode, exact geometry/state and age-only animation', async () => {
    const h = harness(), pool = new h.WindVolumeVFX(h.parent()); await h.ready(); const q = pool.quads[0];
    const paint = (kind, age) => { pool.begin(); assert(pool.draw(area(kind, age), 0.7)); pool.end(); };
    paint('eye', 0.8); assert.equal(bindings(q).length, 1);
    assert.deepEqual(last(q, 'volumeState'), [0.8, 0.7, 0, 0.73]);
    assert.deepEqual(last(q, 'volumeShape'), [108, 108, 40, 4]); assert.equal(q.node.position.y, -7);
    paint('eye', 0.8); assert.equal(bindings(q).length, 1); assert.equal(h.stats.timers.size, 0);
    paint('tornado', 1.25); paint('tornado', 2); assert.equal(bindings(q).length, 2);
    assert.equal(bindings(q)[1].value, h.art[1].texture);
    assert.deepEqual(last(q, 'volumeState'), [2, 0.7, 1, 0.73]);
    assert.deepEqual(last(q, 'volumeShape'), [104, 132, 40, 4]); assert.equal(q.node.position.y, 7);
    paint('eye', 2); assert.equal(bindings(q).length, 3); assert.equal(bindings(q)[2].value, h.art[0].texture);
    const sf = ast(source);
    const timers = visit(sf, n => ts.isCallExpression(n) && n.expression.getText(sf) === 'setTimeout');
    assert.equal(timers.length, 1);
    let owner = timers[0]; while (owner && !ts.isMethodDeclaration(owner)) owner = owner.parent;
    assert.equal(owner.name.getText(sf), 'retry');
    assert.equal(visit(sf, n => ts.isIdentifier(n) && ['Date', 'performance', 'requestAnimationFrame', 'setInterval'].includes(n.text)).length, 0);
    assert(!/\bcc_time\b/.test(effect.replace(/\/\/[^\r\n]*/g, '')));
  });
  await check('disposal destroys only owned carriers/materials and cancels retry; global art survives restart', async () => {
    const h = harness(), parent = h.parent(), pool = new h.WindVolumeVFX(parent); await h.ready();
    const frame = pool.frame, texture = pool.texture, materials = [...h.stats.materials]; parent.destroy(); parent.destroy();
    assert.equal(pool.ready, false); assert.equal(frame.destroyCalls, 1); assert.equal(texture.destroyCalls, 1);
    assert(materials.every(m => m.destroyCalls === 1)); assert.equal(h.effectAsset.destroyCalls, 0);
    h.art.forEach(f => { assert.equal(f.destroyCalls, 0); assert.equal(f.texture.destroyCalls, 0); });
    const next = new h.WindVolumeVFX(h.parent()); await flush(); assert(next.ready);
    assert.equal(h.stats.effectLoads.length, 1); assert.equal(h.stats.imageLoads.length, 2);
    const fail = harness(), p = fail.parent(); new fail.WindVolumeVFX(p);
    fail.finishEffect(new Error('retry')); fail.finishAtlas(0); fail.finishAtlas(1); await flush();
    assert.equal(fail.stats.timers.size, 1); p.destroy(); assert.equal(fail.stats.timers.size, 0);
    fail.runRetries(); assert.equal(fail.stats.effectLoads.length, 1);
  });
  await check('real parent pins volume/energy/fallback per event, ninja allocates no volume, FX precedes text', async () => {
    const h = harness(), { WindNinjaVFX } = h.parentAPI(), parent = h.parent();
    const text = new h.cc.Node('TextLayer'); text.setParent(parent);
    const wind = new WindNinjaVFX(parent, true), ninja = new WindNinjaVFX(parent, false);
    assert(wind.volume); assert.equal(ninja.volume, null); assert.equal(h.stats.effectLoads.length, 1);
    assert(wind.root.getSiblingIndex() < text.getSiblingIndex()); assert(ninja.root.getSiblingIndex() < text.getSiblingIndex());
    const fallback = area(); wind.begin(); wind.area(fallback); wind.end(); assert.equal(wind.areaShader.get(fallback), 'fallback');
    wind.flow.ready = true;
    const energy = area('tornado'); wind.begin(); wind.area(energy); wind.end(); assert.equal(wind.areaShader.get(energy), 'energy');
    await h.ready();
    wind.begin(); wind.area(fallback); wind.area(energy); const fresh = area(); wind.area(fresh); wind.end();
    assert.equal(wind.areaShader.get(fallback), 'fallback'); assert.equal(wind.areaShader.get(energy), 'energy');
    assert.equal(wind.areaShader.get(fresh), 'volume'); assert.equal(wind.volume.used, 1);
    const spiral = area('spiral'); wind.begin(); wind.area(spiral); wind.end(); assert.equal(wind.areaShader.get(spiral), 'energy');
    ninja.flow.ready = true; const ninjaArea = area('spiral'); ninja.begin(); ninja.area(ninjaArea); ninja.end();
    assert.equal(ninja.areaShader.get(ninjaArea), 'energy'); assert.equal(ninja.flow.draws.length, 1);
    const parentAST = ast(fs.readFileSync(path.join(project, parentPath), 'utf8'));
    const field = visit(parentAST, n => ts.isPropertyDeclaration(n) && n.name.getText(parentAST) === 'areaShader')[0];
    assert(ts.isNewExpression(field.initializer)); assert.equal(field.initializer.expression.getText(parentAST), 'WeakMap');
    assert.deepEqual(visit(field, ts.isLiteralTypeNode).map(n => n.literal.text), ['volume', 'energy', 'fallback']);
  });
  await check('all battle/config files protected against baseline; only effects constructor arg changes hero code', () => {
    const originals = new Map();
    for (const folder of ['battle', 'config']) inventory(treeAt(['KingdomWatch', 'assets', 'scripts', folder]), 'assets/scripts/' + folder, originals);
    const allowed = new Set([parentPath, heroesPath]); let exactFiles = 0;
    for (const [file, id] of originals) {
      if (allowed.has(file)) continue;
      // Windows checkout EOL conversion is not a source change. Git blob hashes
      // use LF; retain every other byte, including comments and whitespace.
      const data = Buffer.from(fs.readFileSync(path.join(project, file), 'utf8').replace(/\r\n/g, '\n'));
      const hash = crypto.createHash('sha1').update(Buffer.from('blob ' + data.length + '\0')).update(data).digest('hex');
      assert.equal(hash, id, 'Protected file changed: ' + file); exactFiles++;
    }
    const added = ['battle', 'config'].flatMap(d => diskInventory('assets/scripts/' + d)).filter(f => !originals.has(f));
    assert.deepEqual(added.sort(), [volumePath, volumePath + '.meta'].sort());
    const before = gitObject(originals.get(heroesPath)).data.toString(), current = fs.readFileSync(path.join(project, heroesPath), 'utf8');
    const oldAST = ast(before), newAST = ast(current);
    const calls = sf => visit(sf, n => ts.isNewExpression(n) && n.expression.getText(sf) === 'WindNinjaVFX');
    const oldCalls = calls(oldAST), newCalls = calls(newAST); assert.equal(oldCalls.length, 1); assert.equal(newCalls.length, 1);
    const oldCall = oldCalls[0], newCall = newCalls[0]; assert.equal(oldCall.arguments.length, 1); assert.equal(newCall.arguments.length, 2);
    assert.equal(tokens(oldCall.arguments[0].getText(oldAST)), tokens(newCall.arguments[0].getText(newAST)));
    assert.equal(tokens(newCall.arguments[1].getText(newAST)), tokens("this.id === 'wind'"));
    let method = newCall; while (method && !ts.isMethodDeclaration(method)) method = method.parent;
    assert.equal(method.name.getText(newAST), 'effects');
    const normalized = current.slice(0, newCall.getStart(newAST)) + oldCall.getText(oldAST) + current.slice(newCall.end);
    assert.equal(tokens(normalized), tokens(before), 'Hero logic changed beyond the one constructor argument');
    const classes = visit(newAST, ts.isClassDeclaration);
    const members = classes.flatMap(c => c.members.filter(m => ts.isMethodDeclaration(m) || ts.isConstructorDeclaration(m)));
    return { contentExactProtectedFiles: exactFiles, normalization: 'CRLF to LF only', baselineInventory: originals.size, allowedNewFiles: added,
      heroMethodsAndConstructorsProtected: members.length, heroChange: "effects(): new WindNinjaVFX(existingParent, this.id === 'wind') only" };
  });
  await check('shader ABI, bounded sampling and premultiplied painted coverage remain intact', () => {
    const shader = effect.replace(/\/\/[^\r\n]*/g, '');
    assert.match(shader, /uniform Volume\s*\{\s*vec4 volumeState;\s*vec4 volumeShape;\s*\};/);
    assert.match(shader, /uniform sampler2D volumeMap;/);
    assert.match(shader, /blendSrc: one\s+blendDst: one_minus_src_alpha/);
    assert.match(shader, /sampleColor\.rgb \* sampleColor\.a/);
    assert.match(shader, /vec4 painted = mix\(a, b, t\)/);
    assert.match(shader, /min\(painted\.a, 0\.65\)/);
    assert.match(shader, /2\.0 \/ 512\.0/);
    assert.match(shader, /strength <= 0\.0\) return vec4\(0\.0\)/);
    assert.match(shader, /painted\.a <= 0\.0\) return vec4\(0\.0\)/);
    assert(!/\bnoise[1234]\s*\(/.test(shader));
    return { actualGPUCompilation: 'not run; parent art preview responsibility', imageAssets: 'not loaded or decoded' };
  });
  report.status = report.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';
  report.sourceSHA256 = Object.fromEntries([volumePath, parentPath, heroesPath, 'assets/resources/fx/wind-volume-v122.effect']
    .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(project, file))).digest('hex')]));
  fs.writeFileSync(path.join(__dirname, 'volume-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
