const fs=require('fs'),path=require('path');
const game=path.resolve(__dirname,'../..'),src=path.join(game,'docs/sniper-attack-clean-v1');
const out=path.join(game,'build/web-mobile/previews/sniper-attack-clean-v1');
fs.mkdirSync(out,{recursive:true});fs.copyFileSync(path.join(src,'preview.html'),path.join(out,'index.html'));
for(const name of ['attack.png','attack.frames.json','attack-mirror.gif','attack-cleaned.mp4','comparison.mp4','comparison.gif','original.png','original-1.png','original.frames.json','processing.json','packaging.json']){
 fs.copyFileSync(path.join(src,name),path.join(out,name));
}
console.log(JSON.stringify({preview:out,gameIntegrated:true}));
