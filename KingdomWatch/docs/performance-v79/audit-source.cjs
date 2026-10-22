// Static source inspection only: never import, evaluate or simulate game modules.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ts = require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript');
const root = path.resolve(__dirname, '../..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const source = name => path.join(root, 'assets/scripts/battle', name + '.ts');
const before = name => path.join(__dirname, 'before/assets/scripts/battle', name + '.ts');
const methods = filename => {
  const text = fs.readFileSync(filename, 'utf8');
  const tree = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  if (tree.parseDiagnostics.length) throw Error('Parse diagnostics: ' + filename);
  const result = new Map();
  const printer = ts.createPrinter({ removeComments: true });
  for (const c of tree.statements) if (ts.isClassDeclaration(c)) {
    for (const m of c.members) if (m.body && m.name) {
      const key = c.name.text + '.' + m.name.getText(tree);
      result.set(key, printer.printNode(ts.EmitHint.Unspecified, m.body, tree));
    }
  }
  return result;
};
const allowed = {
  ArcherVFX: ['part', 'paint', 'beginProjectileFrame', 'endProjectileFrame', 'projectile', 'greenWind', 'ribbon'],
  BasicProjectileFlightVFX: ['wake', 'wind'],
  BattleDirector: ['update'],
  FireVFX: ['beginProjectileFrame', 'endProjectileFrame', 'projectile', 'part', 'hit', 'hitClip', 'syncBurns', 'blast', 'drawFrame'],
  FloatText: ['spawn'],
  FrostProjectileVFX: ['beginProjectileFrame', 'endProjectileFrame', 'projectile', 'ribbon'],
  Hero: ['queuedShotDelay'],
  ImpactFX: ['endProjectileFrame'],
  Monster: ['tick', 'drawPresentation', 'sortDepth'],
  Particles: ['burst', 'tick'],
  Projectile: ['tick', 'advanceReturning', 'hitSweep', 'render'],
  SniperUltimateVFX: ['beginFrame', 'endFrame', 'projectile'],
};
const changedMethods = {}, unchangedMethods = [];
for (const [name, whitelist] of Object.entries(allowed)) {
  const prev = methods(before(name)), next = methods(source(name));
  changedMethods[name] = [];
  for (const [key, body] of next) {
    if (prev.get(key) === body) { unchangedMethods.push(key); continue; }
    if (!whitelist.includes(key.split('.').pop())) throw Error('Unexpected changed method: ' + key);
    changedMethods[name].push(key);
  }
  for (const key of prev.keys()) if (!next.has(key)) throw Error('Removed method: ' + key);
}
// Hero attacks, all nine mechanism cards, per-hit handling, burn cadence and randomness retain their source.
const heroChanges = changedMethods.Hero;
if (JSON.stringify(heroChanges) !== JSON.stringify(['ArcherHero.queuedShotDelay'])) throw Error('Hero gameplay changed');
for (const key of ['ProjectileManager.hitMob', 'ProjectileManager.hitGround']) {
  if (!unchangedMethods.includes(key)) throw Error('Hit feedback or damage changed: ' + key);
}
const burn = text => text.replace(/\.node\.getComponent\(UITransform\)!/g, '.ui');
const oldFire = methods(before('FireVFX')), newFire = methods(source('FireVFX'));
if (burn(oldFire.get('FireVFX.syncBurns')) !== newFire.get('FireVFX.syncBurns')) throw Error('Burn timing changed');
const prevSweep = methods(before('Projectile')).get('ProjectileManager.hitSweep');
const nextSweep = methods(source('Projectile')).get('ProjectileManager.hitSweep');
if (prevSweep.slice(prevSweep.indexOf('const c =')) !== nextSweep.slice(nextSweep.indexOf('const c ='))) throw Error('Narrow-phase collision changed');
for (const name of Object.keys(allowed)) {
  const count = filename => (fs.readFileSync(filename, 'utf8').match(/Math\.random\(/g) || []).length;
  if (count(before(name)) !== count(source(name))) throw Error('Random call count changed: ' + name);
}
const assets = [], mediaChanged = [], added = [];
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
for (const filename of walk(path.join(root, 'assets'))) {
  const relative = path.relative(path.join(root, 'assets'), filename).replace(/\\/g, '/');
  if (!(relative in baseline.assets)) { added.push(relative); continue; }
  if (hash(fs.readFileSync(filename)) !== baseline.assets[relative]) {
    assets.push(relative);
    if (!relative.startsWith('scripts/battle/') || !relative.endsWith('.ts')) mediaChanged.push(relative);
  }
}
const removed = Object.keys(baseline.assets).filter(p => !fs.existsSync(path.join(root, 'assets', p)));
if (added.length || removed.length || mediaChanged.length || assets.length !== 12) throw Error('Unexpected asset change');
const beforeTypes = fs.readFileSync(path.join(__dirname, 'typecheck-before.txt'), 'utf8').replace(/\r\n/g, '\n');
const afterTypes = fs.readFileSync(path.join(__dirname, 'typecheck-after.txt'), 'utf8').replace(/\r\n/g, '\n');
if (beforeTypes !== afterTypes) throw Error('Type diagnostics changed');
let nativeChecked = 0;
for (const [name, expected] of Object.entries(baseline.native)) {
  if (hash(fs.readFileSync(path.join(root, 'build/web-mobile', name))) !== expected) throw Error('Native resource changed: ' + name);
  nativeChecked++;
}
const report = {
  kind: 'Static AST, source and file-hash inspection; no game execution',
  baselineCommit: baseline.backupCommit, assetsChecked: Object.keys(baseline.assets).length,
  changedAssets: assets, added, removed, unchangedNative: nativeChecked,
  changedMethods, unchangedMethodCount: unchangedMethods.length,
  heroAttackAndCardMethodsUnchanged: true, hitDamageAndFeedbackUnchanged: true,
  burnSyncOnlyCachesUIComponent: true, exactCollisionAndOrderUnchanged: true,
  randomCallCountUnchanged: true, typeDiagnosticsUnchanged: true,
  typeDiagnostics: (afterTypes.match(/: error TS/g) || []).length,
  runtimeBenchmarksRun: false, visualAcceptance: 'User manual on phone',
};
fs.writeFileSync(path.join(__dirname, 'source-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
