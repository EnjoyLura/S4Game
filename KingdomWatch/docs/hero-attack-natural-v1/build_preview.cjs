const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const out=path.join(game,'build/web-mobile/previews/hero-attack-natural-v1');
fs.mkdirSync(out,{recursive:true});fs.copyFileSync(path.join(root,'preview.html'),path.join(out,'index.html'));
for(const[hero,idle]of[['sniper','sniper-idle-natural-v2'],['volt','volt-idle-natural-v1']]){
 const dest=path.join(out,hero);fs.mkdirSync(dest,{recursive:true});
 for(const file of['attack.png','attack.frames.json','attack-mirror.gif','source.mp4','attack-prompt.txt','video-task.json','packaging.json'])fs.copyFileSync(path.join(game,'docs',`${hero}-attack-natural-v1`,file),path.join(dest,file));
 for(const file of fs.readdirSync(path.join(game,'docs',`${hero}-attack-natural-v1`)).filter(name=>/^attack-\d+\.png$/.test(name)))fs.copyFileSync(path.join(game,'docs',`${hero}-attack-natural-v1`,file),path.join(dest,file));
 for(const file of['idle.png','idle.frames.json'])fs.copyFileSync(path.join(game,'docs',idle,file),path.join(dest,file));
}
const archer=path.join(out,'archer');fs.mkdirSync(archer,{recursive:true});
for(const file of['idle.png','idle.frames.json'])fs.copyFileSync(path.join(game,'assets/resources/ux/archer_idle_v1',file),path.join(archer,file));
for(const[src,dest]of[['assets/resources/scenes/scene_1_1.png','floor.png'],['assets/resources/ux/defense_wall.png','wall.png']])fs.copyFileSync(path.join(game,src),path.join(out,dest));
console.log(JSON.stringify({preview:out}));
