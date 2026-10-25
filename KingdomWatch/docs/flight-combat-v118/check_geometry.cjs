/* Pure geometry/layer checks. Never import Monster, Hero, cc, or any game runtime. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const project = path.resolve(__dirname, '../..');
function dependency(name, candidates) {
  for (const candidate of [name, ...candidates]) { try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; } }
  throw Error('Missing dependency: ' + name);
}
const ts = dependency('typescript', [process.env.KW_TYPESCRIPT,
  'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript',
  'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript'].filter(Boolean));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const relative = file => path.relative(project, file).replace(/\\/g, '/');
const PURE = ['assets/scripts/config/Targeting.ts', 'assets/scripts/battle/FlightPresentation.ts', 'assets/scripts/battle/SiphonLaser.ts'];
const QUERY_NAMES = ['pickTarget', 'anyInRange', 'nearest', 'highestHp', 'highestHpInRange',
  'nearestToLineInRange', 'mobsInRadius', 'densestArea', 'hasHealingTarget'];
function context() {
  const texts = new Map(), modules = new Map(), extracted = {};
  function read(file) { if (!texts.has(file)) texts.set(file, fs.readFileSync(path.join(project, file), 'utf8')); return texts.get(file); }
  function ast(file) { return ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true); }
  function transpile(text, filename) {
    const result = ts.transpileModule(text, { fileName: filename, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
    assert.equal(result.diagnostics.length, 0, 'Transpile diagnostics: ' + filename);
    return result.outputText;
  }
  function pure(file) {
    assert(PURE.includes(file), 'Module execution denied: ' + file);
    if (modules.has(file)) return modules.get(file);
    const module = { exports: {} }; modules.set(file, module.exports);
    const restrictedRequire = specifier => {
      assert(specifier.startsWith('.'), 'External import denied: ' + specifier);
      const resolved = relative(path.resolve(project, path.dirname(file), specifier + '.ts'));
      return pure(resolved);
    };
    new vm.Script(transpile(read(file), file), { filename: file }).runInNewContext({ module, exports: module.exports, require: restrictedRequire }, { timeout: 1000 });
    modules.set(file, module.exports); return module.exports;
  }
  function member(file, owner, name) {
    const tree = ast(file);
    const declaration = tree.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === owner);
    assert(declaration, 'Missing class: ' + owner);
    const result = declaration.members.find(n => n.name?.getText(tree) === name);
    assert(result, 'Missing method: ' + owner + '.' + name);
    return { tree, node: result, text: result.getText(tree) };
  }
  function initializer(file, name) {
    const tree = ast(file);
    for (const statement of tree.statements) if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (declaration.name.getText(tree) === name) return { tree, node: declaration.initializer };
    throw Error('Missing literal: ' + name);
  }
  function literal(node) {
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression(node)) return literal(node.expression);
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isStringLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -literal(node.operand);
    throw Error('Expected a source literal, received ' + ts.SyntaxKind[node.kind]);
  }
  function mob(id) {
    const { node } = initializer('assets/scripts/config/ChapterContent.ts', 'EXPANSION_MOBS');
    const property = node.properties.find(p => p.name && literal(p.name) === id);
    assert(property, 'Missing mob definition: ' + id);
    const out = {};
    for (const p of property.initializer.properties) {
      const name = p.name && (ts.isIdentifier(p.name) ? p.name.text : literal(p.name));
      if (['id', 'radius', 'speed', 'airborne', 'artAtlas'].includes(name)) out[name] = literal(p.initializer);
    }
    return out;
  }
  const targeting = pure(PURE[0]), flight = pure(PURE[1]), laser = pure(PURE[2]);
  const LINE_Y = literal(initializer('assets/scripts/config/GameConfig.ts', 'LINE_Y').node);
  const HERO_Y = literal(initializer('assets/scripts/config/GameConfig.ts', 'HERO_Y').node);
  const MOB_ART_HEIGHT = literal(initializer('assets/scripts/battle/Monster.ts', 'MOB_ART_HEIGHT').node);
  const queryMethods = QUERY_NAMES.map(name => {
    const value = member('assets/scripts/battle/Monster.ts', 'MonsterManager', name).text;
    extracted['MonsterManager.' + name] = sha(value); return value;
  }).join('\n');
  const queryModule = { exports: {} };
  new vm.Script(transpile('class PureQueries { constructor(public list: any[]) {}\n' + queryMethods + '\n}\nexports.PureQueries = PureQueries;', 'extracted-queries.ts'))
    .runInNewContext({ exports: queryModule.exports, acceptsTarget: targeting.acceptsTarget, LINE_Y });
  const heroTree = ast('assets/scripts/battle/Hero.ts');
  const hero = heroTree.statements.find(n => ts.isClassDeclaration(n) && n.members.some(m => m.name?.getText(heroTree) === 'lead'));
  assert(hero, 'No Hero.lead declaration');
  const lead = hero.members.find(n => n.name?.getText(heroTree) === 'lead').getText(heroTree);
  extracted['Hero.lead'] = sha(lead);
  const leadModule = { exports: {} };
  new vm.Script(transpile('class PureLead { constructor(public x: number) {}\n' + lead + '\n}\nexports.PureLead = PureLead;', 'extracted-lead.ts'))
    .runInNewContext({ exports: leadModule.exports, HERO_Y });
  const getters = {};
  for (const name of ['hitY', 'artBaseY', 'groundY']) {
    const value = member('assets/scripts/battle/Monster.ts', 'Monster', name);
    const expression = value.node.body.statements.find(ts.isReturnStatement).expression.getText(value.tree);
    extracted['Monster.' + name] = sha(value.text);
    getters[name] = new vm.Script('(function(){ return ' + expression + '; })').runInNewContext({ MOB_ART_HEIGHT });
  }
  return { read, ast, member, literal, initializer, mob, targeting, flight, laser, getters,
    PureQueries: queryModule.exports.PureQueries, PureLead: leadModule.exports.PureLead,
    LINE_Y, HERO_Y, MOB_ART_HEIGHT, modules, texts, extracted };
}
function run() {
  const c = context(), { targeting: T, flight: F, laser: L, PureQueries: Queries } = c;
  const cases = [];
  const names = list => Array.from(list, m => m.name).sort();
  const make = (name, x, y, lift = 0, extra = {}) => ({ name, x, y, hitY: y + lift, hp: 50, maxHp: 100, dead: false,
    supportHealT: 0, state: 'move', immobilized: false, slowT: 0, slowAmp: 0,
    def: { airborne: lift > 0, radius: 18, speed: 36, kind: 'melee' }, ...extra });
  const near = (a, b, epsilon = 1e-8) => assert(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
  function test(name, action) {
    try { cases.push({ name, passed: true, observations: action() }); }
    catch (error) { cases.push({ name, passed: false, error: error.stack }); }
  }
  test('Sky-only lists cannot be acquired by ground attacks through any actual manager query', () => {
    const sky = make('sky', 0, 0, 72), q = new Queries([sky]);
    assert.equal(q.anyInRange(0, 72, 200, 'ground'), false);
    for (const method of ['pickTarget', 'highestHpInRange', 'nearestToLineInRange']) assert.equal(q[method](0, 72, 200, 'ground'), null);
    assert.equal(q.nearest(0, 72, 200, 'ground'), null); assert.equal(q.highestHp('ground'), null);
    assert.deepEqual(names(q.mobsInRadius(0, 72, 200, 'ground')), []);
    assert.equal(q.densestArea(0, 72, 200, 20, 'ground'), null);
    assert.equal(q.pickTarget(0, 72, 1, 'air'), sky);
    return { groundQueries: 8, airControlAcquires: true };
  });
  test('Cannon shell and frost skill policies differ from missiles and ordinary frost attacks', () => {
    const q = new Queries([make('sky', 0, 0, 72)]), acquired = (hero, slot) => q.anyInRange(0, 72, 1, T.attackLayer(hero, slot));
    assert.equal(acquired('cannon', 'atk'), false); assert.equal(acquired('cannon', 'skill'), false);
    assert.equal(acquired('cannon', 'ult'), true); assert.equal(acquired('mora', 'skill'), false);
    assert.equal(acquired('mora', 'atk'), true); assert.equal(acquired('mora', 'ult'), true);
    return { cannonGroundShells: true, missileAcquiresSky: true, frostSkillGroundOnly: true, frostAttackAndUltimateAcquireSky: true };
  });
  test('Dead high-HP bodies do not win acquisition; ground and air health selection stay separate', () => {
    const ground = make('ground', 0, 72, 0, { hp: 30 }), sky = make('sky', 0, 0, 72, { hp: 90 });
    const dead = make('dead', 0, 72, 0, { dead: true, hp: 9999 }), q = new Queries([dead, sky, ground]);
    assert.equal(q.highestHp(), sky); assert.equal(q.highestHp('ground'), ground);
    assert.equal(T.acceptsTarget(dead, 'all'), false); assert.equal(T.targetY({ y: 50, hitY: 0 }), 0);
    assert.equal(T.targetY({ y: 50 }), 50);
    return { allHighest: sky.name, groundHighest: ground.name, explicitZeroHitYRetained: true };
  });
  test('Body-space splash can join different footprints while footprint-space excludes a raised body elsewhere', () => {
    const sky = make('sky', 0, 0, 72), upper = make('upperGround', 0, 72), lower = make('lowerGround', 0, 0);
    const q = new Queries([sky, upper, lower]);
    assert.deepEqual(names(q.mobsInRadius(0, 72, 1)), ['sky', 'upperGround']);
    assert.deepEqual(names(q.mobsInRadius(0, 72, 1, 'ground')), ['upperGround']);
    assert.deepEqual(names(q.mobsInRadius(0, 0, 1, 'all', false)), ['lowerGround', 'sky']);
    assert.deepEqual(names(q.mobsInRadius(0, 0, 1)), ['lowerGround']);
    return { skyBodyY: sky.hitY, skyFootprintY: sky.y, upperSplash: names(q.mobsInRadius(0, 72, 1)) };
  });
  test('Radius boundary is inclusive and an epsilon outside misses, using visible body coordinates', () => {
    const sky = make('sky', 3, -68, 72), q = new Queries([sky]);
    assert.equal(q.anyInRange(0, 0, 5), true); assert.equal(q.anyInRange(0, 0, 5 - 1e-5), false);
    assert.deepEqual(names(q.mobsInRadius(0, 0, 5)), ['sky']); assert.deepEqual(names(q.mobsInRadius(0, 0, 5 - 1e-5)), []);
    return { offset: [3, 4], inclusiveRadius: 5 };
  });
  test('Dense sky cloud cannot steal a ground-only cast from a smaller ground group', () => {
    const ground = [make('g0', -110, 0), make('g1', -100, 0)];
    const sky = Array.from({ length: 5 }, (_, i) => make('a' + i, 148 + i, 0, 72));
    const q = new Queries([...sky, ...ground]), g = q.densestArea(0, 0, 300, 12, 'ground'), all = q.densestArea(0, 0, 300, 12);
    assert(g && g.x < 0); assert.equal(q.mobsInRadius(g.x, g.y, 12, 'ground').length, 2);
    assert(all && all.x > 0); assert.equal(q.mobsInRadius(all.x, all.y, 12).length, 5);
    return { groundCast: g, unrestrictedCast: all };
  });
  test('Sky cluster centroid refinement compares visible Y against visible Y', () => {
    const q = new Queries([make('a', -8, -4, 72), make('b', 8, -4, 72), make('c', 0, 8, 72)]);
    const point = q.densestArea(0, 72, 100, 20, 'air');
    near(point.x, 0); near(point.y, 72);
    return { centroid: point, allFootprintsNearZero: true };
  });
  test('Healing read-only eligibility and bodySpace=false use footprint radius without healing execution', () => {
    const healer = make('healer', 0, 0, 0, { def: { kind: 'heal', radius: 18 } });
    const sky = make('woundedSky', 0, 5, 72), q = new Queries([healer, sky]);
    assert.equal(q.hasHealingTarget(healer, 10), true);
    assert.deepEqual(names(q.mobsInRadius(0, 0, 10, 'all', false)), ['healer', 'woundedSky']);
    assert.deepEqual(names(q.mobsInRadius(0, 0, 10)), ['healer']);
    sky.supportHealT = 1; assert.equal(q.hasHealingTarget(healer, 10), false);
    const method = c.member('assets/scripts/battle/Monster.ts', 'MonsterManager', 'healAround').text;
    assert(/mobsInRadius\(src\.x, src\.y, spec\.radius, 'all', false\)/.test(method));
    return { healAroundBodySpaceFalseAudited: true, healingOrDamageExecuted: false };
  });
  test('Closest-to-line priority uses logical Y while acquisition range uses visible body Y', () => {
    const sky = make('nearFootprintSky', 0, c.LINE_Y + 20, 72), ground = make('fartherFootprintGround', 0, c.LINE_Y + 40);
    const q = new Queries([ground, sky]);
    assert(sky.hitY > ground.hitY);
    assert.equal(q.nearestToLineInRange(0, c.LINE_Y, 200), sky); assert.equal(q.pickTarget(0, c.LINE_Y, 200), sky);
    assert.equal(q.nearestToLineInRange(0, c.LINE_Y, 50), ground);
    return { wideRangePriority: sky.name, narrowBodyRangePriority: ground.name, LINE_Y: c.LINE_Y };
  });
  test('Ground acquisition and low-HP tie break retain original semantics', () => {
    const healthy = make('healthy', 0, 20, 0, { hp: 80 }), wounded = make('wounded', 0, 20, 0, { hp: 10 });
    const q = new Queries([healthy, wounded]);
    assert.equal(q.pickTarget(0, 0, 50), wounded); assert.equal(q.nearest(0, 0, 50, 'ground'), healthy);
    return { pickTarget: wounded.name, equalDistanceNearestRetainsFirst: true };
  });
  test('Actual Hero.lead intercepts elevated moving/slow/frozen/holding bodies without combat simulation', () => {
    const shooter = new c.PureLead(-45), py = c.HERO_Y + 60;
    const samples = [];
    for (const x of [-180, 120]) for (const mode of ['moving', 'slow', 'frozen', 'holding']) {
      const target = make('target', x, -100, 72);
      if (mode === 'slow') { target.slowT = 1; target.slowAmp = .5; }
      if (mode === 'frozen') target.immobilized = true;
      if (mode === 'holding') target.state = 'hold';
      const speed = 700, direction = shooter.lead(target, speed);
      const t = (target.x - shooter.x) / (speed * direction.dirX);
      const v = mode === 'frozen' || mode === 'holding' ? 0 : target.def.speed * (mode === 'slow' ? .5 : 1);
      assert(t > 0); near(Math.hypot(direction.dirX, direction.dirY), 1);
      near(py + direction.dirY * speed * t, target.hitY - v * t);
      assert(Math.abs(py + direction.dirY * speed * t - (target.y - v * t)) > 60);
      samples.push({ x, mode, flightSeconds: t });
    }
    return { independentInterceptResidualBelow: 1e-8, samples };
  });
  test('Laser aim chooses a raised diagonal cluster and rejects a body beyond viewport even if its footprint is visible', () => {
    const bounds = { left: -375, right: 375, top: 500 };
    const bodies = [make('air1', 100, 28, 72), make('air2', 200, 128, 72), make('ground', 0, 300)];
    const angle = L.bestLaserAngle(0, 0, 3, bodies, bounds); near(angle, Math.PI / 4);
    assert.equal(L.bestLaserAngle(0, 0, 3, [make('above', 0, 480, 72)], bounds), null);
    assert.notEqual(L.bestLaserAngle(0, 0, 3, [make('lowFootprint', 0, 0, 72)], bounds), null);
    return { selectedAngle: angle, raisedAimUsesBodyVisibility: true };
  });
  test('Bounded laser capsule and render overscan stay independent of damage geometry', () => {
    const bounds = { left: -100, right: 100, top: 100 }, angle = Math.PI / 2;
    near(L.laserLength(0, 0, angle, bounds), 100); near(L.laserLength(0, 0, angle, bounds, 40), 140);
    assert.equal(L.laserLength(0, 0, -Math.PI / 2, bounds), 0);
    assert.equal(L.laserTouches(0, 0, angle, 100, 5, 8, 50, 3), true);
    assert.equal(L.laserTouches(0, 0, angle, 100, 5, 8.001, 50, 3), false);
    assert.equal(L.laserTouches(0, 0, angle, 100, 5, 0, 109, 3), false);
    near(L.laserExposure(0, 10, .6, 3), 3); near(L.turnLaser(0, 1, .1), .045);
    return { renderedLength: 140, collisionLength: 100, exposureSeconds: 3 };
  });
  test('Cached hit anchor, atlas ground offsets and death projection preserve the logical footprint', () => {
    const manifest = JSON.parse(c.read('assets/resources/ux/forest_mob_walk_v87.frames.json'));
    let samples = 0;
    for (const id of ['forest_eagle', 'forest_bat', 'forest_wasp']) {
      const def = c.mob(id), height = def.radius * c.MOB_ART_HEIGHT;
      let min = Infinity, max = -Infinity;
      for (let i = 0; i <= 600; i++) {
        const clock = i / 60, lift = F.flightLiftFor(true, id, def.radius, clock);
        const actor = { y: -173, def, artHeight: height, groundOffset: manifest.ground[id].offset, flightLift: lift };
        const base = c.getters.artBaseY.call(actor), ground = c.getters.groundY.call(actor);
        near(c.getters.hitY.call(actor), actor.y + lift);
        near(actor.y + base + height * actor.groundOffset - lift, ground);
        const stationary = F.flightLiftFor(true, id, def.radius, clock); assert.equal(lift, stationary);
        actor.flightLift = 0; near(c.getters.groundY.call(actor), ground); near(c.getters.hitY.call(actor), actor.y);
        assert.equal(F.flightLiftFor(false, id, def.radius, clock), 0);
        min = Math.min(min, lift); max = Math.max(max, lift); samples++;
      }
      assert(max - min > 9.9 && max - min <= 10.00001);
    }
    const hit = c.member('assets/scripts/battle/Monster.ts', 'Monster', 'hitY').text;
    assert(!/sin|cos|flightLiftFor/.test(hit));
    assert(c.member('assets/scripts/battle/Monster.ts', 'Monster', 'drawIceFeet').text.includes('if (this.def.airborne) return;'));
    assert(c.member('assets/scripts/battle/Monster.ts', 'Monster', 'drawHunterMark').text.includes('this.artBaseY'));
    assert(c.member('assets/scripts/battle/Monster.ts', 'Monster', 'die').text.includes('queueBurnBurst(this.x, this.hitY'));
    const death = c.member('assets/scripts/battle/MonsterDeath.ts', 'MonsterDeath', 'begin').text;
    assert(death.includes('this.footY = bodyFootY - flightLift;'));
    assert(death.includes('this.bodyY = bodyFootY + this.height * 0.36;'));
    assert(F.flightLiftFor(true, 'generic_air', 40, 0) - F.flightLiftFor(true, 'generic_air', 10, 0) > 20);
    return { samples, unchangedClockKeepsHoverStill: true, realAtlasOffsets: true, elevatedDeathOriginAndGroundShadow: true };
  });
  test('Actual depth comparator layers flyers above ground with stable footprint depth and spawn ties', () => {
    const method = c.member('assets/scripts/battle/Monster.ts', 'MonsterManager', 'sortDepth');
    let comparator;
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(method.tree) === 'this.depthOrder.sort') comparator = node.arguments[0];
      ts.forEachChild(node, visit);
    }
    visit(method.node); assert(comparator);
    const code = comparator.getText(method.tree);
    c.extracted['MonsterManager.sortDepth.comparator'] = sha(code);
    const out = {};
    // The empty class is only an instanceof tag for plain geometry records.
    class DepthActorMarker {}
    const compiled = ts.transpileModule('exports.compare = ' + code, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    new vm.Script(compiled).runInNewContext({ exports: out, Monster: DepthActorMarker });
    const actor = (name, airborne, depthY, lifeId) => Object.assign(new DepthActorMarker(), { name, def: { airborne }, depthY, lifeId });
    const actors = [actor('airNear', true, -10, 8), actor('groundNear', false, -200, 4),
      actor('airFarOlder', true, 90, 2), actor('groundFar', false, 50, 1),
      actor('airFarNewer', true, 90, 5), { name: 'ice', depthY: 30 }];
    const expected = ['groundFar', 'ice', 'groundNear', 'airFarOlder', 'airFarNewer', 'airNear'];
    for (let i = 0; i < actors.length; i++) {
      const rotated = actors.slice(i).concat(actors.slice(0, i));
      assert.deepEqual(Array.from(rotated.sort(out.compare), actor => actor.name), expected);
      assert.deepEqual(Array.from(rotated.reverse().sort(out.compare), actor => actor.name), expected);
    }
    return { inputPermutations: actors.length * 2, expectedBackToFront: expected, noActorModuleInstantiated: true };
  });
  const sourceHashes = Object.fromEntries([...c.texts].map(([file, text]) => [file, sha(text)]));
  const changedDuringRun = [...c.texts].filter(([file, text]) => sha(fs.readFileSync(path.join(project, file))) !== sha(text)).map(([file]) => file);
  const reportPath = path.join(__dirname, 'geometry-check.json');
  const previous = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : {};
  const result = { generatedAt: new Date().toISOString(), passed: cases.every(item => item.passed) && !changedDuringRun.length,
    caseCount: cases.length, cases, sourceHashes, extractedMethodHashes: c.extracted,
    executedSourceModules: [...c.modules.keys()], typescriptVersion: ts.version,
    isolatedReview: true, gameplay: false, damageOrHealingSimulation: false,
    gameOrBrowserAudioWasmStarted: false, sourceFilesWritten: false,
    sourceSnapshotChangedDuringRun: changedDuringRun,
    limitations: ['Methods are AST-extracted pure queries and lead math; no Monster/Hero module or engine executes.',
      'No damage, healing mutation, combat, gameplay rendering, browser, audio or WASM is exercised.',
      'LINE_Y/HERO_Y are source default design anchors; dynamic device layout is not initialized.'],
    ...(previous.visualReview ? { visualReview: previous.visualReview } : {}) };
  result.checkScriptSha256 = sha(fs.readFileSync(__filename));
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, cases: cases.length, failed: cases.filter(item => !item.passed).map(item => ({ name: item.name, error: item.error })), report: relative(reportPath), executedSourceModules: result.executedSourceModules }, null, 2));
  if (!result.passed || result.sourceSnapshotChangedDuringRun.length) process.exitCode = 1;
  return result;
}
module.exports = { context, project, sha, dependency, relative, run };
if (require.main === module) run();
