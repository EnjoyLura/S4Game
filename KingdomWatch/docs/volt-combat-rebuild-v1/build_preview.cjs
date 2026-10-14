const fs=require('fs'),path=require('path');
const root=__dirname,game=path.resolve(root,'../..');
const out=path.join(game,'build/web-mobile/previews/volt-combat-rebuild-v1');
fs.mkdirSync(out,{recursive:true});
for(const [src,name] of [
 ['preview.html','index.html'],['ready-red.png','ready-red.png'],
 ['image-prompt.txt','image-prompt.txt'],['art.json','art.json'],
 ['../../assets/resources/ux/shop_comic_v1/comic_hero_volt_v1.png','portrait-reference.png'],
 ['../../assets/resources/ux/upgrade_comic_v1/comic_staff_volt_v1.png','staff-reference.png']
])fs.copyFileSync(path.resolve(root,src),path.join(out,name));
console.log(JSON.stringify({preview:out}));
