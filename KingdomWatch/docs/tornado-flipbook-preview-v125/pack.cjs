/** Generated-art slicing/registration only. No painting, inbetweening or engine. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=__dirname,root=path.resolve(out,'../..');
const input=path.join(out,'tornado-generated.png');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const xs=[0,314,627,941,1254],ys=[0,334,650,964,1254],cell=384;
async function main(){
 const bytes=fs.readFileSync(input),meta=await sharp(bytes).metadata();
 if(meta.width!==1254||meta.height!==1254||!meta.hasAlpha)throw Error('Unexpected native sheet');
 fs.mkdirSync(path.join(out,'frames'),{recursive:true});const layers=[],frames=[];
 for(let i=0;i<16;i++){
  const c=i%4,r=Math.floor(i/4),box={left:xs[c],top:ys[r],width:xs[c+1]-xs[c],height:ys[r+1]-ys[r]};
  const raw=await sharp(bytes).extract(box).ensureAlpha().raw().toBuffer();
  const rows=new Float64Array(box.height);let total=0;
  for(let y=Math.floor(box.height*.5);y<box.height;y++)for(let x=0;x<box.width;x++){
   const a=raw[(y*box.width+x)*4+3];if(a>=100){rows[y]+=a;total+=a;}
  }
  let sum=0,toeY=box.height-1;
  for(let y=0;y<box.height;y++){sum+=rows[y];if(sum>=total*.995){toeY=y;break;}}
  let sumX=0,mass=0;
  for(let y=Math.max(Math.floor(box.height*.65),toeY-28);y<=toeY;y++)for(let x=0;x<box.width;x++){
   const a=raw[(y*box.width+x)*4+3];if(a>=100){sumX+=x*a;mass+=a;}
  }
  const toeX=mass?sumX/mass:box.width*.5,left=Math.round(cell*.5-toeX),top=Math.round(336-toeY);
  if(left<0||top<0||left+box.width>cell||top+box.height>cell)throw Error('Packing would clip source cell '+i);
  const png=await sharp({create:{width:cell,height:cell,channels:4,background:'#00000000'}})
   .composite([{input:raw,raw:{width:box.width,height:box.height,channels:4},left,top}]).png().toBuffer();
  const file='frames/'+String(i).padStart(2,'0')+'.png';fs.writeFileSync(path.join(out,file),png);
  layers.push({input:png,left:c*cell,top:r*cell});
  frames.push({index:i,file,sourceRect:box,sourceFoot:[Number(toeX.toFixed(3)),toeY],translation:[left,top],
   scale:1,anchor:[cell*.5,336],sha256:sha(png)});
 }
 const atlas=await sharp({create:{width:cell*4,height:cell*4,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
 fs.writeFileSync(path.join(out,'tornado-16frames.png'),atlas);
 const report={tool:'built-in image_gen',previewOnly:true,generatedFrameCount:16,nativeSize:[1254,1254],
  packedSize:[1536,1536],cellSize:[384,384],nativePixelsRescaled:false,sourceSHA256:sha(bytes),atlasSHA256:sha(atlas),
  note:'Generated grid is not perfectly uniform. Row boundaries are measured from clear gaps. Original RGBA preserved; only crop and integer translation, no optical flow, morphing, per-frame scaling or crossfade.',
  frames,gameAssetsModified:false,gameOrBrowserStarted:false,deploymentPerformed:false};
 fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({frames:frames.length,cell,atlasBytes:atlas.length,gameChanged:false}));
}
main().catch(e=>{process.stderr.write(e.stack+'\n');process.exitCode=1;});
