// Type diagnostics only: no game modules execute.
const fs=require('node:fs'),path=require('node:path');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const project=path.resolve(__dirname,'../..'),name='assets/scripts/ui/HeroLobbyIdle.ts';
const original=fs.readFileSync(path.join(__dirname,'before',name),'utf8');
const cp=path.join(project,'temp/tsconfig.impact-check.json'),config=ts.readConfigFile(cp,ts.sys.readFile);
if(config.error)throw new Error('Type-check config unreadable');
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(cp));
if(parsed.errors.length)throw new Error('Invalid config');
function diagnostics(before){
 const host=ts.createCompilerHost(parsed.options),read=host.getSourceFile.bind(host);
 host.getSourceFile=(file,version,onError,fresh)=>before&&path.resolve(file).toLowerCase()===path.resolve(project,name).toLowerCase()
  ?ts.createSourceFile(file,original,version,true):read(file,version,onError,fresh);
 return ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames,parsed.options,host)).map(d=>({
  file:d.file?path.relative(project,d.file.fileName).replace(/\\/g,'/'):null,code:d.code,
  category:d.category,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')
 })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const before=diagnostics(true),current=diagnostics(false),same=JSON.stringify(before)===JSON.stringify(current);
fs.writeFileSync(path.join(__dirname,'typecheck-comparison.json'),JSON.stringify({before,current,
 beforeDiagnostics:before.length,currentDiagnostics:current.length,normalizedDiagnosticsUnchanged:same,
 gameModulesExecuted:false},null,2)+'\n');
console.log(JSON.stringify({beforeDiagnostics:before.length,currentDiagnostics:current.length,normalizedDiagnosticsUnchanged:same}));
if(!same)process.exitCode=1;
