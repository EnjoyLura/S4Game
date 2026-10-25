/* Nonsemantic atlas import: equal-quadrant extraction, uniform resampling and packing.
 * No painting, alpha re-keying, generated ring removal or semantic edits. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const here=__dirname,root=path.resolve(here,'../..'),artDir=path.join(root,'assets/resources/ux/new_hero_icons_v117');
const rawDir=path.join(root,'local/art-archive/hero-icons-v117/approved');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const template=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/ux/ui_card_explode.png.meta'),'utf8'));
const selection=JSON.parse(fs.readFileSync(path.join(here,'art-selection.json'),'utf8'));
const CELL=512,PAD=4,SIZE=504,COLS=4;
async function main(){
 fs.mkdirSync(artDir,{recursive:true});fs.mkdirSync(rawDir,{recursive:true});
 const groups={icon_core:[],cannon_cards:[],siphon_cards:[]},records=[];
 for(const sheet of selection){
  const bytes=fs.readFileSync(sheet.path),meta=await sharp(bytes).metadata();
  if(!meta.hasAlpha||meta.width!==meta.height)throw Error('Expected transparent square sheet: '+sheet.id);
  fs.writeFileSync(path.join(rawDir,sheet.id+'.png'),bytes);
  const half=sheet.cells.length===1?meta.width:Math.floor(meta.width/2);
  for(let i=0;i<sheet.cells.length;i++){
   const c=sheet.cells[i],rect={left:sheet.cells.length===1?0:(i%2)*half,top:sheet.cells.length===1?0:Math.floor(i/2)*half,width:half,height:half};
   const tile=await sharp(bytes).extract(rect).resize(SIZE,SIZE,{kernel:'lanczos3'}).png().toBuffer();
   const {data,info}=await sharp(tile).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let inside=0,solid=0,outside=0,clear=0;
   for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const r=Math.hypot(x-(SIZE-1)/2,y-(SIZE-1)/2)/SIZE,a=data[(y*SIZE+x)*info.channels+3];
    if(r<.40){inside++;if(a>=250)solid++;}
    if(r>.57){outside++;if(a<=5)clear++;}
   }
   if(solid/inside<.98||clear/outside<.98)throw Error('Circular alpha validation failed '+c.key+' '+JSON.stringify({solid:solid/inside,clear:clear/outside}));
   const group=c.key.startsWith('ui_card_cannon_')?'cannon_cards':c.key.startsWith('ui_card_siphon_')?'siphon_cards':'icon_core';
   const index=groups[group].length,x=(index%COLS)*CELL+PAD,y=Math.floor(index/COLS)*CELL+PAD;
   groups[group].push({input:tile,left:x,top:y});
   records.push({key:c.key,source:'new_hero_icons_v117/'+group,rect:[x,y,SIZE,SIZE],
    sourceSheet:sheet.id,sourceQuadrant:i,sourceCrop:rect,sourceSha256:sha(bytes),
    opaqueInterior:solid/inside,transparentCorners:clear/outside});
  }
 }
 const atlases=[];
 for(const [name,tiles] of Object.entries(groups)){
  const w=COLS*CELL,h=Math.ceil(tiles.length/COLS)*CELL,png=path.join(artDir,name+'.png');
  await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(tiles).png({compressionLevel:9}).toFile(png);
  const m=structuredClone(template),uid=crypto.randomUUID();m.uuid=uid;m.userData.redirect=uid+'@6c48a';
  const t=m.subMetas['6c48a'];t.uuid=uid+'@6c48a';t.displayName=name;t.userData.imageUuidOrDatabaseUri=uid;
  const s=m.subMetas.f9941;s.uuid=uid+'@f9941';s.displayName=name;
  Object.assign(s.userData,{offsetX:0,offsetY:0,trimX:0,trimY:0,width:w,height:h,rawWidth:w,rawHeight:h,
   trimType:'none',packable:false,imageUuidOrDatabaseUri:uid+'@6c48a',
   vertices:{rawPosition:[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
    indexes:[0,1,2,2,1,3],uv:[0,h,w,h,0,0,w,0],nuv:[0,0,1,0,0,1,1,1],minPos:[-w/2,-h/2,0],maxPos:[w/2,h/2,0]}});
  fs.writeFileSync(png+'.meta',JSON.stringify(m,null,2)+'\n');
  atlases.push({path:path.relative(root,png).replaceAll('\\','/'),uuid:uid,width:w,height:h,cells:tiles.length,
   bytes:fs.statSync(png).size,sha256:sha(fs.readFileSync(png))});
 }
 const folderMeta=artDir+'.meta';
 if(!fs.existsSync(folderMeta))fs.writeFileSync(folderMeta,JSON.stringify({ver:'1.2.0',importer:'directory',imported:true,uuid:crypto.randomUUID(),files:[],subMetas:{},userData:{}},null,2)+'\n');
 const manifest={mode:'built-in image_gen',specification:'Circular filled paintings, transparent outside, no decorative outer rims. Four-grid sheet generation authorized by user.',normalization:'Sharp equal-quadrant extraction, uniform Lanczos downsampling to 504px, transparent packing only. Generated alpha preserved.',atlases,icons:records};
 fs.writeFileSync(path.join(here,'art-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 let code='/** Circular painted icons share three atlases; full hero figures retain their existing sources. */\nexport interface NewHeroFrame { source: string; rect: readonly [number, number, number, number]; }\nexport const NEW_HERO_FRAMES: Record<string, NewHeroFrame> = {\n';
 code+=records.map(r=>'  '+JSON.stringify(r.key.startsWith('avatar_')?'ui_'+r.key:r.key)+': { source: '+JSON.stringify(r.source)+', rect: ['+r.rect.join(', ')+'] },').join('\n')+'\n};\n';
 code+="for (const hero of ['cannon', 'siphon']) {\n  NEW_HERO_FRAMES['new_heroes_v105/avatar_' + hero] = NEW_HERO_FRAMES['ui_avatar_' + hero];\n  NEW_HERO_FRAMES['hero_comic_v1/comic_figure_' + hero + '_v1'] = { source: 'new_heroes_v105/' + hero + '_lobby', rect: [0, 0, 1024, 1536] };\n}\n// All callers and prewarm requests resolve to the same source texture, never a second placeholder.\nfor (const key of Object.keys(NEW_HERO_FRAMES)) if (!key.includes('/'))\n  NEW_HERO_FRAMES['shop_comic_v1/' + key] = NEW_HERO_FRAMES[key];\n";
 fs.writeFileSync(path.join(root,'assets/scripts/ui/NewHeroArt.ts'),code);
 console.log(JSON.stringify({atlases,iconCount:records.length,alphaChecks:records.every(r=>r.opaqueInterior>.98&&r.transparentCorners>.98)},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

