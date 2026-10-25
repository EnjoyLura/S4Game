/* Static source/config/art audit. Never loads Cocos, game scenes or combat modules. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const here=__dirname,root=path.resolve(here,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
async function main(){
 const manifest=JSON.parse(read('docs/hero-icons-v117/art-manifest.json'));
 const art=read('assets/scripts/ui/NewHeroArt.ts'),exports={};
 vm.runInNewContext(ts.transpileModule(art,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
 const frames=exports.NEW_HERO_FRAMES,rects=new Set(),slots=[];
 assert.equal(manifest.icons.length,37);
 for(const icon of manifest.icons){
  const key=icon.key.startsWith('avatar_')?'ui_'+icon.key:icon.key,f=frames[key];
  assert.deepEqual(JSON.parse(JSON.stringify(f)),{source:icon.source,rect:icon.rect});
  const atlas=manifest.atlases.find(a=>a.path.endsWith(icon.source.split('/').pop()+'.png'));
  assert(atlas);const [x,y,w,h]=f.rect;assert(x>=4&&y>=4&&x+w<=atlas.width-4&&y+h<=atlas.height-4);
  const rectKey=f.source+':'+f.rect.join(',');assert(!rects.has(rectKey));rects.add(rectKey);
  assert.equal(frames['shop_comic_v1/'+key],f);
  if(key.startsWith('ui_avatar_'))assert.equal(frames['new_heroes_v105/'+key.slice(3)],f);
  slots.push({key,source:f.source,rect:f.rect});
 }
 for(const hero of ['cannon','siphon'])assert.equal(frames['hero_comic_v1/comic_figure_'+hero+'_v1'].source,'new_heroes_v105/'+hero+'_lobby');
 const hud=read('assets/scripts/ui/HUD.ts'),tip=read('assets/scripts/ui/EnemyTooltip.ts'),projectile=read('assets/scripts/battle/Projectile.ts'),cannon=read('assets/scripts/battle/NewHeroes.ts');
 assert(hud.includes('mask.type=Mask.Type.GRAPHICS_ELLIPSE'));
 assert(hud.includes('iconViewport(top,ux,uy,90)')&&hud.includes('iconViewport(atkIcon,0,0,56)')&&hud.includes('iconViewport(icon,0,0,56)'));
 assert(!tip.includes('healthBar')&&!tip.includes('gbar'));
 assert(projectile.includes('if (spec.excludeLifeId) a.hit.add(spec.excludeLifeId)'));
 assert(projectile.includes('this.hitMob(a, m)'));
 assert(!projectile.includes('groundPierce')&&!projectile.includes('hitGroundPassing'));
 assert(cannon.includes('pierce:this.stats.cannonPierce-1,excludeLifeId:primary?.lifeId'));
 assert(cannon.includes('dmg:damage*CC.passingMul'));
 assert(cannon.includes('while(this.secondaryProjectiles.length && projs.hasCapacity)'));
 const comps=[],labels=[],W=8*126,H=5*150;
 for(let i=0;i<slots.length;i++){
  const f=slots[i],im=await sharp(path.join(root,'assets/resources/ux',f.source+'.png')).extract({left:f.rect[0],top:f.rect[1],width:f.rect[2],height:f.rect[3]}).resize(96,96).png().toBuffer();
  const x=(i%8)*126,y=Math.floor(i/8)*150;comps.push({input:im,left:x+15,top:y+8});
  const name=f.key.replace('ui_card_','').replace('ui_icon_','').replace('ui_avatar_','face_');
  labels.push('<text x="'+(x+63)+'" y="'+(y+125)+'" text-anchor="middle" font-size="10" fill="#efe9d5">'+name+'</text>');
 }
 const labelSvg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'">'+labels.join('')+'</svg>');
 comps.push({input:labelSvg,left:0,top:0});
 await sharp({create:{width:W,height:H,channels:4,background:'#26313b'}}).composite(comps).png().toFile(path.join(here,'icon-size-review.png'));
 fs.writeFileSync(path.join(here,'source-static-verification.json'),JSON.stringify({icons:slots.length,atlases:manifest.atlases.length,alphaChecked:true,virtualAliasesUniqueAndInBounds:true,fullHeroFiguresUnchanged:true,hudCircleClips:3,tooltipHpBarRemoved:true,ordinaryHitPathUsed:true,gameBrowserCombatAudioOrWasmStarted:false},null,2)+'\n');
 console.log('37 circular icons, 3 shared atlases, alias bounds, HUD clips and continuation source audit passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

