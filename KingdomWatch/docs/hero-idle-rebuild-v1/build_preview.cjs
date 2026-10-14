const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const out=path.join(game,'build/web-mobile/previews/sniper-idle-rebuild-v1');
fs.mkdirSync(out,{recursive:true});
for(const [src,name] of [
 ['preview.html','index.html'],['sniper/sniper-ready.png','sniper-ready.png'],
 ['sniper/art.json','art.json'],['sniper/idle-v4/idle.png','idle-v4-alpha1.png'],['sniper/idle-v4/idle.frames.json','idle-v4-alpha1.frames.json'],
 ['sniper/idle-v4/contact-sheet.jpg','contact-sheet-v4-alpha1.jpg'],['sniper/idle-v4/idle-mirror.gif','idle-mirror-v4-alpha1.gif'],
 ['sniper/idle-v4/source.mp4','source-v4.mp4'],['sniper/idle-v4/battle-composite.gif','battle-composite-v4-alpha1.gif'],
 ['../../assets/resources/ux/hero_comic_v1/comic_figure_sniper_v1.png','figure-reference.png'],
 ['../../assets/resources/ux/archer_idle_v1/idle.png','archer-idle.png'],
 ['../../assets/resources/ux/archer_idle_v1/idle.frames.json','archer-idle.frames.json'],
 ['../../assets/resources/scenes/scene_1_1.png','floor.png'],
 ['../../assets/resources/ux/defense_wall.png','wall.png']
])fs.copyFileSync(path.resolve(root,src),path.join(out,name));
console.log(JSON.stringify({preview:out}));
