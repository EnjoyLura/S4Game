/** Isolated cosmetic renderer + static source protection. No engine, actors or battle execution. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const ROOT=path.resolve(__dirname,'../..'),BASE='a1735be0';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8').replace(/\r\n/g,'\n');
const prior=p=>cp.execFileSync('git',['show',BASE+':KingdomWatch/'+p],{cwd:ROOT,encoding:'utf8'}).replace(/\r\n/g,'\n');
function isolated(source,imports){const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});assert.equal(out.diagnostics.length,0);
 const ctx={exports:{},require:n=>{assert.ok(Object.hasOwn(imports,n),'Unexpected import '+n);return imports[n];},Math,Number,Map,WeakMap,Set,Promise};vm.runInNewContext(out.outputText,ctx);return ctx.exports;}
const heroFile='assets/scripts/battle/WindNinjaHeroes.ts';
assert.equal(read(heroFile),prior(heroFile).replace('new WindNinjaVFX(this.node.parent!.parent || this.node.parent!)',"new WindNinjaVFX(this.node.parent!.parent || this.node.parent!, this.id === 'wind')"));
const allowed=['assets/scripts/battle/WindNinjaHeroes.ts','assets/scripts/battle/WindNinjaVFX.ts','assets/scripts/ui/BattleEntryWarmup.ts'];
const changed=cp.execFileSync('git',['diff','--name-only',BASE,'--','assets'],{cwd:ROOT,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).map(p=>p.replace(/^KingdomWatch\//,''));
assert.deepEqual(changed.sort(),allowed.sort());
assert.ok(read('assets/scripts/ui/BattleEntryWarmup.ts').includes("if (heroIds.includes('wind')) jobs.push(warmWindVideo(priority))"));
class Color{constructor(r=255,g=255,b=255,a=255){Object.assign(this,{r,g,b,a});}static fromHEX(c,s){c.hex=s;return c;}}
class UI{setAnchorPoint(x,y){this.anchor=[x,y];}setContentSize(w,h){this.size=[w,h];}}
class Sprite{static SizeMode={CUSTOM:1};}
class Frame{reset(v){Object.assign(this,v);}destroy(){this.destroyed=true;}}
class Node{
 static EventType={NODE_DESTROYED:'destroy'};
 constructor(name){this.name=name;this.children=[];this.components=[];this.isValid=true;this.active=true;this.callbacks=[];}
 setParent(parent){this.parent=parent;parent.children.push(this);}
 addComponent(Type){const c=new Type();c.node=this;this.components.push(c);return c;}
 setPosition(...p){assert.ok(p.every(Number.isFinite));this.position=p;}
 once(event,callback){this.callbacks.push(callback);}
 getChildByName(){return null;}
 setSiblingIndex(){}
 destroy(){this.callbacks.forEach(cb=>cb());this.children.forEach(n=>n.destroy());this.isValid=false;}
}
const cc={Node,Color,Sprite,SpriteFrame:Frame,UITransform:UI,JsonAsset:class{},Layers:{Enum:{UI_2D:1}},
 Rect:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}},Size:class{},Vec2:class{}};
function harness(fail=false,defer=false){
 let imageLoads=0,jsonLoads=0;const queued=[];
 const complete=cb=>defer?queued.push(cb):queueMicrotask(cb);
 const ux={uxFrame:(p,cb)=>{imageLoads++;complete(()=>cb(fail?null:{rect:{x:0,y:0,width:4096,height:4096},texture:{path:p}}));},promoteUXArt(){}};
 const resources={load:(p,t,cb)=>{jsonLoads++;complete(()=>cb(fail?Error('unavailable'):null,fail?null:{json:JSON.parse(read('assets/resources/'+p+'.json'))}));}};
 const mod=isolated(read('assets/scripts/battle/WindVideoVFX.ts'),{cc:{...cc,resources},'../ui/Ux':ux});
 return {mod,counts:()=>[imageLoads,jsonLoads],flush:()=>{while(queued.length)queued.shift()();}};
}
async function settle(){for(let i=0;i<8;i++)await Promise.resolve();}
async function main(){
 const h=harness();await Promise.all([h.mod.warmWindVideo('next'),h.mod.warmWindVideo('visible')]);assert.deepEqual(h.counts(),[2,2]);
 const root=new Node('root'),fx=new h.mod.WindVideoVFX(root);await settle();assert.deepEqual(h.counts(),[2,2]);
 let frameCases=0;
 for(const kind of ['eye','tornado']){
  const m=JSON.parse(read('assets/resources/fx/wind_'+kind+'_video_v129.frames.json'));
  for(let n=0;n<300;n++){const age=n/60;assert.equal(h.mod.windVideoFrame(age,m.fps,m.playbackSpeed,m.frameCount),Math.floor(age*m.fps*m.playbackSpeed+1e-7)%m.frameCount);frameCases++;}
  assert.equal(h.mod.windVideoFrame(NaN,m.fps,m.playbackSpeed,m.frameCount),0);
  const area={kind,x:33,y:71,radius:120,age:.4};fx.begin();assert.equal(fx.area(area,.8),true);fx.end();
  const slot=fx.root.children[0];assert.deepEqual(slot.position,[33,71,0]);const ui=slot.components[0],sprite=slot.components[1];
  assert.ok(Math.abs(ui.size[0]/ui.size[1]-m.cellSize[0]/m.cellSize[1])<1e-9);
  assert.equal(sprite.color.a,204);assert.equal(sprite.sizeMode,1);assert.equal(sprite.trim,false);
  const frame=sprite.spriteFrame;fx.begin();fx.area(area,.8);fx.end();assert.equal(sprite.spriteFrame,frame,'Pause must not advance frames');
 }
 fx.begin();for(let n=0;n<9;n++)assert.equal(fx.area({kind:'tornado',x:n,y:0,radius:120,age:.4},1),n<8);fx.end();assert.equal(fx.root.children.filter(n=>n.active).length,8);
 fx.begin();fx.end();assert.equal(fx.root.children.filter(n=>n.active).length,0);
 root.destroy();assert.equal(fx.slots.length,0);assert.equal(fx.clips.size,0);
 // Destruction while the shared asynchronous resource work is still pending.
 const late=harness(false,true),lateRoot=new Node('late'),lateFx=new late.mod.WindVideoVFX(lateRoot);
 const pendingArea={kind:'eye',x:0,y:0,radius:120,age:0};lateFx.begin();assert.equal(lateFx.area(pendingArea,1),false);
 late.flush();await settle();assert.equal(lateFx.area(pendingArea,1),false,'A cast cannot switch visuals midway');
 assert.equal(lateFx.area({...pendingArea},1),true);lateRoot.destroy();
 const dead=harness(false,true),deadRoot=new Node('dead'),deadFx=new dead.mod.WindVideoVFX(deadRoot);deadRoot.destroy();dead.flush();await settle();assert.equal(deadFx.clips.size,0);
 const failed=harness(true);await failed.mod.warmWindVideo();const failRoot=new Node('failure'),failFx=new failed.mod.WindVideoVFX(failRoot);await settle();
 assert.equal(failFx.area(pendingArea,1),false);failRoot.destroy();
 // The complete old renderer remains identical when video mode is not selected (ninja and fallback).
 const draws=[];class Graphics{constructor(){this.log=[];draws.push(this);}clear(){this.log=[];}}
 for(const name of ['moveTo','lineTo','quadraticCurveTo','bezierCurveTo','ellipse','circle','close','fill','stroke'])Graphics.prototype[name]=function(...v){this.log.push([name,...v]);};
 const shaders=[];class Shader{constructor(){this.ready=true;this.log=[];shaders.push(this);}begin(){this.log=[];}draw(...q){this.log.push(q);return true;}end(){}}
 const fakeVideo={WindVideoVFX:class{constructor(){throw Error('Ninja must not create/download video');}}};
 const imports={cc:{...cc,Graphics},'./HeroFxShader':{HeroFxShader:Shader},'./WindVideoVFX':fakeVideo};
 const old=isolated(prior('assets/scripts/battle/WindNinjaVFX.ts'),imports),current=isolated(read('assets/scripts/battle/WindNinjaVFX.ts'),imports);
 const a=new old.WindNinjaVFX(new Node('old')),b=new current.WindNinjaVFX(new Node('new'));let identicalDraws=0;
 for(let k=0;k<120;k++)for(const kind of ['eye','tornado','spiral']){
  const area={kind,x:40,y:100,radius:120,age:k/60,duration:5};a.begin();b.begin();a.area(area);b.area(area);a.end();b.end();
  assert.deepEqual(shaders[0].log,shaders[1].log);assert.deepEqual(draws[0].log,draws[1].log);identicalDraws++;
 }
 const report={status:'PASS',baseline:BASE,changedExistingAssets:changed,gameplayPreservedExceptRenderingConstructor:true,
  shaderAndConfigAssetsUnchanged:true,frameCases,identicalNinjaAndFallbackDrawings:identicalDraws,sharedImageDownloads:2,sharedManifestDownloads:2,
  poolLimit:8,pauseAspectCleanupLateLoadFailureChecks:true,gameEngineBrowserCombatAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
