/* Exact UI skin assets from deterministic vector masters; no generated lettering or layout. */
const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const OUT=__dirname,GAME=path.resolve(OUT,'../..'),DEST=path.join(GAME,'assets/resources/ux/battle_skin_v2');
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const plate=(w,h,fill,light,r=28)=>svg(w,h,`<rect x="2.4" y="2.4" width="${w-4.8}" height="${h-4.8}" rx="${r}" fill="${fill}" stroke="#302C29" stroke-width="4.8"/><path d="M ${r+8} 9 H ${w-r-8}" stroke="${light}" stroke-width="4" stroke-linecap="round"/>`);
const entries=[
 ['banner_title',1040,176,plate(1040,176,'#F5E8CD','#FFF6E2')],
 ['banner_fail',1180,200,plate(1180,200,'#884B3B','#A66550')],
 ['card_base',446,720,plate(446,720,'#FFF5E1','#FFFFFF',24)],
 ...[['button_green','#65B441','#A7DC68'],['button_gold','#FFC848','#FFE88C'],['button_muted','#ABB0AC','#CCD0C6']].map(([key,a,b])=>[key,600,176,plate(600,176,a,b)]),
 ...['l','m','r'].map(k=>{
   const w=520,h=116,r=28;
   const shape=k==='l'?`M ${r} 0 H ${w} V ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`:k==='r'?`M 0 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${h-r} Q ${w} ${h} ${w-r} ${h} H 0 Z`:`M 0 0 H ${w} V ${h} H 0 Z`;
   return ['tab_'+k,w,h,svg(w,h,`<path d="${shape}" fill="#FFFFFF"/><path d="M ${k==='l'?r+8:0} 6 H ${k==='r'?w-r-8:w}" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="4"/>`)];
 }),
 ...[['switch_on',true,'#65B441'],['switch_off',false,'#5A6472'],['switch_disabled',false,'#3A4250']].map(([key,on,fill])=>[key,200,88,svg(200,88,`<rect x="2.4" y="2.4" width="195.2" height="83.2" rx="41.6" fill="${fill}" stroke="#302C29" stroke-width="4.8"/><circle cx="${on?156:44}" cy="44" r="37" fill="${key==='switch_disabled'?'#889099':'#FFF4DD'}"/><path d="M ${on?136:24} 26 Q ${on?156:44} 13 ${on?176:64} 26" fill="none" stroke="#FFFFFF" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/>`)]),
 ['bar_track',450,32,svg(450,32,'<rect x="1.5" y="1.5" width="447" height="29" rx="14.5" fill="#171C22" stroke="#A49C82" stroke-width="3"/>')],
 ['bar_fill',450,24,svg(450,24,'<rect width="450" height="24" rx="12" fill="#E8E8E8"/><path d="M 12 4 H 438" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>')],
];
(async()=>{
 fs.mkdirSync(DEST,{recursive:true});fs.mkdirSync(path.join(OUT,'vectors'),{recursive:true});const records=[];
 for(const [key,w,h,source] of entries){const file=path.join(DEST,key+'.png');fs.writeFileSync(path.join(OUT,'vectors',key+'.svg'),source);await sharp(Buffer.from(source)).png().toFile(file);records.push({key,file,width:w,height:h,bytes:fs.statSync(file).size});}
 fs.writeFileSync(path.join(OUT,'assets.json'),JSON.stringify(records,null,2)+'\n');console.log(JSON.stringify({assets:records.length,bytes:records.reduce((n,r)=>n+r.bytes,0)}));
})().catch(e=>{console.error(e);process.exitCode=1});
