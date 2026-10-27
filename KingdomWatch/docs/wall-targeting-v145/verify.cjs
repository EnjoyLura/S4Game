// Isolated geometry and actual casting methods; never starts engine, battle or audio.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const ROOT=path.resolve(__dirname,'../..'),baseline='d6829713';
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
function compile(src,context={}){const c={exports:{},Math,Number,...context};vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,c);return c.exports;}
const cache=new Map();function pure(file){if(cache.has(file))return cache.get(file);assert.ok(!/Hero\.ts$/.test(file));
 const value=compile(read(file),{require:n=>{assert.ok(n.startsWith('.'),'External runtime denied');return pure(path.posix.normalize(path.posix.join(path.posix.dirname(file),n+'.ts')));}});cache.set(file,value);return value;}
const geoFile='assets/scripts/battle/WindNinjaGeometry.ts',geo=pure(geoFile);
const old=compile(cp.execFileSync('git',['show',baseline+':KingdomWatch/'+geoFile],{cwd:path.resolve(ROOT,'..'),encoding:'utf8'}));
const configs={...pure('assets/scripts/config/ScytheConfig.ts'),...pure('assets/scripts/config/ThunderLanceConfig.ts'),...pure('assets/scripts/config/MagicBowConfig.ts'),...pure('assets/scripts/config/SpaceSwordConfig.ts'),
 ...pure('assets/scripts/battle/ThunderLancePlans.ts'),...pure('assets/scripts/battle/SpaceSwordPlans.ts'),...pure('assets/scripts/battle/UltimateTiming.ts')};
function method(file,klass,name){const f=ts.createSourceFile(file,read('assets/scripts/battle/'+file),ts.ScriptTarget.Latest,true);
 const c=f.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text===klass);assert.ok(c,klass);
 const m=c.members.find(n=>n.name?.getText(f)===name);assert.ok(m,name);return m.getText(f);}
const sets=[['scythe','ScytheHero.ts','ScytheHero',null],['lance','ThunderLanceHero.ts','ThunderLanceHero','ThunderLanceHero'],
 ['arcane','MagicBowHero.ts','MagicBowHero','MagicBowHero'],['sword','SpaceSwordHeroes.ts','SwordHero','SpaceSwordBase']];
const live=m=>!m.dead&&m.node.isValid&&m.node.activeInHierarchy;
function caster(set,geometry,half){const[id,file,klass,denseClass]=set;
 const context={...configs,densestBodyArea:geometry.densestBodyArea,live,Sfx:{cast(){}},
  DESIGN_W:750,LINE_Y:-half+154,HERO_Y:-half+122,LO:{half,notchTop:0},T:id==='scythe'?configs.SCYTHE_TIMING:configs.MAGIC_BOW_TIMING};
 const body=(denseClass?method(file,denseClass,'dense'):'')+method(file,klass,'castSkill')+method(file,klass,'castUlt');
 const C=compile('export class CastMethods {'+body+'}',context).CastMethods,h=new C();
 Object.assign(h,{id,x:0,stats:{skillLv:1,ultLv:1,skillRange:1200,skillRangeMul:1,defIgnore:0},pending:[],fields:[],spins:[],intent:0,serial:0,facing:1,
  charge:100,ultReady:true,reap:null,ultimatePending:false,cooldowns:0,ultimates:0,
  beginSkillCooldown(){this.cooldowns++;},beginUltimate(){this.ultimates++;},abilityDamage:n=>n*100,animateAttack(){},effects:()=>new Proxy({},{get:()=>()=>{}})});
 return h;}
let casts=0,oldFailures=0,covered=0;
for(const half of [450,667,900])for(const x of [-300,0,300])for(const radius of [12,22,48,80])for(const set of sets){
 const line=-half+154,bodyY=line+radius*.5-8,groundY=bodyY-radius*.82+radius*3.85*(3/160);
 const mob={x,y:bodyY,hitY:bodyY,groundY,dead:false,state:'attack',node:{isValid:true,activeInHierarchy:true}};
 for(const slot of ['castSkill','castUlt']){
  const h=caster(set,geo,half),mgr={list:[mob]};h[slot](mgr,{},{});
  assert.equal(slot==='castSkill'?h.cooldowns:h.ultimates,1,`${set[0]} ${slot} failed at wall`);
  const points=set[0]==='scythe'?(slot==='castSkill'?h.spins:[h.reap]):h.pending.map(p=>p.cast||p);
  assert.ok(points.length>0);assert.ok(points.every(p=>Number.isFinite(p.x+p.y)));
  const y=set[0]==='lance'||set[0]==='arcane'?groundY:bodyY;
  const r=set[0]==='scythe'?(slot==='castSkill'?configs.scytheSkillCfg(1):configs.scytheUltCfg(1)).radius:
   set[0]==='lance'?(slot==='castSkill'?configs.LANCE.radius:configs.lanceUltCfg(1).radius):
   set[0]==='arcane'?(slot==='castSkill'?configs.magicBowSkillCfg(1):configs.magicBowUltCfg(1)).radius:
   (slot==='castSkill'?configs.swordSkillCfg(1):configs.swordUltCfg(1)).finalRadius||configs.swordSkillCfg(1).radius;
  assert.ok(points.some(p=>(p.x-x)**2+(p.y-y)**2<=r*r),`${set[0]} damage footprint misses wall target`);covered++;casts++;
 }
}
// Reproduce all eight broken casting entrances using unchanged v144 methods + old geometry.
for(const set of sets)for(const slot of ['castSkill','castUlt']){
 const h=caster(set,old,667),m={x:0,hitY:-510,groundY:-520,dead:false,node:{isValid:true,activeInHierarchy:true}};
 h[slot]({list:[m]},{},{});assert.equal(h.cooldowns+h.ultimates,0);assert.equal(h.charge,100);oldFailures++;
 const fixed=caster(set,geo,667);fixed[slot]({list:[{...m,dead:true}]},{},{});assert.equal(fixed.cooldowns+fixed.ultimates,0);
 const empty=caster(set,geo,667);empty[slot]({list:[]},{},{});assert.equal(empty.cooldowns+empty.ultimates,0);
}
const bounds={left:-345,right:345,bottom:50,top:700},area=geo.densestBodyArea;
assert.ok(area([{x:0,hitY:-50}],0,0,1000,100,bounds),'exact circle boundary');
assert.equal(area([{x:0,hitY:-50.001}],0,0,1000,100,bounds),null);
assert.equal(area([{x:0,hitY:701}],0,0,1000,100,bounds),null,'top exclusion');
assert.equal(area([{x:346,hitY:100}],0,0,1000,100,bounds),null,'side exclusion');
assert.equal(area([{x:0,hitY:100}],0,0,90,100,bounds),null,'cast range');
assert.equal(area([{x:NaN,hitY:100},{x:0,hitY:NaN},{x:0,hitY:100,dead:true}],0,0,1000,100,bounds),null);
let ordinary=0;
for(let i=0;i<300;i++){const bodies=Array.from({length:12},(_,k)=>({x:Math.sin(i*3.1+k*5.7)*340,hitY:50+(Math.cos(i*.9+k*1.7)+1)*320}));
 assert.equal(JSON.stringify(area(bodies,0,-32,900,80+i%180,bounds)),JSON.stringify(old.densestBodyArea(bodies,0,-32,900,80+i%180,bounds)));ordinary++;}
// Exercise the actual wind helper: initial wall coverage, but no backward tornado retargeting.
const wf=ts.createSourceFile('wind',read('assets/scripts/battle/WindNinjaHeroes.ts'),ts.ScriptTarget.Latest,true);
const cluster=wf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='cluster').getText(wf);
const wind=compile(cluster+'\nexports.cluster=cluster;', {densestBodyArea:area,liveNode:live,LINE_Y:0,DESIGN_W:750,LO:{half:667,notchTop:0}});
const wm={x:0,hitY:0,dead:false,node:{isValid:true,activeInHierarchy:true}};
assert.ok(wind.cluster({list:[wm]},0,-32,1000,120));
assert.equal(wind.cluster({list:[{...wm,hitY:190}]},0,200,1000,120,200),null);
assert.equal(wind.cluster({list:[{...wm,node:{isValid:true,activeInHierarchy:false}}]},0,-32,1000,120),null);
const result={status:'PASS',baseline,oldFailedEntrances:oldFailures,actualCastCallbacks:casts,damageFootprintsCoverTarget:covered,viewports:3,ordinaryClustersUnchanged:ordinary,
 boundaryAndRangeChecks:true,deadAndEmptyDoNotConsume:true,tornadoForwardOnlyPreserved:true,gameEngineBattleBrowserAudioWasmStarted:false};
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
