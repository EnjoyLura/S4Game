/** Pure kinematics/geometry, drawing caps, source contracts and no-emit type checks. No combat simulation. */
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, loadTypeScript, loadGeometry, loadConfig, loadDrawing,
  RecordingGraphics, DrawingNode, renderPreview } = require('./render-preview.cjs');
const geo = loadGeometry(), config = loadConfig(), drawing = loadDrawing();
const suites = [];
let checks = 0;
function check(name, fn) { fn(); checks++; suites.push(name); }
function near(a, b, tolerance = 1e-7) { assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`); }
const bounds = { left: -300, right: 300, bottom: 0, top: 600 };

check('density: empty/dead/out-of-view bodies do not seed an area', () => {
  assert.equal(geo.densestBodyArea([], 0, 0, 1000, 80, bounds), null);
  const b = [{ x: 0, hitY: 650 }, { x: 5, hitY: 660 }, { x: 12, hitY: 670 },
    { x: 100, hitY: 400 }, { x: 130, hitY: 400 }, { x: -100, hitY: 100, dead: true }];
  const p = geo.densestBodyArea(b, 0, 0, 1000, 80, bounds);
  assert(p && p.y === 400 && p.x >= 100 && p.x <= 130);
});
check('density: airborne hitY, rather than ground y, governs range', () => {
  assert.equal(geo.densestBodyArea([{ x: 0, hitY: 450, y: 0 }], 0, 0, 200, 60, bounds), null);
  assert(geo.densestBodyArea([{ x: 0, hitY: 150, y: 800 }], 0, 0, 200, 60, bounds));
});
check('density: radius scores the actual circular footprint', () => {
  const p = geo.densestBodyArea([{ x: -210, hitY: 250 }, { x: 90, hitY: 300 },
    { x: 110, hitY: 300 }, { x: 100, hitY: 315 }], 0, 0, 1000, 50, bounds);
  assert(p && p.x > 80 && p.x < 120 && p.y >= 300);
});
check('motion: 82px/s, exact cap and no overshoot even for a long step', () => {
  const p = { x: 0, y: 0 };
  near(geo.moveFieldToward(p, { x: 300, y: 400 }, 82, 1), 82);
  near(p.x, 49.2); near(p.y, 65.6);
  geo.moveFieldToward(p, { x: 300, y: 400 }, 82, 100); near(p.x, 300); near(p.y, 400);
  near(geo.moveFieldToward(p, { x: 0, y: 0 }, 82, -1), 0);
});
check('motion: deterministic 500-case distance/endpoint property check', () => {
  let seed = 120;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 500; i++) {
    const start = { x: random() * 700 - 350, y: random() * 1200 - 500 };
    const end = { x: random() * 700 - 350, y: random() * 1200 - 500 };
    const p = { ...start }, dt = random() * 4, distance = Math.hypot(end.x - start.x, end.y - start.y);
    const travel = geo.moveFieldToward(p, end, 82, dt);
    near(travel, Math.min(distance, 82 * dt));
    near(Math.hypot(p.x - start.x, p.y - start.y), travel);
    const route = geo.finiteReturnPath(start.x, start.y, end.x, end.y, 1100);
    near(start.x + route.dirX * route.distance, end.x); near(start.y + route.dirY * route.distance, end.y);
  }
});
check('return: zero-length and diagonal paths have exact finite endpoints', () => {
  for (const [x, y, lx, ly] of [[20, 400, 35, -455], [0, 0, 0, 0], [-300, 500, 300, -455]]) {
    const p = geo.finiteReturnPath(x, y, lx, ly, 1100);
    assert(Number.isFinite(p.ttl) && Number.isFinite(p.dirX) && Number.isFinite(p.dirY));
    near(x + p.dirX * p.distance, lx); near(y + p.dirY * p.distance, ly);
    near(p.endPoint.x, lx); near(p.endPoint.y, ly);
  }
});
check('kinematics: moving/slowed/hold/attack/immobilized speed contract', () => {
  const m = { state: 'move', immobilized: false, slowT: 0, slowAmp: .5, def: { speed: 36 } };
  near(geo.bodyDownSpeed(m), 36); near(geo.bodyDownSpeed({ ...m, slowT: 1 }), 18);
  for (const state of ['hold', 'attack']) near(geo.bodyDownSpeed({ ...m, state }), 0);
  near(geo.bodyDownSpeed({ ...m, immobilized: true }), 0);
  near(geo.bodyDownSpeed({ ...m, slowT: 1, slowAmp: 1.4 }), 0);
});
function verifyIntercept(x, y, tx, ty, down, speed) {
  const aim = geo.interceptDirection(x, y, tx, ty, down, speed);
  assert(aim.reachable && aim.flightTime >= 0);
  near(Math.hypot(aim.dirX, aim.dirY), 1);
  near(x + aim.dirX * speed * aim.flightTime, tx);
  near(y + aim.dirY * speed * aim.flightTime, ty - down * aim.flightTime);
  return aim;
}
check('kinematics: 1000px range / 36px/s target meets projectile instead of missing by >22px', () => {
  const x = 35, y = -455, tx = -165, ty = 525, speed = config.NINJA.speed;
  const oldTime = Math.hypot(tx - x, ty - y) / speed;
  assert(36 * oldTime > 22);
  const aim = verifyIntercept(x, y, tx, ty, 36, speed);
  assert(aim.impactY < ty && aim.flightTime < oldTime);
});
check('kinematics: both actual mirrored hand origins work for wind and ninja', () => {
  for (const handX of [-35, 35]) for (const bullet of [config.WIND.bladeSpeed, config.NINJA.speed])
    for (const targetX of [-290, 0, 290]) verifyIntercept(handX, -455, targetX, 475, 36, bullet);
});
check('kinematics: stationary/frozen and slowed targets meet at the predicted body point', () => {
  for (const down of [0, 18, 36]) verifyIntercept(-35, -455, 240, 480, down, 1000);
  const frozen = verifyIntercept(35, -455, -100, 500, 0, 1000); near(frozen.impactY, 500);
});
check('kinematics: equal-speed linear case, chase, unreachable and zero-distance fallbacks', () => {
  near(verifyIntercept(0, 0, 0, 100, 50, 50).flightTime, 1);
  near(verifyIntercept(0, 0, 0, -100, 50, 100).flightTime, 2);
  for (const [x, y, down, speed] of [[0, -100, 50, 50], [100, 0, 200, 100]]) {
    const p = geo.interceptDirection(0, 0, x, y, down, speed);
    assert(!p.reachable && Number.isFinite(p.flightTime)); near(Math.hypot(p.dirX, p.dirY), 1);
  }
  const zero = geo.interceptDirection(0, 0, 0, 0, 36, 1000); near(zero.flightTime, 0); assert(Number.isFinite(zero.dirY));
});
check('kinematics: 500 deterministic interceptions agree with target motion', () => {
  for (let i = 0; i < 500; i++) verifyIntercept(i % 2 ? -35 : 35, -455,
    (i * 37 % 660) - 330, -300 + i * 53 % 900, i % 91, i % 2 ? 840 : 1000);
});
check('drawing: wind crescent body stays horizontal under different velocity directions', () => {
  for (const [vx, vy] of [[0, 840], [300, -700], [-600, 300]]) {
    const g = new RecordingGraphics(); drawing.drawWindBlade(g, 0, 0, vx, vy, 10, .1);
    const shape = g.commands.find(c => c.kind === 'fill').points;
    const xs = shape.map(p => p[0]), ys = shape.map(p => p[1]);
    assert(Math.max(...xs) - Math.min(...xs) > (Math.max(...ys) - Math.min(...ys)) * 2);
  }
});
check('drawing: 80 attached-metal cap, 8 area cap, 24 accent cap and expiry', () => {
  const batch = new drawing.WindNinjaVFX(new DrawingNode()); batch.begin();
  for (let i = 0; i < 80; i++) batch.mark(i, 0, .7, i % 2 === 0);
  const count = batch.g.commands.length;
  for (let i = 0; i < 100; i++) batch.mark(i, 0, .7); assert.equal(batch.g.commands.length, count);
  batch.begin();
  for (let i = 0; i < 8; i++) batch.area({ kind: 'eye', x: 0, y: 0, radius: 165, age: 1, duration: 4 });
  const areas = batch.g.commands.length;
  for (let i = 0; i < 100; i++) batch.area({ kind: 'eye', x: 0, y: 0, radius: 165, age: 1, duration: 4 });
  assert.equal(batch.g.commands.length, areas);
  for (let i = 0; i < 100; i++) batch.release(0, 0, 1, 0, 'wind'); assert.equal(batch.accents.length, 24);
  batch.tick(1); assert.equal(batch.accents.length, 0);
});
check('drawing: all fields/projectiles remain finite at start, middle and fade', () => {
  for (const age of [0, .05, 1.3, 3.99, 4]) {
    const batch = new drawing.WindNinjaVFX(new DrawingNode()); batch.begin();
    for (const kind of ['eye', 'tornado', 'spiral']) batch.area({ kind, x: 0, y: 0, radius: 145, age, duration: 4 });
    batch.end(); const g = new RecordingGraphics(); drawing.drawShuriken(g, 0, 0, 100, -1000, 7, age);
    assert(batch.g.commands.length < 600 && g.commands.length < 40);
  }
});

const ts = loadTypeScript();
const sourceFile = path.join(ROOT, 'assets/scripts/battle/WindNinjaHeroes.ts');
const text = fs.readFileSync(sourceFile, 'utf8');
check('static source: contact callback attaches marks without another damage call', () => {
  const source = ts.createSourceFile(sourceFile, text, ts.ScriptTarget.Latest, true);
  let callbacks = 0;
  function visit(node) {
    if (ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'onContact') {
      callbacks++; assert(!/\.takeDamage\s*\(/.test(node.right.getText(source)));
    }
    ts.forEachChild(node, visit);
  }
  visit(source); assert.equal(callbacks, 1);
  assert(!/\.applyKnockback\s*\(/.test(text));
});
check('static source: actual-hand lead, finite endpoint, guarded recall retry and mark eligibility', () => {
  assert.equal((text.match(/interceptDirection\(hand\.x, hand\.y/g) || []).length, 2);
  assert(text.includes('aim.flightTime + .15') && text.includes('initialContactLifeId: mark.lifeId'));
  assert(text.includes('if (!projs.fire(spec)) break;') && text.includes('protected canAutoSkill'));
  assert(text.includes('this.prune(mgr); this.releaseRecalls(mgr, projs);\n    super.updateQueues'));
  assert(text.includes('source.hitY + mark.offsetY') && text.includes('this.marks.size + this.recalls.length >= NINJA.markCap'));
});
const ownNames = ['WindNinjaGeometry', 'WindNinjaVFX', 'WindNinjaHeroes'];
check('metadata: new TypeScript UUIDs are valid and unique', () => {
  const uuids = ownNames.map(name => {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, `assets/scripts/battle/${name}.ts.meta`), 'utf8'));
    assert.equal(m.importer, 'typescript'); assert(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(m.uuid)); return m.uuid;
  }); assert.equal(new Set(uuids).size, 3);
});
const cfg = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, ROOT);
const files = ownNames.map(n => path.join(ROOT, 'assets/scripts/battle/' + n + '.ts'));
const program = ts.createProgram(files, { ...parsed.options, noEmit: true, skipLibCheck: true, incremental: false });
const diagnostics = ts.getPreEmitDiagnostics(program);
const ownDiagnostics = diagnostics.filter(d => d.file && /WindNinja(?:Heroes|VFX|Geometry)\.ts$/.test(d.file.fileName));
check('static TypeScript: new modules have no diagnostics under project ES2015 settings', () => {
  assert.equal(ownDiagnostics.length, 0, ownDiagnostics.map(d => {
    const p = d.file.getLineAndCharacterOfPosition(d.start);
    return `${d.file.fileName}:${p.line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
  }).join('\n'));
});
const preview = renderPreview();
const record = { checkedAt: new Date().toISOString(), status: 'PASS', checks, suites,
  permittedScope: 'pure geometry/kinematics, static source/type checks, isolated Graphics drawing only',
  excludedExecution: ['game engine', 'combat simulation', 'browser', 'audio', 'WASM', 'build', 'git', 'deployment'],
  typeCheck: { version: ts.version, noEmit: true, ownDiagnostics: 0, dependencyDiagnostics: diagnostics.length },
  sha256: Object.fromEntries(files.map(file => [path.basename(file), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  preview };
fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ status: record.status, checks, typeCheck: record.typeCheck, preview }, null, 2));
