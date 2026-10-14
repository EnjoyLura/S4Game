const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..'),out=path.join(game,'build/web-mobile/previews/hero-stance-rebuild-v1');
fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.join(root,'preview.html'),path.join(out,'index.html'));
for(const [dir,folder,kind] of [['sniper','sniper-stance-idle-v3','idle'],['volt','volt-stance-idle-v2','idle'],['sniper-attack','sniper-stance-attack-v1','attack']]){
 const target=path.join(out,dir);fs.mkdirSync(target,{recursive:true});
 const files=['ready-red.png','ready-transparent.png','art.json',kind+'.png',kind+'.frames.json',kind+'-mirror.gif','source.mp4','contact-sheet.jpg',kind+'-prompt.txt'];
 if(kind==='idle')files.push('image-prompt.txt','generation.json');
 for(const file of files)fs.copyFileSync(path.join(game,'docs',folder,file),path.join(target,file));
}
const archer=path.join(out,'archer');fs.mkdirSync(archer,{recursive:true});
for(const file of ['idle.png','idle.frames.json'])fs.copyFileSync(path.join(game,'assets/resources/ux/archer_idle_v1',file),path.join(archer,file));
for(const [file,name] of [['assets/resources/scenes/scene_1_1.png','floor.png'],['assets/resources/ux/defense_wall.png','wall.png']])fs.copyFileSync(path.join(game,file),path.join(out,name));
console.log(JSON.stringify({preview:out}));
