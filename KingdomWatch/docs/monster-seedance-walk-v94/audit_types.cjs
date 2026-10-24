// Compiler diagnostics only. No game module or generated code is executed.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const project = path.resolve(__dirname, '../..');
const files = ['assets/scripts/battle/MobAnim.ts','assets/scripts/config/ChapterContent.ts','assets/scripts/ui/BattleEntryWarmup.ts'];
const originals = new Map(files.map(name => [path.resolve(project,name).replace(/\\/g,'/').toLowerCase(),fs.readFileSync(path.join(__dirname,'before',name),'utf8')]));
const configPath = path.join(project,'temp/tsconfig.impact-check.json');
const config = ts.readConfigFile(configPath,ts.sys.readFile);
if(config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed = ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(configPath));
if(parsed.errors.length) throw new Error('Invalid type-check config');
function diagnostics(before) {
  const host = ts.createCompilerHost(parsed.options), read = host.getSourceFile.bind(host);
  host.getSourceFile = (file,version,onError,fresh) => {
    const source = before && originals.get(path.resolve(file).replace(/\\/g,'/').toLowerCase());
    return typeof source === 'string' ? ts.createSourceFile(file,source,version,true) : read(file,version,onError,fresh);
  };
  return ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames,parsed.options,host)).map(d => ({
    file:d.file ? path.relative(project,d.file.fileName).replace(/\\/g,'/') : null,code:d.code,
    category:d.category,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')
  })).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const before = diagnostics(true), current = diagnostics(false), same = JSON.stringify(before) === JSON.stringify(current);
fs.writeFileSync(path.join(__dirname,'typecheck-comparison.json'),JSON.stringify({before,current,beforeDiagnostics:before.length,currentDiagnostics:current.length,normalizedDiagnosticsUnchanged:same,gameModulesExecuted:false},null,2)+'\n');
console.log(JSON.stringify({beforeDiagnostics:before.length,currentDiagnostics:current.length,normalizedDiagnosticsUnchanged:same}));
if(!same) process.exitCode=1;
