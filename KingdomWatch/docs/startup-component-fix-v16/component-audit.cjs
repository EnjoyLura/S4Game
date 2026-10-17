// Static AST inspection only: parse source without importing or executing game modules.
const fs = require('fs');
const path = require('path');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : e.name.endsWith('.ts') ? [path.join(dir,e.name)] : []);
}
function inspect(file, body = fs.readFileSync(file, 'utf8')) {
  const ast = ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const components = [];
  function visit(node) {
    if (ts.isClassDeclaration(node) && node.heritageClauses) {
      const bases = node.heritageClauses.filter(h => h.token === ts.SyntaxKind.ExtendsKeyword).flatMap(h => h.types.map(t => t.expression.getText(ast)));
      if (bases.some(b => b === 'Component' || b.endsWith('.Component'))) {
        const decorators = ts.getDecorators ? (ts.getDecorators(node) || []) : (node.decorators || []);
        components.push({name: node.name?.text || '(anonymous)', registered: decorators.some(d => /\bccclass\s*\(/.test(d.getText(ast)))});
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return {file: path.relative(root,file).replaceAll('\\','/'), components};
}
const scripts = files(path.join(root,'assets/scripts')).map(f => inspect(f));
const conflicts = scripts.filter(s => s.components.filter(c => c.registered).length > 1);
const before = inspect(path.join(root,'assets/scripts/ui/PositiveFeedback.ts'), fs.readFileSync(path.join(__dirname,'before/PositiveFeedback.ts.txt'),'utf8'));
const result = {kind:'static-source-AST-inspection', scripts: scripts.length,
  beforeConflict: before, conflicts, componentScripts: scripts.filter(s => s.components.length),
  gameExecuted:false, browserExecuted:false, testsExecuted:false};
fs.writeFileSync(path.join(__dirname,'component-audit.json'),JSON.stringify(result,null,2));
process.stdout.write(JSON.stringify({scripts:result.scripts, priorComponents:before.components, conflicts}));
if (conflicts.length) process.exitCode = 1;
