const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const template=fs.readFileSync(path.join(game,'docs/hero-idle-loop-v2/preview.html'),'utf8')
 .replaceAll('重弩手与雷法师 · 待机循环衔接','重弩手 · 正向循环衔接')
 .replace('保留已确认的待机动作，调整首尾衔接与转折减速，让披风、袍摆循环时连贯回位。','单独重新生成重弩手的完整待机周期，保持正向播放。雷法师保留你已确认顺滑的当前版本。')
 .replace('以下为原始视频，尚未整理循环；修正后的循环效果以上方动画和 GIF 为准。','左侧为本次新生成的重弩手原视频，右侧为已确认的雷法师原视频。序列帧与 GIF 均保留完整原帧，正向播放。')
 .replace('href="sniper/idle-prompt.txt"','href="sniper/idle-prompt-effective.txt"')
 .replace('href="volt/idle-prompt.txt"','href="volt/idle-prompt-effective.txt"');
fs.writeFileSync(path.join(root,'preview.html'),template);
const sources=[['sniper','sniper-idle-natural-v2'],['volt','volt-idle-natural-v1']];
for(const name of ['sniper-idle-loop-close-v1','hero-idle-natural-v1','hero-idle-flow-v1','hero-idle-full-v4','hero-idle-cape-fix-v3','hero-idle-loop-v2','hero-idle-lively-v1','hero-idle-subtle-v2','hero-stance-rebuild-v1']){
 const out=path.join(game,'build/web-mobile/previews',name);fs.mkdirSync(out,{recursive:true});
 fs.copyFileSync(path.join(root,'preview.html'),path.join(out,'index.html'));
 for(const [hero,source] of sources){
  const target=path.join(out,hero);fs.mkdirSync(target,{recursive:true});
  for(const file of ['idle.png','idle.frames.json','idle-mirror.gif','packaging.json','ready-red.png','ready-transparent.png','art.json','image-prompt.txt','idle-prompt.txt','video-task.json','source.mp4','loop-selection.json','source-cycle.json'])fs.copyFileSync(path.join(game,'docs',source,file),path.join(target,file));
  for(const file of ['idle-prompt-effective.txt','video-first-frame.png','first-frame-layout.json','first-frame-host.json'])fs.copyFileSync(path.join(game,'docs',source,file),path.join(target,file));
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
