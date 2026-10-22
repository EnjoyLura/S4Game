// Parse configuration literals only. Never import, transpile or execute the game.
const fs = require('fs');
const path = require('path');
const ts = require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript');
const root = path.resolve(__dirname, '../..');
function readWaves(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const declarations = new Map();
  for (const statement of source.statements) if (ts.isVariableStatement(statement)) {
    for (const d of statement.declarationList.declarations) declarations.set(d.name.getText(source), d.initializer);
  }
  function literal(node, env = {}, depth = 0) {
    if (!node || depth > 15) throw Error('Unsupported/missing literal');
    const next = (n, e = env) => literal(n, e, depth + 1);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return next(node.expression);
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isStringLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isIdentifier(node) && Object.hasOwn(env, node.text)) return env[node.text];
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -next(node.operand);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(n => next(n));
    if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => {
      if (ts.isShorthandPropertyAssignment(p)) return [p.name.text, next(p.name)];
      if (!ts.isPropertyAssignment(p)) throw Error('Unsupported property ' + p.getText(source));
      return [p.name.getText(source).replace(/^['"]|['"]$/g, ''), next(p.initializer)];
    }));
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const helper = declarations.get(node.expression.text);
      if (!helper || !ts.isArrowFunction(helper)) throw Error('Unsupported helper');
      const params = {};
      helper.parameters.forEach((p, i) => { params[p.name.getText(source)] = next(node.arguments[i] || p.initializer); });
      return next(helper.body, params);
    }
    throw Error('Unsupported literal: ' + node.getText(source));
  }
  const key = [...declarations.keys()].find(k => k.endsWith('_LEVEL_WAVES'));
  return literal(declarations.get(key));
}
const names = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
const expected = [211, 296, 516, 635, 705, 857];
const report = names.map((name, i) => {
  const current = path.join(root, 'assets/scripts/config', name + 'Level.ts');
  const original = path.join(__dirname, 'before/config', name + 'Level.ts');
  const after = readWaves(current), before = readWaves(fs.existsSync(original) ? original : current);
  function totals(waves) {
    return {
      count: waves.reduce((n, w) => n + w.groups.reduce((c, g) => c + g.count, 0), 0),
      authoredHp: waves.reduce((n, w) => n + w.groups.reduce((c, g) => c + g.count * g.actual.hp, 0), 0),
      authoredSpawnSpan: Number(waves.reduce((n, w) => n + Math.max(...w.groups.map(g => (g.delay || 0) + (g.count - 1) * g.interval)), 0).toFixed(2)),
    };
  }
  const a = totals(after), b = totals(before);
  if (a.count !== expected[i] || a.count !== b.count || after.length !== before.length) throw Error('Wave budget changed: ' + name);
  for (const w of after) for (const g of w.groups) {
    if (!Number.isInteger(g.count) || g.count < 1 || g.actual.hp <= 0 || g.actual.dmg < 0 || g.interval <= 0) throw Error('Bad literal');
  }
  return { level: '1-' + (i + 1), before: b, after: a, waves: after };
});
fs.writeFileSync(path.join(__dirname, 'wave-literal-review.json'), JSON.stringify({
  method: 'TypeScript AST literal decoding; authored spawn span is not measured play time',
  gameCodeImportedOrExecuted: false, combatSimulated: false, levels: report,
}, null, 2));
console.log(JSON.stringify(report.map(({ level, before, after }) => ({ level, before, after })), null, 2));
