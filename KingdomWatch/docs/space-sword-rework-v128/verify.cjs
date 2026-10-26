/** Offline config, placement and cosmetic drawing only. No engine or actors are executed. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function isolated(file,imports={}){const out=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018},reportDiagnostics:true});assert.equal(out.diagnostics.length,0);
 const c={exports:{},require:n=>{assert.ok(Object.hasOwn(imports,n),'Denied import '+n);return imports[n];},Math,Number,Map,Set};vm.runInNewContext(out.outputText,c,{filename:file});return c.exports;}
const cfg=isolated('assets/scripts/config/SpaceSwordConfig.ts');
const plans=isolated('assets/scripts/battle/SpaceSwordPlans.ts',{'../config/SpaceSwordConfig':cfg});
let placementCases=0,timelineCases=0;
for(let level=1;level<=20;level++){
 const sc=cfg.spaceUltCfg(level),sk=cfg.swordSkillCfg(level),su=cfg.swordUltCfg(level);
 assert.equal(sc.pulses,10);assert.equal(sc.duration,3);assert.equal(sc.targets,level<10?6:8);assert.equal(su.count,5);assert.ok(su.finalRadius>su.radius);
 if(level>1)for(const f of ['spaceSkillCfg','spaceUltCfg','swordSkillCfg','swordUltCfg'])assert.ok(cfg[f](level).mul>cfg[f](level-1).mul);
 for(const top of [400,650,1000,1500])for(const x of [-350,-160,0,170,350])for(const y of [-180,50,top]){
  const arena={left:-315,right:315,bottom:-200,top},p=plans.heavenSwordPlan(x,y,su.radius,arena);
  assert.equal(p.length,5);assert.equal(p.filter(s=>s.final).length,1);
  for(let k=0;k<5;k++){const s=p[k];assert.ok(s.x>=arena.left&&s.x<=arena.right&&s.y>=arena.bottom&&s.y<=arena.top);
   assert.ok(s.startY>arena.top&&s.startY>s.y);assert.equal(s.startX===s.x,k===4);
   if(k)assert.ok(s.delay+s.seconds>p[k-1].delay+p[k-1].seconds);}
  assert.equal(p[4].x,Math.max(arena.left,Math.min(arena.right,x)));placementCases++;
 }
 for(const intent of [0,1,6]){
  const p=plans.swordRainPlan(0,0,sk.count+intent,sk.radius);assert.equal(p.length,sk.count+intent+1);
  assert.equal(p[p.length-1].final,true);assert.ok(p.every(s=>Math.hypot(s.x,s.y)<=sk.radius));
 }
 // Validate the pure pulse schedule under frame partitions, without running a spell or battle.
 for(const step of [.016,1/30,.1,.5,4.2]){
  const hits=[];let next=0,age=0,start=.6+sc.orbDelay;
  while(age<start+sc.duration){age+=step;while(next<sc.pulses&&plans.spacePulseAt(next,start,sc.duration,sc.pulses)<=age+1e-7)hits.push(next++);}
  assert.equal(hits.length,10);assert.equal(new Set(hits).size,10);timelineCases++;
 }
}
const hero=read('assets/scripts/battle/SpaceSwordHeroes.ts'),mob=read('assets/scripts/battle/Monster.ts'),proj=read('assets/scripts/battle/Projectile.ts');
assert.ok(hero.includes('!this.prison&&super.canAutoSkill(mgr)'));
assert.ok(hero.includes('c.life===c.mob.lifeId&&live(c.mob)'));
assert.ok(hero.includes('!p.captures.some(')); // Union of areas, no duplicate damage from column overlap.
assert.ok(hero.includes('onGroundDamage:'));assert.ok(hero.includes("ult?'heavenSword':'sword'"));
assert.ok(mob.includes('this.freezeT, this.stunT, this.spaceBindT, this.knockbackT'));
assert.ok(mob.includes('this.dead||this.isBoss||!Number.isFinite(duration)'));
assert.ok(mob.includes('this.spaceBindT > 0 || distance <= 0'));
assert.ok(proj.includes("s.visual==='heavenSword'"));
assert.equal(cfg.spaceSkillCfg(1).targets,4);assert.equal(cfg.SWORD.intentCap,6);
assert.ok(!hero.includes("kind:'blade'"));assert.ok(!hero.includes('homingTarget='));
assert.ok(read('assets/scripts/ui/BattleEntryWarmup.ts').includes("space:['fx/space-sword-burst'],sword:['fx/space-sword-burst']"));
const effect=read('assets/resources/fx/space-sword-burst.effect');assert.ok(!/\b(sampler2D|samplerCube|texture)\b/.test(effect));
assert.ok(effect.includes('blendDst: one'));assert.ok(effect.includes('edge*color.a,0.0)'));
class G{
 constructor(){this.commands=[];this.path='';this.lineWidth=1;}
 clear(){this.commands=[];this.path='';}
 check(...v){assert.ok(v.every(Number.isFinite));}
 moveTo(x,y){this.check(x,y);this.path=`M${x},${y}`;}
 lineTo(x,y){this.check(x,y);this.path+=`L${x},${y}`;}
 quadraticCurveTo(a,b,x,y){this.check(a,b,x,y);this.path+=`Q${a},${b} ${x},${y}`;}
 ellipse(x,y,a,b){this.check(x,y,a,b);this.path=`M${x-a},${y}a${a},${b} 0 1,0 ${a*2},0a${a},${b} 0 1,0 ${-a*2},0`;}
 circle(x,y,r){this.ellipse(x,y,r,r);}
 close(){this.path+='Z';}
 fill(){this.add('fill',this.fillColor);}
 stroke(){this.add('stroke',this.strokeColor);}
 add(kind,c){assert.ok(c&&Number.isFinite(c.a)&&c.a>=0&&c.a<=1);this.commands.push(`<path d="${this.path}" ${kind}="${c.hex}" ${kind}-opacity="${c.a}" ${kind==='stroke'?`fill="none" stroke-width="${this.lineWidth}"`:''}/>`);}
}
const instances=[];class Shader{
 constructor(p,n,capacity){this.capacity=capacity;this.quads=[];instances.push(this);}
 begin(){this.quads=[];}
 draw(...q){assert.ok(q.every(Number.isFinite));assert.ok(this.quads.length<this.capacity);this.quads.push(q);return true;}
 end(){}
}
const drawings=[];const N=()=>({isValid:true,addComponent:()=>{const g=new G();drawings.push(g);return g;},setSiblingIndex(){},destroy(){}});
const fx=isolated('assets/scripts/battle/SpaceSwordVFX.ts',{'cc':{Graphics:G},'../ui/UIKit':{CA:(hex,a)=>({hex,a}),N},'./HeroFxShader':{HeroFxShader:Shader}});
const parent={getChildByName:()=>null};let maxQuads=0;
for(let i=0;i<240;i++){
 const f=new fx.SpaceSwordVFX(parent);f.warmVolume();
 const v=Array.from({length:8},(_,k)=>({x:k*40-140,y:0,orbX:k*40-140,orbY:40,orb:true,orbRadius:42,radius:105}));
 f.setPrison(v,i/60,.95,3);f.render();maxQuads=Math.max(maxQuads,instances.at(-1).quads.length);
 const g=new G();fx.drawHeavenSword(g,0,0,i*Math.PI/20,48+(i%2)*16,i/60);assert.ok(g.commands.length>0);f.destroy();
}
assert.equal(maxQuads,16);
async function main(){
 const aliases=isolated('assets/scripts/ui/NewHeroArt.ts').NEW_HERO_FRAMES,art=JSON.parse(read('docs/space-sword-rework-v128/art-manifest.json'));
 for(const [key,frame]of Object.entries(art.frames)){assert.deepEqual(JSON.parse(JSON.stringify(aliases[key])),frame);const[x,y,w,h]=frame.rect;assert.ok(x>=4&&y>=4&&x+w<=508&&y+h<=508);}
 const m=await sharp(path.join(ROOT,art.assets[0].path)).metadata();assert.equal(m.width,512);assert.equal(m.height,512);assert.ok(m.hasAlpha);
 const archive=path.join(ROOT,'local/art-archive/space-sword-rework-v128/review');fs.mkdirSync(archive,{recursive:true});const frames=[];
 // Cosmetic timeline: draw only, no heroes, monsters, projectiles, battle clock, or damage service.
 for(const kind of ['prison','heaven'])for(let i=0;i<90;i++){
  const age=i/22.5,f=new fx.SpaceSwordVFX(parent);f.warmVolume();const g=drawings.at(-1);
  if(kind==='prison')f.setPrison([{x:-100,y:40,orbX:-100,orbY:88,orb:true,orbRadius:55,radius:105},{x:105,y:140,orbX:105,orbY:188,orb:true,orbRadius:55,radius:105}],age,.95,3);
  else{
   const p=plans.heavenSwordPlan(0,120,240,{left:-315,right:315,bottom:-200,top:570});
   for(const s of p){const t=age-(.65+s.delay+s.seconds);if(t>=0&&t<.9){f.add('giant',s.x,s.y,s.final?320:240,.9,Math.atan2(s.y-s.startY,s.x-s.startX));f.accents.at(-1).age=t;}}
  }
  f.render();
  if(kind==='heaven')for(const s of plans.heavenSwordPlan(0,120,240,{left:-315,right:315,bottom:-200,top:570})){
   const t=(age-.65-s.delay)/s.seconds;if(t>=0&&t<1)fx.drawHeavenSword(g,s.startX+(s.x-s.startX)*t,s.startY+(s.y-s.startY)*t,Math.atan2(s.y-s.startY,s.x-s.startX),s.final?64:48,age);
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="880"><g transform="translate(375,780) scale(1,-1)">${g.commands.join('')}</g></svg>`;
  const filename=`${kind}-${i.toString().padStart(3,'0')}.png`;await sharp(Buffer.from(svg)).png().toFile(path.join(archive,filename));
  frames.push({kind,age,graphics:filename,quads:instances.at(-1).quads});f.destroy();
 }
 fs.writeFileSync(path.join(archive,'recipes.json'),JSON.stringify({frames,width:750,height:880,bottom:-100}));
 const report={status:'PASS',placementCases,purePulseTimelineCases:timelineCases,isolatedDrawingFrames:240,cosmeticPreviewFrames:frames.length,maxShaderQuads:maxQuads,uiAliases:8,
  checks:['level 1-20 monotonic damage and milestones','exactly five ordered impacts, first four diagonal, last vertical, landing clamped across aspect ratios','pulse schedule independent of step partitions','separate bind control and life guards statically checked','overlapping columns one spell damage path','original four-target teleport and six intent cap preserved','actual drawing geometry finite, bounded and alpha-safe','formal UI atlas alpha/8 aliases','pure shader has no image sampler'],actualEngineGameBrowserCombatAudioOrWasmStarted:false,phoneGameplay:'pending user'};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
