const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const out=path.join(game,'build/web-mobile/previews/volt-attack-user-v2');
fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.join(root,'preview.html'),path.join(out,'index.html'));
for(const file of ['attack.png','attack.frames.json','attack-mirror.gif','source.mp4','contact-sheet.jpg','source-origin.json','packaging.json'])fs.copyFileSync(path.join(root,file),path.join(out,file));
for(const file of ['idle.png','idle.frames.json'])fs.copyFileSync(path.join(game,'assets/resources/ux/volt_idle_natural_v1',file),path.join(out,file));
for(const [dir,resource]of [['archer','archer_idle_v1'],['sniper','sniper_idle_natural_v2']]){
const destination=path.join(out,dir);fs.mkdirSync(destination,{recursive:true});
for(const file of ['idle.png','idle.frames.json'])fs.copyFileSync(path.join(game,'assets/resources/ux',resource,file),path.join(destination,file));}
for(const [src,dst]of [['assets/resources/scenes/scene_1_1.png','floor.png'],['assets/resources/ux/defense_wall.png','wall.png']])fs.copyFileSync(path.join(game,src),path.join(out,dst));
console.log(JSON.stringify({preview:out,gameIntegrated:true,paidTaskSubmitted:false}));
