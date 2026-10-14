const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const template=fs.readFileSync(path.join(game,'docs/hero-idle-lively-v1/preview.html'),'utf8')
 .replaceAll('重弩手与雷法师 · 重新生成待机','重弩手与雷法师 · 待机循环衔接')
 .replace('沿用已确认的站姿和武器握持，重新生成完整待机视频。动作重点是披风、袍摆的连贯起伏与轻微呼吸。','保留已确认的待机动作，调整首尾衔接与转折减速，让披风、袍摆循环时连贯回位。')
 .replace('<h2>本次生成的源视频</h2>','<h2>原始视频对照</h2><p>以下为原始视频，尚未整理循环；修正后的循环效果以上方动画和 GIF 为准。</p>');
fs.writeFileSync(path.join(root,'preview.html'),template);
for(const folder of ['sniper-idle-lively-loop-v2','volt-idle-lively-loop-v2']){
 const file=path.join(game,'docs',folder,'packaging.json');
 const packaging=JSON.parse(fs.readFileSync(file,'utf8'));
 packaging.gameIntegrated=true;
 fs.writeFileSync(file,JSON.stringify(packaging,null,2)+'\n');
}
for(const name of ['hero-idle-loop-v2','hero-idle-lively-v1','hero-idle-subtle-v2','hero-stance-rebuild-v1']){
 const out=path.join(game,'build/web-mobile/previews',name);fs.mkdirSync(out,{recursive:true});
 fs.copyFileSync(path.join(root,'preview.html'),path.join(out,'index.html'));
 for(const hero of ['sniper','volt']){
  const target=path.join(out,hero);fs.mkdirSync(target,{recursive:true});
  for(const file of ['idle.png','idle.frames.json','idle-mirror.gif','packaging.json','ready-red.png','ready-transparent.png','art.json','image-prompt.txt','idle-prompt.txt','video-task.json','source.mp4','loop-selection.json'])fs.copyFileSync(path.join(game,'docs',hero+'-idle-lively-loop-v2',file),path.join(target,file));
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
