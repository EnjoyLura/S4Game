const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const out=path.join(game,'build/web-mobile/previews/sniper-attack-forward-v4');
fs.mkdirSync(out,{recursive:true});
for(const [src,name] of [
 ['preview.html','index.html'],['ready-red.png','ready-red.png'],
 ['attack.png','attack.png'],['attack.frames.json','attack.frames.json'],
 ['source.mp4','source.mp4'],['attack-clean.mp4','attack-clean.mp4'],['contact-sheet.jpg','contact-sheet.jpg'],
 ['attack-mirror.gif','attack-mirror.gif'],['battle-composite.gif','battle-composite.gif'],
 ['attack-prompt.txt','attack-prompt.txt'],
 ['../../assets/resources/ux/sniper_idle_forward_v2/idle.png','idle.png'],
 ['../../assets/resources/ux/sniper_idle_forward_v2/idle.frames.json','idle.frames.json'],
 ['../../assets/resources/ux/archer_idle_v1/idle.png','archer-idle.png'],
 ['../../assets/resources/ux/archer_idle_v1/idle.frames.json','archer-idle.frames.json'],
 ['../../assets/resources/scenes/scene_1_1.png','floor.png'],
 ['../../assets/resources/ux/defense_wall.png','wall.png']
])fs.copyFileSync(path.resolve(root,src),path.join(out,name));
console.log(JSON.stringify({preview:out}));
