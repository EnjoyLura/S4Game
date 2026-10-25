/* v122 formal-art preparation only: fixed-cell crop, common uniform resize, RGBA packing. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
let sharp;
for (const modulePath of [process.env.KW_ART_SHARP, 'sharp',
  'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'].filter(Boolean)) {
  try { sharp = require(modulePath); break; } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
}
if (!sharp) throw Error('Install sharp or set KW_ART_SHARP to its absolute module path.');
const root = path.resolve(__dirname, '../..');
const specification = JSON.parse(fs.readFileSync(path.join(__dirname, 'art-prompts.json'), 'utf8'));
const archive = path.join(root, specification.rawArchive);
const destination = path.join(root, 'assets/resources/fx/wind_volume_v122');
const manifestPath = path.join(__dirname, 'art-manifest.json');
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
const slash = value => value.replaceAll('\\', '/');
const relative = value => slash(path.relative(root, value));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const writeJSON = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const check = (condition, message) => { if (!condition) throw Error(message); };
const FRAME = 512, ATLAS = 1024, GUTTER = 55;
const idsInUse = new Map();
function collectUUIDs(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) collectUUIDs(file);
    else if (item.name.endsWith('.meta')) {
      const uuid = JSON.parse(fs.readFileSync(file, 'utf8')).uuid;
      if (uuid) {
        const entries = idsInUse.get(uuid) || [];
        entries.push(file); idsInUse.set(uuid, entries);
      }
    }
  }
}
function stableUUID(file) {
  const uuid = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).uuid : crypto.randomUUID();
  const collisions = (idsInUse.get(uuid) || []).filter(other => path.resolve(other) !== path.resolve(file));
  check(uuid && collisions.length === 0, 'UUID collision for ' + relative(file));
  idsInUse.set(uuid, [file]);
  return uuid;
}
function imageMeta(file, name) {
  const uuid = stableUUID(file), texture = uuid + '@6c48a', spriteFrame = uuid + '@f9941';
  const result = {
    ver: '1.0.27', importer: 'image', imported: true, uuid, files: ['.json', '.png'],
    subMetas: {
      '6c48a': {
        importer: 'texture', uuid: texture, displayName: name, id: '6c48a', name: 'texture',
        userData: { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge',
          imageUuidOrDatabaseUri: uuid, isUuid: true, visible: false,
          minfilter: 'linear', magfilter: 'linear', mipfilter: 'none', anisotropy: 0 },
        ver: '1.0.22', imported: true, files: ['.json'], subMetas: {}
      },
      f9941: {
        importer: 'sprite-frame', uuid: spriteFrame, displayName: name, id: 'f9941', name: 'spriteFrame',
        userData: { trimThreshold: 1, rotated: false, offsetX: 0, offsetY: 0, trimX: 0, trimY: 0,
          width: ATLAS, height: ATLAS, rawWidth: ATLAS, rawHeight: ATLAS,
          borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0,
          packable: false, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
          vertices: { rawPosition: [-512,-512,0,512,-512,0,-512,512,0,512,512,0],
            indexes: [0,1,2,2,1,3], uv: [0,1024,1024,1024,0,0,1024,0],
            nuv: [0,0,1,0,0,1,1,1], minPos: [-512,-512,0], maxPos: [512,512,0] },
          isUuid: true, imageUuidOrDatabaseUri: texture, atlasUuid: '', trimType: 'none' },
        ver: '1.0.12', imported: true, files: ['.json'], subMetas: {}
      }
    },
    userData: { type: 'sprite-frame', fixAlphaTransparencyArtifacts: false, hasAlpha: true, redirect: texture }
  };
  writeJSON(file, result);
  return { image: uuid, texture, spriteFrame };
}
function alphaStats(data, width, height, left = 0, top = 0, stride = width) {
  let zero = 0, opaque = 0, semi = 0, gutterNonzero = 0, maxAlpha = 0;
  const bounds = Object.fromEntries([0,8,64,127].map(value => [value, {x:width,y:height,right:-1,bottom:-1}]));
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const a = data[((top+y)*stride+left+x)*4+3];
    if (a===0) zero++; else if (a===255) opaque++; else semi++;
    maxAlpha = Math.max(maxAlpha, a);
    if (a && (x<GUTTER || x>=width-GUTTER || y<GUTTER || y>=height-GUTTER)) gutterNonzero++;
    for (const [threshold,b] of Object.entries(bounds)) if (a>Number(threshold)) {
      b.x=Math.min(b.x,x); b.y=Math.min(b.y,y); b.right=Math.max(b.right,x); b.bottom=Math.max(b.bottom,y);
    }
  }
  const boundingBoxes = {};
  for (const [threshold,b] of Object.entries(bounds)) {
    boundingBoxes[threshold] = b.right<0 ? null : {x:b.x,y:b.y,width:b.right-b.x+1,height:b.bottom-b.y+1,
      clearMargins:[b.x,b.y,width-1-b.right,height-1-b.bottom]};
  }
  return { zero, semiTransparent:semi, opaque, maxAlpha,
    zeroFraction:zero/(width*height), gutterNonzero, boundingBoxes };
}
function centerOpening(data, stride, left, top, center) {
  let count=0, clear=0, zero=0, sum=0;
  for (let y=-6; y<=6; y++) for(let x=-6; x<=6; x++) if(x*x+y*y<=36) {
    const a=data[((top+center[1]+y)*stride+left+center[0]+x)*4+3];
    count++; sum+=a; if(a<=8)clear++; if(a===0)zero++;
  }
  return { radius:6, pixels:count, alphaLE8:clear, alphaZero:zero, meanAlpha:sum/count,
    centerAlpha:data[((top+center[1])*stride+left+center[0])*4+3] };
}
async function main() {
  collectUUIDs(path.join(root,'assets'));
  fs.mkdirSync(destination,{recursive:true});
  const folderMeta=destination+'.meta', folderUuid=stableUUID(folderMeta);
  writeJSON(folderMeta,{ver:'1.2.0',importer:'directory',imported:true,uuid:folderUuid,files:[],subMetas:{},userData:{}});
  const assets=[];
  for (const source of specification.sources) {
    const rawFile=path.join(archive,source.archiveFile);
    check(fs.existsSync(rawFile),'Raw original missing: '+rawFile+'; restore from the recorded built-in output path.');
    const rawBytes=fs.readFileSync(rawFile), sourceHash=sha256(rawBytes);
    const priorSource=previous?.assets?.find(asset=>asset.id===source.id)?.source;
    if(priorSource) check(priorSource.sha256===sourceHash,'Archived original hash changed for '+source.id);
    const metadata=await sharp(rawBytes).metadata();
    check(metadata.hasAlpha && metadata.channels===4 && metadata.depth==='uchar','Native 8-bit RGBA required: '+source.id);
    check(metadata.width===1254 && metadata.height===1254,'Unexpected native geometry for '+source.id);
    const raw=await sharp(rawBytes).raw().toBuffer();
    const nativeAlpha=alphaStats(raw,metadata.width,metadata.height);
    check(nativeAlpha.zero>0 && nativeAlpha.semiTransparent>0,'Native alpha absent or invalid: '+source.id);
    const composites=[],frames=[],packing=source.packing;
    const sourceCell=packing.sourceCell[0], target=packing.uniformResample[0],scale=target/sourceCell;
    check(packing.uniformResample[0]===packing.uniformResample[1],'Uniform square resample required');
    for(let i=0;i<4;i++) {
      const col=i%2,row=Math.floor(i/2),origin=[col*sourceCell,row*sourceCell];
      const rect={left:origin[0],top:origin[1],width:sourceCell,height:sourceCell};
      const registration=packing.sourceRegistrationPoints[i];
      const point=registration.map(value=>(value+0.5)*scale-0.5);
      const offset=point.map((value,axis)=>Math.round(packing.frameAnchor[axis]-value));
      check(offset.every(value=>value>=GUTTER && value+target<=FRAME-GUTTER),'Packing exceeds clear gutter: '+source.id+'/'+i);
      const tile=await sharp(rawBytes).extract(rect).resize(target,target,{kernel:sharp.kernel.lanczos3})
        .png({compressionLevel:9,palette:false}).toBuffer();
      composites.push({input:tile,left:col*FRAME+offset[0],top:row*FRAME+offset[1]});
      frames.push({index:i,phaseDegrees:i*90,rect:[col*FRAME,row*FRAME,FRAME,FRAME],
        uvRectTopLeft:[col/2,row/2,0.5,0.5],uvRectBottomLeft:[col/2,(1-row)/2,0.5,0.5],
        sourceRect:[...origin,sourceCell,sourceCell],nativeAlpha:alphaStats(raw,sourceCell,sourceCell,...origin,metadata.width),
        packingOffset:offset,uniformScale:scale,frameAnchor:packing.frameAnchor,
        registrationAfterPacking:point.map((value,axis)=>value+offset[axis]),
        registrationError:point.map((value,axis)=>value+offset[axis]-packing.frameAnchor[axis])});
    }
    const atlas=await sharp({create:{width:ATLAS,height:ATLAS,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
      .composite(composites).png({compressionLevel:9,adaptiveFiltering:true,palette:false}).toBuffer();
    const formalMetadata=await sharp(atlas).metadata(),formalRaw=await sharp(atlas).raw().toBuffer();
    check(formalMetadata.hasAlpha && formalMetadata.channels===4,'Formal atlas must be RGBA');
    check(atlas.length<=2_000_000,'Formal PNG exceeds 2MB: '+source.id);
    for(const frame of frames) {
      const [left,top,width,height]=frame.rect;
      frame.alpha=alphaStats(formalRaw,width,height,left,top,ATLAS);
      check(frame.alpha.gutterNonzero===0,'Nonzero alpha in 55px gutters: '+source.id+'/'+frame.index);
      if(source.id==='eye') {
        frame.centralOpening=centerOpening(formalRaw,ATLAS,left,top,packing.frameAnchor);
        check(frame.centralOpening.centerAlpha<=8 && frame.centralOpening.alphaLE8>80,'Central eye is not transparent: '+frame.index);
      }
    }
    const finalFile=path.join(root,source.formalPath);
    fs.writeFileSync(finalFile,atlas);
    const uuids=imageMeta(finalFile+'.meta',source.id);
    assets.push({id:source.id,path:relative(finalFile),resourceKey:'fx/wind_volume_v122/'+source.id,
      width:ATLAS,height:ATLAS,channels:4,alphaMode:'straight RGBA; native generated alpha preserved through standard resampling and packing',
      bytes:atlas.length,sha256:sha256(atlas),uuids,
      source:{archivePath:relative(rawFile),generatedPath:source.generatedPath,width:metadata.width,height:metadata.height,
        channels:metadata.channels,hasNativeAlpha:metadata.hasAlpha,bytes:rawBytes.length,sha256:sourceHash,alpha:nativeAlpha},
      frameSize:[FRAME,FRAME],frameAnchor:packing.frameAnchor,frames});
  }
  writeJSON(manifestPath,{schemaVersion:1,version:'v122',mode:'built-in image_gen; two new generations; no image references',
    scope:'Formal wind VFX art only. Shader, integration, build, Git and deployment belong to parent task.',
    processing:'Four fixed 627x627 source cells, same 370x370 uniform Lanczos3 resample, integer registration packing in 512x512 cells. No color, alpha, semantic or background edits.',
    commands:['node docs/wind-volume-v122/prepare-art.cjs'],
    rawArchiveIgnoredBy:'KingdomWatch/.gitignore: /local/',
    toolchain:{node:process.version,sharp:sharp.versions.sharp,vips:sharp.versions.vips},
    folder:{path:relative(destination),uuid:folderUuid},
    grid:[2,2],atlasSize:[ATLAS,ATLAS],frameSize:[FRAME,FRAME],clearGutterPx:GUTTER,
    phaseOrder:'upper-left, upper-right, lower-left, lower-right',
    validation:{nativeRGBA:true,sourceHashesVerifiedOnRepeat:true,formalRGBA:true,allFrameGuttersAlphaZero:true,
      registrationMaxErrorPx:0.5,perPNGMaxBytes:2_000_000,uniqueUUIDs:true,eyeCentersTransparent:true},
    visualReview:specification.review,assets});
  console.log(JSON.stringify({assets:assets.map(asset=>({id:asset.id,path:asset.path,bytes:asset.bytes,sha256:asset.sha256,
    uuids:asset.uuids,anchor:asset.frameAnchor,sourceHasNativeAlpha:asset.source.hasNativeAlpha,
    gutters:asset.frames.map(frame=>frame.alpha.boundingBoxes[0].clearMargins),
    centralOpenings:asset.frames.map(frame=>frame.centralOpening).filter(Boolean)}))}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
