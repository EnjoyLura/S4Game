// Compiler diagnostics only. This never imports or executes game modules.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const project=path.resolve(__dirname,'../..'),repo=path.resolve(project,'..');
const baseline='c7efe6ab';
const configPath=path.join(project,'temp/tsconfig.impact-check.json');
const config=ts.readConfigFile(configPath,ts.sys.readFile);
if(config.error)throw new Error('Unreadable compiler config');
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(configPath));
const originals=new Map();
const files=cp.execFileSync('git',['ls-tree','-r','--name-only',baseline,'--','KingdomWatch/assets/scripts'],{cwd:repo,encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>p.endsWith('.ts'));
for(const file of files) originals.set(path.resolve(repo,file).toLowerCase(),cp.execFileSync('git',['show',baseline+':'+file],{cwd:repo,encoding:'utf8'}));
function diagnostics(before){
 const host=ts.createCompilerHost(parsed.options),read=host.getSourceFile.bind(host);
 host.getSourceFile=(file,version,onError,fresh)=>before&&originals.has(path.resolve(file).toLowerCase())
  ?ts.createSourceFile(file,originals.get(path.resolve(file).toLowerCase()),version,true):read(file,version,onError,fresh);
 const roots=before?parsed.fileNames.filter(f=>originals.has(path.resolve(f).toLowerCase())):parsed.fileNames;
 return ts.getPreEmitDiagnostics(ts.createProgram(roots,parsed.options,host)).map(d=>({
  file:d.file?path.relative(project,d.file.fileName).replace(/\\/g,'/'):null,code:d.code,
  message:ts.flattenDiagnosticMessageText(d.messageText,'\n')
 })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const before=diagnostics(true),current=diagnostics(false);
const added=current.filter(d=>!before.some(b=>JSON.stringify(b)===JSON.stringify(d)));
fs.writeFileSync(path.join(__dirname,'typecheck-comparison.json'),JSON.stringify({baseline,before,current,added,
 beforeDiagnostics:before.length,currentDiagnostics:current.length,gameModulesExecuted:false},null,2)+'\n');
console.log(JSON.stringify({beforeDiagnostics:before.length,currentDiagnostics:current.length,added},null,2));
if(added.length)process.exitCode=1;
