const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
for(const name of ['hero-idle-subtle-v2','hero-stance-rebuild-v1']){
 const out=path.join(game,'build/web-mobile/previews',name);fs.mkdirSync(out,{recursive:true});
 fs.copyFileSync(path.join(root,'preview.html'),path.join(out,'index.html'));
 for(const [hero,original] of [['sniper','sniper-stance-idle-v3'],['volt','volt-stance-idle-v2']]){
  const target=path.join(out,hero);fs.mkdirSync(target,{recursive:true});
  for(const file of ['idle.png','idle.frames.json','idle-mirror.gif','packaging.json'])fs.copyFileSync(path.join(root,hero,file),path.join(target,file));
  for(const file of ['ready-red.png','ready-transparent.png','art.json','image-prompt.txt','idle-prompt.txt','generation.json'])fs.copyFileSync(path.join(game,'docs',original,file),path.join(target,file));
 }
 for(const [dir,source,files] of [
  ['sniper-attack','docs/sniper-stance-attack-v1',['attack.png','attack.frames.json','attack-mirror.gif']],
  ['archer','assets/resources/ux/archer_idle_v1',['idle.png','idle.frames.json']]]){
  const target=path.join(out,dir);fs.mkdirSync(target,{recursive:true});
  for(const file of files)fs.copyFileSync(path.join(game,source,file),path.join(target,file));
 }
 for(const [file,target] of [['assets/resources/scenes/scene_1_1.png','floor.png'],['assets/resources/ux/defense_wall.png','wall.png']])fs.copyFileSync(path.join(game,file),path.join(out,target));
 console.log(JSON.stringify({preview:out}));
}
