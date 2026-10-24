// Compiler-only comparison. Does not import or execute any game module.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const project = path.resolve(__dirname, '../..');
const files = ['battle/BattleDirector.ts', 'ui/HUD.ts', 'ui/Panels.ts', 'ui/BattleProgressBar.ts'];
const originals = new Map(files.map(name => [path.resolve(project, 'assets/scripts', name).replace(/\\/g, '/').toLowerCase(),
  cp.execFileSync('git', ['show', 'a3fe1d0e:KingdomWatch/assets/scripts/' + name], {cwd: project, encoding: 'utf8'})]));
const configPath = path.join(project, 'temp/tsconfig.impact-check.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
if (parsed.errors.length) throw new Error('Invalid type-check config');
function diagnostics(before) {
  const host = ts.createCompilerHost(parsed.options);
  const originalGet = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, onError, fresh) => {
    const source = before && originals.get(path.resolve(file).replace(/\\/g, '/').toLowerCase());
    return typeof source === 'string' ? ts.createSourceFile(file, source, languageVersion, true)
      : originalGet(file, languageVersion, onError, fresh);
  };
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  return ts.getPreEmitDiagnostics(program).map(d => ({file: d.file ? path.relative(project, d.file.fileName).replace(/\\/g, '/') : null,
    code: d.code, category: d.category, message: ts.flattenDiagnosticMessageText(d.messageText, '\n')}))
    .sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const before = diagnostics(true), current = diagnostics(false);
const unchanged = JSON.stringify(before) === JSON.stringify(current);
fs.writeFileSync(path.join(__dirname, 'typecheck-comparison.json'), JSON.stringify({baselineCommit: 'a3fe1d0e', before, current,
  beforeDiagnostics: before.length, currentDiagnostics: current.length, normalizedDiagnosticsUnchanged: unchanged,
  gameModulesExecuted: false}, null, 2) + '\n');
console.log(JSON.stringify({beforeDiagnostics: before.length, currentDiagnostics: current.length, normalizedDiagnosticsUnchanged: unchanged}));
if (!unchanged) process.exitCode = 1;
