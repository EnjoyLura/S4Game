// Static TypeScript AST reader. Never loads or executes project/game modules.
const fs = require('fs');
const path = require('path');
const ts = require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
function readCatalog(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function literal(n) {
    if (ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return ts.isNumericLiteral(n) ? Number(n.text) : n.text;
    if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.map(p => [p.name.text, literal(p.initializer)]));
    if (ts.isCallExpression(n) && n.expression.getText(source) === 'art' && n.arguments.length === 1) return 'weapons_v1/' + literal(n.arguments[0]);
    throw new Error('Unsupported static catalog node: ' + n.getText(source));
  }
  for (const s of source.statements) if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations)
    if (d.name.getText(source) === 'WEAPONS') return literal(d.initializer);
  throw new Error('Missing WEAPONS declaration');
}
const current = readCatalog(path.join(root, 'assets/scripts/config/Weapons.ts'));
const before = readCatalog(path.join(__dirname, 'before/assets/scripts/config/Weapons.ts'));
for (const id of Object.keys(before)) if (JSON.stringify(current[id]) !== JSON.stringify(before[id])) throw new Error('Old weapon changed: ' + id);
const added = Object.values(current).filter(w => !before[w.id]);
if (added.length !== 16 || Object.keys(current).length !== 25) throw new Error('Unexpected weapon totals');
for (const quality of [2,3]) for (const type of ['bow','crossbow','book','staff'])
  if (added.filter(w => w.quality === quality && w.type === type).length !== 2) throw new Error('Missing quality/type pair');
for (const w of added) {
  if (w.tier !== (w.quality === 2 ? 1 : 2) || w.price !== (w.quality === 2 ? 1000 : 1600) || w.unlock !== (w.quality === 2 ? '1-2' : '1-4')) throw new Error('Catalog progression mismatch: ' + w.id);
  if (Object.keys(w.stats).length !== 3 || Object.values(w.stats).some(v => v <= 0)) throw new Error('Invalid stat choices');
}
const record = { originalWeaponCount: Object.keys(before).length, originalWeaponsUnchanged: true, totalWeapons: Object.keys(current).length,
  shopWeaponCount: Object.values(current).filter(w => !w.starter).length, added, inspection: 'Static AST extraction only; no project code executed' };
fs.writeFileSync(path.join(__dirname, 'catalog.json'), JSON.stringify(record, null, 2));
process.stdout.write('Catalog AST reviewed: 16 new weapons, 25 total, 21 in shop; all 9 originals unchanged.\n');
