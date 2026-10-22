// Static AST inventory only. Does not import, transpile or run any game module.
const fs = require('fs');
const path = require('path');
const ts = require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
const files = ['config/Cards', 'battle/Hero', 'battle/Projectile', 'battle/Monster',
  'battle/FireVFX', 'battle/FrostVFX', 'battle/ImpactFX'];
const parsed = {};
for (const name of files) {
  const text = fs.readFileSync(path.join(root, 'assets/scripts', name + '.ts'), 'utf8');
  const ast = ts.createSourceFile(name + '.ts', text, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) throw new Error(name + ': parse diagnostic');
  parsed[name] = ast;
}
const wanted = ['archer_knockback', 'sniper_return', 'pyro_firefield', 'pyro_antiheal',
  'pyro_giant', 'volt_arc', 'volt_overload', 'mora_pierce', 'mora_ground'];
const cards = [];
let mechanicIds;
function property(obj, name) {
  return obj.properties.find(p => p.name && p.name.getText() === name)?.initializer;
}
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText() === 'c' &&
      ts.isObjectLiteralExpression(node.arguments[0])) {
    const obj = node.arguments[0], id = property(obj, 'id');
    if (id && ts.isStringLiteral(id)) {
      const value = key => property(obj, key)?.text;
      cards.push({ id: id.text, name: value('name'), owner: value('owner'), rarity: value('rarity'),
        maxStacks: Number(value('maxStacks')), art: value('art'), req: value('req'),
        desc: value('desc'), apply: property(obj, 'apply')?.getText() });
    }
  }
  if (ts.isVariableDeclaration(node) && node.name.getText() === 'MECHANIC_IDS') {
    mechanicIds = node.initializer.arguments[0].elements.map(e => e.text);
  }
  ts.forEachChild(node, visit);
}
visit(parsed['config/Cards']);
if (new Set(cards.map(c => c.id)).size !== cards.length) throw new Error('Duplicate literal card ID');
const selected = wanted.map(id => {
  const found = cards.filter(c => c.id === id);
  if (found.length !== 1) throw new Error('Missing or duplicate card: ' + id);
  const c = found[0];
  if (c.maxStacks !== 1 || !mechanicIds.includes(id)) throw new Error('Invalid stack/group: ' + id);
  if (!fs.existsSync(path.join(root, 'assets/resources/ux', c.art + '.png'))) throw new Error('Missing art: ' + id);
  if (c.desc.split('\n').length > 3 || /叠层|可配合|联动/.test(c.desc)) throw new Error('Dense card copy: ' + id);
  return c;
});
const expectedApply = {
  archer_knockback: 'archerKnockback = 56', sniper_return: 'sniperReturn = .4',
  pyro_firefield: 'pyroFirefield = 3', pyro_antiheal: 'pyroHealCut = .5',
  pyro_giant: 'pyroGiantEvery = 4', volt_arc: 'voltArc = .5',
  volt_overload: 'voltOverload = .5', mora_pierce: 'moraPierce = 1', mora_ground: 'moraGround = 3',
};
for (const c of selected) if (!c.apply.includes(expectedApply[c.id])) throw new Error('Card value mismatch: ' + c.id);
function method(ast, className, name) {
  const cls = ast.statements.find(s => ts.isClassDeclaration(s) && s.name.text === className);
  return cls.members.find(m => m.name?.getText() === name)?.getText();
}
const preserved = {};
for (const [file, cls, methods] of [
  ['battle/FireVFX', 'FireVFX', ['syncBurns', 'renderClip', 'tick']],
  ['battle/FrostVFX', 'FrostVFX', ['domain', 'tick', 'render']],
  ['battle/Hero', 'HeroBase', ['tick', 'chargeKill']],
]) {
  const source = fs.readFileSync(path.join(__dirname, 'before/assets/scripts', file + '.ts'), 'utf8');
  const old = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const name of methods) {
    const before = method(old, cls, name), after = method(parsed[file], cls, name);
    if (!before || before !== after) throw new Error('Preserved method changed or missing: ' + cls + '.' + name);
    preserved[cls + '.' + name] = 'identical';
  }
}
const report = { scope: 'static syntax and AST only', game_code_executed: false,
  files_parsed: files.length, direct_card_count: cards.length,
  new_mechanic_cards: selected, preserved_methods: preserved,
  documented_review: [
    'Normal finite segment collision remains shared by outbound, return and frost piercing contacts.',
    'Return clips the map edge and launch point, uses distinct per-leg life IDs, never creates another return.',
    'Only the first primary arrow of every fourth base cycle owns knockback; split and serial arrows do not copy it.',
    'Basic arc is bounded to one nearest secondary target and cannot call itself or cast a skill.',
    'Overload checks existing shock, 50% roll, boss exclusion and a per-target three-second cooldown.',
    'Burn healing reduction owns its own expiry; other sources extending burn cannot extend that expiry.',
    'Firefield callback runs on the actual last skill projectile landing, including empty ground.',
    'Skill firefields never apply meteor vulnerability; both field types use each area radius and lifetime.',
    'Frost ground updates before the ultimate queue early return, refreshes slow on new arrivals and clears on expiry.',
    'Picker falls back to remaining legal cards only after the usual numeric cap would leave empty slots.',
  ] };
fs.writeFileSync(path.join(__dirname, 'source-review.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({parsed: files.length, approved_cards: selected.length, existing_art: true,
  copy_lines: selected.map(c => [c.name, c.desc.split('\n').length]), preserved_methods: Object.keys(preserved)}));
