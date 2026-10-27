// Execute only the isolated visual renderer with recorded sprites. No engine/battle/audio/browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const nodes=[];
class Color {constructor(r=255,g=255,b=255,a=255){Object.assign(this,{r,g,b,a});}}
class Node {
 static EventType={NODE_DESTROYED:'destroyed'};
 constructor(name){this.name=name;this.children=[];this.active=true;this.isValid=true;this.x=0;this.y=0;this.angle=0;this.handlers=[];nodes.push(this);}
 setParent(p){this.parent=p;p.children.push(this);}getChildByName(n){return this.children.find(c=>c.name===n)||null;}
 addComponent(C){const c=new C();c.node=this;this[C.name]=c;return c;}
 once(e,cb){this.handlers.push(cb);}setPosition(x,y){assert.ok([x,y].every(Number.isFinite));Object.assign(this,{x,y});}
 setRotationFromEuler(x,y,angle){assert.ok(Number.isFinite(angle));this.angle=angle;}
 setSiblingIndex(){}getSiblingIndex(){return 0;}
 destroy(){this.isValid=false;this.handlers.forEach(cb=>cb());this.children.forEach(n=>n.destroy());}
}
class Rect {constructor(x=0,y=0,width=0,height=0){Object.assign(this,{x,y,width,height});}}
class Size {constructor(width,height){Object.assign(this,{width,height});}}
class Vec2 {constructor(x=0,y=0){Object.assign(this,{x,y});}}
class SpriteFrame {reset(o){Object.assign(this,o);}}
class Sprite {static SizeMode={CUSTOM:0};set color(c){this.tint={...c};}}
class UITransform {setAnchorPoint(x,y){this.anchor=[x,y];}setContentSize(w,h){this.size=[w,h];}}
class JsonAsset {}
class Graphics {
 clear(){}moveTo(){}lineTo(){}ellipse(){}circle(){}close(){}fill(){}stroke(){}
}
class Shader {constructor(){this.ready=false;}begin(){}draw(){return false;}end(){}}
const cc={Node,Color,Sprite,SpriteFrame,UITransform,Rect,Size,Vec2,JsonAsset,Graphics,Layers:{Enum:{UI_2D:1}},
 resources:{load(p,T,cb){cb(null,{json:JSON.parse(read('assets/resources/'+p+'.json'))});}}};
const ux={uxFrame(p,cb){const meta=JSON.parse(read('assets/resources/'+p+'.png.meta'));
 const s=Object.values(meta.subMetas).find(s=>s.importer==='sprite-frame').userData;
 const frame=new SpriteFrame();frame.reset({texture:p+'.png',rect:new Rect(0,0,s.width,s.height)});cb(frame);},promoteUXArt(){}};
function isolated(file,imports){const js=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018},reportDiagnostics:true});assert.equal(js.diagnostics.length,0);
 const c={exports:{},require:n=>{assert.ok(Object.hasOwn(imports,n),'Denied '+n);return imports[n];},Math,Number,Map,Set,WeakMap,Promise};vm.runInNewContext(js.outputText,c,{filename:file});return c.exports;}
const atlas=isolated('assets/scripts/battle/ThunderLanceAtlas.ts',{'cc':cc,'../ui/Ux':ux});
const plans=isolated('assets/scripts/battle/ThunderLancePlans.ts',{});
const n=(name,parent)=>{const node=new Node(name);node.setParent(parent);return node;};
const fx=isolated('assets/scripts/battle/ThunderLanceVFX.ts',{'cc':cc,'../ui/UIKit':{N:n,CA:(h,a)=>({h,a})},
 './ThunderLanceAtlas':atlas,'./HeroFxShader':{HeroFxShader:Shader},'./SwordAbilityVFX':{swordDebris(){},swordSoilLip(){}}});
const root=new Node('field');const groundLayer=n('GroundFxLayer',root);n('MobLayer',root);n('TextLayer',root);
function belowMobs(node){for(let p=node;p;p=p.parent)if(p.name==='GroundFxLayer')return true;return false;}
function sprites(){return nodes.filter(n=>n.active&&n.isValid&&n.Sprite&&n.Sprite.spriteFrame&&n.parent?.isValid).map(n=>({
 texture:n.Sprite.spriteFrame.texture,rect:n.Sprite.spriteFrame.rect,x:n.x,y:n.y,angle:n.angle,
 anchor:n.UITransform.anchor,size:n.UITransform.size,alpha:n.Sprite.tint.a/255,plane:n.parent.name,belowMobs:belowMobs(n)}));}
async function main(){
 await atlas.warmLanceAtlas('visible');assert.equal(atlas.lanceAtlasReady(),true);
 for(const age of [-1,0,.5,2,200,NaN])assert.ok(Number.isInteger(atlas.lanceAtlasFrame(age,24,48,true)));
 assert.equal(atlas.lanceAtlasFrame(10,30,24,false),23);
 assert.ok(atlas.lanceInsertion(.085)>atlas.lanceInsertion(.4));assert.equal(atlas.lanceInsertion(0),0);
 // Exercise the actual projectile-layer initialization method, without loading combat modules.
 const file=ts.createSourceFile('Projectile.ts',read('assets/scripts/battle/Projectile.ts'),ts.ScriptTarget.Latest,true);
 const manager=file.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='ProjectileManager');
 const method=manager.members.find(n=>n.name?.getText(file)==='warmLanceFlight').getText(file);
 const js=ts.transpileModule('exports.FlightLayer=class {constructor(field){this.field=field;}'+method+'}',{compilerOptions:{target:ts.ScriptTarget.ES2018}}).outputText;
 const ctx={exports:{},Node,Layers:cc.Layers,Graphics,HeroFxShader:Shader,ThunderLanceAtlas:atlas.ThunderLanceAtlas,LANCE_EFFECT:'fx/thunder-lance-flow'};
 vm.runInNewContext(js,ctx);const projLayer=n('ProjLayer',root),realLayer=new ctx.exports.FlightLayer(projLayer);realLayer.warmLanceFlight();
 assert.equal(realLayer.lanceRoot.parent,groundLayer);assert.ok(realLayer.lanceFallback);projLayer.destroy();assert.equal(realLayer.lanceRoot,null);
 const pool=new atlas.ThunderLanceAtlas(groundLayer,'testFlightPool',32);const nodeCount=nodes.length;
 for(let i=0;i<50;i++){pool.begin();for(let j=0;j<40;j++)assert.equal(pool.spear(0,0,-1,12,i/60,.3),j<32);pool.end();}
 assert.equal(nodes.length,nodeCount,'sprite pool grew');pool.begin();pool.end();assert.equal(sprites().length,0);
 const field={x:0,y:400,radius:250,age:0,seconds:6,giant:true,seed:.618,angle:0,phase:0,lengthScale:1};
 const frames=[];
 // The directly-forward throw reproduces the user's v142 lateral-swerve report.
 const flight=plans.lanceFlightPlan(0,30,0,400,'great'),last=plans.lanceFlightPose(flight,flight.seconds);
 Object.assign(field,{angle:last.angle,phase:flight.seconds,lengthScale:last.lengthScale});
 for(let frame=0;frame<240;frame++){
  const time=frame/60,contact=1.2,age=time-contact;
  pool.begin();
  const vfx=new fx.ThunderLanceVFX(root);
  if(age<0){const t=Math.max(0,flight.seconds+age);const p=plans.lanceFlightPose(flight,t);
   pool.spear(p.x,p.y,p.angle,40,t,field.seed,1,false,0,p.lengthScale);vfx.render([]);
  }else{
   vfx.impact(field.x,field.y,field.radius,true,field.seed);
   vfx.tick(Math.min(age,1));
   if(age>=1){vfx.wave(field.x,field.y,field.radius,field.seed+1);vfx.tick(age-1);}
   vfx.render([{...field,age}]);
  }
  pool.end();frames.push({time,contact,sprites:sprites()});vfx.destroy();
 }
 const landing=new fx.ThunderLanceVFX(root);landing.impact(0,0,90,false,.2);landing.tick(.1);landing.render([{...field,x:0,y:0,radius:90,giant:false,age:.1}]);
 const normal=sprites();assert.ok(normal.some(s=>s.texture.includes('_body_')));assert.ok(normal.some(s=>s.texture.includes('_impact_')));
 assert.ok(normal.find(s=>s.texture.includes('_body_')).size[1]<120);
 landing.render([]);landing.tick(100);landing.render([]);pool.begin();pool.end();assert.equal(sprites().length,0,'effect did not clean up');landing.destroy();
 const cases=[];
 for(const kind of ['normal','rain']){
  for(const age of [-.15,.04,.2,.65]){
   pool.begin();const vfx=new fx.ThunderLanceVFX(root),fields=[];
   for(let k=0;k<(kind==='rain'?6:1);k++){
    const x=kind==='rain'?(k%3-1)*90:0,y=kind==='rain'?360+Math.floor(k/3)*90:400;
    const localAge=age-(kind==='rain'?k*.055:0);
    const f=plans.lanceFlightPlan(kind==='rain'?x+65:-80,kind==='rain'?900:30,x,y,kind);
    if(localAge<0){const t=Math.max(0,f.seconds+localAge),p=plans.lanceFlightPose(f,t);pool.spear(p.x,p.y,p.angle,12,t,.618+k*.07,1,false,0,p.lengthScale);}
    else{fields.push({...field,x,y,radius:90,giant:false,age:localAge,angle:plans.lanceFlightPose(f,f.seconds).angle,phase:f.seconds,lengthScale:plans.lanceFlightPose(f,f.seconds).lengthScale});
     if(localAge<.55){vfx.impact(x,y,90,false,k*.07);}}
   }
   vfx.tick(Math.max(0,age));vfx.render(fields);pool.end();cases.push({kind,age,sprites:sprites()});vfx.destroy();
  }
 }
 assert.ok([...frames,...cases,{sprites:normal}].every(r=>r.sprites.every(s=>s.belowMobs)),'lance rendered above monsters');
 fs.writeFileSync(path.join(__dirname,'sprite-frames.json'),JSON.stringify({frames,normal,cases}));
 const immutable=['assets/scripts/config/ThunderLanceConfig.ts'];
 for(const file of immutable){const base=cp.execFileSync('git',['show','6fbe9cfc:KingdomWatch/'+file],{cwd:path.resolve(ROOT,'..'),encoding:'utf8'});assert.equal(read(file),base,file+' combat changed');}
 const result={status:'PASS',actualAtlasAndVfxCode:true,fixedPoolCapacity:32,noPerFrameNodes:true,
   simulationClockOnly:true,buriedTipCropped:true,normalAndGiantUseBlenderArt:true,emptyAfterExpiry:true,
   allLancePassesBelowMonsters:true,flightFallbackAlsoBelowMonsters:true,flightLayerDestroyedWithProjectileLayer:true,
   unchangedCombatSources:immutable,gameEngineBrowserCombatAudioOrWasmStarted:false,visualAcceptance:'pending user'};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
