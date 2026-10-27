// Isolated real cosmetic classes and controlled callbacks; no engine, real battle, browser/audio/WASM.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'),nodes=[],shaders=[];
class Color {constructor(r=255,g=255,b=255,a=255){Object.assign(this,{r,g,b,a});}}
class Node {static EventType={NODE_DESTROYED:'destroyed'};constructor(name){Object.assign(this,{name,children:[],active:true,activeInHierarchy:true,isValid:true,x:0,y:0,angle:0,handlers:[]});nodes.push(this);}
 setParent(p){this.parent=p;p.children.push(this);}getChildByName(n){return this.children.find(c=>c.name===n)||null;}
 addComponent(C){const c=new C();c.node=this;this[C.name]=c;return c;}once(e,cb){this.handlers.push(cb);}
 setPosition(x,y){assert.ok([x,y].every(Number.isFinite));Object.assign(this,{x,y});}setRotationFromEuler(x,y,angle){assert.ok(Number.isFinite(angle));this.angle=angle;}
 setSiblingIndex(){}getSiblingIndex(){return 0;}destroy(){this.isValid=false;this.handlers.forEach(cb=>cb());this.children.forEach(n=>n.destroy());}}
class Rect {constructor(x=0,y=0,width=0,height=0){Object.assign(this,{x,y,width,height});}}
class Size {constructor(width,height){Object.assign(this,{width,height});}}
class Vec2 {constructor(x=0,y=0){Object.assign(this,{x,y});}}
class SpriteFrame {reset(o){Object.assign(this,o);}}
class Sprite {static SizeMode={CUSTOM:0};set color(c){this.tint={...c};}}
class UITransform {setAnchorPoint(x,y){this.anchor=[x,y];}setContentSize(w,h){assert.ok([w,h].every(n=>Number.isFinite(n)&&n>0));this.size=[w,h];}}
class JsonAsset {}
class Graphics {clear(){}moveTo(...v){assert.ok(v.every(Number.isFinite));}lineTo(...v){assert.ok(v.every(Number.isFinite));}ellipse(){}circle(){}close(){}fill(){}stroke(){}}
function below(node){for(let p=node;p;p=p.parent)if(p.name==='GroundFxLayer')return true;return false;}
class Shader {constructor(parent,name,capacity){this.parent=parent;this.name=name;this.capacity=capacity;this.ready=true;this.quads=[];shaders.push(this);}
 begin(){this.quads=[];}draw(...q){assert.ok(q.every(Number.isFinite));if(!this.ready||this.quads.length>=this.capacity)return false;this.quads.push(q);return true;}end(){}}
const cc={Node,Color,Sprite,SpriteFrame,UITransform,Rect,Size,Vec2,JsonAsset,Graphics,Layers:{Enum:{UI_2D:1}},
 resources:{load(p,T,cb){cb(null,{json:JSON.parse(read('assets/resources/'+p+'.json'))});}}};
const ux={uxFrame(p,cb){const meta=JSON.parse(read('assets/resources/'+p+'.png.meta')),s=Object.values(meta.subMetas).find(s=>s.importer==='sprite-frame').userData;
 const frame=new SpriteFrame();frame.reset({texture:p+'.png',rect:new Rect(0,0,s.width,s.height)});cb(frame);},promoteUXArt(){}};
function isolated(file,imports={}){const js=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018},reportDiagnostics:true});assert.equal(js.diagnostics.length,0);
 const c={exports:{},require:n=>{assert.ok(Object.hasOwn(imports,n),'Denied '+n);return imports[n];},Math,Number,Map,Set,WeakMap,Promise};vm.runInNewContext(js.outputText,c,{filename:file});return c.exports;}
const config=isolated('assets/scripts/config/ScytheConfig.ts'),T=config.SCYTHE_TIMING;
const plans=isolated('assets/scripts/battle/ScythePlans.ts',{'../config/ScytheConfig':config});
const geometry=isolated('assets/scripts/battle/WindNinjaGeometry.ts');
const atlas=isolated('assets/scripts/battle/ScytheAtlas.ts',{'cc':cc,'../ui/Ux':ux});
const n=(name,p)=>{const node=new Node(name);node.setParent(p);return node;};
const ui={N:n,CA:(hex,a)=>{assert.ok(Number.isFinite(a)&&a>=0&&a<=1);return {hex,a};}};
const fx=isolated('assets/scripts/battle/ScytheVFX.ts',{'cc':cc,'../ui/UIKit':ui,'./ScytheAtlas':atlas,'./HeroFxShader':{HeroFxShader:Shader},'./ScythePlans':plans,'../config/ScytheConfig':config});
const root=new Node('field'),ground=n('GroundFxLayer',root),mobs=n('MobLayer',root),proj=n('ProjLayer',root);n('FxLayer',root);n('TextLayer',root);
function snapshot(){return {sprites:nodes.filter(n=>n.active&&n.isValid&&n.Sprite&&n.Sprite.spriteFrame&&n.parent?.isValid).map(n=>({
 texture:n.Sprite.spriteFrame.texture,rect:n.Sprite.spriteFrame.rect,x:n.x,y:n.y,angle:n.angle,anchor:n.UITransform.anchor,size:n.UITransform.size,
 alpha:n.Sprite.tint.a/255,plane:n.parent.name,belowMobs:below(n)})),shaders:shaders.filter(s=>s.parent.isValid).flatMap(s=>s.quads.map(q=>({q,belowMobs:below(s.parent)})))};}
function callbacks(){
 class Base {constructor(){this.node=new Node('hero');this.node.setParent(n('HeroLayer',root));this.stats={ultLv:1,skillLv:1,skillRangeMul:1,defIgnore:0,skillRange:1180};this.x=0;this.ultReady=true;this.charge=80;this.ultimateT=0;}
  abilityDamage(m){return m*100;}beginUltimate(d){this.ultimateT=d;}animateAttack(){}ultimateBeat(){}beginSkillCooldown(){}selectNormalTarget(){return null;}}
 const noop=()=>{},effect={tick:noop,hit:noop,swing:noop,destroy:noop};
 const Hero=isolated('assets/scripts/battle/ScytheHero.ts',{'cc':cc,'./Hero':{HeroBase:Base},'../config/GameConfig':{DESIGN_W:750,HERO_Y:0,LINE_Y:-100,LO:{half:900,notchTop:0}},
  '../config/ScytheConfig':config,'./ScythePlans':plans,'../core/Sfx':{Sfx:{cast:noop,shoot:noop,impact:noop}},'../ui/Ux':{artSprite:noop},'../ui/UIKit':ui,
  './WindNinjaGeometry':{...geometry,densestBodyArea:()=>({x:0,y:400})},'./ScytheVFX':{ScytheVFX:class {}}}).ScytheHero;
 const run=(steps)=>{
  const hero=new Hero(),events=[[],[],[]],fake=[{x:0,hitY:400},{x:321,hitY:400},{x:0,hitY:720}].map((p,i)=>({...p,dead:false,node:{isValid:true,activeInHierarchy:true},
   takeDamage(v,...rest){events[i].push({damage:v,heavy:rest[5]});this.lastDamageTaken=v;}}));
  let stat=0;hero.effects=()=>effect;assert.ok(hero.castUlt({list:fake},{hasCapacity:false},{add:(id,v)=>{stat+=v;}}));
  assert.equal(hero.charge,0);assert.equal(hero.castUlt({list:fake},{},{}),false,'overlapping ult');
  for(const dt of steps)hero.updateQueues(dt,{list:fake},{hasCapacity:false});
  return {hero,events,stat};
 };
 const before=run([0,.61]);assert.equal(before.events[0].length,0,'damage before region rises');
 const regular=run(Array(240).fill(1/60)),coarse=run([.1,.8,.7,1.5,.9]),jump=run([4]);
 for(const r of [regular,coarse,jump]){assert.equal(r.events[0].length,9);assert.equal(r.events[1].length,0);assert.equal(r.events[2].length,9);
  assert.ok(Math.abs(r.events[0].reduce((s,e)=>s+e.damage,0)-810)<1e-8);assert.equal(r.events[0][8].damage,162);assert.equal(r.hero.reap,null);assert.equal(r.stat,1620);}
 const paused=run([.7,0,0,0]);assert.equal(paused.events[0].length,1);
 paused.hero.node.destroy();assert.equal(paused.hero.reap,null);
 return {actualCallbacks:true,pulses:9,finalMultiplier:2,totalBaseMultiplier:8.1,outsideNotHit:true,boundaryHit:true,coarseStepCatchup:true,pauseStable:true,independentOfProjectileCapacity:true};
}
async function main(){
 const damage=callbacks();await atlas.warmScytheAtlas('visible');assert.ok(atlas.scytheAtlasReady());
 for(let lv=1;lv<=20;lv++){const c=config.scytheUltCfg(lv),growth=(1+(lv-1)*.08)*(lv>=20?1.2:1),old=8.1*growth*(lv>=5?1.1:1)*(lv>=10?1.15:1);
  assert.ok(Math.abs(c.mul*(c.hits-1+c.finalMul)-old)<1e-9);}
 for(const age of [-1,0,.61,.62,1,3,100])assert.ok(plans.scytheReapPulseCount(age,9)>=0&&plans.scytheReapPulseCount(age,9)<=9);
 assert.equal(plans.scythePulseCount(100,4),10);assert.equal(plans.scythePulseCount(T.skillWindup+T.throw-.001,4),0);
 for(const x of [-43,0,43])assert.ok(Number.isFinite(plans.scytheBladeEntry(-.3*x*x/43+50,x,100,43,4)));
 const pool=new atlas.ScytheAtlas(proj,'scytheBlenderProjectiles',40),count=nodes.length;
 for(let i=0;i<10;i++){pool.begin();for(let k=0;k<45;k++)assert.equal(pool.draw('blade',0,0,43,i/60),k<40);pool.end();}assert.equal(count,nodes.length);
 pool.begin();pool.end();
 const records=[];
 for(const kind of ['normal','skill','ultimate']){
  const effect=new fx.ScytheVFX(root),c=config.scytheUltCfg(1),r={x:0,y:390,radius:c.radius,age:0,duration:c.duration,hits:c.hits,seed:.37};
  for(let i=0;i<(kind==='skill'?330:kind==='ultimate'?220:100);i++){
   const age=i/60;effect.tick(i?1/60:0);effect.begin();pool.begin();
   if(kind==='normal'){
    if(age<.7)pool.draw('blade',-130+age*220,50+age*530,43,age,Math.atan2(530,220)-Math.PI/2,1,.4);
    if(i===42)effect.hit(24,421,30);
   }else if(kind==='skill'){
    const p=plans.scythePose(age,4,-120,50,0,390);effect.spin(p.x,p.y,155,age,.37,p.opacity,r);
   }else if(age<r.duration){r.age=age;effect.reaping(r);}
   effect.end();pool.end();const snap=snapshot();
   if(kind==='ultimate'&&age<T.reapStart)assert.ok(!snap.sprites.some(s=>s.texture.includes('slash')),'cross-slash during windup');
   records.push({kind,age,...snap});
  }
  effect.destroy();
 }
 pool.begin();pool.end();assert.equal(snapshot().sprites.length,0,'pool not hidden');
 // Vortex splits around actors; deterministic rifts use both near and far planes.
 for(const kind of ['skill','ultimate']){const sprites=records.filter(r=>r.kind===kind).flatMap(r=>r.sprites);assert.ok(sprites.some(s=>s.belowMobs)&&sprites.some(s=>!s.belowMobs));}
 assert.ok(records.flatMap(r=>r.shaders).filter(s=>s.q[8]===5).every(s=>s.belowMobs));
 assert.ok(records.flatMap(r=>r.shaders).some(s=>s.q[8]===7));
 for(let i=0;i<=24;i++){const lateral=(i/12-1)*43,front=.72*(Math.sqrt(Math.max(0,1-(lateral/43)**2))-1)*43;assert.equal(plans.scytheBladeEntry(front,lateral,0,43,1),0);}
 const slash='assets/resources/fx/scythe_slash_v144.png';const oldSlash=cp.execFileSync('git',['show','ac3358f8:KingdomWatch/'+slash],{cwd:path.resolve(ROOT,'..'),maxBuffer:8e6});assert.ok(fs.readFileSync(path.join(ROOT,slash)).equals(oldSlash),'original rift changed');
 const fallback=new fx.ScytheVFX(root);fallback.shader.ready=false;fallback.domain.ready=false;fallback.atlas.choose=()=>false;
 for(let i=0;i<100;i++){fallback.begin();fallback.spin(0,300,155,i/30,.3,1,{});fallback.reaping({x:0,y:300,radius:320,age:i/30,duration:3.16,hits:9,seed:.3});fallback.end();}fallback.destroy();
 fs.writeFileSync(path.join(__dirname,'sprite-frames.json'),JSON.stringify(records));
 for(const file of ['ThunderLanceHero.ts','ThunderLanceAtlas.ts','ThunderLancePlans.ts']){
  const old=cp.execFileSync('git',['show','ac3358f8:KingdomWatch/assets/scripts/battle/'+file],{cwd:path.resolve(ROOT,'..'),encoding:'utf8'});
  assert.equal(read('assets/scripts/battle/'+file).replace(/\r\n/g,'\n'),old.replace(/\r\n/g,'\n'),'lance benchmark changed');}
 const result={status:'PASS',damage,levelsChecked:20,cosmeticFrames:records.length,firstSlashAt:T.reapStart,windupHasNoCrossedSlashes:true,
 fixedProjectilePool:40,noPerFrameNodes:true,fallbackFinite:true,splitDepthRendering:true,originalRiftTexturePreserved:true,arcColliderMatches25Samples:true,lanceArtPhysicsAndDamageUnchanged:true,lanceLayerKeptAboveMonsters:true,gameEngineBrowserRealBattleAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
