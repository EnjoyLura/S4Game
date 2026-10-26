/** Pure geometry and isolated cosmetic-state checks; no game, battle, browser, audio or WASM. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const baseline='d0213296';
function load(file,deps={}) {
  const result=ts.transpileModule(read(file),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
  const module={exports:{}};
  vm.runInNewContext(result.outputText,{exports:module.exports,module,require:name=>{assert(name in deps,name);return deps[name];},Math,console});
  return module.exports;
}
const near=(a,b,t=1e-7)=>assert(Math.abs(a-b)<=t,`${a} != ${b}`);
const g=load('assets/scripts/battle/WindNinjaGeometry.ts');
// A side-tip contact that the old centre-point sweep misses, plus exact limits and fast motion.
near(g.sweptBladeEntry(70,48,100,30,20),.6128220211291865);
assert.equal(g.sweptBladeEntry(70,50.01,100,30,20),Infinity);
near(g.sweptBladeEntry(70,50,100,30,20),.7);
near(g.sweptBladeEntry(2,25,0,30,20),0);
assert.equal(g.sweptBladeEntry(-21,0,100,30,20),Infinity);
near(g.sweptBladeEntry(700,29,840,30,20),680/840);
// Independent distance-to-static-segment oracle at the reported first contact.
let seed=126,contacts=0;
const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<2400;i++) {
  const along=rnd()*1000-100,across=rnd()*180-90,travel=rnd()*850,h=rnd()*45,r=5+rnd()*35;
  const t=g.sweptBladeEntry(along,across,travel,h,r);
  const distance=u=>Math.hypot(along-travel*u,Math.max(0,Math.abs(across)-h));
  if(Number.isFinite(t)) {
    contacts++;assert(t>=0&&t<=1);assert(distance(t)<=r+1e-7);
    if(t>1e-6)assert(distance(t-1e-6)>r-1e-7);
  } else {
    const nearest=Math.max(0,Math.min(1,along/travel));assert(distance(nearest)>r-1e-7);
  }
  // Rotate both the blade and target: the same contact time must result in every direction.
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2,.7]) {
    const ux=Math.cos(angle),uy=Math.sin(angle),x=along*ux-across*uy,y=along*uy+across*ux;
    const rotated=g.sweptBladeEntry(x*ux+y*uy,-x*uy+y*ux,travel,h,r);
    if(Number.isFinite(t))near(rotated,t);else assert.equal(rotated,Infinity);
  }
}
for(let i=0;i<1600;i++) {
  const p={x:rnd()*600-300,y:rnd()*1000},before={...p},target={x:rnd()*600-300,y:rnd()*1000};
  const dt=rnd()*10;
  g.moveFieldToward(p,target,82,dt,true);
  assert(p.y>=before.y);assert(Math.hypot(p.x-before.x,p.y-before.y)<=82*dt+1e-7);
}
const oldMotion={x:0,y:0};g.moveFieldToward(oldMotion,{x:300,y:400},82,1);near(oldMotion.x,49.2);near(oldMotion.y,65.6);
const forwardBounds={left:-300,right:300,bottom:300,top:800};
const point=g.densestBodyArea([{x:0,hitY:100},{x:1,hitY:110},{x:200,hitY:500}],0,300,Infinity,120,forwardBounds);
assert(point&&point.y===500);

// Real energy class with inert nodes/materials: shared size, ready, accepted release and disposal.
class Node {
  static EventType={NODE_DESTROYED:'destroy'};
  constructor(){this.isValid=true;this.components=[];this.events={};}
  setParent(p){this.parent=p;}setPosition(x,y){this.x=x;this.y=y;}
  addComponent(C){const c=new C();this.components.push(c);return c;}
  once(e,fn){this.events[e]=fn;}
}
class UITransform {setContentSize(w,h){this.width=w;this.height=h;}}
class Sprite {static SizeMode={CUSTOM:0};}
class Vec4 {constructor(...args){this.set(...args);}set(...args){this.values=args;}}
class Material {initialize(){}setProperty(k,v){this[k]=v;}destroy(){this.destroyed=true;}}
const cc={Node,UITransform,Sprite,Vec4,Material,EffectAsset:class{},Layers:{Enum:{UI_2D:1}},resources:{load:(key,C,done)=>done(null,{})}};
const Fx=load('assets/scripts/ui/UltEnergyFx.ts',{'cc':cc,'./Ux':{uxFrame:(key,done)=>done({})}}).UltEnergyFx;
const skill=new Fx(new Node(),0,0,'#55D8C3',56),ult=new Fx(new Node(),0,0);
near(skill.node.components[0].width,168*56/90);near(ult.node.components[0].width,168);
assert(skill.loaded);skill.sync(0,1,true);assert.equal(skill.state.values[2],1);
skill.sync(.1,1,true);skill.release();assert.equal(skill.state.values[2],-1);
skill.sync(.1,.02,false);assert.equal(skill.state.values[2],-1);
for(let i=0;i<6;i++)skill.sync(.1,.03,false);
assert.equal(skill.state.values[2],0);skill.sync(.1,1,true);assert.equal(skill.state.values[2],1);
const mat=skill.material;skill.node.events.destroy();assert(mat.destroyed&&!skill.loaded);

const hero=read('assets/scripts/battle/Hero.ts'),newHeroes=read('assets/scripts/battle/NewHeroes.ts');
const wind=read('assets/scripts/battle/WindNinjaHeroes.ts'),projectile=read('assets/scripts/battle/Projectile.ts');
const hud=read('assets/scripts/ui/HUD.ts'),monster=read('assets/scripts/battle/Monster.ts');
assert.equal((hero+newHeroes+wind).match(/this\.beginSkillCooldown\(\)/g).length,9);
assert.equal((hero+newHeroes+wind).match(/this\.skillCd = this\.skillCdTotal;/g).length,1);
assert.match(hero,/this\.skillCastSerial\+\+/);assert.match(hero,/this\.skillCd = \.15; return/);
assert.match(hud,/s\.lastCastSerial !== hero\.skillCastSerial/);assert.match(hud,/s\.energy\.release\(\)/);
assert.match(hud,/s\.energy\.sync\(dt, hero\.skillPct, !cooling\)/);
assert.match(wind,/a\.radius, a\.y\)/);assert.match(wind,/moveFieldToward\(a, a\.destination, WIND\.tornadoSpeed, step, true\)/);
assert.match(wind,/a\.pull \* step, a\.kind === 'tornado'/);assert.match(monster,/forwardOnly\?Math\.max\(restY,clampedY\):clampedY/);
assert.match(projectile,/this\.hitMob\(a, m\)/);assert.match(projectile,/a\.hit\.add\(m\.lifeId\)/);
const changed=cp.execFileSync('git',['diff','--name-only',baseline,'--','KingdomWatch/assets'],{cwd:path.resolve(root,'..'),encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).sort();
assert.equal(changed.length,9);assert(changed.every(p=>p.endsWith('.ts')));
const report={status:'PASS',baseline,changedAssets:changed,geometryCases:2400,rotationCases:12000,contacts,
  forwardMovementCases:1600,skillCastSites:9,sharedEnergyReadyReleaseAndDisposal:true,
  gameBattleBrowserAudioOrWasmExecuted:false,phoneGameplayReview:'pending user'};
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
