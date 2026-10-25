#!/usr/bin/env node
'use strict';
/** Run: node docs/wind-ninja-v121/check_integration.cjs
 * Actual TS modules, inert cc doubles, async microtask loads; no Cocos/combat/browser/audio/WASM.
 * Git is read-only. Writes only integration-check.json. No build, commit, push or deploy.
 * The separately authored wind-ninja-flow.effect is deliberately not required or interpreted.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..'), BASE = '0a1fc689';
const HELP = 'assets/scripts/battle/HeroFxShader.ts';
const VFX = 'assets/scripts/battle/WindNinjaVFX.ts';
const WARM = 'assets/scripts/ui/BattleEntryWarmup.ts';
const PROJECTILE = 'assets/scripts/battle/Projectile.ts';
const DIRECTOR = 'assets/scripts/battle/BattleDirector.ts';
const report = { checkedAt: new Date().toISOString(), status: 'FAIL', baseline: BASE,
  scope: 'Static AST and isolated real drawing/helper/warmup modules with inert cc doubles',
  excludedExecution: ['engine', 'combat', 'game', 'browser', 'audio', 'WASM', 'build', 'git mutation', 'deployment'],
  limitations: ['No GPU/rendered appearance validation; new shader internals are outside this check.'],
  checks: [], sha256: {} };
let ts;
for (const p of [process.env.TYPESCRIPT_PATH, process.env.WIND_NINJA_TYPESCRIPT, 'typescript',
  'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js']) {
  if (p) try { ts = require(p); break; } catch {}
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const read = f => { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); report.sha256[f] = sha(s); return s; };
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const prefix = () => git(['rev-parse', '--show-prefix']).trim();
const old = f => git(['show', BASE + ':' + prefix() + f]);
const ast = (s, f = 'source.ts') => ts.createSourceFile(f, s, ts.ScriptTarget.Latest, true);
function nodes(n, predicate) {
  const out = []; const visit = x => { if (predicate(x)) out.push(x); ts.forEachChild(x, visit); }; visit(n); return out;
}
function canonical(s) {
  const sf = ast(s); assert.equal(sf.parseDiagnostics.length, 0);
  return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(sf);
}
const one = (items, name) => { assert.equal(items.length, 1, name + ' must occur exactly once'); return items[0]; };
const member = (sf, owner, name) => {
  const cls = one(nodes(sf, n => ts.isClassDeclaration(n) && n.name?.text === owner), owner);
  return one(cls.members.filter(n => n.name?.getText(sf) === name), owner + '.' + name);
};
const classCanonical = s => canonical('class Checked { ' + s + ' }');
function editSource(source, edits) {
  let boundary = source.length;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    assert(e.end <= boundary, 'Overlapping AST normalization'); boundary = e.start;
    source = source.slice(0, e.start) + e.text + source.slice(e.end);
  }
  return source;
}
/** Narrow, validated AST edits: the remaining WHOLE file must still match the baseline.
 * We never omit fire/tick/hit methods, callbacks, expressions or arithmetic wholesale.
 */
function normalizeProjectile(source, baseline) {
  const sf = ast(source), before = ast(baseline), edits = [];
  assert.equal(sf.parseDiagnostics.length, 0);
  const replace = (n, text = '') => edits.push({ start: n.getStart(sf), end: n.end, text });
  const exact = (n, expected, isMember = false) => assert.equal(
    isMember ? classCanonical(n.getText(sf)) : canonical(n.getText(sf)),
    isMember ? classCanonical(expected) : canonical(expected), 'Unapproved visual change: ' + n.getText(sf).slice(0, 75));
  const method = name => member(sf, 'ProjectileManager', name);
  const imp = (tree, key) => one(tree.statements.filter(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === key), key);
  const heroImport = imp(sf, './HeroFxShader'); exact(heroImport, "import { HeroFxShader } from './HeroFxShader';"); replace(heroImport);
  const windImport = imp(sf, './WindNinjaVFX');
  exact(windImport, "import { drawWindBlade, drawShuriken, WIND_NINJA_FX_EFFECT } from './WindNinjaVFX';");
  replace(windImport, imp(before, './WindNinjaVFX').getText(before));
  const active = one(nodes(sf, n => ts.isInterfaceDeclaration(n) && n.name.text === 'Active'), 'Active');
  const flag = one(active.members.filter(n => n.name?.getText(sf) === 'windShader'), 'Active.windShader');
  assert.equal(flag.getText(sf), 'windShader: boolean;'); replace(flag);
  const pool = method('windFlight'); exact(pool, 'private windFlight: HeroFxShader | null = null;', true); replace(pool);
  const cls = one(nodes(sf, n => ts.isClassDeclaration(n) && n.name?.text === 'ProjectileManager'), 'ProjectileManager');
  const ctor = one(cls.members.filter(ts.isConstructorDeclaration), 'constructor');
  const field = ctor.parameters[0]; assert.equal(field.name.getText(sf), 'field');
  assert.equal(field.modifiers?.length, 1); assert.equal(field.modifiers[0].kind, ts.SyntaxKind.PrivateKeyword);
  replace(field.modifiers[0]);
  const warm = method('warmWindFlight');
  exact(warm, `warmWindFlight(): void {
    if (!this.windFlight) this.windFlight = new HeroFxShader(this.field, 'windCrescentFlight', MAX_PROJS, 'plasma',
      { effect: WIND_NINJA_FX_EFFECT, technique: 0 });
  }`, true); replace(warm);
  const fire = method('fire');
  const assignment = one(nodes(fire, n => ts.isBinaryExpression(n) && n.left.getText(sf) === 'a.windShader'), 'fire visual flag');
  assert(ts.isExpressionStatement(assignment.parent));
  assert.equal(assignment.parent.parent, fire.body, 'Cosmetic assignment must be a plain fire statement');
  exact(assignment.parent, "a.windShader = spec.visual === 'wind' && !!this.windFlight?.ready;"); replace(assignment.parent);
  const make = method('makeActive');
  const initial = one(nodes(make, n => ts.isPropertyAssignment(n) && n.name.getText(sf) === 'windShader'), 'initial windShader');
  assert.equal(initial.initializer.kind, ts.SyntaxKind.FalseKeyword);
  const properties = initial.parent.properties, index = properties.indexOf(initial);
  assert.equal(index, properties.length - 1, 'Flag appended to existing pool record');
  edits.push({ start: properties[index - 1].end, end: initial.end, text: '' });
  const render = method('render');
  for (const action of ['begin', 'end']) {
    const call = one(nodes(render, n => ts.isCallExpression(n) && n.expression.getText(sf) === 'this.windFlight?.' + action), action);
    exact(call.parent, 'this.windFlight?.' + action + '();'); replace(call.parent);
  }
  const windBranch = tree => one(nodes(tree, n => ts.isIfStatement(n)
    && canonical(n.expression.getText()) === canonical("s.visual === 'wind'")), 'wind render branch');
  const branch = windBranch(render);
  exact(branch, `if (s.visual === 'wind') {
    const rendered = a.windShader && this.windFlight?.draw(s.x,s.y,size*10,size*10,
      Math.atan2(a.vy,a.vx)*180/Math.PI,a.age,a.fxSeed,1,3,size*3);
    if (!rendered) drawWindBlade(g,s.x,s.y,a.vx,a.vy,size,a.age);
    continue;
  }`);
  replace(branch, windBranch(member(before, 'ProjectileManager', 'render')).getText(before));
  return editSource(source, edits);
}
function normalizeDirector(source) {
  const sf = ast(source); assert.equal(sf.parseDiagnostics.length, 0);
  const call = one(nodes(sf, n => ts.isCallExpression(n) && n.expression.getText(sf) === 'this.projs.warmWindFlight'), 'director warm hook');
  const hook = call.parent.parent;
  assert(ts.isIfStatement(hook));
  assert.equal(canonical(hook.getText(sf)), canonical("if (this.heroes.some(h => h.id === 'wind')) this.projs.warmWindFlight();"));
  const start = member(sf, 'BattleDirector', 'start'); assert.equal(hook.parent, start.body);
  const previous = start.body.statements[start.body.statements.indexOf(hook) - 1];
  assert(ts.isExpressionStatement(previous) && ts.isBinaryExpression(previous.expression)
    && previous.expression.left.getText(sf) === 'this.projs'
    && ts.isNewExpression(previous.expression.right)
    && previous.expression.right.expression.getText(sf) === 'ProjectileManager', 'Warm immediately after projectile construction');
  return editSource(source, [{ start: hook.getStart(sf), end: hook.end, text: '' }]);
}
function evaluate(s, filename, imports) {
  const out = ts.transpileModule(s, { fileName: filename, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
  assert.equal(out.diagnostics?.length || 0, 0, filename + ' syntax');
  const noRng = Object.create(Math); noRng.random = () => { throw Error('Unexpected RNG'); };
  const exports = {};
  vm.runInNewContext(out.outputText, { exports, Math: noRng, require(id) {
    assert(Object.hasOwn(imports, id), 'Refused runtime import: ' + id); return imports[id];
  } }, { filename, timeout: 3000 });
  return exports;
}
async function check(name, run) {
  try { const evidence = await run(); report.checks.push({ name, status: 'PASS', ...(evidence ? { evidence } : {}) }); }
  catch (e) { report.checks.push({ name, status: 'FAIL', error: e.stack || String(e) }); }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function harness() {
  const created = { nodes: [], materials: [], textures: [], frames: [], loads: [] }, pending = [];
  class Node {
    static EventType = { NODE_DESTROYED: 'destroy' };
    constructor(name) { this.name = name; this.children = []; this.active = true; this.isValid = true;
      this.position = { x: 0, y: 0 }; this.angle = 0; this.events = new Map(); created.nodes.push(this); }
    setParent(p) { this.parent = p; p.children.push(this); }
    addComponent(C) { const c = new C(); c.node = this; return c; }
    setPosition(x, y) { this.position = { x, y }; }
    once(type, cb) { this.events.set(type, cb); }
    destroy() { if (!this.isValid) return; this.events.get('destroy')?.(); this.isValid = false;
      for (const c of this.children) c.destroy(); }
  }
  class Disposable { constructor() { this.destroyCount = 0; } destroy() { this.destroyCount++; } }
  class Texture2D extends Disposable { static PixelFormat = { RGBA8888: 1 };
    constructor() { super(); created.textures.push(this); } reset() {} uploadData() {} }
  class SpriteFrame extends Disposable { constructor() { super(); created.frames.push(this); } reset() {} }
  class Material extends Disposable { constructor() { super(); this.properties = {}; created.materials.push(this); }
    initialize(options) { this.options = options; }
    setProperty(k, v) { this.properties[k] = { ...v }; } }
  class Sprite { static SizeMode = { CUSTOM: 1 }; get isValid() { return this.node.isValid; } }
  class UITransform { setContentSize(width, height) { this.width = width; this.height = height; } }
  class Vec4 { set(x, y, z, w) { Object.assign(this, { x, y, z, w }); } }
  class Color { static fromHEX(c, s) { c.hex = s; c.a = 255; return c; } }
  class Graphics {
    constructor() { this.ops = []; this.path = []; }
    clear() { this.ops = []; this.path = []; }
    moveTo(x, y) { this.path = [[x, y]]; }
    lineTo(x, y) { this.path.push([x, y]); }
    bezierCurveTo(...p) { for (let i = 0; i < p.length; i += 2) this.path.push(p.slice(i, i + 2)); }
    circle(x, y, r) { this.path = [[x, y]]; this.circleRadius = r; }
    close() {}
    fill() { this.record('fill', this.fillColor); }
    stroke() { this.record('stroke', this.strokeColor); }
    record(kind, color) { this.ops.push({ kind, color: { ...color }, radius: this.circleRadius,
      path: this.path.map(p => p.slice()), width: this.lineWidth }); this.circleRadius = undefined; }
  }
  class EffectAsset { constructor(key) { this.key = key; this.refs = 0; } addRef() { this.refs++; } }
  const cc = { Node, Texture2D, SpriteFrame, Material, Sprite, UITransform, Vec4, Color, Graphics, EffectAsset,
    Rect: class {}, Size: class {}, Vec2: class {}, JsonAsset: class {}, Layers: { Enum: { UI_2D: 1 } },
    gfx: { BlendFactor: { ONE: 1, ONE_MINUS_SRC_ALPHA: 2 } },
    resources: { load(key, type, callback) { created.loads.push(key); pending.push({ key, callback }); } } };
  const N = (name, parent) => { const n = new Node(name); n.setParent(parent); return n; };
  const helper = evaluate(read(HELP), HELP, { cc, '../ui/UIKit': { N } });
  const renderer = evaluate(read(VFX), VFX, { cc, './HeroFxShader': helper });
  return { cc, created, helper, renderer, parent: new Node('parent'), pending,
    async settle(key, fail = false, missing = false) {
      const jobs = pending.filter(p => p.key === key); assert(jobs.length, 'No pending load: ' + key);
      const asset = missing ? null : new EffectAsset(key);
      for (const p of jobs) { pending.splice(pending.indexOf(p), 1);
        queueMicrotask(() => p.callback(fail ? Error('inert load failure') : null, asset)); }
      await flush(); return asset;
    } };
}
const draw = (fx, i = 0) => fx.draw(i, 2, 240, 200, 3, .2, .73, .8, 2, 90, 1);
const area = (kind = 'spiral') => ({ kind, x: 0, y: 0, radius: 90, age: .3, duration: 2 });
async function main() {
  assert(ts, 'Installed TypeScript required (TYPESCRIPT_PATH may override); never auto-installs.');
  report.typescript = ts.version;
  await check('combat and configuration AST unchanged from baseline', () => {
    const files = git(['ls-tree', '-r', '--name-only', BASE, '--', 'assets/scripts/battle', 'assets/scripts/config'])
      .trim().split(/\r?\n/).filter(f => f.endsWith('.ts'));
    // Projectile/Director have separately validated cosmetic-only normalization below.
    const checked = files.filter(f => ![HELP, VFX, PROJECTILE, DIRECTOR].includes(f));
    assert(checked.length > 40, 'Unexpected baseline inventory');
    const changed = checked.filter(f => canonical(read(f)) !== canonical(old(f)));
    assert.deepEqual(changed, [], 'Changed protected source AST'); return { files: checked.length };
  });
  await check('Projectile combat AST identical after strictly whitelisted cosmetic additions', () => {
    const source = read(PROJECTILE), baseline = old(PROJECTILE);
    assert.equal(canonical(normalizeProjectile(source, baseline)), canonical(baseline), 'Projectile has nonvisual changes');
    const critical = ['hitSweep', 'hitMob', 'tick', 'advanceReturning', 'hitGround', 'hitArc', 'damageFor', 'addDamage', 'recycle'];
    const before = ast(baseline), after = ast(source);
    for (const name of critical) assert.equal(
      classCanonical(member(after, 'ProjectileManager', name).getText(after)),
      classCanonical(member(before, 'ProjectileManager', name).getText(before)), name + ': combat AST changed');
    // Prove this exemption cannot hide damage, timing, callbacks or flight-math mutations.
    for (const [from, to] of [['sp.dmg * scale', 'sp.dmg * 0'], ['a.ttl -= dt', 'a.ttl -= dt * 2'],
      ['sp.onContact?.(m)', 'sp.onContact?.(null)'], ['a.vx = dx / len * spec.speed', 'a.vx = dx * len * spec.speed']]) {
      assert(source.includes(from), 'Mutation anchor missing: ' + from);
      assert.notEqual(canonical(normalizeProjectile(source.replace(from, to), baseline)), canonical(baseline), 'Missed mutation: ' + from);
    }
    return { exactCombatMethods: critical, fireExemption: 'single validated windShader assignment', rejectedMutationKinds: ['damage', 'timing', 'callback', 'velocity math'] };
  });
  await check('BattleDirector AST unchanged except single wind-only warm hook', () => {
    assert.equal(canonical(normalizeDirector(read(DIRECTOR))), canonical(old(DIRECTOR)));
    return { hook: 'wind-only, immediately after ProjectileManager construction', allOtherLogic: 'baseline AST identical' };
  });
  await check('legacy shuriken and metal marks retain their AST', () => {
    const before = ast(old(VFX)), after = ast(read(VFX));
    for (const name of ['drawShuriken', 'metalStar', 'mark']) {
      const find = sf => nodes(sf, n => (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name?.getText(sf) === name)[0];
      assert(find(before) && find(after), name);
      const standalone = (n, sf) => ts.isMethodDeclaration(n) ? 'class Legacy { ' + n.getText(sf) + ' }' : n.getText(sf);
      assert.equal(canonical(standalone(find(after), after)), canonical(standalone(find(before), before)), name);
    }
  });
  await check('energized crescent convex midpoint and every tail rotate toward all four aim directions', () => {
    const h = harness(), x = 13, y = -7, size = 7, age = .37;
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [3, 4]];
    let east;
    for (const [vx, vy] of directions) {
      const g = new h.cc.Graphics(); h.renderer.drawWindBlade(g, x, y, vx, vy, size, age);
      const len = Math.hypot(vx, vy), dx = vx / len, dy = vy / len;
      assert.equal(g.ops.filter(op => op.kind === 'fill').length, 3, 'Three luminous crescent layers');
      assert.equal(g.ops.filter(op => op.kind === 'stroke').length, 5, 'Five trailing streaks');
      for (const op of g.ops) for (const p of op.path) assert(p.every(Number.isFinite), 'Finite drawing geometry');
      const body = g.ops.find(op => op.kind === 'fill');
      const projected = body.path.map(([px, py]) => [(px - x) * dx + (py - y) * dy, -(px - x) * dy + (py - y) * dx]);
      const apex = projected.reduce((a, b) => b[0] > a[0] ? b : a);
      assert(apex[0] > size * 2 && Math.abs(apex[1]) < size * .1, 'Convex apex must face aim target');
      assert(projected[0][0] < apex[0] * .5, 'Crescent tips trail its convex midpoint');
      assert(Math.max(...projected.map(p => p[1])) - Math.min(...projected.map(p => p[1])) > size * 4, 'Broad crescent');
      let area2 = 0; for (let i = 0; i < projected.length; i++) {
        const a = projected[i], b = projected[(i + 1) % projected.length]; area2 += a[0] * b[1] - b[0] * a[1];
      }
      assert(Math.abs(area2) / 2 > size * size, 'Thick energy body');
      for (const op of g.ops.filter(op => op.kind === 'stroke')) {
        const a = op.path[0], b = op.path.at(-1);
        assert((b[0] - a[0]) * dx + (b[1] - a[1]) * dy < 0, 'Streaks extend behind aim');
      }
      if (!east) east = g.ops;
      assert.equal(g.ops.length, east.length);
      g.ops.forEach((op, i) => {
        assert.equal(op.path.length, east[i].path.length);
        op.path.forEach(([px, py], j) => {
          const [ex, ey] = east[i].path[j];
          assert(Math.abs(px - (x + dx * (ex - x) - dy * (ey - y))) < 1e-7, 'All geometry rotates with velocity (x)');
          assert(Math.abs(py - (y + dy * (ex - x) + dx * (ey - y))) < 1e-7, 'All geometry rotates with velocity (y)');
        });
      });
    }
    return { cardinalDirections: 4, diagonal: [3, 4], layers: 3, tailStreaks: 5, gpuValidation: false };
  });
  await check('actual helper defaults, effect cache isolation, independent techniques and inactive carriers', async () => {
    const h = harness(), C = h.helper.HeroFxShader;
    const oldFx = ['alpha', 'emission', 'plasma'].map((mode, i) => new C(h.parent, mode, 2, mode));
    const fresh = new C(h.parent, 'new', 2, 'plasma', { effect: 'fx/wind-ninja-flow', technique: 7 });
    const alternate = new C(h.parent, 'alternate', 1, 'alpha', { effect: 'fx/wind-ninja-flow', technique: 4 });
    assert.equal(h.created.loads.length, 2, 'One shared pending request per effect');
    for (const fx of [...oldFx, fresh, alternate]) { fx.begin(); assert.equal(draw(fx), false); fx.end(); }
    assert(h.created.nodes.filter(n => /^flow\d+$/.test(n.name)).every(n => !n.active));
    const oldAsset = await h.settle('fx/hero-impact-flow');
    assert(oldFx.every(f => f.ready)); assert.equal(fresh.ready, false);
    assert.deepEqual(h.created.materials.map(m => m.options.technique), [0, 0, 1, 1, 2, 2]);
    for (const fx of [oldFx[1], oldFx[2], fresh]) for (const q of fx.quads) {
      assert.equal(q.sprite._srcBlendFactor, h.cc.gfx.BlendFactor.ONE);
      assert.equal(q.sprite._dstBlendFactor, fx === oldFx[1] ? h.cc.gfx.BlendFactor.ONE : h.cc.gfx.BlendFactor.ONE_MINUS_SRC_ALPHA);
    }
    const saved = h.created.materials.slice(); const newAsset = await h.settle('fx/wind-ninja-flow');
    assert.notEqual(oldAsset, newAsset); assert.equal(oldAsset.refs, 1); assert.equal(newAsset.refs, 1);
    assert.deepEqual(h.created.materials.slice(6).map(m => m.options.technique), [7, 7, 4]);
    assert(saved.every(m => m.options.effectAsset === oldAsset && m.destroyCount === 0));
    return { defaultTechniques: [0, 1, 2], loads: h.created.loads, sameEffectDifferentTechniques: [7, 4] };
  });
  await check('failed and missing effect retry only their own cache entry', async () => {
    for (const failure of ['error', 'missing']) {
      const h = harness(), C = h.helper.HeroFxShader;
      const stable = new C(h.parent, 'old', 1);
      const failed = new C(h.parent, 'new', 1, 'plasma', { effect: 'fx/wind-ninja-flow', technique: 0 });
      await h.settle('fx/hero-impact-flow'); const material = h.created.materials[0];
      await h.settle('fx/wind-ninja-flow', failure === 'error', failure === 'missing');
      assert.equal(failed.ready, false); assert.equal(draw(failed), false);
      const cached = new C(h.parent, 'old-again', 1);
      const retry = new C(h.parent, 'retry', 1, 'plasma', { effect: 'fx/wind-ninja-flow', technique: 0 });
      await flush(); assert(cached.ready); assert(stable.ready);
      assert.equal(h.created.loads.filter(x => x === 'fx/hero-impact-flow').length, 1);
      assert.equal(h.created.loads.filter(x => x === 'fx/wind-ninja-flow').length, 2);
      await h.settle('fx/wind-ninja-flow'); assert(retry.ready); assert.equal(failed.ready, false);
      assert.equal(material.destroyCount, 0); assert.equal(material.options.effectAsset.key, 'fx/hero-impact-flow');
    }
  });
  await check('helper pool is fixed, reuses nodes, updates uniforms, hides unused quads and cleans up', async () => {
    const h = harness(), fx = new h.helper.HeroFxShader(h.parent, 'pool', 8);
    await h.settle('fx/hero-impact-flow'); const count = h.created.nodes.length;
    assert(h.created.materials.every(m => m.options.technique === 0), 'Omitted blend mode defaults to alpha technique 0');
    for (let frame = 0; frame < 40; frame++) { fx.begin();
      for (let i = 0; i < 8; i++) assert.equal(draw(fx, i), true);
      assert.equal(draw(fx, 9), false); fx.end(); }
    assert.equal(h.created.nodes.length, count); assert.equal(h.created.materials.length, 8);
    assert.equal(h.created.materials[0].properties.fxState.z, .8);
    assert.equal(h.created.materials[0].properties.fxShape.w, 1);
    fx.begin(); assert(draw(fx)); fx.end();
    assert.equal(h.created.nodes.filter(n => /^flow\d+$/.test(n.name) && n.active).length, 1);
    fx.begin(); fx.end(); assert(h.created.nodes.filter(n => /^flow\d+$/.test(n.name)).every(n => !n.active));
    h.parent.destroy(); h.parent.destroy(); assert.equal(draw(fx), false);
    for (const item of [...h.created.materials, ...h.created.frames, ...h.created.textures]) assert.equal(item.destroyCount, 1);
  });
  await check('destroy before async completion never allocates or reactivates material carriers', async () => {
    const h = harness(), fx = new h.helper.HeroFxShader(h.parent, 'early', 8);
    h.parent.destroy(); await h.settle('fx/hero-impact-flow');
    assert.equal(fx.ready, false); assert.equal(draw(fx), false); assert.equal(h.created.materials.length, 0);
    assert(h.created.frames.concat(h.created.textures).every(x => x.destroyCount === 1));
    assert(h.created.nodes.filter(n => /^flow\d+$/.test(n.name)).every(n => !n.active));
  });
  await check('area renderer pins per-event mode across readiness and caps/reuses eight shader quads', async () => {
    const h = harness(), v = new h.renderer.WindNinjaVFX(h.parent), events = ['eye', 'tornado', 'spiral'].map(area);
    assert.equal(Object.prototype.toString.call(v.areaShader), '[object WeakMap]');
    assert.equal(v.flow.blendMode, 'plasma', 'New area carriers use premultiplied coverage blending');
    for (const q of v.flow.quads) {
      assert.equal(q.sprite._srcBlendFactor, h.cc.gfx.BlendFactor.ONE);
      assert.equal(q.sprite._dstBlendFactor, h.cc.gfx.BlendFactor.ONE_MINUS_SRC_ALPHA);
    }
    assert.equal(h.created.nodes.filter(n => /^flow\d+$/.test(n.name)).length, 8);
    v.begin(); events.forEach(e => v.area(e)); v.end(); assert(v.g.ops.length > 0);
    assert(h.created.nodes.filter(n => /^flow\d+$/.test(n.name)).every(n => !n.active));
    await h.settle('fx/wind-ninja-flow');
    assert(h.created.materials.every(m => m.options.effectAsset.key === 'fx/wind-ninja-flow' && m.options.technique === 0),
      'New effect explicitly selects technique 0 despite plasma default technique 2');
    v.begin(); events.forEach(e => v.area(e)); v.end();
    assert(h.created.nodes.filter(n => /^flow\d+$/.test(n.name)).every(n => !n.active), 'Existing fallback events must stay fallback');
    const fresh = Array.from({ length: 12 }, () => area()); const count = h.created.nodes.length;
    for (let i = 0; i < 30; i++) { v.begin(); fresh.forEach(e => v.area(e)); v.end();
      assert.equal(h.created.nodes.filter(n => /^flow\d+$/.test(n.name) && n.active).length, 8);
      assert.equal(v.g.ops.length, 0, 'Ready spiral is pure shader energy'); }
    assert.equal(h.created.nodes.length, count); assert.equal(h.created.materials.length, 8);
    v.begin(); v.end(); assert(h.created.nodes.filter(n => /^flow\d+$/.test(n.name)).every(n => !n.active));
    for (let i = 0; i < 100; i++) v.release(0, 0, 1, 0, 'wind');
    assert.equal(v.accents.length, 24); v.tick(.23); assert.equal(v.accents.length, 0);
    v.begin(); for (let i = 0; i < 80; i++) v.mark(0, 0, .1); const ops = v.g.ops.length;
    v.mark(0, 0, .1); assert.equal(v.g.ops.length, ops, 'Mark cap'); v.end();
    v.destroy(); v.destroy(); assert(h.created.materials.every(m => m.destroyCount === 1));
    return { shaderCapacity: 8, repeatedFrames: 30, accentCap: 24, markCap: 80,
      blendMode: 'plasma', blendFactors: ['ONE', 'ONE_MINUS_SRC_ALPHA'], explicitEffectTechnique: 0 };
  });
  await check('fallback has no metallic spiral, opaque footprint circle, range ring or giant white fill', () => {
    const h = harness(), v = new h.renderer.WindNinjaVFX(h.parent);
    for (const kind of ['eye', 'tornado', 'spiral']) for (const age of [.02, .3, 1, 1.95]) {
      v.begin(); v.area({ ...area(kind), age }); v.end(); assert(v.g.ops.length > 0);
      for (const op of v.g.ops) {
        const alpha = op.color.a / 255;
        assert(!(op.radius >= 90 * .65 && (op.kind === 'stroke' || alpha >= .4)), kind + ' footprint/range boundary');
        const p = op.path; let twiceArea = 0;
        for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; twiceArea += a[0] * b[1] - b[0] * a[1]; }
        assert(!(op.kind === 'fill' && ['#F3FBF7', '#F0FFE3', '#FFFFFF'].includes(op.color.hex)
          && alpha > .4 && Math.abs(twiceArea) / 2 > 90 * 90 * .5), 'Huge white fallback');
        if (kind === 'spiral') assert(!['#334855', '#7894A3', '#CEDFE4'].includes(op.color.hex), 'Metal spiral fallback');
      }
    }
    const sf = ast(read(VFX)); const spiral = nodes(sf, n => ts.isFunctionDeclaration(n) && n.name?.text === 'drawSpiral')[0];
    assert(spiral); assert(!nodes(spiral, n => ts.isCallExpression(n) && n.expression.getText(sf) === 'metalStar').length);
  });
  await check('wind and ninja warm their effect before first-paint promise resolves', async () => {
    for (const hero of ['wind', 'ninja']) {
      const h = harness(), done = () => Promise.resolve();
      h.cc.director = { preloadScene(name, cb) { queueMicrotask(() => cb(null)); } };
      const imports = { cc: h.cc, '../config/Campaign': { battleSceneKey: () => 'scene' },
        '../config/LevelDifficulty': { getChallengeDef: () => ({ waves: [] }) },
        '../config/ChapterContent': { enemyArtRef: () => ({ atlas: 'mob' }) },
        '../battle/BattleSprite': { warmBattleAtlas: done }, '../battle/ArcherIdleAnimation': { preloadArcherClip: done },
        '../battle/HeroSequenceAnimation': { preloadHeroClip: done }, '../battle/MobAnim': { getMobAnims: cb => cb() },
        './Ux': { warmUXArt: done, uxFrame: (id, cb) => cb() }, './PickArt': { warmPickArt: done }, './Fonts': { warmGameFonts() {} } };
      const warm = evaluate(read(WARM), WARM, imports); let completed = false;
      const job = warm.warmBattlefield('1-1', [hero]).then(() => { completed = true; });
      await flush(); assert(h.created.loads.includes('fx/wind-ninja-flow'));
      for (const key of [...new Set(h.created.loads)].filter(k => k !== 'fx/wind-ninja-flow')) await h.settle(key);
      assert.equal(completed, false, hero + ' barrier omitted effect');
      await h.settle('fx/wind-ninja-flow'); await job; assert(completed);
    }
  });
  report.shaderAsset = { path: 'assets/resources/fx/wind-ninja-flow.effect',
    presentAtCheck: fs.existsSync(path.join(ROOT, 'assets/resources/fx/wind-ninja-flow.effect')),
    requiredForThisIsolatedCheck: false };
}
main().catch(e => report.checks.push({ name: 'harness setup', status: 'FAIL', error: e.stack || String(e) })).finally(() => {
  report.status = report.checks.length && report.checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(__dirname, 'integration-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(report.status + ': ' + report.checks.filter(c => c.status === 'PASS').length + '/' + report.checks.length + ' integration checks');
  for (const c of report.checks.filter(c => c.status === 'FAIL')) console.error(c.name + ': ' + c.error);
  process.exitCode = report.status === 'PASS' ? 0 : 1;
});
