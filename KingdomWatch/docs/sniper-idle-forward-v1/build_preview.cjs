const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const out=path.join(game,'build/web-mobile/previews/sniper-idle-forward-v1');
fs.mkdirSync(out,{recursive:true});
for(const [src,name] of [
 ['preview.html','index.html'],['ready-red.png','ready-red.png'],
 ['ready-transparent.png','ready-transparent.png'],['art.json','art.json'],
 ['idle.png','idle.png'],['idle.frames.json','idle.frames.json'],
 ['source.mp4','source.mp4'],['contact-sheet.jpg','contact-sheet.jpg'],
 ['idle-mirror.gif','idle-mirror.gif'],['battle-composite.gif','battle-composite.gif'],
 ['image-prompt.txt','image-prompt.txt'],['idle-prompt.txt','idle-prompt.txt'],
 ['../../assets/resources/ux/archer_idle_v1/idle.png','archer-idle.png'],
 ['../../assets/resources/ux/archer_idle_v1/idle.frames.json','archer-idle.frames.json'],
 ['../../assets/resources/scenes/scene_1_1.png','floor.png'],
 ['../../assets/resources/ux/defense_wall.png','wall.png']
])fs.copyFileSync(path.resolve(root,src),path.join(out,name));
console.log(JSON.stringify({preview:out}));
