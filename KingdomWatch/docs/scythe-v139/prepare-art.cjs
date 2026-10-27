/** Nonsemantic atlas preparation: alpha analysis, complete source crops, uniform scaling, packing. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'assets/resources/ux/scythe_v139');
const raw=path.join(root,'local/art-archive/scythe-v139');
const base='C:/Users/user/.codex/generated_images/01a178e6-4e37-7020-8745-0a52d3c09f24/';
const selection=[{id:'scythe',figure:base+'exec-104d3833-b39b-42e1-9dff-58224031fdaa.png',icons:base+'exec-42f0b765-a0fc-41d3-a430-c22582764542.png'}];
const template=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/ux/ui_card_explode.png.meta'),'utf8'));
const assets=[],frames={},sources=[];
function bounds(data,w,h,x0=0,x1=w){let l=w,t=h,r=0,b=0;for(let y=0;y<h;y++)for(let x=x0;x<x1;x++)if(data[(y*w+x)*4+3]>12){l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);}return{left:l,top:t,width:r-l,height:b-t};}
function components(data,w,h){
  const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),out=[];
  for(let seed=0;seed<seen.length;seed++){
    if(seen[seed]||data[seed*4+3]<=12)continue;
    let front=0,end=1,l=w,t=h,r=0,b=0;queue[0]=seed;seen[seed]=1;
    while(front<end){const i=queue[front++],x=i%w,y=Math.floor(i/w);l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);
      for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&data[j*4+3]>12){seen[j]=1;queue[end++]=j;}
    }
    if(end>w*h*.07)out.push({left:l,top:t,width:r-l,height:b-t,pixels:end});
  }
  if(out.length!==4)throw Error('Expected four separate circular icon subjects, got '+out.length);
  return out.sort((a,b)=>Math.abs(a.top-b.top)>h*.2?a.top-b.top:a.left-b.left);
}
function meta(name,w,h){
  const p=path.join(folder,name+'.png.meta'),m=structuredClone(template),id=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)).uuid:crypto.randomUUID();
  m.uuid=id;m.userData.redirect=id+'@6c48a';const tx=m.subMetas['6c48a'];tx.uuid=id+'@6c48a';tx.displayName=name;tx.userData.imageUuidOrDatabaseUri=id;
  const sf=m.subMetas.f9941;sf.uuid=id+'@f9941';sf.displayName=name;
  Object.assign(sf.userData,{offsetX:0,offsetY:0,trimX:0,trimY:0,width:w,height:h,rawWidth:w,rawHeight:h,trimType:'none',packable:false,imageUuidOrDatabaseUri:id+'@6c48a',
    vertices:{rawPosition:[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],indexes:[0,1,2,2,1,3],uv:[0,h,w,h,0,0,w,0],nuv:[0,0,1,0,0,1,1,1],minPos:[-w/2,-h/2,0],maxPos:[w/2,h/2,0]}});
  fs.writeFileSync(p,JSON.stringify(m,null,2)+'\n');return id;
}
async function save(name,composites,w,h){const p=path.join(folder,name+'.png');
  await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).png({compressionLevel:9}).toFile(p);
  assets.push({path:path.relative(root,p).replaceAll('\\','/'),uuid:meta(name,w,h),width:w,height:h,bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
}
async function main(){
  fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(raw,{recursive:true});
  if(!fs.existsSync(folder+'.meta'))fs.writeFileSync(folder+'.meta',JSON.stringify({ver:'1.2.0',importer:'directory',imported:true,uuid:crypto.randomUUID(),files:[],subMetas:{},userData:{}},null,2)+'\n');
  const iconParts=[];
  for(const row of selection){
    const figure=fs.readFileSync(fs.existsSync(path.join(raw,row.id+'-pair.png'))?path.join(raw,row.id+'-pair.png'):row.figure);
    const image=await sharp(figure).ensureAlpha().raw().toBuffer({resolveWithObject:true}),w=image.info.width,h=image.info.height;
    fs.writeFileSync(path.join(raw,row.id+'-pair.png'),figure);
    // Generated pair has an off-center empty gutter; split in that gutter, never through a weapon.
    const empty=[];for(let x=Math.floor(w*.42);x<Math.ceil(w*.60);x++){
      let occupied=false;for(let y=0;y<h;y++)if(image.data[(y*w+x)*4+3]>12){occupied=true;break;}
      if(!occupied)empty.push(x);
    }
    if(!empty.length)throw Error('No transparent gutter between actors');
    const split=empty[Math.floor(empty.length/2)];
    const crops=[bounds(image.data,w,h,0,split),bounds(image.data,w,h,split,w)];
    const scale=Math.min(472/Math.max(...crops.map(c=>c.width)),714/Math.max(...crops.map(c=>c.height)));
    const parts=[];
    for(let k=0;k<2;k++){
      const crop=crops[k];if(crop.left<=(k?split:0)||crop.left+crop.width>=(k?w:split))throw Error('Actor reaches cell boundary');
      const ww=Math.round(crop.width*scale),hh=Math.round(crop.height*scale);
      const input=await sharp(figure).extract(crop).resize(ww,hh).png().toBuffer();
      parts.push({input,left:k*512+Math.floor((512-ww)/2),top:744-hh});
      const frame={source:'scythe_v139/'+row.id+'_figures',rect:[k*512,0,512,768]};
      frames['new_heroes_v139/'+row.id+(k?'_battle':'_lobby')]=frame;
      if(!k)frames['hero_comic_v1/comic_figure_'+row.id+'_v1']=frame;
    }
    await save(row.id+'_figures',parts,1024,768);
    const icons=fs.readFileSync(fs.existsSync(path.join(raw,row.id+'-icons.png'))?path.join(raw,row.id+'-icons.png'):row.icons);
    fs.writeFileSync(path.join(raw,row.id+'-icons.png'),icons);
    const rgba=await sharp(icons).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const regions=components(rgba.data,rgba.info.width,rgba.info.height);
    for(let k=0;k<4;k++){
      const{left,top,width,height}=regions[k];const box={left,top,width,height};
      const side=Math.max(width,height),buffer=await sharp(icons).extract(box).png().toBuffer();
      const square=await sharp({create:{width:side+4,height:side+4,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
        .composite([{input:buffer,left:2+Math.floor((side-width)/2),top:2+Math.floor((side-height)/2)}]).png().toBuffer();
      const input=await sharp(square).resize(248,248).png().toBuffer(),index=iconParts.length,x=(index%2)*256+4,y=Math.floor(index/2)*256+4;
      const key=k===0?'ui_avatar_'+row.id:'ui_icon_'+['atk','skill','ult'][k-1]+'_'+row.id;
      iconParts.push({input,left:x,top:y});frames[key]={source:'scythe_v139/abilities',rect:[x,y,248,248]};
    }
    sources.push({id:row.id,figureSha256:crypto.createHash('sha256').update(figure).digest('hex'),figureCrops:crops,scale,iconRegions:regions,
      iconsSha256:crypto.createHash('sha256').update(icons).digest('hex')});
  }
  await save('abilities',iconParts,512,512);
  for(const key of Object.keys(frames))if(!key.includes('/'))frames['shop_comic_v1/'+key]=frames[key];
  const dest=path.join(root,'assets/scripts/ui/NewHeroArt.ts'),old=fs.readFileSync(dest,'utf8'),marker='// v139 scythe atlas regions.';
  fs.writeFileSync(dest,(old.includes(marker)?old.slice(0,old.indexOf(marker)):old.trimEnd()+'\n')+marker+'\nObject.assign(NEW_HERO_FRAMES, '+JSON.stringify(frames,null,2)+');\n');
  fs.writeFileSync(path.join(__dirname,'art-manifest.json'),JSON.stringify({mode:'built-in image_gen',sources,assets,frames,processing:'Complete alpha subject crop; common uniform actor scale per pair; no painting, deformation, artificial frame or VFX textures.'},null,2)+'\n');
  console.log(JSON.stringify({assets,aliases:Object.keys(frames).length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
