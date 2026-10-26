/** Collect only newly introduced localized literals, preserving previous font coverage. */
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const root=path.resolve(__dirname,'../..'),repo=path.dirname(root);
const files=cp.execFileSync('git',['diff','--name-only','b40535fd','--','KingdomWatch/assets/scripts'],{cwd:repo,encoding:'utf8'}).trim().split(/\r?\n/).filter(x=>x.endsWith('.ts')).map(x=>x.replace(/^KingdomWatch\//,''));
files.push('assets/scripts/config/SpaceSwordConfig.ts','assets/scripts/battle/SpaceSwordHeroes.ts');
function strings(s){
 const out=new Set();function walk(n){
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||n.kind===ts.SyntaxKind.TemplateHead||n.kind===ts.SyntaxKind.TemplateMiddle||n.kind===ts.SyntaxKind.TemplateTail)
   if(/[\u3400-\u9fff]/.test(n.text))out.add(n.text);
  ts.forEachChild(n,walk);
 }walk(ts.createSourceFile('x.ts',s,ts.ScriptTarget.Latest,true));return out;
}
const text=[];
for(const f of new Set(files)){
 let old='';try{old=cp.execFileSync('git',['show','b40535fd:KingdomWatch/'+f],{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{}
 const previous=strings(old);for(const s of strings(fs.readFileSync(path.join(root,f),'utf8')))if(!previous.has(s))text.push(s);
}
fs.writeFileSync(path.join(__dirname,'font-text.json'),JSON.stringify({text},null,2)+'\n');console.log('New localized literals: '+text.length);

