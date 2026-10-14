const fs = require('fs'), path = require('path');
const ts = require('C:/Users/user/AppData/Local/npm-cache/_npx/2b0c79b2deda3034/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'preview');
fs.mkdirSync(out, {recursive:true});
fs.writeFileSync(path.join(out, 'archer-rig.js'), ts.transpileModule(fs.readFileSync(path.join(root, 'assets/scripts/battle/ArcherRigPose.ts'), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText);
for (const [source, target] of [['assets/resources/ux/archer_native_v1/parts.png','parts.png'],['assets/resources/ux/archer_native_v1/parts.frames.json','parts.frames.json']]) fs.copyFileSync(path.join(root, source), path.join(out, target));
if(process.argv.includes('--publish')) {
  const dest=path.join(root,'build/web-mobile/previews/archer-native-v1');fs.mkdirSync(dest,{recursive:true});
  for(const file of ['index.html','archer-rig.js','parts.png','parts.frames.json'])fs.copyFileSync(path.join(out,file),path.join(dest,file));
}
console.log('Archer native preview prepared');
