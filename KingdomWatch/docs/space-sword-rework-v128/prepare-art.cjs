/** Pack complete generated UI subjects; no painting, added borders, or battle effect textures. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'assets/resources/ux/space_sword_v128');
const archive=path.join(root,'local/art-archive/space-sword-rework-v128');
const source='C:/Users/user/.codex/generated_images/01a15ef7-7947-7cb0-82f2-df6682c99f16/exec-09382bdc-6d39-4a87-a90b-a5c22d46f7c7.png';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(archive,{recursive:true});
 const data=fs.readFileSync(fs.existsSync(path.join(archive,'icons-master.png'))?path.join(archive,'icons-master.png'):source);
 fs.writeFileSync(path.join(archive,'icons-master.png'),data);
 const raw=await sharp(data).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=raw.info;
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),regions=[];
 for(let seed=0;seed<w*h;seed++){
  if(seen[seed]||raw.data[seed*4+3]<=12)continue;
  let front=0,end=1,left=w,top=h,right=0,bottom=0;queue[0]=seed;seen[seed]=1;
  while(front<end){const i=queue[front++],x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);
   for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&raw.data[j*4+3]>12){seen[j]=1;queue[end++]=j;}}
  if(end>w*h*.07)regions.push({left,top,width:right-left,height:bottom-top});
 }
 if(regions.length!==4)throw Error('Expected four complete alpha subjects: '+regions.length);
 regions.sort((a,b)=>Math.abs(a.top-b.top)>h*.2?a.top-b.top:a.left-b.left);
 const keys=['ui_icon_skill_space','ui_icon_ult_space','ui_icon_skill_sword','ui_icon_ult_sword'],parts=[],frames={};
 for(let k=0;k<4;k++){
  const box=regions[k],side=Math.max(box.width,box.height)+4;
  const input=await sharp({create:{width:side,height:side,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
   .composite([{input:await sharp(data).extract(box).png().toBuffer(),left:Math.floor((side-box.width)/2),top:Math.floor((side-box.height)/2)}]).png().toBuffer();
  const left=k%2*256+4,top=Math.floor(k/2)*256+4;
  parts.push({input:await sharp(input).resize(248,248).png().toBuffer(),left,top});
  frames[keys[k]]={source:'space_sword_v128/icons',rect:[left,top,248,248]};frames['shop_comic_v1/'+keys[k]]=frames[keys[k]];
 }
 const target=path.join(folder,'icons.png');
 await sharp({create:{width:512,height:512,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(parts).png({compressionLevel:9}).toFile(target);
 if(!fs.existsSync(folder+'.meta'))fs.writeFileSync(folder+'.meta',JSON.stringify({ver:'1.2.0',importer:'directory',imported:true,uuid:crypto.randomUUID(),files:[],subMetas:{},userData:{}},null,2)+'\n');
 const m=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/ux/space_sword_v127/abilities.png.meta'),'utf8'));
 const id=fs.existsSync(target+'.meta')?JSON.parse(fs.readFileSync(target+'.meta')).uuid:crypto.randomUUID();m.uuid=id;m.userData.redirect=id+'@6c48a';
 const tx=m.subMetas['6c48a'];tx.uuid=id+'@6c48a';tx.displayName='icons';tx.userData.imageUuidOrDatabaseUri=id;
 const sf=m.subMetas.f9941;sf.uuid=id+'@f9941';sf.displayName='icons';
 Object.assign(sf.userData,{offsetX:0,offsetY:0,trimX:0,trimY:0,width:512,height:512,rawWidth:512,rawHeight:512,trimType:'none',packable:false,imageUuidOrDatabaseUri:id+'@6c48a',
  vertices:{rawPosition:[-256,-256,0,256,-256,0,-256,256,0,256,256,0],indexes:[0,1,2,2,1,3],uv:[0,512,512,512,0,0,512,0],nuv:[0,0,1,0,0,1,1,1],minPos:[-256,-256,0],maxPos:[256,256,0]}});
 fs.writeFileSync(target+'.meta',JSON.stringify(m,null,2)+'\n');
 const tsPath=path.join(root,'assets/scripts/ui/NewHeroArt.ts'),old=fs.readFileSync(tsPath,'utf8'),marker='// v128 revised space/sword UI abilities.';
 fs.writeFileSync(tsPath,(old.includes(marker)?old.slice(0,old.indexOf(marker)):old.trimEnd()+'\n')+marker+'\nObject.assign(NEW_HERO_FRAMES, '+JSON.stringify(frames,null,2)+');\n');
 const assets=[{path:path.relative(root,target).replaceAll('\\','/'),uuid:id,width:512,height:512,bytes:fs.statSync(target).size,sha256:hash(fs.readFileSync(target))}];
 fs.writeFileSync(path.join(__dirname,'art-manifest.json'),JSON.stringify({mode:'built-in image_gen; UI icons only',source,sourceSha256:hash(data),regions,assets,frames,processing:'Complete alpha subjects, uniform scaling, 4px gutters; no painting or ring. No effect textures.'},null,2)+'\n');
 console.log(JSON.stringify({assets,aliases:Object.keys(frames).length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
