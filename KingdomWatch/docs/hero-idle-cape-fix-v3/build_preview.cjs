const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const template=fs.readFileSync(path.join(game,'docs/hero-idle-loop-v2/preview.html'),'utf8')
 .replaceAll('重弩手与雷法师 · 待机循环衔接','重弩手 · 完整斗篷待机')
 .replace('保留已确认的待机动作，调整首尾衔接与转折减速，让披风、袍摆循环时连贯回位。','重弩手使用斗篷完整的连续动作段，保持当前人物大小、脚底位置和相邻帧往返循环。雷法师沿用当前动作。')
 .replace('以下为原始视频，尚未整理循环；修正后的循环效果以上方动画和 GIF 为准。','下方保留原始视频作为制作记录。重弩手原视频中斗篷出框的后段已从上方动画和 GIF 中移除，修正效果以上方为准。');
fs.writeFileSync(path.join(root,'preview.html'),template);
const sources=[['sniper','sniper-idle-cape-safe-v3'],['volt','volt-idle-lively-loop-v2']];
const packagingFile=path.join(game,'docs/sniper-idle-cape-safe-v3/packaging.json');
const packaging=JSON.parse(fs.readFileSync(packagingFile,'utf8'));packaging.gameIntegrated=true;
fs.writeFileSync(packagingFile,JSON.stringify(packaging,null,2)+'\n');
for(const name of ['hero-idle-cape-fix-v3','hero-idle-loop-v2','hero-idle-lively-v1','hero-idle-subtle-v2','hero-stance-rebuild-v1']){
 const out=path.join(game,'build/web-mobile/previews',name);fs.mkdirSync(out,{recursive:true});
 fs.copyFileSync(path.join(root,'preview.html'),path.join(out,'index.html'));
 for(const [hero,source] of sources){
  const target=path.join(out,hero);fs.mkdirSync(target,{recursive:true});
  for(const file of ['idle.png','idle.frames.json','idle-mirror.gif','packaging.json','ready-red.png','ready-transparent.png','art.json','image-prompt.txt','idle-prompt.txt','video-task.json','source.mp4','loop-selection.json'])fs.copyFileSync(path.join(game,'docs',source,file),path.join(target,file));
  if(hero==='sniper')fs.copyFileSync(path.join(game,'docs',source,'cape-framing.json'),path.join(target,'cape-framing.json'));
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
