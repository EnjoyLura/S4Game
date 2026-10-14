const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
for(const folder of ['sniper-idle-lively-v1','volt-idle-lively-v1']){
 const file=path.join(game,'docs',folder,'packaging.json');
 const packaging=JSON.parse(fs.readFileSync(file,'utf8'));
 packaging.gameIntegrated=true;
 fs.writeFileSync(file,JSON.stringify(packaging,null,2)+'\n');
}
for(const name of ['hero-idle-lively-v1','hero-idle-subtle-v2','hero-stance-rebuild-v1']){
 const out=path.join(game,'build/web-mobile/previews',name);fs.mkdirSync(out,{recursive:true});
 fs.copyFileSync(path.join(root,'preview.html'),path.join(out,'index.html'));
 for(const [hero,original] of [['sniper','sniper-idle-lively-v1'],['volt','volt-idle-lively-v1']]){
  const target=path.join(out,hero);fs.mkdirSync(target,{recursive:true});
  for(const file of ['idle.png','idle.frames.json','idle-mirror.gif','packaging.json','ready-red.png','ready-transparent.png','art.json','image-prompt.txt','idle-prompt.txt','video-task.json','source.mp4','loop-selection.json'])fs.copyFileSync(path.join(game,'docs',original,file),path.join(target,file));
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
