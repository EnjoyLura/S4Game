/* Nonsemantic production import: source crop, uniform scaling, alpha-preserving atlas packing. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const here=__dirname,root=path.resolve(here,'../..'),folder=path.join(root,'assets/resources/ux/wind_ninja_v120'),raw=path.join(root,'local/art-archive/wind-ninja-v120');
const selection=JSON.parse(fs.readFileSync(path.join(here,'art-selection.json'),'utf8'));
const template=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/ux/ui_card_explode.png.meta'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),uuid=()=>crypto.randomUUID();
function meta(name,w,h){
 const p=path.join(folder,name+'.png.meta'),m=structuredClone(template),id=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')).uuid:uuid();
 m.uuid=id;m.userData.redirect=id+'@6c48a';const tex=m.subMetas['6c48a'];tex.uuid=id+'@6c48a';tex.displayName=name;tex.userData.imageUuidOrDatabaseUri=id;
 const sf=m.subMetas.f9941;sf.uuid=id+'@f9941';sf.displayName=name;
 Object.assign(sf.userData,{offsetX:0,offsetY:0,trimX:0,trimY:0,width:w,height:h,rawWidth:w,rawHeight:h,trimType:'none',packable:false,imageUuidOrDatabaseUri:id+'@6c48a',
 vertices:{rawPosition:[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],indexes:[0,1,2,2,1,3],uv:[0,h,w,h,0,0,w,0],nuv:[0,0,1,0,0,1,1,1],minPos:[-w/2,-h/2,0],maxPos:[w/2,h/2,0]}});
 fs.writeFileSync(p,JSON.stringify(m,null,2)+'\n');return id;
}
async function main(){
 fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(raw,{recursive:true});
 if(!fs.existsSync(folder+'.meta'))fs.writeFileSync(folder+'.meta',JSON.stringify({ver:'1.2.0',importer:'directory',imported:true,uuid:uuid(),files:[],subMetas:{},userData:{}},null,2)+'\n');
 const frames={},assets=[];
 async function save(name,composites,w,h){
  const p=path.join(folder,name+'.png');await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).png({compressionLevel:9}).toFile(p);
  assets.push({path:path.relative(root,p).replaceAll('\\','/'),uuid:meta(name,w,h),width:w,height:h,bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))});
 }
 for(const source of selection.characters){
  const bytes=fs.readFileSync(source.path),m=await sharp(bytes).metadata();if(!m.hasAlpha)throw Error('Missing alpha');
  fs.writeFileSync(path.join(raw,source.id+'-original.png'),bytes);
  const split=source.id==='wind'?684:Math.floor(m.width/2),parts=[];
  for(let side=0;side<2;side++){
   const crop={left:side?split:0,top:0,width:side?m.width-split:split,height:m.height};
   const foot=source.id==='wind'?1215:1003;
   const scale=Math.min(488/crop.width,740/foot),w=Math.round(crop.width*scale),h=Math.round(crop.height*scale);
   const image=await sharp(bytes).extract(crop).resize(w,h).png().toBuffer();
   const x=side*512+Math.floor((512-w)/2),y=744-Math.round(foot*scale);
   if(y<0||y+h>768)throw Error('Actor bounds');
   parts.push({input:image,left:x,top:y});
   const id=source.id,sourceKey='wind_ninja_v120/'+id+'_figures',rect=[side*512,0,512,768];
   frames['new_heroes_v120/'+id+(side?'_battle':'_lobby')]={source:sourceKey,rect};
   if(!side)frames['hero_comic_v1/comic_figure_'+id+'_v1']={source:sourceKey,rect};
  }
  await save(source.id+'_figures',parts,1024,768);
 }
 const cells=[],tile=256,pad=4,size=248;
 for(const sheet of selection.icons){
  const bytes=fs.readFileSync(sheet.path),m=await sharp(bytes).metadata(),half=Math.floor(m.width/2);
  if(!m.hasAlpha||m.width!==m.height)throw Error('Icon sheet shape');
  fs.writeFileSync(path.join(raw,sheet.id+'.png'),bytes);
  for(let i=0;i<sheet.cells.length;i++){
   const key=sheet.cells[i]==='ui_avatar_ninja_spare'?'ui_avatar_ninja':sheet.cells[i];
   cells.push({key,input:await sharp(bytes).extract({left:(i%2)*half,top:Math.floor(i/2)*half,width:half,height:half}).resize(size,size).png().toBuffer()});
  }
 }
 const avatar=fs.readFileSync(selection.windAvatar.path);fs.writeFileSync(path.join(raw,'wind-avatar.png'),avatar);
 cells.push({key:'ui_avatar_wind',input:await sharp(avatar).resize(size,size).png().toBuffer()});
 const composites=[];
 for(let i=0;i<cells.length;i++){
  const c=cells[i],x=(i%4)*tile+pad,y=Math.floor(i/4)*tile+pad;
  frames[c.key]={source:'wind_ninja_v120/abilities',rect:[x,y,size,size]};
  composites.push({input:c.input,left:x,top:y});
  const{data,info}=await sharp(c.input).ensureAlpha().raw().toBuffer({resolveWithObject:true});let opaque=0,total=0,clear=0,corners=0;
  for(let py=0;py<size;py++)for(let px=0;px<size;px++){const r=Math.hypot(px-(size-1)/2,py-(size-1)/2)/size,a=data[(py*size+px)*info.channels+3];if(r<.4){total++;if(a>=250)opaque++;}if(r>.59){corners++;if(a<6)clear++;}}
  if(opaque/total<.98||clear/corners<.98)throw Error('Circle alpha:'+c.key);
 }
 await save('abilities',composites,1024,768);
 for(const key of Object.keys(frames))if(!key.includes('/'))frames['shop_comic_v1/'+key]=frames[key];
 fs.writeFileSync(path.join(here,'art-manifest.json'),JSON.stringify({mode:'built-in image_gen',normalization:'Uniform resampling and packing only; generated alpha preserved. Two 512x768 actor regions per hero, feet at744. Circular icons248x248 with4px gutters.',assets,frames},null,2)+'\n');
 const file=path.join(root,'assets/scripts/ui/NewHeroArt.ts'),old=fs.readFileSync(file,'utf8'),marker='// v120 wind/ninja real atlas regions.';
 const kept=old.includes(marker)?old.slice(0,old.indexOf(marker)):old.trimEnd()+'\n';
 fs.writeFileSync(file,kept+marker+'\nObject.assign(NEW_HERO_FRAMES, '+JSON.stringify(frames,null,2)+');\n');
 console.log(JSON.stringify({assets,frameAliases:Object.keys(frames).length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
