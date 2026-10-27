// Only isolated cosmetic drawing and pure placement. No battle actors or game execution.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'../..'),REC=path.join(ROOT,'local/art-archive/lance-tips-v140/review'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function isolated(file,imports={}){const out=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018},reportDiagnostics:true});assert.equal(out.diagnostics.length,0);
 const c={exports:{},require:n=>{assert.ok(Object.hasOwn(imports,n),'Denied import '+n);return imports[n];},Math,Number,Map,Set};vm.runInNewContext(out.outputText,c,{filename:file});return c.exports;}
class G{
 constructor(){this.commands=[];this.path='';this.lineWidth=1;}
 clear(){this.commands=[];this.path='';} check(...v){assert.ok(v.every(Number.isFinite));}
 moveTo(x,y){this.check(x,y);this.path=`M${x},${y}`;} lineTo(x,y){this.check(x,y);this.path+=`L${x},${y}`;}
 quadraticCurveTo(a,b,x,y){this.check(a,b,x,y);this.path+=`Q${a},${b} ${x},${y}`;}
 ellipse(x,y,a,b){this.check(x,y,a,b);this.path=`M${x-a},${y}a${a},${b} 0 1,0 ${a*2},0a${a},${b} 0 1,0 ${-a*2},0`;}
 circle(x,y,r){this.ellipse(x,y,r,r);} close(){this.path+='Z';} fill(){this.add('fill',this.fillColor);} stroke(){this.add('stroke',this.strokeColor);}
 add(kind,c){assert.ok(c&&Number.isFinite(c.a)&&c.a>=0&&c.a<=1);this.commands.push(`<path d="${this.path}" ${kind}="${c.hex}" ${kind}-opacity="${c.a}" ${kind==='stroke'?`fill="none" stroke-width="${this.lineWidth}"`:''}/>`);}
}
const instances=[],drawings=[];
class Shader{
 constructor(p,n,capacity){this.capacity=capacity;this.quads=[];this.ready=true;instances.push(this);}
 begin(){this.quads=[];} draw(...q){assert.ok(q.every(Number.isFinite));if(!this.ready||this.quads.length>=this.capacity)return false;this.quads.push(q);return true;} end(){}
}
const ground={name:'GroundFxLayer',isValid:true},parent={getChildByName:n=>n==='GroundFxLayer'?ground:null};
const N=(name,p)=>({name,parent:p,isValid:true,addComponent:()=>{const g=new G();drawings.push(g);return g;},setSiblingIndex(){},destroy(){this.isValid=false;}});
const imports={'cc':{Graphics:G},'../ui/UIKit':{CA:(hex,a)=>({hex,a}),N},'./HeroFxShader':{HeroFxShader:Shader}};



const plans=isolated('assets/scripts/battle/ThunderLancePlans.ts');
const layout=isolated('assets/scripts/ui/BattleTipLayout.ts');
const config=isolated('assets/scripts/config/ThunderLanceConfig.ts');
const art=isolated('assets/scripts/battle/SwordAbilityVFX.ts',imports);
const fx=isolated('assets/scripts/battle/ThunderLanceVFX.ts',{...imports,'./SwordAbilityVFX':art});
let trajectoryCases=0,poseSamples=0,maxAngleStep=0;
for(const kind of ['normal','rain','great'])for(const sx of [-300,0,300])for(const tx of [-300,0,300])for(const ty of [50,300,700]){
 const sy=kind==='rain'?850:-50,p=plans.lanceFlightPlan(sx,sy,tx,ty,kind),end=plans.lanceFlightPose(p,p.seconds);
 assert.ok(p.seconds>0&&p.seconds<3);assert.equal(end.x,tx);assert.equal(end.y,ty);assert.ok(end.vy<0);assert.equal(end.angle,Math.atan2(end.vy,end.vx));
 assert.ok(!plans.lanceFlightPose(p,p.seconds-1e-7).arrived&&end.arrived);
 let prior=null,high=-Infinity;
 for(let i=0;i<=240;i++){
  const t=p.seconds*i/240,q=plans.lanceFlightPose(p,t);poseSamples++;
  assert.ok([q.x,q.y,q.angle,q.vx,q.vy].every(Number.isFinite));high=Math.max(high,q.y);
  if(prior){const d=Math.abs(Math.atan2(Math.sin(q.angle-prior.angle),Math.cos(q.angle-prior.angle)));maxAngleStep=Math.max(maxAngleStep,d);assert.ok(d<.35,'No abrupt apex / landing flip');}
  const epsilon=.00001;if(t>epsilon&&t<p.seconds-epsilon){
   const a=plans.lanceFlightPose(p,t-epsilon),b=plans.lanceFlightPose(p,t+epsilon);
   assert.ok(Math.abs((b.x-a.x)/(2*epsilon)-q.vx)<1e-5);assert.ok(Math.abs((b.y-a.y)/(2*epsilon)-q.vy)<1e-4);
   assert.ok(Math.abs((b.vy-a.vy)/(2*epsilon)+p.gravity)<1e-5);
  }prior=q;
 }
 if(kind!=='rain')assert.ok(high>Math.max(sy,ty)+65);trajectoryCases++;
}
// Only the actual UI-only method is extracted. No Panels imports, Hero, Monster or game code runs.
const source=read('assets/scripts/ui/Panels.ts'),ast=ts.createSourceFile('Panels.ts',source,ts.ScriptTarget.Latest,true);
let method;function visit(n){if(ts.isMethodDeclaration(n)&&n.name.getText(ast)==='showTips')method=n;ts.forEachChild(n,visit);}visit(ast);assert.ok(method);
const js=ts.transpileModule('function '+method.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2018}}).outputText;
const cfg={...config,...isolated('assets/scripts/config/MagicBowConfig.ts'),...isolated('assets/scripts/config/ScytheConfig.ts')};
let uiLabels=[],uiPanels=[];const finite=(...xs)=>assert.ok(xs.every(Number.isFinite),'UI coordinates must be finite');
const node=(name,p,x=0,y=0,w=0,h=0)=>{finite(x,y,w,h);return {name,on(){},addComponent:()=>new G()};};
const context={...cfg,...layout,Math,Number,Graphics:G,Node:{EventType:{TOUCH_END:'touch'}},CA:(hex,a)=>({hex,a}),N:node,
 LO:{half:667},HERO_Y:-545,WYB:(b,h)=>-context.LO.half+b+h/2,WX:(x,w)=>x-375+w/2,
 voltShockAmp:()=>0,voltShockDuration:()=>3,targetLabel:()=>'',
 gpanel:(p,x,y,w,h)=>{finite(x,y,w,h);uiPanels.push({x,y,w,h});return {};},
 artSprite:(p,x,y,w,h)=>finite(x,y,w,h),label:(p,x,y,text,style)=>{finite(x,y);uiLabels.push({x,y,text,style});}};
vm.runInNewContext(js+';this.showTips=showTips;',context,{filename:'isolated-actual-showTips.ts'});
const tipCases=[];
for(const half of [500,667,850])for(const id of ['lance','arcane','scythe'])for(const kind of ['atk','skill','ult'])for(const x of [-270,-90,90,270]){
 context.LO.half=half;context.HERO_Y=-half+122;uiPanels=[];uiLabels=[];
 const hero={id,x,stats:{range:1100,skillRange:1150,skillLv:1,ultLv:1,normalMul:1,skillRangeMul:1,aspd:1,critRate:.1},effAtk:80,
  skillCdTotal:12,chargeGoal:80,charge:20,abilityDamage:mul=>100*mul,targetLayer:()=> 'all'};
 context.showTips.call({begin(){},closeAll(){},modalRoot:{}},kind,hero,{maxHp:100},3);
 assert.equal(uiPanels.length,1);assert.equal(uiLabels.length,14);assert.ok(uiLabels.every(l=>typeof l.text==='string'&&!/NaN|undefined/.test(l.text)));
 const panel=uiPanels[0];assert.ok(panel.x-panel.w/2>=-367&&panel.x+panel.w/2<=367&&panel.y-panel.h/2>=-half+8&&panel.y+panel.h/2<=half-8);
 if(half===667&&x===-90)tipCases.push({id,kind,half,panel,labels:uiLabels});
}
// Regression demonstration: old method puts the same content at invalid coordinates.
const old=cp.execFileSync('git',['show','9c25c3c4:KingdomWatch/assets/scripts/ui/Panels.ts'],{cwd:path.dirname(ROOT),encoding:'utf8'});
assert.ok(old.includes('Math.min(375 - w / 2 - 8, px)'));assert.ok(!method.getText(ast).includes('Math.min(375 - w / 2 - 8, px)'));
const oldAst=ts.createSourceFile('old-Panels.ts',old,ts.ScriptTarget.Latest,true);let oldMethod;
function visitOld(n){if(ts.isMethodDeclaration(n)&&n.name.getText(oldAst)==='showTips')oldMethod=n;ts.forEachChild(n,visitOld);}visitOld(oldAst);
vm.runInNewContext(ts.transpileModule('function '+oldMethod.getText(oldAst),{compilerOptions:{target:ts.ScriptTarget.ES2018}}).outputText+';this.showOldTips=showTips;',context);
let regressionFailures=0;
for(const id of ['lance','arcane','scythe'])for(const kind of ['atk','skill','ult']){
 const hero={id,x:0,stats:{range:1100,skillRange:1150,skillLv:1,ultLv:1,normalMul:1,skillRangeMul:1,aspd:1,critRate:.1},effAtk:80,
  skillCdTotal:12,chargeGoal:80,charge:20,abilityDamage:mul=>100*mul,targetLayer:()=> 'all'};
 assert.throws(()=>context.showOldTips.call({begin(){},closeAll(){},modalRoot:{}},kind,hero,{maxHp:100},0),/UI coordinates must be finite/);regressionFailures++;
}
const projection=read('assets/scripts/battle/Projectile.ts'),hero=read('assets/scripts/battle/ThunderLanceHero.ts');
assert.ok(projection.includes('const pose=lanceFlightPose(sp.lanceFlight,a.age)')&&!projection.includes('4*arc.height'));
assert.ok(hero.includes('angle=lanceFlightPose(flight,flight.seconds).angle')&&hero.includes('phase:flight.seconds'));
assert.ok(!/setTimeout|Date\.now|performance\.now/.test(hero));
for(const rel of ['battle/MagicBowHero.ts','battle/ScytheHero.ts','battle/SpaceSwordHeroes.ts','battle/WindNinjaHeroes.ts','battle/Monster.ts','config/ThunderLanceConfig.ts']){
 const before=cp.execFileSync('git',['show','9c25c3c4:KingdomWatch/assets/scripts/'+rel],{cwd:path.dirname(ROOT),encoding:'utf8'}).replace(/\r\n/g,'\n');assert.equal(read('assets/scripts/'+rel).replace(/\r\n/g,'\n'),before);
}
async function layer(g,name){await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="940"><g transform="translate(375,840) scale(1,-1)">${g?.commands.join('')||''}</g></svg>`)).png().toFile(path.join(REC,name));return name;}
async function main(){fs.mkdirSync(REC,{recursive:true});const frames=[],trajectories=[];
 for(const[kind,count]of [['normal',72],['rain',60],['ultimate',96]]){
  const p=plans.lanceFlightPlan(kind==='rain'?200:-190,kind==='rain'?800:-30,120,330,kind==='ultimate'?'great':kind);
  trajectories.push({kind,...p});const f=new fx.ThunderLanceVFX(parent),flight=new Shader(null,'flight',1),fields=[];let impacted=false;
  for(let i=0;i<count;i++){
   const age=i/30;f.tick(i?1/30:0);flight.begin();fields.length=0;const q=plans.lanceFlightPose(p,age),giant=kind==='ultimate';
   if(!q.arrived)fx.drawLanceFlight(flight,new G(),q.x,q.y,q.angle,giant?35:9,age,.37);
   else{const plantedAge=age-p.seconds;fields.push({x:p.tx,y:p.ty,angle:q.angle,radius:giant?250:90,giant,age:plantedAge,seconds:giant?6:4.5,seed:.37,phase:p.seconds});
    if(!impacted){f.impact(p.tx,p.ty,giant?250:90,giant,.37);impacted=true;}}
   f.render(fields);const name=kind+'-'+i+'.png';frames.push({kind,age,ground:f.ground.quads,air:[...f.spears.quads,...flight.quads],
    groundGraphics:await layer(f.dirt,'ground-'+name),graphics:await layer(f.g,name),frontGraphics:await layer(f.front,'front-'+name)});
  }f.destroy();
 }
 let anchors=0;
 for(const angle of [-2.4,-1.7,-1.2,-.7])for(const size of [9,35])for(const age of [0,.04,.12,1]){
  const shader=new Shader(null,'s',1);fx.drawLanceFlight(shader,new G(),20,30,angle,size,age,.37,1,true,1.2);
  const q=shader.quads[0],length=size*8,buried=length*q[10];assert.ok(Math.abs(q[0]+Math.cos(angle)*(length*.5-buried)-20)<1e-6);
  assert.ok(Math.abs(q[1]+Math.sin(angle)*(length*.5-buried)-30)<1e-6);assert.ok(Math.abs(q[5]-age-1.2)<1e-6);anchors++;
 }
 const fallback=new Shader(null,'s',1);fallback.ready=false;const ink=new G();fx.drawLanceFlight(fallback,ink,0,100,-1.5,35,.4,.1,1,true);assert.ok(ink.commands.length>0);
 fs.writeFileSync(path.join(REC,'recipes.json'),JSON.stringify({frames,width:750,height:940,bottom:-100}));
 fs.writeFileSync(path.join(__dirname,'tips-review.json'),JSON.stringify(tipCases,null,2)+'\n');
 fs.writeFileSync(path.join(__dirname,'trajectory-review.json'),JSON.stringify(trajectories,null,2)+'\n');
 const report={status:'PASS',trajectoryCases,poseSamples,maxAngleStepRadians:maxAngleStep,tooltipCases:108,previousVersionTooltipFailures:regressionFailures,tipAnchors:anchors,
  actualTooltipMethod:true,cosmeticFrames:frames.length,fallbackGeometry:true,oldHeroImplementationsPreserved:true,gameEngineBrowserBattleAudioOrWasmStarted:false};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}main().catch(e=>{console.error(e);process.exitCode=1;});
