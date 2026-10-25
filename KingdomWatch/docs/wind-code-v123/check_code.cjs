#!/usr/bin/env node
'use strict';
/** Run from any directory: node docs/wind-code-v123/check_code.cjs
 * Evaluate ONLY WindNinjaVFX and pure WindNinjaGeometry, with strict cc/HeroFxShader
 * doubles. Heroes, warmup and shader are inspected as source, never executed.
 * Git commands are read-only (optional locks disabled). The sole output is the
 * adjacent code-check.json. No engine/GPU/game/browser/combat/audio/WASM/build.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const BASE = 'd525be221dc9c101f9a76be85f8eb431085585db';
const VFX = 'assets/scripts/battle/WindNinjaVFX.ts';
const HEROES = 'assets/scripts/battle/WindNinjaHeroes.ts';
const HELPER = 'assets/scripts/battle/HeroFxShader.ts';
const GEO = 'assets/scripts/battle/WindNinjaGeometry.ts';
const WARM = 'assets/scripts/ui/BattleEntryWarmup.ts';
const SHADER = 'assets/resources/fx/wind-ninja-flow.effect';
const REMOVED = ['assets/scripts/battle/WindVolumeVFX.ts', 'assets/scripts/battle/WindVolumeVFX.ts.meta'];
const report = {
  status: 'FAIL', baseline: BASE,
  scope: 'Static source protection and isolated actual VFX/pure geometry with inert cc/HeroFxShader doubles',
  executedProductionModules: [VFX, GEO],
  excludedExecution: ['engine', 'GPU/shader compilation', 'game', 'browser', 'combat', 'audio', 'WASM', 'build', 'Git mutation', 'deployment'],
  imageLoadingOrDecoding: false, realTimersUsed: false, gitReadOnlyCommands: ['rev-parse', 'ls-tree', 'cat-file --batch'],
  output: 'docs/wind-code-v123/code-check.json',
  limitations: ['Source checks do not validate shader compilation, rendered appearance or mobile performance.',
    'Export verification of the two removed PNGs belongs to the later parent package check; no export is run here.'],
  packageExportVerification: { status: 'NOT_RUN', removedSourcePNGCountExpected: 2 },
  checks: [], sourceSHA256: {},
};
let ts;
for (const candidate of [process.env.WIND_CHECK_TYPESCRIPT, process.env.TYPESCRIPT_PATH, 'typescript',
  'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript']) {
  if (candidate) try { ts = require(candidate); break; } catch {}
}
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const lf = text => text.replace(/\r\n/g, '\n');
const snapshot = new Map();
function read(file) {
  if (!snapshot.has(file)) {
    const bytes = fs.readFileSync(path.join(ROOT, file));
    snapshot.set(file, bytes); report.sourceSHA256[file] = sha(bytes);
  }
  return snapshot.get(file).toString('utf8');
}
function git(args, input) {
  return execFileSync('git', args, { cwd: ROOT, input, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, windowsHide: true });
}
let originals;
function baseline() {
  if (originals) return originals;
  const prefix = git(['rev-parse', '--show-prefix']).toString().trim();
  const listing = git(['ls-tree', '--full-name', '-r', '-z', BASE, '--', 'assets/scripts', 'assets/resources/fx']).toString();
  const entries = listing.split('\0').filter(Boolean).map(line => {
    const match = /^\d+ blob ([a-f0-9]{40})\t(.+)$/.exec(line); assert(match, 'Unexpected baseline entry');
    assert(match[2].startsWith(prefix)); return { id: match[1], file: match[2].slice(prefix.length) };
  });
  assert(entries.length > 100, 'Incomplete baseline inventory');
  const batch = git(['cat-file', '--batch'], entries.map(e => e.id).join('\n') + '\n');
  originals = new Map(); let offset = 0;
  for (const entry of entries) {
    const end = batch.indexOf(10, offset), header = batch.subarray(offset, end).toString().split(' ');
    assert.equal(header[0], entry.id); assert.equal(header[1], 'blob');
    const size = Number(header[2]), bytes = batch.subarray(end + 1, end + 1 + size);
    assert.equal(bytes.length, size); assert.equal(batch[end + 1 + size], 10);
    assert.equal(crypto.createHash('sha1').update(Buffer.from('blob ' + size + '\0')).update(bytes).digest('hex'), entry.id);
    originals.set(entry.file, bytes); offset = end + size + 2;
  }
  assert.equal(offset, batch.length); return originals;
}
const old = file => { assert(baseline().has(file), 'Missing baseline: ' + file); return baseline().get(file).toString('utf8'); };
function diskFiles(folder) {
  return fs.readdirSync(path.join(ROOT, folder), { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && entry.name === '.wrangler') return []; // Existing local hosting cache is not runtime source.
    const file = folder + '/' + entry.name; return entry.isDirectory() ? diskFiles(file) : [file];
  });
}
const ast = (text, file = 'checked.ts') => {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  assert.equal(sf.parseDiagnostics.length, 0, 'TypeScript parse error: ' + file); return sf;
};
function nodes(root, predicate) {
  const found = []; function walk(n) { if (predicate(n)) found.push(n); ts.forEachChild(n, walk); } walk(root); return found;
}
const one = (items, label) => { assert.equal(items.length, 1, label + ' must occur once'); return items[0]; };
function canonical(text) {
  const printed = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(ast(text));
  // The printer retains original single-line/multiline flags. Compare its actual
  // token stream, so line wrapping cannot masquerade as a semantic difference.
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printed), tokens = [];
  for (let kind; (kind = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken;) tokens.push([kind, scanner.getTokenText()]);
  return JSON.stringify(tokens);
}
const sameAST = (actual, expected, message) => assert.equal(canonical(actual), canonical(expected), message);
function member(sf, owner, name) {
  const cls = one(nodes(sf, n => ts.isClassDeclaration(n) && n.name?.text === owner), owner);
  return one(cls.members.filter(n => ts.isConstructorDeclaration(n) ? name === 'constructor' : n.name?.getText(sf) === name), owner + '.' + name);
}
function edit(source, edits) {
  let boundary = source.length;
  for (const item of edits.sort((a, b) => b.start - a.start)) {
    assert(item.end <= boundary, 'Overlapping normalization'); boundary = item.start;
    source = source.slice(0, item.start) + item.text + source.slice(item.end);
  }
  return source;
}
const classAST = text => canonical('class Checked { ' + text + ' }');
function normalizeHeroes(source, before) {
  const sf = ast(source), bs = ast(before), edits = [];
  const replace = (node, text = '') => edits.push({ start: node.getStart(sf), end: node.end, text });
  const exactMethod = (node, expected) => assert.equal(classAST(node.getText(sf)), classAST(expected), 'Unapproved cosmetic method');
  const effects = member(sf, 'WindNinjaHeroBase', 'effects');
  exactMethod(effects, `protected effects(): WindNinjaVFX {
    return this.fx ||= new WindNinjaVFX(this.node.parent!.parent || this.node.parent!);
  }`);
  replace(effects, member(bs, 'WindNinjaHeroBase', 'effects').getText(bs));
  const hand = member(sf, 'WindNinjaHeroBase', 'hand'), handAt = member(sf, 'WindNinjaHeroBase', 'handAt');
  exactMethod(hand, 'protected hand(target: Monster): FieldPoint { return this.handAt(target.x, target.hitY); }');
  exactMethod(handAt, `protected handAt(x: number, y: number): FieldPoint {
    this.faceAttack(x - this.x, y - HERO_Y - 60);
    return { x: this.x + this.facing * 35, y: HERO_Y + 90 };
  }`);
  const oldHand = member(bs, 'WindNinjaHeroBase', 'hand');
  sameAST(handAt.body.getText(sf), oldHand.body.getText(bs).replace(/target\.hitY/g, 'y').replace(/target\.x/g, 'x'),
    'handAt must perform exactly the old face/offset calculation');
  replace(hand, oldHand.getText(bs)); replace(handAt);
  const ult = member(sf, 'NinjaHero', 'castUlt'), statements = [...ult.body.statements];
  const handStatement = one(statements.filter(n => ts.isVariableStatement(n)
    && n.declarationList.declarations.some(d => d.name.getText(sf) === 'hand')), 'ultimate cosmetic hand');
  const handIndex = statements.indexOf(handStatement), launch = statements[handIndex + 1];
  sameAST(handStatement.getText(sf), 'const hand = this.handAt(point.x, point.y);');
  sameAST(launch.getText(sf), 'this.effects().spiralLaunch(hand.x, hand.y, point.x, point.y, ULT_TIMING.ninja.windup);');
  sameAST(statements[handIndex - 1].getText(sf),
    "this.addArea('spiral', point, radius, cfg.duration, NINJA.ultTick, cfg.mul, 0, ULT_TIMING.ninja.windup);");
  sameAST(statements[handIndex + 2].getText(sf), 'Sfx.cast(this.id, true);');
  replace(handStatement); replace(launch);
  assert.equal(nodes(sf, n => ts.isCallExpression(n) && n.expression.getText(sf).endsWith('.spiralLaunch')).length, 1);
  const normalized = edit(source, edits);
  sameAST(normalized, before, 'Whole hero file changed beyond the validated cosmetic statements');
  let exactMethods = 0;
  for (const cls of nodes(bs, ts.isClassDeclaration)) for (const method of cls.members) {
    if (!ts.isMethodDeclaration(method) && !ts.isConstructorDeclaration(method) && !ts.isGetAccessor(method)) continue;
    const name = ts.isConstructorDeclaration(method) ? 'constructor' : method.name.getText(bs);
    if (cls.name.text === 'WindNinjaHeroBase' && ['effects', 'hand'].includes(name)
      || cls.name.text === 'NinjaHero' && name === 'castUlt') continue;
    const nowClass = one(nodes(sf, n => ts.isClassDeclaration(n) && n.name?.text === cls.name.text), cls.name.text);
    const now = one(nowClass.members.filter(n => ts.isConstructorDeclaration(n) ? name === 'constructor' : n.name?.getText(sf) === name), name);
    assert.equal(lf(now.getText(sf)), lf(method.getText(bs)), 'Protected method bytes changed: ' + cls.name.text + '.' + name); exactMethods++;
  }
  return { wholeFileASTProtected: true, exactUntouchedMethodsAndAccessors: exactMethods,
    allowedChanges: ['effects(): remove wind constructor argument', 'hand(): delegate to exact old calculation in handAt()',
      'NinjaHero.castUlt(): add only cosmetic hand and spiralLaunch immediately after unchanged addArea'] };
}
function variable(sf, name) { return one(nodes(sf, n => ts.isVariableDeclaration(n) && n.name.getText(sf) === name), name); }
function property(sf, name, key) { return one(variable(sf, name).initializer.properties.filter(p => p.name.getText(sf) === key), name + '.' + key); }
function fnSource(sf, name) { return one(sf.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === name), name).getText(sf); }
function shaderFunction(source, name) {
  const match = new RegExp('\\b(?:vec[234]|float)\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{').exec(source);
  assert(match, 'Missing actual shader function: ' + name); let depth = 1, end = match.index + match[0].length;
  while (end < source.length && depth) { if (source[end] === '{') depth++; if (source[end] === '}') depth--; end++; }
  assert.equal(depth, 0, 'Incomplete shader function'); return source.slice(match.index, end);
}
const area = (kind = 'eye', age = .8, radius = 40) => ({ kind, age, x: 13, y: -7, radius, duration: 4 });

function harness() {
  const stats = { nodes: [], graphics: [], shaders: [] };
  class Node {
    constructor(name) { Object.assign(this, { name, children: [], isValid: true, active: true, layer: 0, callbacks: [] }); stats.nodes.push(this); }
    setParent(parent) { this.parent = parent; parent.children.push(this); }
    getChildByName(name) { return this.children.find(n => n.name === name); }
    getSiblingIndex() { return this.parent.children.indexOf(this); }
    setSiblingIndex(index) { const a = this.parent.children; a.splice(a.indexOf(this), 1); a.splice(index, 0, this); }
    addComponent(Type) { const item = new Type(); item.node = this; return item; }
    destroy() { if (!this.isValid) return; this.children.forEach(c => c.destroy()); this.isValid = this.active = false; this.callbacks.forEach(fn => fn()); }
  }
  class Color {
    constructor() { this.a = 255; }
    static fromHEX(c, hex) { assert.match(hex, /^#[0-9A-Fa-f]{6}$/); c.hex = hex; }
  }
  class Graphics {
    constructor() { this.commands = []; this.totalCommands = 0; stats.graphics.push(this); }
    command(name, args = []) { assert(args.every(Number.isFinite), 'Nonfinite vector drawing: ' + name); this.commands.push([name, ...args]); this.totalCommands++; }
    clear() { this.commands = []; }
    moveTo(...a) { assert.equal(a.length, 2); this.command('moveTo', a); }
    lineTo(...a) { assert.equal(a.length, 2); this.command('lineTo', a); }
    bezierCurveTo(...a) { assert.equal(a.length, 6); this.command('bezierCurveTo', a); }
    circle(...a) { assert.equal(a.length, 3); assert(a[2] >= 0); this.command('circle', a); }
    close() { this.command('close'); }
    fill() { this.command('fill'); }
    stroke() { assert(Number.isFinite(this.lineWidth) && this.lineWidth > 0); this.command('stroke'); }
    set fillColor(c) { assert(Number.isFinite(c.a) && c.a >= 0 && c.a <= 255); this.command('fillColor', [c.a]); }
    set strokeColor(c) { assert(Number.isFinite(c.a) && c.a >= 0 && c.a <= 255); this.command('strokeColor', [c.a]); }
  }
  class HeroFxShader {
    constructor(parent, name, capacity, blend, options) {
      Object.assign(this, { parent, name, capacity, blend, options, ready: false, used: 0, lastUsed: 0, attempts: [], draws: [], begins: 0, ends: 0 });
      this.slots = Array.from({ length: capacity }, (_, i) => { const n = new Node(name + i); n.setParent(parent); n.active = false; return n; });
      stats.shaders.push(this);
    }
    begin() { this.used = 0; this.attempts = []; this.draws = []; this.begins++; }
    draw(...args) {
      assert.equal(args.length, 11); assert(args.every(Number.isFinite), 'Nonfinite shader geometry/state'); this.attempts.push(args);
      if (!this.ready || this.used >= this.capacity || !this.parent.isValid) return false;
      this.slots[this.used++].active = true; this.draws.push(args); return true;
    }
    end() { for (let i = this.used; i < this.lastUsed; i++) this.slots[i].active = false; this.lastUsed = this.used; this.ends++; }
  }
  const forbidden = () => { throw new Error('Forbidden timer, clock, image or random access in isolated code'); };
  const pureMath = Object.create(Math); pureMath.random = forbidden;
  const context = vm.createContext({ Math: pureMath,
    Date: class { constructor() { forbidden(); } static now() { forbidden(); } }, performance: { now: forbidden },
    setTimeout: forbidden, setInterval: forbidden, requestAnimationFrame: forbidden, Image: forbidden,
  });
  function evaluate(file, dependencies) {
    const compiled = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
    assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
    const module = { exports: {} };
    const wrapper = new vm.Script('(function(require,module,exports){' + compiled.outputText + '\n})', { filename: file }).runInContext(context, { timeout: 1000 });
    wrapper(id => { assert(Object.hasOwn(dependencies, id), 'Forbidden runtime dependency: ' + id); return dependencies[id]; }, module, module.exports);
    return module.exports;
  }
  const cc = { Node, Color, Graphics, Layers: { Enum: { UI_2D: 1 } } };
  const api = evaluate(VFX, { cc, './HeroFxShader': { HeroFxShader } }), geometry = evaluate(GEO, {});
  const parent = new Node('Parent'), text = new Node('TextLayer'); text.setParent(parent);
  const fx = new api.WindNinjaVFX(parent);
  return { api, geometry, stats, cc, parent, text, fx, flow: stats.shaders[0], g: stats.graphics[0] };
}
const paint = (h, areas = []) => { h.fx.begin(); areas.forEach(a => h.fx.area(a)); h.fx.end(); };
const close = (a, b, message) => assert(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b)), message || `${a} != ${b}`);
function check(name, fn) {
  try { const detail = fn(); report.checks.push({ name, status: 'PASS', ...(detail ? { detail } : {}) }); }
  catch (error) { report.checks.push({ name, status: 'FAIL', error: error.stack || String(error) }); }
}

function main() {
  assert(ts, 'TypeScript runtime unavailable; set WIND_CHECK_TYPESCRIPT');
  for (const file of [VFX, HEROES, HELPER, GEO, WARM, SHADER]) read(file); // Snapshot each input once, including the actual shader.
  baseline();
  check('all other scripts, data/config and combat paths retain baseline bytes', () => {
    const allowed = new Set([VFX, HEROES, WARM, ...REMOVED]); let exactFiles = 0, configFiles = 0;
    const originalFiles = [...baseline().keys()].filter(f => f.startsWith('assets/scripts/'));
    for (const file of originalFiles) {
      if (allowed.has(file)) continue;
      assert.equal(lf(read(file)), lf(old(file)), 'Protected file changed: ' + file); exactFiles++;
      if (file.startsWith('assets/scripts/config/') || file.startsWith('assets/scripts/core/')) configFiles++;
    }
    assert.deepEqual(diskFiles('assets/scripts').filter(f => !baseline().has(f)), [], 'Unapproved new runtime scripts');
    for (const file of REMOVED) { assert(baseline().has(file)); assert(!fs.existsSync(path.join(ROOT, file)), 'Removed volume code remains'); }
    return { exactFiles, configAndCoreFiles: configFiles, normalization: 'CRLF to LF only; every other byte retained',
      excludedLocalCacheDirectoryNames: ['.wrangler'], removed: REMOVED };
  });
  check('whole hero AST and every untouched method protect damage, targeting, reservations and schedules', () => normalizeHeroes(read(HEROES), old(HEROES)));
  check('prewarm removes only wind volume images/effect; wind/ninja keep the procedural effect', () => {
    const before = old(WARM), current = read(WARM), bs = ast(before), sf = ast(current), edits = [];
    const images = property(bs, 'FX_IMAGES', 'wind'), oldEffects = property(bs, 'FX_EFFECTS', 'wind');
    sameAST('const p={' + images.getText(bs) + '};', "const p={wind:['fx/wind_volume_v122/eye','fx/wind_volume_v122/tornado']};");
    sameAST('const p={' + oldEffects.getText(bs) + '};', "const p={wind:['fx/wind-ninja-flow','fx/wind-volume-v122']};");
    const next = variable(bs, 'FX_IMAGES').initializer.properties[1];
    assert.equal(variable(bs, 'FX_IMAGES').initializer.properties[0], images);
    edits.push({ start: images.getStart(bs), end: next.getStart(bs), text: '' });
    const effects = property(sf, 'FX_EFFECTS', 'wind');
    sameAST('const p={' + effects.getText(sf) + '};', "const p={wind:['fx/wind-ninja-flow']};");
    edits.push({ start: oldEffects.getStart(bs), end: oldEffects.end, text: effects.getText(sf) });
    sameAST(current, edit(before, edits), 'Unrelated prewarm behavior changed');
    for (const id of ['wind', 'ninja']) {
      assert(!variable(sf, 'FX_IMAGES').initializer.properties.some(p => p.name.getText(sf) === id));
      sameAST('const p={' + property(sf, 'FX_EFFECTS', id).getText(sf) + '};', `const p={${id}:['fx/wind-ninja-flow']};`);
    }
    return { newWindOrNinjaFXImages: 0, retainedEffect: 'fx/wind-ninja-flow', unrelatedPrewarmASTProtected: true };
  });
  check('volume source/effect/images and runtime references are removed', () => {
    const removed = [...baseline().keys()].filter(f => /WindVolumeVFX|wind-volume-v122|wind_volume_v122/.test(f));
    const pngs = removed.filter(f => /\.png$/.test(f)); assert.equal(pngs.length, 2);
    for (const file of removed) assert(!fs.existsSync(path.join(ROOT, file)), 'Obsolete volume asset remains: ' + file);
    assert(!fs.existsSync(path.join(ROOT, 'assets/resources/fx/wind_volume_v122')));
    for (const file of diskFiles('assets/scripts').filter(f => /\.ts$/.test(f)))
      assert(!/WindVolumeVFX|wind-volume-v122|wind_volume_v122/.test(read(file)), 'Runtime volume reference: ' + file);
    for (const file of diskFiles('assets/resources/fx')) assert(!/wind[-_]volume/i.test(file), 'Volume resource remains: ' + file);
    report.packageExportVerification.removedSourcePNGs = pngs;
    return { removed, sourcePNGs: pngs.length, packageExport: 'not run; parent must verify exported assets separately' };
  });
  check('new VFX has only art-free drawing dependencies; white 2x2 carrier remains in unchanged HeroFxShader', () => {
    const source = read(VFX), sf = ast(source), helper = read(HELPER);
    assert.deepEqual(sf.statements.filter(ts.isImportDeclaration).map(n => n.moduleSpecifier.text), ['cc', './HeroFxShader']);
    const ccImport = sf.statements.find(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === 'cc');
    assert.deepEqual(ccImport.importClause.namedBindings.elements.map(e => e.name.text).sort(), ['Color', 'Graphics', 'Layers', 'Node']);
    const forbidden = ['resources', 'assetManager', 'Texture2D', 'SpriteFrame', 'ImageAsset', 'Sprite', 'uxFrame', 'warmUXArt',
      'loadRemote', 'fetch', 'XMLHttpRequest', 'Date', 'performance', 'setTimeout', 'setInterval', 'requestAnimationFrame'];
    assert.equal(nodes(sf, n => ts.isIdentifier(n) && forbidden.includes(n.text)).length, 0);
    assert(!/flipbook|atlas|sampler|texture\s*\(/i.test(source));
    assert.equal(lf(helper), lf(old(HELPER)), 'Shared carrier/helper changed');
    assert.match(helper, /reset\(\{ width: 2, height: 2, format: Texture2D\.PixelFormat\.RGBA8888 \}\)/);
    assert.match(helper, /uploadData\(new Uint8Array\(16\)\.fill\(255\)\)/);
    const ctor = member(sf, 'WindNinjaVFX', 'constructor'); assert.equal(ctor.parameters.length, 1);
    const flow = one(nodes(ctor, n => ts.isNewExpression(n) && n.expression.getText(sf) === 'HeroFxShader'), 'only shader pool');
    assert.equal(Number(flow.arguments[2].getText(sf)), 12);
    const pinned = member(sf, 'WindNinjaVFX', 'areaShader');
    assert.equal(pinned.initializer.expression.getText(sf), 'WeakMap');
    assert.equal(pinned.initializer.typeArguments[1].kind, ts.SyntaxKind.BooleanKeyword);
    return { imageDependencies: 0, volumeDependencies: 0, shaderPool: 12, pinType: 'WeakMap<WindNinjaAreaView, boolean>', carrier: 'unchanged 2x2 RGBA white in existing helper only' };
  });
  check('normal crescent, shuriken and attached metal drawing preserve baseline bytes', () => {
    const sf = ast(read(VFX)), bs = ast(old(VFX));
    const functions = ['color', 'fill', 'stroke', 'arc', 'ribbon', 'leaf', 'drawWindBlade', 'metalStar', 'drawShuriken'];
    for (const name of functions) assert.equal(lf(fnSource(sf, name)), lf(fnSource(bs, name)), name + ' changed');
    assert.equal(lf(variable(sf, 'P').getText(sf)), lf(variable(bs, 'P').getText(bs)), 'Metal palette changed');
    for (const name of ['mark', 'release']) assert.equal(lf(member(sf, 'WindNinjaVFX', name).getText(sf)), lf(member(bs, 'WindNinjaVFX', name).getText(bs)));
    return { exactFunctions: functions, exactMethods: ['mark', 'release'], paletteExact: true };
  });
  check('actual shader has no samplers/texture calls or flipbooks and keeps exact mode 3 windCrescent', () => {
    const source = lf(read(SHADER)), before = lf(old(SHADER));
    const shader = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '');
    assert(!/\b(?:[iu]?sampler\w*|[iu]?texture\w*|texelFetch\w*|textureSize|textureQuery\w*)\b/i.test(shader), 'Shader must not declare samplers or read textures');
    assert(!/\b(?:cc_time|frameIndex|flipbook|atlas|setTimeout|Date)\b/i.test(shader));
    const crescent = shaderFunction(source, 'windCrescent');
    assert.equal(crescent, shaderFunction(before, 'windCrescent'), 'Mode 3 source substring changed');
    const frag = shaderFunction(shader, 'frag');
    assert.match(frag, /fxState\.w\s*<\s*3\.5\)\s*result\s*=\s*vec4\(windCrescent\([^;]+,\s*0\.0\);/);
    assert.match(frag, /else\s+result\s*=\s*vec4\((?!windCrescent)[\s\S]+,\s*0\.0\);/);
    assert.match(shader, /uniform HeroFlow\s*\{\s*vec4 fxState;\s*vec4 fxShape;\s*\}/);
    assert.match(shader, /blendSrc:\s*one\s+blendDst:\s*one_minus_src_alpha/);
    assert.match(frag, /opacity\s*<=\s*0\.0\)\s*return vec4\(0\.0\)/);
    for (const name of ['windEye', 'tornado', 'energyShuriken'])
      assert.notEqual(shaderFunction(source, name), shaderFunction(before, name), 'Mode not rewritten: ' + name);
    return { shaderSHA256: report.sourceSHA256[SHADER], mode3SubstringSHA256: sha(crescent), samplerDeclarations: 0,
      textureCalls: 0, newMode4DispatchPresent: true, rewrittenModes: [0, 1, 2, 4], shaderCompiled: false };
  });
  check('actual VFX constructor retains FX below TextLayer and a fixed twelve-slot pool', () => {
    const h = harness(); assert.equal(h.stats.shaders.length, 1); assert.equal(h.stats.graphics.length, 1);
    assert(h.fx.root.getSiblingIndex() < h.text.getSiblingIndex()); assert.equal(h.fx.root.layer, h.cc.Layers.Enum.UI_2D);
    assert.equal(h.flow.capacity, 12); assert.equal(h.flow.blend, 'plasma'); assert.equal(h.flow.options.effect, 'fx/wind-ninja-flow'); assert.equal(h.flow.options.technique, 0);
    assert(!('volume' in h.fx)); const nodeCount = h.stats.nodes.length;
    for (let i = 0; i < 50; i++) { h.flow.ready = true; paint(h, [area()]); }
    assert.equal(h.stats.nodes.length, nodeCount); assert.equal(h.stats.shaders.length, 1);
    const p = new h.cc.Node('NoTextParent'), fx = new h.api.WindNinjaVFX(p); assert(fx.root.isValid);
    return { fixedPool: 12, repeatedFramesWithoutAllocation: 50, ordering: 'WindNinjaVFX before TextLayer', noTextParentSupported: true };
  });
  check('WeakMap pins both readiness booleans by event identity with no mid-event fallback flip', () => {
    let events = 0;
    for (const kind of ['eye', 'tornado', 'spiral']) {
      const h = harness(), fallback = area(kind); paint(h, [fallback]);
      assert.equal(h.fx.areaShader.get(fallback), false); assert(h.g.commands.length > 0); assert.equal(h.flow.attempts.length, 0);
      h.flow.ready = true; fallback.age += .1; paint(h, [fallback]);
      assert.equal(h.fx.areaShader.get(fallback), false); assert(h.g.commands.length > 0); assert.equal(h.flow.attempts.length, 0);
      const shader = { ...fallback }; paint(h, [shader]); assert.equal(h.fx.areaShader.get(shader), true); assert.equal(h.flow.draws.length, 1);
      h.flow.ready = false; paint(h, [shader]); assert.equal(h.fx.areaShader.get(shader), true); assert.equal(h.flow.attempts.length, 1);
      if (kind === 'spiral') assert.equal(h.g.commands.length, 0, 'Pinned shader event fell back mid-event');
      h.flow.ready = true; paint(h, [shader]); assert.equal(h.fx.areaShader.get(shader), true); assert.equal(h.flow.draws.length, 1); events += 2;
    }
    return { pinnedEvents: events, kinds: ['eye', 'tornado', 'spiral'], testedTransitions: ['not ready -> ready', 'ready -> not ready -> ready'], identityBased: true };
  });
  check('shader-not-ready fallback produces finite valid vector paths for all area kinds', () => {
    const h = harness(); let cases = 0, commands = 0;
    for (const kind of ['eye', 'tornado', 'spiral']) for (const radius of [0, .001, 40, 250])
      for (const age of [0, 1e-6, .13, 2, 4 - 1e-6, 4]) {
        paint(h, [area(kind, age, radius)]); assert.equal(h.flow.attempts.length, 0);
        assert(h.g.commands.some(c => c[0] === 'moveTo')); assert(h.g.commands.some(c => c[0] === 'stroke' || c[0] === 'fill'));
        commands += h.g.commands.length; cases++;
      }
    return { cases, finiteDrawingCommands: commands, GPUOrEngineUsed: false };
  });
  check('eight areas and two launch cosmetics fit the twelve-slot pool; frame end clears expired slots', () => {
    const h = harness(); h.flow.ready = true;
    for (let i = 0; i < 25; i++) h.fx.spiralLaunch(i, 0, 120 + i, 300, .45);
    assert.equal(h.fx.launches.length, 2); assert.equal(h.fx.launches[0].x, 23); assert.equal(h.fx.launches[1].x, 24);
    const many = Array.from({ length: 25 }, (_, i) => area(['eye', 'tornado', 'spiral'][i % 3])); paint(h, many);
    assert.equal(h.flow.draws.length, 10); assert.equal(h.flow.attempts.length, 10);
    assert.equal(h.flow.draws.filter(d => d[8] === 4).length, 2); assert.equal(h.flow.slots.filter(n => n.active).length, 10);
    const [eye, tornado, spiral] = h.flow.draws; assert.equal(eye[8], 0); assert.equal(tornado[8], 1); assert.equal(spiral[8], 2);
    close(tornado[1], -7 + 40 * .35); close(tornado[2], 40 * 2.6); close(tornado[3], 40 * 3.3);
    const ignored = many[8]; assert.equal(h.fx.areaShader.has(ignored), false, 'Overflow area should not acquire a path');
    h.fx.tick(.45); paint(h); assert.equal(h.fx.launches.length, 0); assert.equal(h.flow.draws.length, 0);
    assert(h.flow.slots.every(n => !n.active)); assert.equal(h.g.commands.length, 0);
    paint(h); assert(h.flow.slots.every(n => !n.active));
    return { pool: 12, maximumAcceptedAreas: 8, maximumLaunches: 2, peakDraws: 10, staleDrawsAfterExpiration: 0 };
  });
  check('launch uses battle dt only, freezes at zero dt, expires exactly, rejects invalid inputs and cleans destroy', () => {
    const h = harness(); h.flow.ready = true;
    for (const values of [[0, 0, 1, 1, 0], [0, 0, 1, 1, -1], [NaN, 0, 1, 1, .45], [0, 0, Infinity, 1, .45], [0, 0, 1, 1, NaN]]) h.fx.spiralLaunch(...values);
    assert.equal(h.fx.launches.length, 0); h.fx.spiralLaunch(-35, 90, 13, 300, .45); paint(h);
    const initial = JSON.stringify(h.flow.draws); h.fx.tick(0); paint(h); assert.equal(JSON.stringify(h.flow.draws), initial);
    paint(h); assert.equal(JSON.stringify(h.flow.draws), initial, 'render/end advanced the battle clock');
    h.fx.tick(.225); paint(h); const halfway = h.flow.draws[0], p = 1 - Math.pow(.5, 1.2);
    close(halfway[0], -35 + 48 * p); close(halfway[1], 90 + 210 * p); close(halfway[5], .225);
    assert.equal(halfway[8], 4); close(halfway[10], .45); assert(h.fx.launches.length === 1);
    h.fx.tick(.225); paint(h); assert.equal(h.fx.launches.length, 0); assert.equal(h.flow.attempts.length, 0); assert(h.flow.slots.every(n => !n.active));
    const fallback = harness(); fallback.fx.spiralLaunch(0, 0, 0, 300, .45); paint(fallback);
    assert.equal(fallback.flow.draws.length, 0); assert(fallback.g.commands.length > 0);
    fallback.fx.tick(.45); paint(fallback); assert.equal(fallback.g.commands.length, 0);
    h.fx.spiralLaunch(0, 0, 1, 1, .45); h.fx.release(0, 0, 1, 0, 'wind'); h.fx.destroy(); h.fx.destroy();
    assert.equal(h.fx.launches.length, 0); assert.equal(h.fx.accents.length, 0); assert(!h.fx.root.isValid); assert(h.flow.slots.every(n => !n.isValid));
    return { duration: .45, renderDoesNotAdvanceAge: true, zeroDTFreezes: true, exactExpiryClearsAll: true, shaderFailureFallbackFinite: true, destroyIdempotent: true };
  });
  check('existing .45 ultimate windup and battle clock integration are statically unchanged', () => {
    const sf = ast(read('assets/scripts/battle/UltimateTiming.ts'));
    const ninja = property(sf, 'ULT_TIMING', 'ninja');
    const windup = one(ninja.initializer.properties.filter(p => p.name.getText(sf) === 'windup'), 'ninja.windup');
    assert.equal(Number(windup.initializer.getText(sf)), .45);
    const heroes = ast(read(HEROES)), update = member(heroes, 'WindNinjaHeroBase', 'updateQueues').getText(heroes);
    assert.match(update, /this\.fx\?\.tick\(dt\)/);
    const hero = ast(read('assets/scripts/battle/Hero.ts'));
    assert.match(member(hero, 'HeroBase', 'tick').getText(hero), /this\.updateQueues\(dt, mgr, projs\)/);
    assert.match(read('assets/scripts/battle/BattleDirector.ts'), /for \(const h of this\.heroes\) h\.tick\(sub, this\.mgr, this\.projs, this\.dmgSvc\)/);
    return { launchLifeAndExistingAreaDelay: 'ULT_TIMING.ninja.windup (.45)', clock: 'BattleDirector sub -> HeroBase.tick(dt) -> updateQueues(dt) -> fx.tick(dt)', combatExecuted: false };
  });
  check('normal/attached metal paths draw finitely in four directions; marks and accents keep original caps/expiry', () => {
    const h = harness(); let draws = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) for (const age of [0, .1, 3]) {
      h.g.clear(); h.api.drawWindBlade(h.g, 13, -7, dx, dy, 10, age); assert(h.g.commands.length > 0);
      h.g.clear(); h.api.drawShuriken(h.g, 13, -7, dx, dy, 7, age); assert(h.g.commands.length > 0); draws += 2;
    }
    h.fx.begin(); for (let i = 0; i < 80; i++) h.fx.mark(i, -i, .1 * i, i % 2 === 0);
    const count = h.g.commands.length; h.fx.mark(0, 0, 0); assert.equal(h.g.commands.length, count); h.fx.end();
    h.fx.begin(); h.fx.mark(0, 0, 0); assert(h.g.commands.length > 0); h.fx.end();
    for (let i = 0; i < 30; i++) h.fx.release(i, 0, 1, 0, i % 2 ? 'wind' : 'shuriken');
    assert.equal(h.fx.accents.length, 24); assert.equal(h.fx.accents[0].x, 6);
    paint(h); assert(h.g.commands.length > 0); h.fx.tick(.22); paint(h); assert.equal(h.fx.accents.length, 0); assert.equal(h.g.commands.length, 0);
    return { helperDrawingCases: draws, marksPerFrame: 80, accents: 24, accentExpiry: .22 };
  });
  check('pure field movement is bounded, dt-controlled, deterministic and never mutates targets', () => {
    const { geometry: geo } = harness(); let cases = 0;
    for (const x of [-300, 0, 300]) for (const y of [-100, 0, 500]) for (const speed of [-1, 0, 35, 400]) for (const dt of [-1, 0, .016, .25, 10]) {
      const target = Object.freeze({ x: 13, y: 71 }), p = { x, y }, distance = Math.hypot(target.x - x, target.y - y);
      const traveled = geo.moveFieldToward(p, target, speed, dt);
      close(traveled, Math.min(distance, Math.max(0, speed) * Math.max(0, dt))); assert(Number.isFinite(p.x + p.y));
      close(Math.hypot(p.x - target.x, p.y - target.y), distance - traveled); cases++;
    }
    const a = { x: -20, y: 3 }, b = { ...a }, target = Object.freeze({ x: 12, y: 44 });
    for (let i = 0; i < 20; i++) geo.moveFieldToward(a, target, 20, .01);
    geo.moveFieldToward(b, target, 20, .2); close(a.x, b.x); close(a.y, b.y);
    return { cases, partitionEquivalent: true, targetMutation: false };
  });
  check('pure interception, dense-field choice and finite return math retain finite body-space results', () => {
    const { geometry: geo } = harness(); let cases = 0;
    for (const x of [-100, 0, 100]) for (const y of [-100, 0, 500]) for (const down of [0, 50, 100, 100.00000001, 300]) for (const speed of [0, 50, 100, 500]) {
      const result = geo.interceptDirection(0, 0, x, y, down, speed);
      for (const key of ['dirX', 'dirY', 'flightTime', 'impactX', 'impactY']) assert(Number.isFinite(result[key]), key);
      close(Math.hypot(result.dirX, result.dirY), 1); assert(result.flightTime >= 0);
      if (result.reachable && result.flightTime > 0) {
        close(result.impactY, y - down * result.flightTime);
        // Zero input speed deliberately exercises the existing 1e-6 safety
        // clamp's finite-output contract. Its nearly repeated quadratic roots
        // are not a physically meaningful projectile accuracy fixture.
        if (speed > 0) {
          const traveled = speed * result.flightTime;
          const rounding = 128 * Number.EPSILON * Math.max(1, Math.abs(y), down * result.flightTime);
          assert(Math.abs(Math.hypot(result.impactX, result.impactY) - traveled) <= rounding + 1e-7 * Math.max(1, traveled),
            'Intercept residual exceeds coordinate cancellation bound: ' + JSON.stringify({ x, y, down, speed, result }));
        }
      }
      cases++;
    }
    const bodies = [{ x: 20, hitY: 30 }, { x: 24, hitY: 32 }, { x: 22, hitY: 34 },
      { x: -80, hitY: 70 }, { x: 200, hitY: 30 }, { x: 21, hitY: 31, dead: true }, { x: NaN, hitY: 30 }];
    const bodyCopy = JSON.stringify(bodies), bounds = { left: -100, right: 100, bottom: 0, top: 100 };
    const center = geo.densestBodyArea(bodies, 0, 0, 100, 12, bounds); assert(center && center.x >= 20 && center.x <= 24);
    assert.equal(JSON.stringify(bodies), bodyCopy); assert.equal(geo.densestBodyArea([], 0, 0, 100, 12, bounds), null);
    for (const source of [[0, 0], [10, -20], [-200, 500]]) {
      const result = geo.finiteReturnPath(...source, 0, 0, 500); assert(Number.isFinite(result.dirX + result.dirY + result.ttl));
      assert.equal(result.endPoint.x, 0); assert.equal(result.endPoint.y, 0); close(result.distance, Math.hypot(...source)); close(result.ttl, result.distance / 500 + .25);
    }
    return { interceptionCases: cases, zeroSpeedSafety: 'finite-output contract only', denseSelectionMutatesBodies: false, returnPathCases: 3, combatExecuted: false };
  });
}
try { main(); } catch (error) { report.checks.push({ name: 'harness setup', status: 'FAIL', error: error.stack || String(error) }); }
// A concurrent parent edit must never yield a PASS tied to stale source hashes.
for (const [file, bytes] of snapshot) {
  if (!fs.existsSync(path.join(ROOT, file)) || !fs.readFileSync(path.join(ROOT, file)).equals(bytes))
    report.checks.push({ name: 'input stable during run: ' + file, status: 'FAIL', error: 'Source changed concurrently; rerun after parent finishes.' });
}
report.status = report.checks.length && report.checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
report.summary = { passed: report.checks.filter(c => c.status === 'PASS').length, total: report.checks.length };
fs.writeFileSync(path.join(__dirname, 'code-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.status}: ${report.summary.passed}/${report.summary.total} static/isolated checks; wrote ${report.output}`);
for (const result of report.checks.filter(c => c.status === 'FAIL')) console.error(result.name + ': ' + result.error);
process.exitCode = report.status === 'PASS' ? 0 : 1;
