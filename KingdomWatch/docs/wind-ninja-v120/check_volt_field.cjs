#!/usr/bin/env node
'use strict';
/**
 * Reproduce: node docs/wind-ninja-v120/check_volt_field.cjs
 * Optional: TYPESCRIPT_PATH=<absolute typescript package/lib/typescript.js>.
 * Runs only current-source arithmetic/queue methods and an isolated Graphics recorder.
 * Never imports Hero/Monster/BattleDirector, boots Cocos, opens a browser, or loads audio/WASM.
 * Writes only volt-field-check.json beside this file. No builds, Git or network operations.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const reportPath = path.join(__dirname, 'volt-field-check.json');
const tracked = [
  'assets/scripts/battle/VoltField.ts', 'assets/scripts/battle/VoltField.ts.meta',
  'assets/scripts/battle/Hero.ts', 'assets/scripts/config/WindNinjaConfig.ts',
  'assets/scripts/config/Cards.ts', 'assets/scripts/battle/UltimateTiming.ts',
  'assets/scripts/battle/BattleDirector.ts', 'assets/scripts/battle/WaveManager.ts',
];
const raw = Object.fromEntries(tracked.map(f => [f, fs.readFileSync(path.join(root, f))]));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const sourceHashes = Object.fromEntries(tracked.map(f => [f, sha(raw[f])]));
const source = file => raw[file].toString('utf8');
const checks = [], metrics = {};
let tsPath, ts;

function findTypeScript() {
  const candidates = [process.env.TYPESCRIPT_PATH];
  try { candidates.push(require.resolve('typescript', { paths: [root, __dirname] })); } catch {}
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA,
    'npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript/lib/typescript.js'));
  candidates.push('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
  for (const candidate of candidates.filter(Boolean)) {
    if (fs.existsSync(candidate)) { tsPath = require.resolve(candidate); return require(candidate); }
  }
  throw Error('TypeScript unavailable. Set TYPESCRIPT_PATH to an installed typescript package or lib/typescript.js; no automatic install is performed.');
}
function check(name, run) {
  try { const evidence = run(); checks.push({ name, passed: true, ...(evidence ? { evidence } : {}) }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack || String(error) }); }
}
function compile(text, filename) {
  const result = ts.transpileModule(text, { fileName: filename, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
  assert.equal((result.diagnostics || []).length, 0, filename + ': syntax diagnostics');
  return result.outputText;
}
function evaluate(text, filename, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const deny = Object.create(Math);
  deny.random = () => { throw Error('Unexpected battle RNG in field/config/renderer'); };
  const context = { Math: deny, Float32Array, WeakMap, WeakSet, Number, ...globals };
  const wrapper = vm.runInNewContext('(function(require,module,exports){' + compile(text, filename) + '\n})',
    context, { filename, timeout: 10000 });
  wrapper(id => { assert(Object.hasOwn(dependencies, id), 'Unapproved import: ' + id); return dependencies[id]; }, module, module.exports);
  return module.exports;
}
function ast(file) { return ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true); }
function declaration(sf, name) {
  const found = sf.statements.find(s => s.name?.text === name);
  assert(found, 'Missing declaration: ' + name); return found;
}
function initializer(sf, name) {
  for (const statement of sf.statements) if (ts.isVariableStatement(statement)) {
    const item = statement.declarationList.declarations.find(d => d.name.getText(sf) === name);
    if (item) return item.initializer.getText(sf);
  }
  throw Error('Missing initializer: ' + name);
}
function member(sf, className, name) {
  const found = declaration(sf, className).members.find(m => m.name?.getText(sf) === name);
  assert(found, className + '.' + name + ' missing'); return found.getText(sf);
}
function near(a, b) { assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`); }

let nodes = 0, colors = 0;
class Color { constructor(r, g, b, a) { colors++; Object.assign(this, { r, g, b, a }); } }
class Node {
  static EventType = { NODE_DESTROYED: 'destroy' };
  constructor(name = '') { nodes++; Object.assign(this, { name, children: [], isValid: true, activeInHierarchy: true, events: [] }); }
  setParent(parent) { this.parent = parent; parent.children.push(this); }
  getChildByName(name) { return this.children.find(c => c.name === name); }
  once(event, callback) { assert.equal(event, Node.EventType.NODE_DESTROYED); this.events.push(callback); }
  addComponent(Type) { const component = new Type(); component.node = this; return component; }
  destroy() { if (!this.isValid) return; this.isValid = false; for (const fn of this.events) fn(); for (const child of this.children) child.destroy(); }
}
class Graphics {
  constructor() { this.commands = []; this.clears = 0; }
  clear() { this.commands = []; this.clears++; }
}
for (const name of ['moveTo', 'lineTo', 'stroke', 'circle', 'fill']) Graphics.prototype[name] = function (...args) {
  assert(args.every(Number.isFinite), 'nonfinite renderer coordinates');
  this.commands.push({ name, args, color: { ...(name === 'fill' || name === 'circle' ? this.fillColor : this.strokeColor) }, width: this.lineWidth });
};
const owner = () => new Node('volt');
function mob(x = 0, y = 0, airborne = false, hp = 1e9) {
  return { x, y, hitY: y + (airborne ? 80 : 0), depthY: y - 18, groundY: y - 14,
    def: { airborne }, node: new Node('mob'), hp, dead: false, shockT: 0, stunT: 0, lastDamageTaken: 0, hits: [],
    takeDamage(damage, critical, id) {
      this.lastDamageTaken = 0; if (this.dead) return false;
      this.hits.push({ damage, critical, id }); this.lastDamageTaken = Math.min(this.hp, damage * .7);
      this.hp -= damage * .7; this.dead = this.hp <= 0; return this.dead;
    },
    applyShock() { throw Error('Unexpected shock in level-1 fixture'); },
  };
}
function ledger() { return { total: 0, add(id, damage) { assert.equal(id, 'volt'); this.total += damage; } }; }
function manager(list = []) {
  return { list, mobsInRadius(x, y, radius) { return this.list.filter(m => (m.x - x) ** 2 + (m.hitY - y) ** 2 <= radius ** 2); } };
}

try {
  ts = findTypeScript();
  const config = evaluate(source('assets/scripts/config/WindNinjaConfig.ts'), 'WindNinjaConfig.ts');
  const C = config.VOLT_FIELD;
  const { VoltField } = evaluate(source('assets/scripts/battle/VoltField.ts'), 'VoltField.ts', {
    cc: { Color, Node, Graphics, Layers: { Enum: { UI_2D: 1 } } }, '../config/WindNinjaConfig': config,
  });
  const heroAst = ast('assets/scripts/battle/Hero.ts'), cardsAst = ast('assets/scripts/config/Cards.ts');
  const timingAst = ast('assets/scripts/battle/UltimateTiming.ts');
  function setup() {
    const battle = new Node('Field'), ground = new Node('GroundFxLayer'); ground.setParent(battle);
    return { battle, ground, field: VoltField.forBattle(battle, 0) };
  }

  check('shared field configuration is exactly the approved contract', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(C)), { duration: 3, tick: .5, radius: 95, mul: .2, maxFields: 8 });
  });
  check('six half-second contacts, .2 each; inclusive expiry and actual damage credit', () => {
    const { field } = setup(), m = mob(), l = ledger(), mgr = manager([m]);
    field.leave(owner(), 0, 0, C.mul, l); field.advanceTo(0, mgr); assert.equal(m.hits.length, 0);
    for (let i = 1; i <= 6; i++) field.advanceTo(i * C.tick, mgr);
    assert.equal(m.hits.length, 6); near(m.hits.reduce((sum, hit) => sum + hit.damage, 0), 1.2); near(l.total, .84);
    field.advanceTo(9, mgr); assert.equal(m.hits.length, 6);
    return { contactTimes: [.5, 1, 1.5, 2, 2.5, 3], coefficientSum: 1.2 };
  });
  check('30/60/144Hz, irregular chunks and bounded huge idle jump', () => {
    for (const hz of [30, 60, 144]) {
      const { field } = setup(), m = mob(); field.leave(owner(), 0, 0, 1, null);
      for (let i = 1; i <= hz * 4; i++) field.advanceTo(i / hz, manager([m]));
      assert.equal(m.hits.length, 6);
    }
    for (const chunks of [[.49, .02, .99, 1.5], [3], [1e7], [.4, .4, .4, .4, .4, .4, .6]]) {
      const { field } = setup(), m = mob(); field.leave(owner(), 0, 0, 1, null); let time = 0;
      for (const dt of chunks) field.advanceTo(time += dt, manager([m])); assert.equal(m.hits.length, 6);
    }
  });
  check('nearest refresh retains pulse phase; expiry extends from latest strike', () => {
    const { field } = setup(), o = owner(), m = mob(), mgr = manager([m]);
    field.leave(o, 0, 0, 1, null); field.advanceTo(.49, mgr); field.leave(o, 10, 0, 1, null);
    assert.equal(m.hits.length, 0); field.advanceTo(.5, mgr); assert.equal(m.hits.length, 1);
    field.advanceTo(3, mgr); assert.equal(m.hits.length, 6);
    field.advanceTo(3.48, mgr); assert.equal(field.fields.filter(p => p.active).length, 1);
    field.advanceTo(3.5, mgr); assert.equal(m.hits.length, 6); assert(!field.fields.some(p => p.active));
  });
  check('overlap chooses strongest once across owners, shared clock cannot double advance', () => {
    const { battle, field } = setup(), a = owner(), b = owner(), m = mob(40), la = ledger(), lb = ledger();
    const same = VoltField.forBattle(battle, 0); assert.equal(same, field);
    field.leave(a, 0, 0, 10, la); same.leave(b, 80, 0, 25, lb);
    for (const t of [.5, 1]) { field.advanceTo(t, manager([m])); same.advanceTo(t, manager([m])); }
    assert.equal(m.hits.length, 2); assert(m.hits.every(h => h.damage === 25 && !h.critical && h.id === 'volt'));
    assert.equal(la.total, 0); near(lb.total, 35);
  });
  check('staggered owners share phase without adding contacts', () => {
    const { field } = setup(), m = mob(40), mgr = manager([m]);
    field.leave(owner(), 0, 0, 1, null); field.advanceTo(.27, mgr); field.leave(owner(), 80, 0, 3, null);
    field.advanceTo(3, mgr); assert.equal(m.hits.length, 6); assert(m.hits.every(h => h.damage === 3));
    field.advanceTo(3.27, mgr); assert.equal(m.hits.length, 6);
  });
  check('nearest refresh threshold, strongest owner and damage credit retained', () => {
    const { field } = setup(), a = owner(), b = owner(), la = ledger(), lb = ledger();
    field.leave(a, 0, 0, 8, la); field.leave(a, 80, 0, 5, la); field.leave(b, 50, 0, 12, lb);
    assert.equal(field.fields.filter(p => p.active).length, 2); assert(field.fields.some(p => p.active && p.x === 0));
    field.leave(a, 52, 0, 2, la); const p = field.fields.find(p => p.active && p.x === 52);
    assert.equal(p.damage, 12); assert.equal(p.owner, b); assert.equal(p.ledger, lb);
    const q = setup().field; q.leave(a, 0, 0, 1, null); q.leave(b, C.radius * .6, 0, 1, null);
    assert.equal(q.fields.filter(p => p.active).length, 1);
    const r = setup().field; r.leave(a, 0, 0, 1, null); r.leave(b, C.radius * .6 + .01, 0, 1, null);
    assert.equal(r.fields.filter(p => p.active).length, 2);
  });
  check('global eight-slot pool recycles oldest; geometry buffers remain bounded', () => {
    const { field } = setup(), o = owner(), buffers = field.fields.map(p => p.cracks);
    for (let i = 0; i < 200; i++) {
      field.advanceTo(i * .001, manager()); field.leave(o, i * 200, 0, 1, null);
      assert(field.fields.filter(p => p.active).length <= C.maxFields);
    }
    assert.equal(field.fields.length, 8); assert(field.fields.every((p, i) => p.cracks === buffers[i]));
    assert(field.fields.some(p => p.x === 39800)); assert(!field.fields.some(p => p.x === 0));
  });
  check('ground-only, radius inclusive, dead/inactive/invalid targets excluded', () => {
    const { field } = setup(), data = [mob(), mob(C.radius), mob(C.radius + .001), mob(0, 0, true), mob(), mob(), mob()];
    data[4].dead = true; data[5].node.activeInHierarchy = false; data[6].node.isValid = false;
    field.leave(owner(), 0, 0, 1, null); field.advanceTo(.5, manager(data));
    assert.deepEqual(data.map(m => m.hits.length), [1, 1, 0, 0, 0, 0, 0]);
  });
  check('pause/repeated/invalid times ignored; no presentation lifetime dependency', () => {
    const { field } = setup(), m = mob(), mgr = manager([m]); field.leave(owner(), 0, 0, 1, null);
    field.advanceTo(.25, mgr); for (const t of [.25, .25, NaN, Infinity, -3]) field.advanceTo(t, mgr);
    assert.equal(field.time, .25); assert.equal(m.hits.length, 0); field.advanceTo(3, mgr); assert.equal(m.hits.length, 6);
  });
  check('owner destruction/inactivation stops fields; battle WeakMap entries are isolated and removed', () => {
    const { battle, field } = setup(), o = owner(), m = mob(); field.leave(o, 0, 0, 1, null); o.destroy();
    field.advanceTo(.5, manager([m])); assert.equal(m.hits.length, 0); assert(!field.fields.some(p => p.active));
    const other = setup(); assert.notEqual(other.field, field); const a = owner(); other.field.leave(a, 0, 0, 1, null);
    a.activeInHierarchy = false; other.field.advanceTo(.5, manager([m])); assert.equal(m.hits.length, 0);
    battle.destroy(); field.advanceTo(2, manager([m])); assert.equal(field.fields.length, 0); assert(!VoltField.battles.has(battle));
  });
  check('destroyed strongest owner leaves independent weaker fields active; merged-slot ownership is explicit', () => {
    const { field } = setup(), a = owner(), b = owner(), m = mob(40), mgr = manager([m]);
    field.leave(a, 0, 0, 10, null); field.leave(b, 80, 0, 5, null); field.advanceTo(.5, mgr);
    assert.equal(m.hits.at(-1).damage, 10); a.destroy(); field.advanceTo(1, mgr);
    assert.equal(m.hits.at(-1).damage, 5); assert.equal(field.fields.filter(p => p.active).length, 1);
    field.render(); const graphics = field.g; assert(graphics.commands.length > 0);
    b.destroy(); assert.equal(graphics.commands.length, 0); assert(!field.fields.some(p => p.active));
    const q = setup().field, strong = owner(), weak = owner();
    q.leave(strong, 0, 0, 10, null); q.leave(weak, 10, 0, 5, null);
    assert.equal(q.fields.filter(p => p.active).length, 1);
    strong.destroy(); assert(!q.fields.some(p => p.active));
    return { independentFootprintFallsBackToWeaker: true, coalescedFootprintOwnedByStrongestContributor: true };
  });
  check('isolated renderer: one paint per frame, fixed nodes/colors/point buffers, small purple marks', () => {
    const { battle, ground, field } = setup(), o = owner();
    for (let i = 0; i < 8; i++) field.leave(o, i * 200, 0, 1, null);
    field.advanceTo(.3, manager()); assert.equal(field.g, null);
    const n = nodes, c = colors, buffers = field.fields.map(p => p.cracks); field.render();
    assert.equal(nodes, n + 1); assert.equal(colors, c); assert.equal(ground.children.length, 1);
    const g = field.g, first = JSON.stringify(g.commands), clears = g.clears;
    field.render(); assert.equal(g.clears, clears); assert.equal(JSON.stringify(g.commands), first);
    let maxCommands = g.commands.length, maxCircleRadius = 0;
    for (let frame = 1; frame <= 240; frame++) {
      field.advanceTo(.3 + frame / 100, manager()); field.render(); maxCommands = Math.max(maxCommands, g.commands.length);
      assert.equal(nodes, n + 1); assert.equal(colors, c); assert(field.fields.every((p, i) => p.cracks === buffers[i]));
      assert(g.commands.length <= 8 * 140);
      for (const cmd of g.commands) {
        if (cmd.name === 'circle') {
          maxCircleRadius = Math.max(maxCircleRadius, cmd.args[2]); assert(cmd.args[2] <= 1.7 + 1e-12);
        }
        if (cmd.name === 'moveTo' || cmd.name === 'lineTo' || cmd.name === 'circle') {
          const localX = cmd.args[0] - Math.round(cmd.args[0] / 200) * 200;
          assert(Math.abs(localX) <= C.radius); assert(Math.abs(cmd.args[1]) <= C.radius * .55);
        }
        if (cmd.color.a > 0) assert(cmd.color.b >= cmd.color.r && cmd.color.r > cmd.color.g, 'palette stays purple, no black mask');
      }
    }
    field.advanceTo(3, manager()); field.render(); assert.equal(g.commands.length, 0);
    battle.destroy(); field.render(); assert.equal(field.g, null);
    metrics.renderer = { sampledFrames: 241, maxCommands, additionalNodes: 1, additionalColorsDuringFrames: 0,
      fieldSlots: 8, floatsPerField: buffers[0].length, largestFilledCircleRadius: maxCircleRadius };
    return metrics.renderer;
  });
  check('invalid deposits ignored', () => {
    const { field } = setup(), o = owner();
    for (const args of [[NaN, 0, 1], [0, Infinity, 1], [0, 0, -1], [0, 0, NaN], [0, 0, 0]]) field.leave(o, ...args, null);
    assert(!field.fields.some(p => p.active));
  });
  check('empty battlefield advances expiry; later enemy receives no banked damage', () => {
    const { field } = setup(), o = owner(); field.leave(o, 0, 0, 1, null);
    field.advanceTo(1.25, manager()); near(field.time, 1.25); near(field.nextPulse, 1.5);
    const m = mob(); field.advanceTo(1.49, manager([m])); assert.equal(m.hits.length, 0);
    field.advanceTo(1.5, manager([m])); assert.equal(m.hits.length, 1);
    field.advanceTo(100, manager()); assert(!field.fields.some(p => p.active));
    field.advanceTo(100.5, manager([m])); assert.equal(m.hits.length, 1);
    field.leave(o, 0, 0, 1, null); field.advanceTo(100.99, manager([m])); assert.equal(m.hits.length, 1);
    field.advanceTo(101, manager([m])); assert.equal(m.hits.length, 2);
  });
  check('flying-only battlefield consumes field lifetime without contacts', () => {
    const { field } = setup(), m = mob(0, 0, true); field.leave(owner(), 0, 0, 1, null);
    field.advanceTo(3, manager([m])); assert.equal(m.hits.length, 0); assert(!field.fields.some(p => p.active));
  });
  check('late second owner uses shared absolute time; no new clock/extra pulse after quiet interval', () => {
    const { battle, field } = setup(), o = owner(), m = mob(40), mgr = manager([m]);
    field.advanceTo(40, manager()); field.leave(o, 0, 0, 1, null);
    const second = VoltField.forBattle(battle, 40.2); assert.equal(second, field);
    second.advanceTo(40.2, mgr); second.leave(owner(), 80, 0, 3, null);
    field.advanceTo(40.5, mgr); second.advanceTo(40.5, mgr);
    assert.equal(m.hits.length, 1); assert.equal(m.hits[0].damage, 3);
    for (let i = 0; i < 20; i++) field.leave(o, 0, 0, 1, null); assert.equal(o.events.length, 1);
  });

  // Extract only the actual touched queue/strike methods and pure helpers, never the Hero module.
  const helperNames = ['abilityDamage', 'voltUltCfg', 'voltShockDuration', 'voltShockedMultiplier',
    'voltShockAmp', 'voltStrikeCount', 'voltStrikeTime'];
  const helperText = 'const ABILITY_ATTACK_RATIO = ' + initializer(cardsAst, 'ABILITY_ATTACK_RATIO') + ';\n' +
    helperNames.map(name => declaration(cardsAst, name).getText(cardsAst)).join('\n');
  const helpers = evaluate(helperText, 'extracted-volt-arithmetic.ts');
  const timingLiteral = ts.createSourceFile('timing.ts', 'const T=' + initializer(timingAst, 'ULT_TIMING'), ts.ScriptTarget.Latest, true);
  const timingObject = timingLiteral.statements[0].declarationList.declarations[0].initializer;
  const voltInitializer = timingObject.properties.find(p => p.name.getText(timingLiteral) === 'volt').initializer.getText(timingLiteral);
  const timing = evaluate('export const ULT_TIMING = {volt:' + voltInitializer + '};', 'extracted-volt-timing.ts').ULT_TIMING;
  const selected = ['ultimateRemaining', 'ultShowDuration', 'updateQueues', 'thunderStrike', 'castUlt', 'renderEffects'];
  const extracted = selected.map(name => member(heroAst, 'VoltHero', name)).join('\n');
  const signals = { soundCalls: 0, events: 0, parentRenders: 0 };
  class DataBase {
    get ultReady() { return this.ready; }
    abilityDamage(mul, ultimate, attackMul) { return helpers.abilityDamage(this.stats, mul, ultimate, attackMul); }
    beginUltimate() { this.ultimateT = this.ultShowDuration; }
    animateAttack() {} ultimateBeat() {}
    renderEffects() { signals.parentRenders++; }
  }
  const isolatedMath = Object.create(Math); isolatedMath.random = () => 0;
  const { QueueFixture } = evaluate('export class QueueFixture extends DataBase {\n' + extracted + '\n}',
    'extracted-volt-methods.ts', {}, { ...helpers, DataBase, Math: isolatedMath, VoltField, VOLT_FIELD: C,
      ULT_TIMING: timing, SPAWN_Y: 717, HERO_Y: -545,
      Sfx: { ultimateImpact() { signals.soundCalls++; } },
      bus: { emit() { signals.events++; } }, EVT: { CHARGE_CHANGED: 'charge', HIT_STOP: 'hitstop' } });
  function heroFixture(selectedCard = true, bonus = 0) {
    const { battle, ground } = setup(), layer = new Node('HeroLayer'); layer.setParent(battle);
    const h = new QueueFixture(), node = owner(); node.setParent(layer);
    Object.assign(h, { node, id: 'volt', x: 0, ready: true, charge: 65, ultimateT: 0,
      strikeQueue: [], voltFieldTime: 0, voltFields: null, lastDmg: ledger(),
      stats: { voltField: selectedCard, voltStrikeBonus: bonus, ultLv: 1, atk: 100, atkMul: 1,
        skillDmg: 200, skillMul: 1, ultDmgMul: 1, ultStun: 0, shockOnHit: 0 } });
    const strikes = [], projs = { voltThunder(...args) { strikes.push({ time: h.voltFieldTime, args }); } };
    const step = (dt, mgr) => { h.ultimateT = Math.max(0, h.ultimateT - dt); h.updateQueues(dt, mgr, projs); };
    return { h, battle, ground, projs, strikes, step };
  }
  check('actual 15/25-strike schedules: no birth bursts; residue outlives queue and presentation by remaining 3s', () => {
    const rows = [];
    for (const count of [15, 25]) {
      const { h, projs, strikes, step } = heroFixture(true, count - 15), m = mob(), mgr = manager([m]);
      assert(h.castUlt(mgr, projs, h.lastDmg)); assert.equal(h.strikeQueue.length, count);
      near(h.strikeQueue.at(-1).t, helpers.voltStrikeTime(count - 1));
      const duration = h.ultShowDuration; let afterPresentation = false;
      for (let frame = 1; frame <= Math.ceil((duration + 3.1) * 120); frame++) {
        step(1 / 120, mgr);
        if (h.voltFieldTime > duration + .02 && h.voltFieldTime < duration + .05) {
          assert.equal(h.strikeQueue.length, 0); assert.equal(h.ultimateRemaining, 0);
          assert(h.voltFields.fields.some(p => p.active)); afterPresentation = true;
        }
      }
      assert(afterPresentation); assert.equal(strikes.length, count); assert(!h.voltFields.fields.some(p => p.active));
      const lastStrike = strikes.at(-1).time;
      rows.push({ count, plannedLastStrike: helpers.voltStrikeTime(count - 1), actualLastStrike: lastStrike,
        presentationDuration: duration, expectedFieldExpiry: lastStrike + C.duration });
    }
    metrics.ultimateSchedules = rows; return rows;
  });
  check('actual lethal thunder leaves ground residue; dead queued references skip without phantom refresh', () => {
    const { h, projs, strikes, step } = heroFixture(), target = mob(0, 0, false, 1), mgr = manager([target]);
    assert(h.castUlt(mgr, projs, h.lastDmg)); step(.65, mgr);
    assert(target.dead); assert.equal(strikes.length, 1); assert(h.voltFields.fields.some(p => p.active));
    const expiry = h.voltFields.fields.find(p => p.active).expires; near(expiry, .65 + C.duration);
    mgr.list.length = 0; step(1, mgr); assert(h.voltFields.fields.some(p => p.active));
    step(2.01, mgr); assert(!h.voltFields.fields.some(p => p.active));
    step(1, mgr); assert.equal(h.strikeQueue.length, 0); assert.equal(strikes.length, 1); assert.equal(h.ultimateRemaining, 0);
    return { firstStrike: .65, lastRefreshExpiry: expiry, actualStrikes: strikes.length, skippedDeadQueueEntries: 14 };
  });
  check('residual pulse kills queued target before strike; no recursive field or thunder', () => {
    const { h, battle, projs, strikes, step } = heroFixture(), m = mob(0, 0, false, 1), mgr = manager([m]);
    h.voltFields = VoltField.forBattle(battle, 0); h.voltFields.leave(h.node, 0, 0, 100, h.lastDmg);
    h.strikeQueue.push({ t: .5, target: m, index: 0 }); step(.5, mgr);
    assert(m.dead); assert.equal(m.hits.length, 1); assert.equal(strikes.length, 0); assert.equal(h.strikeQueue.length, 0);
    near(h.voltFields.fields.find(p => p.active).expires, 3); near(h.lastDmg.total, 1);
  });
  check('dead queued target retargets surviving body; airborne impact projects field to groundY', () => {
    const { h, projs, strikes, step } = heroFixture(), dead = mob(), air = mob(20, 90, true);
    dead.dead = true; h.strikeQueue.push({ t: .1, target: dead, index: 0 }); step(.1, manager([dead, air]));
    assert.equal(strikes.length, 1); assert.equal(strikes[0].args[1], air.hitY);
    const p = h.voltFields.fields.find(p => p.active); assert.equal(p.x, air.x); assert.equal(p.y, air.groundY);
    const before = air.hits.length; step(.5, manager([air])); assert.equal(air.hits.length, before);
    void projs;
  });
  check('no-card strike keeps original damage/control/timing and creates no field; render composes parent', () => {
    const { h, projs, step } = heroFixture(false), m = mob(), mgr = manager([m]);
    assert(h.castUlt(mgr, projs, h.lastDmg)); near(h.ultShowDuration, 4.5); step(.65, mgr);
    assert.equal(m.hits.length, 1); near(m.hits[0].damage, helpers.abilityDamage(h.stats, helpers.voltUltCfg(1).boltMul, true));
    assert.equal(h.voltFields, null); assert.equal(m.stunT, 0);
    const before = signals.parentRenders; h.renderEffects(); assert.equal(signals.parentRenders, before + 1);
  });
  check('static integration: running empty battlefield still ticks; residual never extends victory/presentation lock', () => {
    const directorAst = ast('assets/scripts/battle/BattleDirector.ts');
    const update = member(directorAst, 'BattleDirector', 'update');
    const active = member(directorAst, 'BattleDirector', 'ultimateActive');
    const cleared = member(directorAst, 'BattleDirector', 'onAllCleared');
    const baseTick = member(heroAst, 'HeroBase', 'tick');
    const queues = member(heroAst, 'VoltHero', 'updateQueues'), strike = member(heroAst, 'VoltHero', 'thunderStrike');
    assert(update.includes('for (const h of this.heroes) h.tick(sub, this.mgr, this.projs, this.dmgSvc)'));
    assert(update.indexOf("this.state !== 'running'") < update.indexOf('h.tick(sub'));
    assert(baseTick.indexOf('this.updateQueues(dt, mgr, projs)') < baseTick.indexOf('this.selectNormalTarget(mgr)'));
    assert(queues.indexOf('advanceTo') < queues.indexOf('for (let i = this.strikeQueue'));
    assert(strike.indexOf('fields.leave') < strike.indexOf('o.takeDamage'));
    assert(strike.includes('this.stats.voltField === true')); assert(strike.includes('this.abilityDamage(VOLT_FIELD.mul, true)'));
    assert(!active.includes('voltField')); assert(!member(heroAst, 'VoltHero', 'ultimateRemaining').includes('voltField'));
    assert(cleared.includes('this.pendingWin = true')); assert(!cleared.includes("this.state = 'win'"));
    const fieldSource = source('assets/scripts/battle/VoltField.ts');
    for (const forbidden of ['Math.random', 'Date.now', 'setTimeout', 'setInterval', 'applyShock', 'tryOverload', 'stunT', 'Sfx'])
      assert(!fieldSource.includes(forbidden), forbidden);
    const meta = JSON.parse(source('assets/scripts/battle/VoltField.ts.meta')); assert.equal(meta.importer, 'typescript');
    return { emptyRunningBattleTicks: true, pendingVictoryKeepsRunning: true,
      pausedPickWinLoseStopBattleClock: true, residualExtendsUltimateOrVictoryGate: false };
  });
  metrics.extractedMethods = selected;
  metrics.extractedMethodsSha256 = sha(extracted);
  metrics.cocosAudioModulesImported = 0;
  metrics.stubOnlySignals = signals;
} catch (error) {
  checks.push({ name: 'test harness setup', passed: false, error: error.stack || String(error) });
}

check('all reviewed production sources remain byte-identical during checks', () => {
  for (const file of tracked) assert.equal(sha(fs.readFileSync(path.join(root, file))), sourceHashes[file], file);
});
const report = {
  passed: checks.every(c => c.passed), checkedAt: new Date().toISOString(),
  command: 'node docs/wind-ninja-v120/check_volt_field.cjs',
  testScriptSha256: sha(fs.readFileSync(__filename)), sourceHashes,
  nodeVersion: process.version, typescriptVersion: ts?.version || null, typescriptPath: tsPath || null,
  isolation: { gameRuntime: false, cocosEngine: false, browser: false, realCombat: false,
    audio: false, wasm: false, network: false, build: false, git: false,
    methodExtraction: 'Only named VoltHero methods, pure Cards arithmetic and Volt timing; all collaborators are inert data doubles.',
    renderer: 'Graphics command recorder; verifies geometry/palette budgets, not GPU appearance or phone performance.' },
  lifecycleReview: {
    battleKey: 'WeakMap<Node, VoltField> keyed by battle Field; explicitly deleted on battle NODE_DESTROYED.',
    clock: 'advanceTo takes absolute accumulated hero battle time. Equal/older timestamps are ignored, so same-start heroes cannot double-advance.',
    emptyBattlefield: 'While running, HeroBase invokes updateQueues even without targets. advanceTo ages/prunes fields with an empty list and consumes pulse boundaries without banking contacts.',
    idleGap: 'The next leave after all fields expire resets the next pulse to current battle time + .5; long empty gaps never replay historical pulses.',
    owner: 'Fields require a valid active owner. Nearby refresh coalesces one footprint and retains strongest damage/credit; destruction of that retained owner releases the coalesced slot.',
    ultimateDeath: 'Field creation precedes direct lethal damage; dead queued targets retarget or skip. A residual kill before a queued strike cannot create another field.',
    terminalState: 'Pause/pick/win/lose stop simulation. Residual continues past strike queue/presentation only while running and does not delay victory; remaining visuals may freeze at win until battle teardown.',
    assumption: 'All roster heroes start the same battle clock and receive the same battle dt. Dynamically inserting a hero with a zero clock mid-battle is not implemented or claimed.',
  },
  metrics, checkCount: checks.length, failures: checks.filter(c => !c.passed).length, checks,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, checks: report.checkCount, failures: report.failures, report: reportPath }));
for (const failed of checks.filter(c => !c.passed)) console.error(failed.name + '\n' + failed.error);
process.exitCode = report.passed ? 0 : 1;
